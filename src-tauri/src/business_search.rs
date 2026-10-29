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
    if !valid_label(&label) { return Err("Invalid business search window".into()); }
    let window = app.get_webview_window(&label).ok_or("The search window was closed. Open Google Search or Maps again")?;
    capture_url(window.url().map_err(|e| e.to_string())?.as_str())?;
    let (sender, receiver) = tokio::sync::oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window.eval_with_callback(CAPTURE, move |value| {
        if let Ok(mut sender) = sender.lock() { if let Some(sender) = sender.take() { let _ = sender.send(value); } }
    }).map_err(|e| format!("Could not read the displayed page: {e}"))?;
    let raw = tokio::time::timeout(Duration::from_secs(8), receiver).await
        .map_err(|_| "The search window did not respond. Wait for it to load and import again")?
        .map_err(|_| "The search window closed during import")?;
    if raw.len() > 150000 { return Err("The displayed results exceed the import limit".into()); }
    let capture: SearchCapture = serde_json::from_str(&raw).map_err(|_| "The search page could not be read. Wait for results and try again")?;
    normalize(capture)
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
    }
    #[test]
    fn business_search_bounds_and_validates_captured_candidates() {
        let capture = SearchCapture { url: "https://www.google.com/maps/place/Atlas".into(), title: "Google Maps".into(), text: "a".repeat(25000), selected_name: Some("Atlas".into()), phones: vec!["+213 555 000 000".into(), "a phone".into(), "12345678901234567890".into()], addresses: vec![], results: vec![SearchResult { title: "Unsafe".into(), url: "javascript:alert(1)".into(), snippet: "".into() }], error: None };
        let capture = normalize(capture).expect("valid capture");
        assert_eq!(capture.text.len(), 20000); assert_eq!(capture.phones, vec!["+213 555 000 000"]); assert!(capture.results.is_empty());
    }
}
