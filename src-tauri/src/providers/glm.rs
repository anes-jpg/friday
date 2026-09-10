use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GlmConfig {
    pub base_url: String,
    pub api_key: String,
    pub heavy_model: String,
    pub light_model: String,
}

impl Default for GlmConfig {
    fn default() -> Self {
        Self {
            base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
            api_key: String::new(),
            heavy_model: "glm-4-plus".to_string(),
            light_model: "glm-4-flash".to_string(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum StreamDelta {
    Token(String),
    ToolCall {
        id: String,
        name: String,
        arguments: Value,
    },
    Done,
}

#[derive(Default)]
struct ToolCallAccumulator {
    id: String,
    name: String,
    arguments_buffer: String,
}

pub struct GlmProvider {
    pub config: GlmConfig,
    pub http: reqwest::Client,
}

impl GlmProvider {
    pub fn new(config: GlmConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self { config, http }
    }

    /// Retrieve API key from Windows Credential Manager (§08 Security Model)
    pub fn get_key_from_keyring() -> Result<String, String> {
        let entry = keyring::Entry::new("friday-assistant", "glm-api-key")
            .map_err(|e| e.to_string())?;
        entry.get_password().map_err(|e| e.to_string())
    }

    /// Save API key into Windows Credential Manager
    pub fn save_key_to_keyring(api_key: &str) -> Result<(), String> {
        let entry = keyring::Entry::new("friday-assistant", "glm-api-key")
            .map_err(|e| e.to_string())?;
        entry.set_password(api_key).map_err(|e| e.to_string())
    }

    /// Selects model tier based on turn requirements (D7 & D8 in Build Plan)
    pub fn select_model(&self, needs_reasoning: bool) -> &str {
        if needs_reasoning {
            &self.config.heavy_model
        } else {
            &self.config.light_model
        }
    }

    /// Prepares request payload for OpenAI-compatible `/chat/completions` endpoint
    pub fn prepare_payload(
        &self,
        messages: Vec<Value>,
        tools: Vec<Value>,
        needs_reasoning: bool,
    ) -> Value {
        let model = self.select_model(needs_reasoning);

        json!({
            "model": model,
            "messages": messages,
            "tools": if tools.is_empty() { Value::Null } else { json!(tools) },
            "tool_choice": if tools.is_empty() { Value::Null } else { json!("auto") },
            "stream": true,
            "temperature": 0.3,
            "max_tokens": 2048,
        })
    }

    /// Streams completion turns with robust fragmented tool-call accumulation (§05 The GLM Provider)
    pub async fn stream_completion<F>(
        &self,
        messages: Vec<Value>,
        tools: Vec<Value>,
        needs_reasoning: bool,
        mut on_delta: F,
    ) -> Result<(String, Vec<Value>), String>
    where
        F: FnMut(StreamDelta),
    {
        // Try to obtain the key from keyring if not supplied in config
        let api_key = if !self.config.api_key.is_empty() {
            self.config.api_key.clone()
        } else {
            Self::get_key_from_keyring().unwrap_or_default()
        };

        if api_key.is_empty() {
            return Err("GLM API Key not found. Please set your key in Settings or Windows Credential Manager.".to_string());
        }

        let payload = self.prepare_payload(messages, tools, needs_reasoning);
        let url = format!("{}/chat/completions", self.config.base_url.trim_end_matches('/'));

        let response = self
            .http
            .post(&url)
            .bearer_auth(api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to reach GLM endpoint: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("GLM API returned error {}: {}", status, err_text));
        }

        let mut stream = response.bytes_stream().eventsource();
        let mut full_text = String::new();
        let mut tool_accumulators: HashMap<usize, ToolCallAccumulator> = HashMap::new();

        while let Some(event_res) = stream.next().await {
            let event = match event_res {
                Ok(ev) => ev,
                Err(err) => {
                    tracing::warn!("SSE stream read error: {}", err);
                    break;
                }
            };

            let data = event.data.trim();
            if data == "[DONE]" {
                break;
            }

            let parsed: Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                if let Some(first_choice) = choices.first() {
                    let delta = first_choice.get("delta");

                    // 1. Text token delta
                    if let Some(content) = delta.and_then(|d| d.get("content")).and_then(|c| c.as_str()) {
                        if !content.is_empty() {
                            full_text.push_str(content);
                            on_delta(StreamDelta::Token(content.to_string()));
                        }
                    }

                    // 2. Fragmented tool call accumulation
                    if let Some(tool_calls) = delta.and_then(|d| d.get("tool_calls")).and_then(|tc| tc.as_array()) {
                        for tc in tool_calls {
                            let index = tc.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
                            let acc = tool_accumulators.entry(index).or_default();

                            if let Some(id) = tc.get("id").and_then(|s| s.as_str()) {
                                acc.id = id.to_string();
                            }

                            if let Some(func) = tc.get("function") {
                                if let Some(name) = func.get("name").and_then(|n| n.as_str()) {
                                    acc.name = name.to_string();
                                }
                                if let Some(args_chunk) = func.get("arguments").and_then(|a| a.as_str()) {
                                    acc.arguments_buffer.push_str(args_chunk);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Assemble finalized tool calls
        let mut finalized_tools: Vec<Value> = Vec::new();
        for (_, acc) in tool_accumulators {
            let args_value: Value = serde_json::from_str(&acc.arguments_buffer).unwrap_or_else(|_| json!({}));
            let tool_json = json!({
                "id": acc.id,
                "type": "function",
                "function": {
                    "name": acc.name,
                    "arguments": args_value
                }
            });

            on_delta(StreamDelta::ToolCall {
                id: acc.id,
                name: acc.name,
                arguments: args_value,
            });

            finalized_tools.push(tool_json);
        }

        on_delta(StreamDelta::Done);
        Ok((full_text, finalized_tools))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_selection() {
        let config = GlmConfig::default();
        let provider = GlmProvider::new(config);

        assert_eq!(provider.select_model(true), "glm-4-plus");
        assert_eq!(provider.select_model(false), "glm-4-flash");
    }

    #[test]
    fn test_payload_preparation() {
        let config = GlmConfig::default();
        let provider = GlmProvider::new(config);

        let messages = vec![json!({"role": "user", "content": "Hello"})];
        let payload = provider.prepare_payload(messages, vec![], false);

        assert_eq!(payload["model"], "glm-4-flash");
        assert_eq!(payload["stream"], true);
        assert_eq!(payload["temperature"], 0.3);
    }
}
