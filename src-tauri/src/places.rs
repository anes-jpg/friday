//! Bounded, cancellable native adapters for public place and photo metadata.
use crate::memory::db::Database;
use serde::{Deserialize,Serialize};
use serde_json::Value;
use std::{collections::HashMap,sync::{Arc,Mutex},time::Duration};
use tokio::sync::{Notify,Semaphore};
use std::sync::atomic::{AtomicBool,Ordering};
use tauri::State;

#[derive(Clone,Serialize,Deserialize)]
pub struct PlaceData {pub data:Value,pub source:String,pub fetched_at:i64,pub cached:bool,pub stale:bool}
struct RequestStop {cancelled:AtomicBool,signal:Notify}
pub struct NativePlaceService {
    client:reqwest::Client, db:Arc<Mutex<Database>>, requests:Mutex<HashMap<String,Arc<RequestStop>>>,
    requests_limit:Semaphore, photos_limit:Semaphore,
}
fn validate_url(raw:&str)->Result<reqwest::Url,String> {
    let url=reqwest::Url::parse(raw).map_err(|e|e.to_string())?;
    if url.scheme()!="https" || !url.username().is_empty() || url.password().is_some() || url.port().is_some_and(|port|port!=443) {return Err("Place metadata must use an approved HTTPS service".into());}
    let valid=match url.host_str().unwrap_or("") {
        "nominatim.openstreetmap.org"=>["/search","/lookup"].contains(&url.path()),
        "photon.komoot.io"=>url.path()=="/api/",
        "overpass-api.de"=>url.path()=="/api/interpreter",
        "www.openstreetmap.org"=>url.path().starts_with("/api/0.6/") && url.path().ends_with(".json"),
        "commons.wikimedia.org"|"www.wikidata.org"=>url.path()=="/w/api.php",
        _=>false,
    };
    if !valid {return Err("Place metadata service or endpoint is not supported".into());}
    Ok(url)
}
impl NativePlaceService {
    pub fn new(db:Arc<Mutex<Database>>)->Self {
        let client=reqwest::Client::builder().timeout(Duration::from_secs(12)).connect_timeout(Duration::from_secs(3)).redirect(reqwest::redirect::Policy::none()).user_agent("FRIDAY/1.0 local-desktop-place-browser").build().unwrap_or_default();
        Self {client,db,requests:Mutex::new(HashMap::new()),requests_limit:Semaphore::new(4),photos_limit:Semaphore::new(2)}
    }
    pub fn cancel(&self,id:&str)->Result<(),String> {
        if let Some(request)=self.requests.lock().map_err(|e|e.to_string())?.get(id) {request.cancelled.store(true,Ordering::Release);request.signal.notify_one();}
        Ok(())
    }
    async fn fetch(&self,id:String,raw:String,body:Option<String>)->Result<PlaceData,String> {
        let url=validate_url(&raw)?;
        if raw.len()>8000 || body.as_ref().is_some_and(|body|body.len()>20000) {return Err("Place request exceeds its size limit".into());}
        if body.is_some() && url.host_str()!=Some("overpass-api.de") {return Err("Only nearby Overpass queries may use a request body".into());}
        let key=format!("{raw}\n{}",body.as_deref().unwrap_or(""));
        let cached=self.db.lock().map_err(|e|e.to_string())?.place_cache_get(&key).map_err(|e|e.to_string())?;
        let freshness=if url.path().contains("search") || url.host_str()==Some("photon.komoot.io") || body.is_some() {30*60_000} else {24*60*60_000};
        if let Some(cached)=&cached {if crate::memory::runs::now_ms()-cached.fetched_at<freshness {let mut cached=cached.clone();cached.cached=true;return Ok(cached);}}
        let stop=Arc::new(RequestStop {cancelled:AtomicBool::new(false),signal:Notify::new()});
        {let mut requests=self.requests.lock().map_err(|e|e.to_string())?;if requests.contains_key(&id) {return Err("Duplicate place request ID".into());}requests.insert(id.clone(),stop.clone());}
        let result=tokio::select! {biased;
            _=stop.signal.notified()=>Err("Place request cancelled".into()),
            result=async {
                let _permit=self.requests_limit.acquire().await.map_err(|e|e.to_string())?;
                let _photo=if [Some("commons.wikimedia.org"),Some("www.wikidata.org")].contains(&url.host_str()) {Some(self.photos_limit.acquire().await.map_err(|e|e.to_string())?)} else {None};
                let request=if let Some(body)=body {self.client.post(url.clone()).form(&[("data",body)])} else {self.client.get(url.clone())};
                let mut response=request.send().await.map_err(|e|format!("Place service is unavailable: {e}"))?.error_for_status().map_err(|e|format!("Place service failed: {e}"))?;
                if response.content_length().is_some_and(|length|length>8*1024*1024) {return Err("Place response exceeds 8 MB".into());}
                let mut bytes=Vec::new();
                while let Some(chunk)=response.chunk().await.map_err(|e|e.to_string())? {if bytes.len()+chunk.len()>8*1024*1024 {return Err("Place response exceeds 8 MB".into());}bytes.extend_from_slice(&chunk);}
                let data:Value=serde_json::from_slice(&bytes).map_err(|e|format!("Invalid place response: {e}"))?;
                if data.get("error").is_some() || data.get("remark").is_some() {return Err("The place service could not complete this request".into());}
                let result=PlaceData {data,source:url.host_str().unwrap_or("Place service").into(),fetched_at:crate::memory::runs::now_ms(),cached:false,stale:false};
                self.db.lock().map_err(|e|e.to_string())?.place_cache_put(&key,&result).map_err(|e|e.to_string())?;
                Ok(result)
            }=>result,
        };
        self.requests.lock().map_err(|e|e.to_string())?.remove(&id);
        if stop.cancelled.load(Ordering::Acquire) {return Err("Place request cancelled".into());}
        match result {Ok(result)=>Ok(result),Err(error)=>if let Some(mut cached)=cached {cached.cached=true;cached.stale=true;Ok(cached)} else {Err(error)}}
    }
}
#[tauri::command]
pub async fn get_place_data(request_id:String,url:String,body:Option<String>,state:State<'_,crate::AppState>)->Result<PlaceData,String> {state.places.fetch(request_id,url,body).await}
#[tauri::command]
pub fn cancel_place_request(request_id:String,state:State<'_,crate::AppState>)->Result<(),String> {state.places.cancel(&request_id)}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn metadata_adapters_reject_unapproved_destinations() {
        assert!(validate_url("https://nominatim.openstreetmap.org/search?q=Alger").is_ok());
        assert!(validate_url("https://commons.wikimedia.org/w/api.php?action=query").is_ok());
        assert!(validate_url("http://nominatim.openstreetmap.org/search").is_err());
        assert!(validate_url("https://evil.test/search").is_err());
        assert!(validate_url("https://user:secret@nominatim.openstreetmap.org/search").is_err());
    }
}
