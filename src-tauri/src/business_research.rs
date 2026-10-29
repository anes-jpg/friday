//! Free, read-only business research. URLs stay public across every redirect.
use serde::Serialize;
use std::{net::{IpAddr, SocketAddr}, time::Duration};

#[derive(Serialize)]
pub struct BusinessSite { pub url: String, pub html: String }
#[derive(Serialize)]
pub struct BusinessSource { pub title: String, pub url: String }

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a,b,c,_] = ip.octets();
            !ip.is_private() && !ip.is_loopback() && !ip.is_link_local() && !ip.is_documentation()
                && a != 0 && a < 224 && !(a == 100 && (64..=127).contains(&b))
                && !(a == 192 && b == 0 && c == 0) && !(a == 198 && (b == 18 || b == 19))
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() { return public_ip(IpAddr::V4(v4)); }
            let segments = ip.segments();
            segments[0] & 0xe000 == 0x2000 && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
        }
    }
}
fn public_url(raw: &str) -> Result<reqwest::Url,String> {
    if raw.len() > 4000 { return Err("Website URL is too long".into()); }
    let url = reqwest::Url::parse(raw).map_err(|_| "Enter a complete public website URL")?;
    if !["http","https"].contains(&url.scheme()) || !url.username().is_empty() || url.password().is_some()
        || url.port().is_some_and(|port| ![80,443].contains(&port)) { return Err("Use a public HTTP or HTTPS website without credentials".into()); }
    let host = url.host_str().ok_or("Website has no host")?.trim_matches(['[',']']);
    if let Ok(ip) = host.parse::<IpAddr>() {
        if !public_ip(ip) { return Err("Local and private addresses cannot be researched".into()); }
    } else if !host.contains('.') || host.ends_with(".local") || host.ends_with(".localhost") {
        return Err("Local hostnames cannot be researched".into());
    }
    Ok(url)
}
async fn fetch_site(raw: String) -> Result<BusinessSite,String> {
    let mut url = public_url(&raw)?;
    for _ in 0..4 {
        let host = url.host_str().ok_or("Website has no host")?.trim_matches(['[',']']).to_string();
        let port = url.port_or_known_default().ok_or("Unsupported website port")?;
        let addresses: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(),port)).await.map_err(|e|format!("Website DNS unavailable: {e}"))?
            .filter(|address| public_ip(address.ip())).collect();
        if addresses.is_empty() { return Err("Website did not resolve to a public address".into()); }
        let client = reqwest::Client::builder().no_proxy().resolve_to_addrs(&host,&addresses)
            .redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(8))
            .user_agent("FRIDAY/1.0 public-business-research").build().map_err(|e|e.to_string())?;
        let mut response = client.get(url.clone()).send().await.map_err(|e|format!("Website could not be read: {e}"))?;
        if response.status().is_redirection() {
            let next = response.headers().get(reqwest::header::LOCATION).ok_or("Website redirect has no destination")?.to_str().map_err(|_|"Invalid website redirect")?;
            url = public_url(url.join(next).map_err(|_|"Invalid website redirect")?.as_str())?;
            continue;
        }
        response.error_for_status_ref().map_err(|e|format!("Website request failed: {e}"))?;
        if response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|value|value.to_str().ok())
            .is_some_and(|value| !value.contains("text/html") && !value.contains("application/xhtml")) {
            return Err("Contact research needs an HTML website page".into());
        }
        if response.content_length().is_some_and(|size|size>1_000_000) { return Err("Website page exceeds the 1 MB research limit".into()); }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e|e.to_string())? {
            if bytes.len()+chunk.len()>1_000_000 { return Err("Website page exceeds the 1 MB research limit".into()); }
            bytes.extend_from_slice(&chunk);
        }
        return Ok(BusinessSite {url:url.to_string(),html:String::from_utf8_lossy(&bytes).into_owned()});
    }
    Err("Website redirected too many times".into())
}
#[tauri::command]
pub async fn read_business_site(url: String) -> Result<BusinessSite,String> {
    tokio::time::timeout(Duration::from_secs(18),fetch_site(url)).await.map_err(|_|"Website research timed out")?
}
fn attribute(tag: &str,name: &str) -> Option<String> {
    for quote in ['"','\''] {
        let start = format!("{name}={quote}");
        if let Some(value) = tag.split(&start).nth(1) { return value.split(quote).next().map(str::to_string); }
    }
    None
}
fn sources_from_html(html: &str) -> Vec<BusinessSource> {
    let mut sources = Vec::new();
    for anchor in html.split("<a ").skip(1) {
        let Some((tag,body)) = anchor.split_once('>') else {continue};
        if !attribute(tag,"class").is_some_and(|classes|classes.split_whitespace().any(|class|class=="result__a")) {continue;}
        let Some(href) = attribute(tag,"href") else {continue};
        let href = href.replace("&amp;","&");
        let absolute = if href.starts_with("//") {format!("https:{href}")} else {href};
        let Ok(link) = reqwest::Url::parse(&absolute) else {continue};
        let destination = link.query_pairs().find(|(key,_)|key=="uddg").map(|(_,value)|value.into_owned()).unwrap_or_else(||link.to_string());
        let Ok(url) = public_url(&destination) else {continue};
        if sources.iter().any(|source: &BusinessSource|source.url==url.as_str()) {continue;}
        let title = body.split("</a>").next().unwrap_or("").split('<').map(|part|part.rsplit('>').next().unwrap_or("")).collect::<Vec<_>>().join("")
            .replace("&amp;","&").replace("&quot;","\"").replace("&#39;","'");
        sources.push(BusinessSource {title:title.trim().chars().take(180).collect(),url:url.to_string()});
        if sources.len()==8 {break;}
    }
    sources
}
#[tauri::command]
pub async fn search_business_sources(query: String) -> Result<Vec<BusinessSource>,String> {
    if query.trim().is_empty() || query.len()>1000 {return Err("Enter a business name and location".into());}
    let client=reqwest::Client::builder().timeout(Duration::from_secs(12)).user_agent("FRIDAY/1.0 public-business-research").build().map_err(|e|e.to_string())?;
    let mut response=client.post("https://html.duckduckgo.com/html/").form(&[("q",query)]).send().await.map_err(|e|format!("Free search unavailable: {e}"))?.error_for_status().map_err(|e|e.to_string())?;
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|e|e.to_string())? {if bytes.len()+chunk.len()>1_000_000 {return Err("Search response exceeds its limit".into());}bytes.extend_from_slice(&chunk);}
    let sources=sources_from_html(&String::from_utf8_lossy(&bytes));
    if sources.is_empty() {return Err("Free search returned no readable links. Open a browser search or paste a business website to research it.".into());}
    Ok(sources)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn business_research_rejects_private_and_credential_urls() {
        for url in ["http://127.0.0.1","https://10.0.0.1","https://[::1]","http://169.254.169.254","https://user:secret@business.com","file:///C:/secret","http://100.64.1.1","http://192.168.1.1"] {assert!(public_url(url).is_err(),"{url}");}
        assert!(public_url("https://business.com/contact").is_ok());
    }
    #[test]
    fn business_search_keeps_source_links_and_drops_local_results() {
        let html=r#"<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcafe.com%2Fcontact">Café <b>Atlas</b></a><a href="http://127.0.0.1" class="result__a">Local</a>"#;
        let sources=sources_from_html(html);
        assert_eq!(sources.len(),1);assert_eq!(sources[0].url,"https://cafe.com/contact");assert_eq!(sources[0].title,"Café Atlas");
    }
}
