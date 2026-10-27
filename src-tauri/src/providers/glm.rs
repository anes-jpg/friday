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

pub fn validate_provider_config(base_url: &str, model: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(base_url.trim()).map_err(|_| "Enter a valid OpenAI-compatible endpoint".to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Use an HTTP or HTTPS OpenAI-compatible endpoint.".to_string());
    }
    if model.trim().is_empty() {
        return Err("Enter a model name for reasoning.".to_string());
    }
    Ok(())
}

pub fn is_local_endpoint(base_url: &str) -> bool {
    reqwest::Url::parse(base_url).ok().and_then(|url| url.host_str().map(str::to_string)).map(|host| {
        let host = host.trim_matches(['[', ']']).to_ascii_lowercase();
        host == "localhost" || host.ends_with(".localhost") || host == "::1" || host.starts_with("127.")
    }).unwrap_or(false)
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

/// Defensively parses and repairs potentially truncated JSON arguments from streaming tool calls
pub fn repair_json_arguments(raw: &str) -> Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return json!({});
    }
    if let Ok(val) = serde_json::from_str(trimmed) {
        return val;
    }

    // Auto-close unclosed string quote and unclosed braces
    let mut repaired = trimmed.to_string();
    let mut in_str = false;
    let mut escape = false;
    let mut open_braces = 0usize;
    let mut close_braces = 0usize;
    let mut open_brackets = 0usize;
    let mut close_brackets = 0usize;

    for c in repaired.chars() {
        if escape {
            escape = false;
            continue;
        }
        if c == '\\' {
            escape = true;
            continue;
        }
        if c == '"' {
            in_str = !in_str;
            continue;
        }
        if !in_str {
            match c {
                '{' => open_braces += 1,
                '}' => close_braces += 1,
                '[' => open_brackets += 1,
                ']' => close_brackets += 1,
                _ => {}
            }
        }
    }

    if in_str {
        repaired.push('"');
    }
    for _ in close_brackets..open_brackets {
        repaired.push(']');
    }
    for _ in close_braces..open_braces {
        repaired.push('}');
    }

    if let Ok(val) = serde_json::from_str(&repaired) {
        return val;
    }

    json!({})
}

/// Robust OpenAI-compatible URL normalizer.
/// Automatically handles DeepSeek, OpenAI, AgentRouter, and Zhipu endpoints without missing paths.
pub fn normalize_api_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return "https://api.deepseek.com/v1/chat/completions".to_string();
    }
    if trimmed.ends_with("/chat/completions") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/responses") {
        return trimmed.to_string();
    }
    if trimmed.contains("/api/paas/v4") {
        return format!("{}/chat/completions", trimmed);
    }
    if trimmed.ends_with("/v1") || trimmed.ends_with("/beta") {
        return format!("{}/chat/completions", trimmed);
    }
    format!("{}/v1/chat/completions", trimmed)
}

#[derive(Clone)]
pub struct GlmProvider {
    pub config: GlmConfig,
    pub http: reqwest::Client,
    pub isolated_credentials: bool,
}

impl GlmProvider {
    pub fn new(config: GlmConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .tcp_keepalive(Duration::from_secs(30))
            .tcp_nodelay(true)
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Some(Duration::from_secs(90)))
            .user_agent("Cline/1.0.0")
            .build()
            .unwrap_or_default();

