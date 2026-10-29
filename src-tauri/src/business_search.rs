//! Explicit, read-only capture of a visible Google research window. No paid API.
use serde::{Deserialize, Serialize};
use std::{sync::{Arc, Mutex}, time::Duration};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, webview::NewWindowResponse};

const LABEL: &str = "business-search-";
const CAPTURE: &str = include_str!("business_search_capture.js");

fn allowed_url(url: &reqwest::Url) -> bool {
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some()
        || url.port().is_some_and(|port| port != 443) { return false; }
    match url.host_str() {
        Some("www.google.com" | "google.com" | "maps.google.com") => {
            let path = url.path();
            path == "/search" || path == "/maps" || path.starts_with("/maps/")
                || path.starts_with("/sorry/") || path.starts_with("/httpservice/")
        }
        Some("consent.google.com") => true,
        _ => false,
    }
}
fn capture_url(raw: &str) -> Result<reqwest::Url, String> {
    if raw == "about:blank" { return Err("The search page has not loaded yet".into()); }
    let url = reqwest::Url::parse(raw).map_err(|_| "The search page has not loaded yet")?;
    if !allowed_url(&url) { return Err("Only the dedicated Google Search or Maps page can be imported".into()); }
    if url.host_str() == Some("consent.google.com") || url.path().starts_with("/sorry/")
        || url.path().starts_with("/httpservice/") {
        return Err("Finish Google's consent or verification in the search window, then import again".into());
    }
    Ok(url)
}
fn valid_label(label: &str) -> bool {
    label.strip_prefix(LABEL).is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult { pub title: String, pub url: String, pub snippet: String }
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCapture {
    pub url: String, pub title: String, pub text: String, pub selected_name: Option<String>,
    pub phones: Vec<String>, pub addresses: Vec<String>, pub results: Vec<SearchResult>,
    #[serde(default)] pub error: Option<String>,
    #[serde(default)] pub website: Option<String>,
    #[serde(default)] pub hours: Option<String>,
    #[serde(default)] pub category: Option<String>,
    #[serde(default)] pub selection_state: Option<String>,
    #[serde(default)] pub photos: Vec<String>,
}
fn limit(value: &mut String, count: usize) { *value = value.chars().take(count).collect(); }
fn normalize(mut capture: SearchCapture) -> Result<SearchCapture, String> {
    capture_url(&capture.url)?;
    if let Some(error) = capture.error.take() { return Err(error.chars().take(300).collect()); }
    if capture.text.trim().is_empty() { return Err("The page is still opening. Wait for results, then import again".into()); }
    limit(&mut capture.url, 4000); limit(&mut capture.title, 200); limit(&mut capture.text, 20000);
    if let Some(name) = &mut capture.selected_name { limit(name, 180); }
    capture.phones.retain(|phone| phone.chars().all(|c| c.is_ascii_digit() || "+ ().-/".contains(c))
        && (6..=15).contains(&phone.chars().filter(|c| c.is_ascii_digit()).count()));
    capture.phones.truncate(12);
    capture.addresses.truncate(8);
    for address in &mut capture.addresses { limit(address, 500); }
    if let Some(website) = &capture.website {
        if !reqwest::Url::parse(website).is_ok_and(|url| ["https", "http"].contains(&url.scheme()) && url.username().is_empty() && url.password().is_none() && !url.host_str().is_some_and(|host| host == "google.com" || host.ends_with(".google.com"))) { capture.website = None; }
    }
    if let Some(website) = &mut capture.website { limit(website, 4000); }
    if let Some(hours) = &mut capture.hours { limit(hours, 2000); }
    if let Some(category) = &mut capture.category { limit(category, 100); }
    capture.photos.retain(|photo| photo.len() <= 4000 && reqwest::Url::parse(photo).is_ok_and(|url| url.scheme() == "https" && url.username().is_empty() && url.password().is_none() && matches!(url.host_str(), Some("lh3.googleusercontent.com" | "lh4.googleusercontent.com" | "lh5.googleusercontent.com" | "lh6.googleusercontent.com"))));
    capture.photos.truncate(6);
    capture.results.retain(|result| reqwest::Url::parse(&result.url).is_ok_and(|url|
        ["https", "http"].contains(&url.scheme()) && url.username().is_empty() && url.password().is_none()));
    capture.results.truncate(20);
    for result in &mut capture.results { limit(&mut result.title, 200); limit(&mut result.url, 4000); limit(&mut result.snippet, 900); }
    Ok(capture)
}

#[tauri::command]
pub async fn open_business_search(app: AppHandle, query: String, maps: bool, label: Option<String>) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() || query.len() > 1000 { return Err("Enter a business category or name and its city (up to 1000 characters)".into()); }
    let mut url = reqwest::Url::parse(if maps { "https://www.google.com/maps/search/" } else { "https://www.google.com/search" }).map_err(|e| e.to_string())?;
    if maps { url.query_pairs_mut().append_pair("api", "1").append_pair("query", query); }
    else { url.query_pairs_mut().append_pair("q", query); }
    if let Some(label) = label {
        if !valid_label(&label) { return Err("Invalid business search window".into()); }
        if let Some(window) = app.get_webview_window(&label) {
            window.navigate(url).map_err(|e| e.to_string())?;
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            return Ok(label);
        }
    }
    let label = format!("{LABEL}{}", uuid::Uuid::now_v7());
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url))
        .title("FRIDAY · Google business research · return to FRIDAY to import")
        .inner_size(1100.0, 800.0)
        .on_navigation(allowed_url)
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .build().map_err(|e| format!("Google research window could not open: {e}"))?;
    Ok(label)
}

