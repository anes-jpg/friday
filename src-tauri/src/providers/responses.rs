use crate::providers::glm::{GlmProvider, StreamDelta};
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub fn input_items(messages: &[Value]) -> Vec<Value> {
    let mut input = Vec::new();
    for message in messages {
        if message["role"] == "tool" {
            input.push(json!({"type":"function_call_output","call_id":message["tool_call_id"],"output":message["content"].as_str().unwrap_or("")}));
            continue;
        }
        if let Some(content) = message.get("content").filter(|content| !content.is_null()) {
            input.push(json!({"role":message["role"],"content":content}));
        }
        if let Some(calls) = message["tool_calls"].as_array() {
            for call in calls {
                input.push(json!({"type":"function_call","call_id":call["id"],"name":call["function"]["name"],"arguments":call["function"]["arguments"]}));
            }
        }
    }
    input
}
pub fn output_items(response: &Value) -> Result<(String, Vec<Value>), String> {
    if response["status"] == "failed" || response["status"] == "incomplete" {
        return Err(format!("Responses request did not complete: {}", response.get("error").or(response.get("incomplete_details")).unwrap_or(&Value::Null)));
    }
    let mut text = String::new();
    let mut calls = Vec::new();
    if let Some(output) = response["output"].as_array() {
        for item in output {
            if item["type"] == "function_call" {
                let arguments = serde_json::from_str::<Value>(item["arguments"].as_str().unwrap_or("{}")).map_err(|e| format!("Invalid tool arguments: {e}"))?;
                calls.push(json!({"id":item["call_id"],"type":"function","function":{"name":item["name"],"arguments":arguments}}));
            }
            if let Some(content) = item["content"].as_array() {
                for part in content {
                    if part["type"] == "output_text" { text.push_str(part["text"].as_str().unwrap_or("")); }
                    if part["type"] == "refusal" { text.push_str(part["refusal"].as_str().unwrap_or("")); }
                }
            }
        }
    }
    Ok((text, calls))
}
impl GlmProvider {
    pub async fn stream_responses<F>(&self, messages: Vec<Value>, tools: Vec<Value>, needs_reasoning: bool, mut on_delta: F) -> Result<(String, Vec<Value>), String>
    where F: FnMut(StreamDelta) {
        let mut payload = json!({"model":self.select_model(needs_reasoning),"input":input_items(&messages),"stream":true,"store":false});
        if !tools.is_empty() {
            payload["tools"] = Value::Array(tools.iter().filter_map(|tool| tool.get("function")).map(|function| {
                let mut definition = function.clone();
                definition["type"] = json!("function");
                definition["strict"] = json!(false);
                definition
            }).collect());
        }
        let mut request = self.http.post(&self.config.base_url).json(&payload);
        let key = self.get_effective_api_key();
        if !key.is_empty() { request = request.bearer_auth(key); }
        let response = request.send().await.map_err(|e| format!("Responses connection failed: {e}"))?;
        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("Responses returned HTTP {status}"));
        }
        let json_response = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|header| header.to_str().ok()).is_some_and(|header| header.contains("application/json"));
        if json_response {
            let response: Value = response.json().await.map_err(|e| e.to_string())?;
            let (text, calls) = output_items(&response)?;
            if text.is_empty() && calls.is_empty() { return Err("Responses returned an empty result".into()); }
            if !text.is_empty() { on_delta(StreamDelta::Token(text.clone())); }
            emit_calls(&calls, &mut on_delta);
            on_delta(StreamDelta::Done);
            return Ok((text, calls));
        }
        let mut stream = response.bytes_stream().eventsource();
        let mut text = String::new();
        let mut items = BTreeMap::<usize, Value>::new();
        let mut completed = false;
        while let Some(event) = stream.next().await {
            let event = event.map_err(|e| format!("Responses stream interrupted: {e}"))?;
            if event.data.trim() == "[DONE]" { break; }
            let data: Value = serde_json::from_str(&event.data).map_err(|e| format!("Invalid Responses event: {e}"))?;
            match data["type"].as_str().unwrap_or("") {
                "response.output_text.delta" => {
                    let delta = data["delta"].as_str().unwrap_or("");
                    text.push_str(delta);
                    on_delta(StreamDelta::Token(delta.to_string()));
                }
                "response.output_item.done" => {
                    let index = data["output_index"].as_u64().unwrap_or(0) as usize;
                    items.insert(index, data["item"].clone());
                }
                "response.completed" => {
                    let (final_text, calls) = output_items(&data["response"])?;
                    if text.is_empty() { text = final_text; if !text.is_empty() { on_delta(StreamDelta::Token(text.clone())); } }
                    if !calls.is_empty() {
                        emit_calls(&calls, &mut on_delta);
                        on_delta(StreamDelta::Done);
                        return Ok((text, calls));
                    }
                    completed = true;
                    break;
                }
                "response.failed" | "response.incomplete" | "error" => return Err(format!("Responses failed: {}", data.get("error").or_else(|| data.get("response")).unwrap_or(&data))),
                _ => {}
            }
        }
        if !completed { return Err("Responses stream ended before completion".into()); }
        let (_, calls) = output_items(&json!({"output":items.into_values().collect::<Vec<_>>()}))?;
        if text.trim().is_empty() && calls.is_empty() { return Err("Responses returned an empty result".into()); }
        emit_calls(&calls, &mut on_delta);
        on_delta(StreamDelta::Done);
        Ok((text, calls))
    }
}
fn emit_calls<F: FnMut(StreamDelta)>(calls: &[Value], on_delta: &mut F) {
    for call in calls {
        on_delta(StreamDelta::ToolCall { id: call["id"].as_str().unwrap_or("").into(), name: call["function"]["name"].as_str().unwrap_or("").into(), arguments: call["function"]["arguments"].clone() });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn converts_tool_round_trip_without_losing_call_ids() {
        let items = input_items(&[json!({"role":"assistant","content":null,"tool_calls":[{"id":"call-1","function":{"name":"read","arguments":"{}"}}]}), json!({"role":"tool","tool_call_id":"call-1","content":"done"})]);
        assert_eq!(items[0]["call_id"], "call-1");
        assert_eq!(items[1]["type"], "function_call_output");
        assert_eq!(items[1]["call_id"], "call-1");
    }
    #[test]
    fn parses_text_and_calls_and_rejects_incomplete_results() {
        let response = json!({"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"Hello"}]},{"type":"function_call","call_id":"call-2","name":"read","arguments":"{\"path\":\"test\"}"}]});
        let (text, calls) = output_items(&response).expect("valid response");
        assert_eq!(text, "Hello");
        assert_eq!(calls[0]["function"]["arguments"]["path"], "test");
        assert!(output_items(&json!({"status":"incomplete"})).is_err());
    }
    async fn test_server(body: String, status: &str) -> (String, tokio::task::JoinHandle<(String, Value)>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("local test listener");
        let address = listener.local_addr().expect("listener address");
        let status = status.to_string();
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("test connection");
            let mut request = Vec::new();
            let mut buffer = [0u8; 1024];
            let boundary = loop {
                let count = socket.read(&mut buffer).await.expect("read headers");
                assert!(count > 0);
                request.extend_from_slice(&buffer[..count]);
                if let Some(boundary) = request.windows(4).position(|bytes| bytes == b"\r\n\r\n") { break boundary + 4; }
            };
            let headers = String::from_utf8_lossy(&request[..boundary]).to_string();
            let length: usize = headers.lines().find_map(|line| line.to_lowercase().strip_prefix("content-length:").map(|value| value.trim().parse().expect("body length"))).expect("content length");
            while request.len() < boundary + length {
                let count = socket.read(&mut buffer).await.expect("read body");
                assert!(count > 0); request.extend_from_slice(&buffer[..count]);
            }
            let payload: Value = serde_json::from_slice(&request[boundary..boundary + length]).expect("JSON request");
            let response = format!("HTTP/1.1 {status}\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
            // Split framing and UTF-8 arbitrarily to exercise the real HTTP/SSE parser.
            for chunk in response.as_bytes().chunks(7) {
                socket.write_all(chunk).await.expect("write event fragment");
                tokio::task::yield_now().await;
            }
            socket.shutdown().await.expect("close test stream");
            (headers, payload)
        });
        (format!("http://{address}/v1/responses"), task)
    }
    fn provider(url: String, key: &str) -> GlmProvider {
        let mut provider = GlmProvider::new(crate::providers::glm::GlmConfig {
            base_url: url, heavy_model: "vendor/exact:model".into(), light_model: "small:model".into(), api_key: key.into(),
        });
        provider.isolated_credentials = true;
        provider
    }
    #[tokio::test]
    async fn fragmented_transport_preserves_text_tool_ids_and_credentials() {
        let body = [
            json!({"type":"response.output_text.delta","delta":"Héllo "}),
            json!({"type":"response.output_item.done","output_index":1,"item":{"type":"function_call","call_id":"call-x","name":"window.list","arguments":"{}"}}),
            json!({"type":"response.completed","response":{"status":"completed","output":[{"type":"function_call","call_id":"call-x","name":"window.list","arguments":"{}"}]}}),
        ].into_iter().map(|event| format!("data: {event}\n\n")).collect::<String>();
        let (url, request) = test_server(body, "200 OK").await;
        let mut deltas = Vec::new();
        let (text, calls) = provider(url, "test-profile-key").stream_completion(
            vec![json!({"role":"user","content":"List my windows"})],
            vec![json!({"type":"function","function":{"name":"window.list","parameters":{"type":"object","properties":{}}}})],
            true, |delta| deltas.push(delta),
        ).await.expect("completed response");
        assert_eq!(text, "Héllo ");
        assert_eq!(calls[0]["id"], "call-x");
        assert_eq!(calls[0]["function"]["arguments"], json!({}));
        assert!(matches!(deltas.last(), Some(StreamDelta::Done)));
        let (headers, payload) = request.await.expect("request captured");
        assert!(headers.to_lowercase().contains("authorization: bearer test-profile-key"));
        assert_eq!(payload["model"], "vendor/exact:model");
        assert_eq!(payload["store"], false);
        assert_eq!(payload["tools"][0]["type"], "function");
    }
    #[tokio::test]
    async fn truncated_transport_is_an_error_and_emits_no_done() {
        let (url, request) = test_server("data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n".into(), "200 OK").await;
        let mut done = false;
        let result = provider(url, "").stream_completion(vec![], vec![], false, |delta| { if matches!(delta, StreamDelta::Done) { done = true; } }).await;
        assert!(result.expect_err("truncated stream must fail").contains("before completion"));
        assert!(!done);
        let (headers, payload) = request.await.expect("request captured");
        assert!(!headers.to_lowercase().contains("authorization:"));
        assert_eq!(payload["model"], "small:model");
    }
    #[tokio::test]
    async fn http_error_cannot_be_reported_as_completed() {
        let (url, request) = test_server("Unavailable".into(), "503 Service Unavailable").await;
        let error = provider(url, "").stream_completion(vec![], vec![], true, |_| {}).await.expect_err("HTTP failure");
        assert!(error.contains("503"));
        request.await.expect("request captured");
    }

}