        Self { config, http, isolated_credentials: false }
    }

    pub fn with_client(config: GlmConfig, http: reqwest::Client) -> Self {
        Self { config, http, isolated_credentials: false }
    }

    /// Retrieve effective API key from config, env vars (GLM_API_KEY, DEEPSEEK_API_KEY, ZHIPU_API_KEY), or Windows Credential Manager
    pub fn get_effective_api_key(&self) -> String {
        if !self.config.api_key.trim().is_empty() {
            self.config.api_key.trim().to_string()
        } else if self.isolated_credentials {
            String::new()
        } else if let Ok(k) = std::env::var("GLM_API_KEY") {
            k.trim().to_string()
        } else if let Ok(k) = std::env::var("DEEPSEEK_API_KEY") {
            k.trim().to_string()
        } else if let Ok(k) = std::env::var("ZHIPU_API_KEY") {
            k.trim().to_string()
        } else if let Ok(k) = std::env::var("OPENAI_API_KEY") {
            k.trim().to_string()
        } else {
            Self::get_key_from_keyring()
                .unwrap_or_default()
                .trim()
                .to_string()
        }
    }

    /// Retrieve API key from Windows Credential Manager (§08 Security Model)
    pub fn get_key_from_keyring() -> Result<String, String> {
        let entry =
            keyring::Entry::new("friday-assistant", "glm-api-key").map_err(|e| e.to_string())?;
        entry.get_password().map_err(|e| e.to_string())
    }

    /// Save API key into Windows Credential Manager
    pub fn save_key_to_keyring(api_key: &str) -> Result<(), String> {
        let entry =
            keyring::Entry::new("friday-assistant", "glm-api-key").map_err(|e| e.to_string())?;
        entry.set_password(api_key).map_err(|e| e.to_string())
    }

    /// Selects model tier based on turn requirements (D7 & D8 in Build Plan)
    pub fn select_model(&self, needs_reasoning: bool) -> &str {
        if needs_reasoning {
            if !self.config.heavy_model.trim().is_empty() {
                &self.config.heavy_model
            } else if !self.config.light_model.trim().is_empty() {
                &self.config.light_model
            } else {
                "glm-5.3"
            }
        } else {
            if !self.config.light_model.trim().is_empty() {
                &self.config.light_model
            } else if !self.config.heavy_model.trim().is_empty() {
                &self.config.heavy_model
            } else {
                "glm-5.3"
            }
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
        let is_deepseek_reasoner = model.contains("deepseek-reasoner") || model == "deepseek-r1";
        let is_local_slm = is_local_endpoint(&self.config.base_url);
        let mut final_messages = messages;
        if is_local_slm && !tools.is_empty() {
            final_messages.insert(0, json!({"role": "system", "content": format!("Available tools: {}. To execute an action, return a tool_call object containing name and args in your JSON response.", serde_json::to_string(&tools).unwrap_or_default())}));
        }

        let mut map = serde_json::Map::new();
        map.insert("model".to_string(), json!(model));
        map.insert("messages".to_string(), json!(final_messages));

        // DeepSeek Reasoner and Local SLMs (Ollama) strictly forbid the OpenAI "tools" schema parameter
        if !tools.is_empty() && !is_deepseek_reasoner && !is_local_slm {
            let mut sanitized_tools = Vec::with_capacity(tools.len());
            for mut t in tools {
                if let Some(func) = t.get_mut("function") {
                    if let Some(n) = func.get("name").and_then(|v| v.as_str()) {
                        if n.contains('.') {
                            func["name"] = json!(n.replace('.', "_"));
                        }
                    }
                    if let Some(params) = func.get_mut("parameters") {
                        if let Some(map) = params.as_object_mut() {
                            if !map.contains_key("type") || map["type"].is_null() {
                                map.insert("type".to_string(), json!("object"));
                            }
                            if !map.contains_key("properties") || map["properties"].is_null() {
                                map.insert("properties".to_string(), json!({}));
                            }
                            if !map.contains_key("required")
                                || map["required"].is_null()
                                || !map["required"].is_array()
                            {
                                map.insert("required".to_string(), json!([]));
                            }
                            if let Some(props) =
                                map.get_mut("properties").and_then(|p| p.as_object_mut())
                            {
                                for (_, prop_val) in props.iter_mut() {
                                    if let Some(prop_obj) = prop_val.as_object_mut() {
                                        if let Some(en) = prop_obj.get("enum") {
                                            if en.is_null() || !en.is_array() {
                                                prop_obj.remove("enum");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        func["parameters"] = json!({
                            "type": "object",
                            "properties": {},
                            "required": []
                        });
                    }
                }
                sanitized_tools.push(t);
            }
            map.insert("tools".to_string(), json!(sanitized_tools));
        }
        map.insert("stream".to_string(), json!(true));
        if !is_deepseek_reasoner {
            map.insert("temperature".to_string(), json!(0.3));
        }
        map.insert("max_tokens".to_string(), json!(8192));

        Value::Object(map)
    }

    /// Streams completion turns with robust fragmented tool-call accumulation (§05 The GLM Provider)
    /// Includes exponential backoff retry on transient errors (429, 5xx, network failures).
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
        let api_key = self.get_effective_api_key();
        validate_provider_config(&self.config.base_url, self.select_model(needs_reasoning))?;
        if self.config.base_url.trim_end_matches('/').ends_with("/responses") {
            return self.stream_responses(messages, tools, needs_reasoning, on_delta).await;
        }
        if api_key.trim().is_empty() && !is_local_endpoint(&self.config.base_url) {
            return Err("Provider API key not found. Please set your key in Settings or Windows Credential Manager.".to_string());
        }
        let auth_key = if api_key.trim().is_empty() { "ollama".to_string() } else { api_key };

        let payload = self.prepare_payload(messages.clone(), tools.clone(), needs_reasoning);
        let url = normalize_api_url(&self.config.base_url);

        // Retry loop with exponential backoff for transient errors
        const MAX_RETRIES: u32 = 3;
        let retry_delays_ms: [u64; 3] = [500, 1000, 2000];
        let mut last_error = String::new();

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let delay = retry_delays_ms
                    .get((attempt - 1) as usize)
                    .copied()
                    .unwrap_or(2000);
                tracing::warn!(
                    "Provider request attempt {}/{} failed: {}. Retrying in {} ms...",
                    attempt,
                    MAX_RETRIES,
                    last_error,
                    delay
                );
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }

            let response = match self
                .http
                .post(&url)
                .bearer_auth(&auth_key)
                .json(&payload)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    last_error = format!("Failed to reach endpoint {}: {}", url, e);
                    if attempt < MAX_RETRIES {
                        continue; // Network error — retry
                    }
                    return Err(last_error);
                }
            };

            if !response.status().is_success() {
                let status = response.status();
                let err_text = response.text().await.unwrap_or_default();
                last_error = format!("Provider API returned error {}: {}", status, err_text);

                // Only retry on transient/rate-limit errors
                let is_retryable = matches!(status.as_u16(), 429 | 500 | 502 | 503 | 504);
                if is_retryable && attempt < MAX_RETRIES {
                    continue;
                }
                return Err(last_error);
            }

            // Success — process the response below
            // (break out of retry loop with the response)
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // Handle non-streaming JSON response
            if content_type.contains("application/json") {
                return self.handle_json_response(response, &mut on_delta).await;
            }

            // Handle SSE streaming response
            return self
                .handle_sse_stream(
                    response,
                    &messages,
                    &tools,
                    needs_reasoning,
                    &auth_key,
                    &url,
                    &mut on_delta,
                )
                .await;
        }

        Err(last_error)
    }

    /// Handles a non-streaming JSON response from the API.
    async fn handle_json_response<F>(
        &self,
        response: reqwest::Response,
        on_delta: &mut F,
    ) -> Result<(String, Vec<Value>), String>
    where
        F: FnMut(StreamDelta),
    {
        let json: Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

        if let Some(error) = json.get("error") {
            return Err(format!("API error: {}", error));
        }

        let mut full_text = String::new();
        let mut finalized_tools = Vec::new();

        if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
            if let Some(first) = choices.first() {
                if let Some(message) = first.get("message") {
                    if let Some(content) = message.get("content").and_then(|c| c.as_str()) {
                        full_text = content.to_string();
                        on_delta(StreamDelta::Token(content.to_string()));
                    }
                    if let Some(tools) = message.get("tool_calls").and_then(|t| t.as_array()) {
                        for tc in tools {
                            let id = tc
                                .get("id")
                                .and_then(|id| id.as_str())
                                .unwrap_or_default()
                                .to_string();
                            if let Some(func) = tc.get("function") {
                                let name = func
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or_default()
                                    .to_string();

                                let args_val = if let Some(args_str) =
                                    func.get("arguments").and_then(|a| a.as_str())
                                {
                                    repair_json_arguments(args_str)
                                } else {
                                    func.get("arguments").cloned().unwrap_or_else(|| json!({}))
                                };

                                let tool_json = json!({
                                    "id": id,
                                    "type": "function",
                                    "function": {
                                        "name": name.clone(),
                                        "arguments": args_val.clone()
                                    }
                                });
                                finalized_tools.push(tool_json);

                                on_delta(StreamDelta::ToolCall {
                                    id,
                                    name,
                                    arguments: args_val,
                                });
                            }
                        }
                    }
                }
            }
        }
        on_delta(StreamDelta::Done);

        if finalized_tools.is_empty() {
            finalized_tools.extend(extract_embedded_tool_calls(&full_text));
        }

        if full_text.trim().is_empty() && finalized_tools.is_empty() {
            return Err("The API returned an empty non-streaming response.".to_string());
        }

        Ok((full_text, finalized_tools))
    }

    /// Handles an SSE streaming response, accumulating tool calls and tokens.
    #[allow(clippy::too_many_arguments)]
    async fn handle_sse_stream<F>(
        &self,
        response: reqwest::Response,
        messages: &[Value],
        tools: &[Value],
        needs_reasoning: bool,
        api_key: &str,
        url: &str,
        on_delta: &mut F,
    ) -> Result<(String, Vec<Value>), String>
    where
        F: FnMut(StreamDelta),
    {
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

            if let Some(error) = parsed.get("error") {
                return Err(format!("Stream error: {}", error));
            }

            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                if let Some(first_choice) = choices.first() {
                    let delta = first_choice.get("delta");

                    // 1. Text token delta (supports both standard content and deepseek-reasoner reasoning_content)
                    if let Some(content) = delta
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        if !content.is_empty() {
                            full_text.push_str(content);
                            on_delta(StreamDelta::Token(content.to_string()));
                        }
                    } else if let Some(reasoning) = delta
                        .and_then(|d| d.get("reasoning_content"))
                        .and_then(|c| c.as_str())
                    {
                        if !reasoning.is_empty() {
                            on_delta(StreamDelta::Token(reasoning.to_string()));
                        }
                    }

                    // 2. Fragmented tool call accumulation
                    if let Some(tool_calls) = delta
                        .and_then(|d| d.get("tool_calls"))
                        .and_then(|tc| tc.as_array())
                    {
                        for tc in tool_calls {
                            let index =
                                tc.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
                            let acc = tool_accumulators.entry(index).or_default();

                            if let Some(id) = tc.get("id").and_then(|s| s.as_str()) {
                                acc.id = id.to_string();
                            }

                            if let Some(func) = tc.get("function") {
                                if let Some(name) = func.get("name").and_then(|n| n.as_str()) {
                                    acc.name = name.to_string();
                                }
                                if let Some(args_chunk) =
                                    func.get("arguments").and_then(|a| a.as_str())
                                {
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
        for (idx, acc) in tool_accumulators.into_iter() {
            let call_id = if acc.id.trim().is_empty() {
                format!("call_{}", idx)
            } else {
                acc.id
            };
            let args_value: Value = repair_json_arguments(&acc.arguments_buffer);
            let tool_json = json!({
                "id": call_id.clone(),
                "type": "function",
                "function": {
                    "name": acc.name.clone(),
                    "arguments": args_value.clone()
                }
            });

            on_delta(StreamDelta::ToolCall {
                id: call_id,
                name: acc.name,
                arguments: args_value,
            });

            finalized_tools.push(tool_json);
        }

        on_delta(StreamDelta::Done);

        if finalized_tools.is_empty() {
            finalized_tools.extend(extract_embedded_tool_calls(&full_text));
        }

        if full_text.trim().is_empty() && finalized_tools.is_empty() {
            tracing::info!(
                "SSE stream was empty, attempting non-streaming request fallback to {}",
                url
            );
            let mut fallback_payload =
                self.prepare_payload(messages.to_vec(), tools.to_vec(), needs_reasoning);
            if let Some(map) = fallback_payload.as_object_mut() {
                map.insert("stream".to_string(), json!(false));
            }
            if let Ok(resp) = self
                .http
                .post(url)
                .bearer_auth(api_key)
                .json(&fallback_payload)
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<Value>().await {
                        if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                            if let Some(first) = choices.first() {
                                if let Some(message) = first.get("message") {
                                    let mut fallback_tools = Vec::new();
                                    if let Some(tools_arr) = message.get("tool_calls").and_then(|t| t.as_array()) {
                                        for (idx, tc) in tools_arr.iter().enumerate() {
                                            let id = tc
                                                .get("id")
                                                .and_then(|s| s.as_str())
                                                .filter(|s| !s.trim().is_empty())
                                                .map(|s| s.to_string())
                                                .unwrap_or_else(|| format!("call_{}", idx));
                                            if let Some(func) = tc.get("function") {
                                                let name = func
                                                    .get("name")
                                                    .and_then(|n| n.as_str())
                                                    .unwrap_or_default()
                                                    .to_string();
                                                let args_val = if let Some(args_str) =
                                                    func.get("arguments").and_then(|a| a.as_str())
                                                {
                                                    serde_json::from_str(args_str).unwrap_or_else(|_| json!({}))
                                                } else {
                                                    func.get("arguments").cloned().unwrap_or_else(|| json!({}))
                                                };
                                                fallback_tools.push(json!({
                                                    "id": id.clone(),
                                                    "type": "function",
                                                    "function": {
                                                        "name": name.clone(),
                                                        "arguments": args_val.clone()
                                                    }
                                                }));
                                                on_delta(StreamDelta::ToolCall {
                                                    id,
                                                    name,
                                                    arguments: args_val,
                                                });
                                            }
                                        }
                                    }

                                    let maybe_content = message
                                        .get("content")
                                        .and_then(|c| c.as_str())
                                        .or_else(|| {
                                            message
                                                .get("reasoning_content")
                                                .and_then(|c| c.as_str())
                                        });

                                    let has_content = maybe_content.map(|c| !c.trim().is_empty()).unwrap_or(false);
                                    let has_tools = !fallback_tools.is_empty();

                                    if has_content || has_tools {
                                        let final_content = maybe_content.unwrap_or("").to_string();
                                        if has_content {
                                            on_delta(StreamDelta::Token(final_content.clone()));
                                        }
                                        on_delta(StreamDelta::Done);
                                        return Ok((final_content, fallback_tools));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return Err("The API returned an empty stream. Please verify your API key and model in Settings (Ctrl+,).".to_string());
        }

        Ok((full_text, finalized_tools))
    }
}

pub fn extract_embedded_tool_calls(text: &str) -> Vec<Value> {
    let mut result = Vec::new();
    let trimmed = text.trim();

    let normalize_tool_name = |name: &str| -> String {
        let clean = name.trim().to_lowercase();
        match clean.as_str() {
            "windows.settings" | "windows_settings" | "windows_setting" | "windows.setting"
            | "settings" | "system.settings" | "system_settings" | "system_setting"
            | "operating_system_settings" | "os_settings" => "os.settings".to_string(),

            "windows.godseye" | "windows_godseye" | "godseye" | "god_eye" | "gods_eye"
            | "gods.eye" | "surveillance" | "camera_feed" | "cameras_feed" => "os.godseye".to_string(),

            "windows.split" | "windows_split" | "split" | "split_view" | "console" => "os.split".to_string(),

            "windows.legion" | "windows_legion" | "legion" | "iron_legion" | "iron.legion" => "os.legion".to_string(),

            "windows.grid" | "windows_grid" | "grid" | "bento" | "bento_grid" => "os.grid".to_string(),

            "windows.media" | "windows_media" | "media" | "media_control" => "media.control".to_string(),

            "windows.gpu" | "windows_gpu" | "gpu" | "gpu_status" => "hardware.gpu".to_string(),

            "windows.ram" | "windows_ram" | "ram" | "memory" => "hardware.ram".to_string(),

            other => other.to_string(),
        }
    };

    let mut json_candidates = Vec::new();

    // 1. Line-by-line candidate scan (handles `* Tool call: {"name": ...}`)
    for line in text.lines() {
        let line_trim = line.trim();
        if let Some(start) = line_trim.find('{') {
            if let Some(end) = line_trim.rfind('}') {
                if end > start {
                    json_candidates.push(&line_trim[start..=end]);
                }
            }
        }
    }

    // 2. Whole-text candidate scan (in case JSON spans multiple lines)
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end > start {
                json_candidates.push(&trimmed[start..=end]);
            }
        }
    }

    for cand in json_candidates {
        if let Ok(val) = serde_json::from_str::<Value>(cand) {
            if let Some(obj) = val.as_object() {
                // Direct object format: {"name": "windows_settings", "args": { ... }}
                if let Some(name) = obj.get("name").and_then(|n| n.as_str()) {
                    let norm_name = normalize_tool_name(name);
                    let args = obj
                        .get("args")
                        .or_else(|| obj.get("arguments"))
                        .cloned()
                        .unwrap_or_else(|| json!({}));

                    if !result.iter().any(|existing: &Value| {
                        existing
                            .get("function")
                            .and_then(|f| f.get("name"))
                            .and_then(|n| n.as_str())
                            == Some(&norm_name)
                    }) {
                        result.push(json!({
                            "id": format!("call_embedded_{}", result.len()),
                            "type": "function",
                            "function": {
                                "name": norm_name,
                                "arguments": args
                            }
                        }));
                    }
                }

                // Nested in "tool_call": {"tool_call": {"name": ...}}
                if let Some(tc) = obj.get("tool_call").and_then(|t| t.as_object()) {
                    if let Some(name) = tc.get("name").and_then(|n| n.as_str()) {
                        let norm_name = normalize_tool_name(name);
                        let args = tc
                            .get("args")
                            .or_else(|| tc.get("arguments"))
                            .cloned()
                            .unwrap_or_else(|| json!({}));

                        if !result.iter().any(|existing: &Value| {
                            existing
                                .get("function")
                                .and_then(|f| f.get("name"))
                                .and_then(|n| n.as_str())
                                == Some(&norm_name)
                        }) {
                            result.push(json!({
                                "id": format!("call_embedded_{}", result.len()),
                                "type": "function",
                                "function": {
                                    "name": norm_name,
                                    "arguments": args
                                }
                            }));
                        }
                    }
                }

                // Nested in "tool_calls": [{"name": ...}]
                if let Some(tcs) = obj.get("tool_calls").and_then(|t| t.as_array()) {
                    for tc in tcs {
                        let tc_obj = if let Some(func) = tc.get("function").and_then(|f| f.as_object()) {
                            Some(func)
                        } else {
                            tc.as_object()
                        };

                        if let Some(o) = tc_obj {
                            if let Some(name) = o.get("name").and_then(|n| n.as_str()) {
                                let norm_name = normalize_tool_name(name);
                                let args = o
                                    .get("args")
                                    .or_else(|| o.get("arguments"))
                                    .cloned()
                                    .unwrap_or_else(|| json!({}));

                                if !result.iter().any(|existing: &Value| {
                                    existing
                                        .get("function")
                                        .and_then(|f| f.get("name"))
                                        .and_then(|n| n.as_str())
                                        == Some(&norm_name)
                                }) {
                                    result.push(json!({
                                        "id": format!("call_embedded_{}", result.len()),
                                        "type": "function",
                                        "function": {
                                            "name": norm_name,
                                            "arguments": args
                                        }
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if result.is_empty() {
        let lower = text.to_lowercase();
        if lower.contains("windows.settings")
            || lower.contains("windows_settings")
            || lower.contains("windows settings")
            || lower.contains("os.settings")
            || (lower.contains("settings")
                && (lower.contains("tool call")
                    || lower.contains("tool_call")
                    || lower.contains("action space")
                    || lower.contains("action:")))
        {
            result.push(json!({
                "id": "call_embedded_fallback",
                "type": "function",
                "function": {
                    "name": "os.settings",
                    "arguments": {}
                }
            }));
        } else if lower.contains("windows.godseye")
            || lower.contains("windows_godseye")
            || lower.contains("os.godseye")
            || (lower.contains("godseye")
                && (lower.contains("tool call")
                    || lower.contains("tool_call")
                    || lower.contains("action space")
                    || lower.contains("action:")))
        {
            result.push(json!({
                "id": "call_embedded_fallback",
                "type": "function",
                "function": {
                    "name": "os.godseye",
                    "arguments": {}
                }
            }));
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_openai_compatible_remote_and_local_models() {
        let defaults = GlmConfig::default();
        assert!(validate_provider_config(&defaults.base_url, &defaults.heavy_model).is_ok());
        for url in ["http://127.0.0.1:11434/v1", "https://localhost/v1", "https://127.0.0.2/v1", "https://[::1]/v1"] {
            assert!(validate_provider_config(url, "friday-1b-operator").is_ok());
        }
        assert!(validate_provider_config("https://api.deepseek.com/v1", "deepseek-chat").is_ok());
        assert!(validate_provider_config("https://api.openai.com/v1", "gpt-4o").is_ok());
        assert!(validate_provider_config("file:///tmp/model", "gpt-4o").is_err());
        assert!(validate_provider_config(&defaults.base_url, "").is_err());
    }

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
        let tools = vec![json!({
            "type": "function",
            "function": {
                "name": "screen.read",
                "description": "Read screen text"
            }
        })];
        let payload = provider.prepare_payload(messages, tools, false);

        assert_eq!(payload["model"], "glm-4-flash");
        assert_eq!(payload["stream"], true);
        assert_eq!(payload["temperature"], 0.3);
        assert_eq!(payload["tools"][0]["function"]["name"], "screen_read");
    }

    #[test]
    fn test_repair_json_arguments() {
        // Valid JSON
        let valid = r#"{"path": "Desktop/app.html", "content": "<h1>Hello</h1>"}"#;
        let res = repair_json_arguments(valid);
        assert_eq!(res["path"], "Desktop/app.html");
        assert_eq!(res["content"], "<h1>Hello</h1>");

        // Truncated with unclosed quote and unclosed brace
        let truncated = r#"{"path": "Desktop/app.html", "content": "<h1>Hello</h"#;
        let res2 = repair_json_arguments(truncated);
        assert_eq!(res2["path"], "Desktop/app.html");
        assert_eq!(res2["content"], "<h1>Hello</h");

        // Empty string
        let empty = repair_json_arguments("");
        assert_eq!(empty, json!({}));
    }

    #[test]
    fn test_extract_embedded_tool_calls_bullet_format() {
        let text = r#"* Tool call: {"name": "windows_settings", "args": {"target": "operating system"}}"#;
        let tools = extract_embedded_tool_calls(text);
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0]["function"]["name"], "os.settings");
        assert_eq!(tools[0]["function"]["arguments"]["target"], "operating system");
    }

    #[test]
    fn test_extract_embedded_tool_calls_nested_godseye() {
        let text = r#"Certainly! {"tool_call": {"name": "windows.godseye", "args": {}}}"#;
        let tools = extract_embedded_tool_calls(text);
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0]["function"]["name"], "os.godseye");
    }
}