#[tauri::command]
pub async fn capture_business_search(app: AppHandle, label: String) -> Result<SearchCapture, String> {
    read_capture(&app, &label, CAPTURE).await
}

async fn read_capture(app: &AppHandle, label: &str, script: &str) -> Result<SearchCapture, String> {
    if !valid_label(&label) { return Err("Invalid business search window".into()); }
    let window = app.get_webview_window(&label).ok_or("The search window was closed. Open Google Search or Maps again")?;
    capture_url(window.url().map_err(|e| e.to_string())?.as_str())?;
    let (sender, receiver) = tokio::sync::oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window.eval_with_callback(script, move |value| {
        if let Ok(mut sender) = sender.lock() { if let Some(sender) = sender.take() { let _ = sender.send(value); } }
    }).map_err(|e| format!("Could not read the displayed page: {e}"))?;
    let raw = tokio::time::timeout(Duration::from_secs(4), receiver).await
        .map_err(|_| "The search window did not respond. Wait for it to load and import again")?
        .map_err(|_| "The search window closed during import")?;
    if raw.len() > 150000 { return Err("The displayed results exceed the import limit".into()); }
    let capture: SearchCapture = serde_json::from_str(&raw).map_err(|_| "The search page could not be read. Wait for results and try again")?;
    normalize(capture)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessSelection { pub name: String, pub address: String, pub city: String, pub lat: f64, pub lng: f64, pub source: Option<String> }

fn selection_query(selection: &BusinessSelection) -> Result<String, String> {
    if selection.name.trim().is_empty() || selection.name.chars().count() > 180 || selection.address.chars().count() > 500 || selection.city.chars().count() > 100
        || !selection.lat.is_finite() || !selection.lng.is_finite() || selection.lat.abs() > 90.0 || selection.lng.abs() > 180.0 {
        return Err("Choose a business with a valid name and search location".into());
    }
    Ok(format!("{} {} {}", selection.name.trim(), selection.address.trim(), selection.city.trim()))
}

#[tauri::command]
pub async fn open_selected_business(app: AppHandle, label: String, selection: BusinessSelection) -> Result<(), String> {
    if !valid_label(&label) || app.get_webview_window(&label).is_some() { return Err("Invalid or already active research request".into()); }
    let query = selection_query(&selection)?;
    let mut url = reqwest::Url::parse("https://www.google.com/maps/search/").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("api", "1").append_pair("query", &query);
    if let Some(source) = &selection.source {
        let source = capture_url(source)?;
        if source.path().starts_with("/maps/place/") { url = source; }
    }
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url))
        .title("FRIDAY · Google Maps research · choose a branch, then capture in FRIDAY")
        .inner_size(1100.0, 800.0).on_navigation(allowed_url)
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .build().map_err(|e| format!("Google Maps could not open: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn capture_selected_business(app: AppHandle, window: tauri::WebviewWindow, label: String, selection: BusinessSelection) -> Result<SearchCapture, String> {
    selection_query(&selection)?;
    if !valid_label(&label) { return Err("Invalid research request".into()); }
    let request = serde_json::to_string(&selection).map_err(|e| e.to_string())?;
    let script = CAPTURE.replacen("const request = null;", &format!("const request = {request};"), 1);
    let deadline = tokio::time::Instant::now() + Duration::from_secs(50);
    let mut previous = None;
    let mut stable_count = 0;
    let mut mismatch_count = 0;
    while tokio::time::Instant::now() < deadline {
        if app.get_webview_window(&label).is_none() { return Err("Google research was cancelled or its window was closed".into()); }
        let capture = match read_capture(&app, &label, &script).await {
            Ok(capture) => capture,
            Err(error) if error.contains("still opening") || error.contains("has not loaded") || error.contains("did not respond") || error.contains("could not be read") => {
                tokio::time::sleep(Duration::from_millis(650)).await;
                continue;
            }
            Err(error) => return Err(error),
        };
        match capture.selection_state.as_deref() {
            Some("ambiguous") => return Err("Several branches match. Select the correct listing in the Google window, then retry capture in FRIDAY".into()),
            Some("matched") => {
                // Two equal snapshots avoid capturing halfway through the listing's render.
                let fingerprint = format!("{:?}|{:?}|{:?}|{:?}|{:?}|{:?}", capture.selected_name, capture.phones, capture.addresses, capture.website, capture.hours, capture.photos);
                stable_count = if previous.as_ref() == Some(&fingerprint) { stable_count + 1 } else { 1 };
                let has_fields = !capture.addresses.is_empty() || !capture.phones.is_empty() || capture.website.is_some();
                if stable_count >= if has_fields { 2 } else { 4 } {
                    let research = app.get_webview_window(&label).ok_or("The research window was closed")?;
                    research.close().map_err(|e| format!("Details were read but the research window could not close: {e}"))?;
                    let _ = window.set_focus();
                    return Ok(capture);
                }
                previous = Some(fingerprint);
            }
            Some("mismatch") => {
                previous = None; stable_count = 0;
                mismatch_count += 1;
                if mismatch_count >= 5 { return Err("The displayed business does not match the selected name and location. Select the right branch in Google Maps, then retry capture".into()); }
            }
            _ => { previous = None; stable_count = 0; }
        }
        tokio::time::sleep(Duration::from_millis(650)).await;
    }
    Err("Google Maps did not provide a stable matching listing within 50 seconds. Its window stays open; select the business and retry capture".into())
}

#[tauri::command]
pub async fn close_business_search(app: AppHandle, label: String) -> Result<(), String> {
    if !valid_label(&label) { return Err("Invalid research window".into()); }
    if let Some(window) = app.get_webview_window(&label) { window.close().map_err(|e| e.to_string())?; }
    Ok(())
}

fn selected_listing(capture: SearchCapture) -> Result<SearchCapture, String> {
    let url = capture_url(&capture.url)?;
    if !url.path().starts_with("/maps/place/") || !capture.selected_name.as_ref().is_some_and(|name| !name.trim().is_empty()) {
        return Err("Select one business listing in Google Maps, then capture it here".into());
    }
    Ok(capture)
}

/// User-directed branch selection bypasses automatic name/location matching only.
#[tauri::command]
pub async fn pull_selected_business(app: AppHandle, window: tauri::WebviewWindow, label: String) -> Result<SearchCapture, String> {
    let capture = selected_listing(read_capture(&app, &label, CAPTURE).await?)?;
    if let Some(research) = app.get_webview_window(&label) { research.close().map_err(|e| e.to_string())?; }
    let _ = window.set_focus();
    Ok(capture)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn business_search_restricts_windows_and_navigation() {
        assert!(valid_label(&format!("{LABEL}{}", uuid::Uuid::now_v7())));
        for label in ["main", "console", "business-search-main"] { assert!(!valid_label(label)); }
        for url in ["https://www.google.com/search?q=cafe", "https://www.google.com/maps/place/Atlas", "https://consent.google.com/m"] {
            assert!(allowed_url(&reqwest::Url::parse(url).expect("fixture URL")));
        }
        for url in ["http://www.google.com/search", "https://accounts.google.com/login", "https://google.com.attacker.org/search", "https://user@www.google.com/search", "https://www.google.com:8080/search", "https://www.google.com/mail", "file:///C:/secret"] {
            assert!(!allowed_url(&reqwest::Url::parse(url).expect("fixture URL")));
        }
        assert!(capture_url("https://www.google.com/sorry/index").is_err());
        assert!(capture_url("https://consent.google.com/m").is_err());
        assert!(capture_url("about:blank").expect_err("startup page cannot be imported").contains("has not loaded"));
    }
    #[test]
    fn business_search_bounds_and_validates_captured_candidates() {
        let capture = SearchCapture { url: "https://www.google.com/maps/place/Atlas".into(), title: "Google Maps".into(), text: "a".repeat(25000), selected_name: Some("Atlas".into()), phones: vec!["+213 555 000 000".into(), "a phone".into(), "12345678901234567890".into()], addresses: vec![], results: vec![SearchResult { title: "Unsafe".into(), url: "javascript:alert(1)".into(), snippet: "".into() }], error: None, website: Some("javascript:alert(1)".into()), hours: None, category: None, selection_state: None, photos: vec!["https://lh3.googleusercontent.com/p/atlas".into(), "https://attacker.org/tracker".into(), "http://lh3.googleusercontent.com/p/atlas".into()] };
        let capture = normalize(capture).expect("valid capture");
        assert_eq!(capture.text.len(), 20000); assert_eq!(capture.phones, vec!["+213 555 000 000"]); assert!(capture.results.is_empty());
        assert!(capture.website.is_none());
        assert_eq!(capture.photos, vec!["https://lh3.googleusercontent.com/p/atlas"]);
        let mut capture = selected_listing(capture).expect("single selected listing can be pulled");
        capture.selected_name = None;
        assert!(selected_listing(capture).is_err());
    }
    #[test]
    fn business_search_validates_selected_business() {
        let mut selection = BusinessSelection { name: "Atlas Café".into(), address: "".into(), city: "Oran".into(), lat: 35.6969, lng: -0.6417, source: None };
        assert_eq!(selection_query(&selection).expect("valid selection"), "Atlas Café  Oran");
        selection.lat = f64::NAN;
        assert!(selection_query(&selection).is_err());
        selection.lat = 35.6969; selection.name = " ".into();
        assert!(selection_query(&selection).is_err());
    }
}
