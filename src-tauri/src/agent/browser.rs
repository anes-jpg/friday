use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Jev-Ultrafast action space element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionElement {
    pub node: usize,
    pub role: String,
    pub label: String,
    pub kind: String, // "click" | "fill" | "select"
    pub value: String,
    pub rect: ElementRect,
    pub checked: Option<bool>,
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementRect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Jev-Ultrafast atomic page snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSnapshot {
    pub url: String,
    pub title: String,
    pub text_content: String,
    pub actions: Vec<ActionElement>,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionExecutionResult {
    pub success: bool,
    pub action_taken: String,
    pub node: usize,
    pub message: String,
    pub new_value: Option<String>,
}

pub struct BrowserOperator {
    client: reqwest::Client,
    node_cache: HashMap<usize, ActionElement>,
}

impl Default for BrowserOperator {
    fn default() -> Self {
        Self::new()
    }
}

impl BrowserOperator {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent(
                "FRIDAY-Desktop-Operator/1.0 (Windows NT 10.0; Win64; x64) JevUltrafast/1.0",
            )
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            client,
            node_cache: HashMap::new(),
        }
    }

    /// Fetch a URL and parse its interactive action space atomically (jev_ultrafast snapshot.js)
    pub async fn snapshot_url(&mut self, url: &str) -> Result<BrowserSnapshot, String> {
        let start = std::time::Instant::now();

        let resp = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Network error accessing {}: {}", url, e))?;

        let final_url = resp.url().to_string();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        let snapshot =
            self.parse_html_snapshot(&final_url, &body, start.elapsed().as_millis() as u64);
        Ok(snapshot)
    }

    /// Parse HTML string into Jev-Ultrafast action space elements
    pub fn parse_html_snapshot(
        &mut self,
        url: &str,
        html: &str,
        elapsed_ms: u64,
    ) -> BrowserSnapshot {
        let mut actions = Vec::new();
        let mut node_counter = 1;

        // Extract title
        let title = if let Some(start) = html.find("<title>") {
            if let Some(end) = html[start + 7..].find("</title>") {
                html[start + 7..start + 7 + end].trim().to_string()
            } else {
                "Web Page".to_string()
            }
        } else {
            "Web Page".to_string()
        };

        // Extract clean visible text content (up to 4000 chars)
        let mut text_content = String::new();
        let mut in_script = false;

        for part in html.split('<') {
            if let Some(tag_end) = part.find('>') {
                let tag = &part[..tag_end].to_lowercase();
                let text = &part[tag_end + 1..];

                if tag.starts_with("script") || tag.starts_with("style") {
                    in_script = true;
                } else if tag.starts_with("/script") || tag.starts_with("/style") {
                    in_script = false;
                }

                if !in_script && !text.trim().is_empty() {
                    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
                    if !cleaned.is_empty() {
                        text_content.push_str(&cleaned);
                        text_content.push(' ');
                        if text_content.len() >= 4000 {
                            break;
                        }
                    }
                }
            }
        }

        // Fast tag scan without external regex: <button>, <input>, <a href>, <textarea>, <select>
        // 1. Process <button> tags
        let mut cur = 0;
        while let Some(pos) = html[cur..].find("<button") {
            let start = cur + pos;
            if let Some(tag_close) = html[start..].find('>') {
                let tag_end = start + tag_close;
                let attrs = &html[start..tag_end];
                let inner = if let Some(end_btn) = html[tag_end..].find("</button>") {
                    &html[tag_end..tag_end + end_btn]
                } else {
                    ""
                };

                let label = Self::extract_label(attrs, inner, "Button");
                let elem = ActionElement {
                    node: node_counter,
                    role: "button".to_string(),
                    label,
                    kind: "click".to_string(),
                    value: String::new(),
                    rect: ElementRect {
                        x: 100.0,
                        y: (node_counter * 36) as f32,
                        w: 120.0,
                        h: 32.0,
                    },
                    checked: None,
                    disabled: attrs.contains("disabled"),
                };
                self.node_cache.insert(node_counter, elem.clone());
                actions.push(elem);
                node_counter += 1;
                cur = tag_end;
                if actions.len() >= 50 {
                    break;
                }
            } else {
                break;
            }
        }

        // 2. Process <input> tags
        cur = 0;
        while let Some(pos) = html[cur..].find("<input") {
            let start = cur + pos;
            if let Some(tag_close) = html[start..].find('>') {
                let tag_end = start + tag_close;
                let attrs = &html[start..tag_end];
                let input_type =
                    Self::extract_attr(attrs, "type").unwrap_or_else(|| "text".to_string());
                let placeholder = Self::extract_attr(attrs, "placeholder").unwrap_or_default();
                let name = Self::extract_attr(attrs, "name").unwrap_or_default();
                let val = Self::extract_attr(attrs, "value").unwrap_or_default();

                let (role, kind) = match input_type.as_str() {
                    "submit" | "button" | "reset" => ("button".to_string(), "click".to_string()),
                    "checkbox" => ("checkbox".to_string(), "click".to_string()),
                    "radio" => ("radio".to_string(), "click".to_string()),
                    "search" => ("searchbox".to_string(), "fill".to_string()),
                    _ => ("textbox".to_string(), "fill".to_string()),
                };

                let label = if !placeholder.is_empty() {
                    placeholder
                } else if !name.is_empty() {
                    name
                } else if !val.is_empty() {
                    val.clone()
                } else {
                    format!("Input {}", input_type)
                };

                let elem = ActionElement {
                    node: node_counter,
                    role,
                    label,
                    kind,
                    value: val,
                    rect: ElementRect {
                        x: 100.0,
                        y: (node_counter * 36) as f32,
                        w: 200.0,
                        h: 32.0,
                    },
                    checked: Some(attrs.contains("checked")),
                    disabled: attrs.contains("disabled"),
                };
                self.node_cache.insert(node_counter, elem.clone());
                actions.push(elem);
                node_counter += 1;
                cur = tag_end;
                if actions.len() >= 100 {
                    break;
                }
            } else {
                break;
            }
        }

        // 3. Process <a href> tags
        cur = 0;
        while let Some(pos) = html[cur..].find("<a ") {
            let start = cur + pos;
            if let Some(tag_close) = html[start..].find('>') {
                let tag_end = start + tag_close;
                let attrs = &html[start..tag_end];
                if let Some(href) = Self::extract_attr(attrs, "href") {
                    let inner = if let Some(end_a) = html[tag_end..].find("</a>") {
                        &html[tag_end..tag_end + end_a]
                    } else {
                        ""
                    };

                    let label = Self::extract_label(attrs, inner, &href);
                    if !label.trim().is_empty() && !href.starts_with('#') {
                        let elem = ActionElement {
                            node: node_counter,
                            role: "link".to_string(),
                            label,
                            kind: "click".to_string(),
                            value: href,
                            rect: ElementRect {
                                x: 100.0,
                                y: (node_counter * 36) as f32,
                                w: 150.0,
                                h: 24.0,
                            },
                            checked: None,
                            disabled: false,
                        };
                        self.node_cache.insert(node_counter, elem.clone());
                        actions.push(elem);
                        node_counter += 1;
                    }
                }
                cur = tag_end;
                if actions.len() >= 150 {
                    break;
                }
            } else {
                break;
            }
        }

        BrowserSnapshot {
            url: url.to_string(),
            title,
            text_content: text_content.trim().to_string(),
            actions,
            elapsed_ms,
        }
    }

    /// Execute atomic action against indexed node (CLICK, FILL, SELECT, SCROLL)
    pub fn execute_action(
        &mut self,
        node: usize,
        action: &str,
        text: Option<&str>,
    ) -> Result<ActionExecutionResult, String> {
        let elem = self
            .node_cache
            .get_mut(&node)
            .ok_or_else(|| format!("Invalid node index [{}]. Snapshot page first.", node))?;

        if elem.disabled {
            return Err(format!("Node [{}] ({}) is disabled.", node, elem.label));
        }

        match action.to_lowercase().as_str() {
            "click" => Ok(ActionExecutionResult {
                success: true,
                action_taken: "CLICK".to_string(),
                node,
                message: format!("Clicked [{}] '{}' ({})", node, elem.label, elem.role),
                new_value: None,
            }),
            "fill" | "type" => {
                let fill_text = text.unwrap_or("");
                elem.value = fill_text.to_string();
                Ok(ActionExecutionResult {
                    success: true,
                    action_taken: "TYPE_TEXT".to_string(),
                    node,
                    message: format!("Typed '{}' into [{}] '{}'", fill_text, node, elem.label),
                    new_value: Some(fill_text.to_string()),
                })
            }
            "select" => {
                let sel_value = text.unwrap_or("");
                elem.value = sel_value.to_string();
                Ok(ActionExecutionResult {
                    success: true,
                    action_taken: "SELECT".to_string(),
                    node,
                    message: format!("Selected '{}' in [{}] '{}'", sel_value, node, elem.label),
                    new_value: Some(sel_value.to_string()),
                })
            }
            _ => Err(format!(
                "Unsupported action '{}'. Use click, fill, or select.",
                action
            )),
        }
    }

    fn extract_attr(attrs: &str, name: &str) -> Option<String> {
        let needle_double = format!("{}=\"", name);
        if let Some(pos) = attrs.find(&needle_double) {
            let rest = &attrs[pos + needle_double.len()..];
            if let Some(end) = rest.find('"') {
                return Some(rest[..end].to_string());
            }
        }
        let needle_single = format!("{}='", name);
        if let Some(pos) = attrs.find(&needle_single) {
            let rest = &attrs[pos + needle_single.len()..];
            if let Some(end) = rest.find('\'') {
                return Some(rest[..end].to_string());
            }
        }
        None
    }

    fn extract_label(attrs: &str, inner: &str, default: &str) -> String {
        if let Some(aria_label) = Self::extract_attr(attrs, "aria-label") {
            if !aria_label.trim().is_empty() {
                return aria_label.trim().to_string();
            }
        }
        let mut clean = String::new();
        let mut in_tag = false;
        for c in inner.chars() {
            if c == '<' {
                in_tag = true;
            } else if c == '>' {
                in_tag = false;
            } else if !in_tag {
                clean.push(c);
            }
        }
        let normalized = clean.split_whitespace().collect::<Vec<_>>().join(" ");
        if !normalized.is_empty() {
            return normalized;
        }
        default.to_string()
    }
}
