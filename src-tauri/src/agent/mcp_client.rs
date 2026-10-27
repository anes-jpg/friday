use serde_json::{json, Value};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tracing::info;

pub struct AgentMcpClient {
    child: Child,
}

impl AgentMcpClient {
    pub async fn spawn() -> Result<Self, String> {
        let mut candidates = vec![
            "core/main.py".to_string(),
            "../core/main.py".to_string(),
            "../../core/main.py".to_string(),
        ];

        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                candidates.push(parent.join("core").join("main.py").to_string_lossy().to_string());
                candidates.push(parent.join("../core").join("main.py").to_string_lossy().to_string());
            }
        }

        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            candidates.push(format!("{}\\Desktop\\friday\\core\\main.py", userprofile));
        }

        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            candidates.push(format!("{}\\friday\\core\\main.py", localappdata));
            candidates.push(format!("{}\\Programs\\friday\\core\\main.py", localappdata));
        }

        let script_path = candidates
            .into_iter()
            .find(|p| std::path::Path::new(p).exists())
            .unwrap_or_else(|| "core/main.py".to_string());

        let mut client = Self::spawn_process(&script_path).await?;
        client.perform_handshake().await?;
        Ok(client)
    }

    async fn spawn_process(script_path: &str) -> Result<Self, String> {
        let mut cmd = Command::new("py");
        cmd.arg("-3")
            .arg(script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        cmd.kill_on_drop(true);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn Python MCP server ({}): {}", script_path, e))?;

        info!("Spawned Python LangGraph MCP Server at {}.", script_path);

        Ok(Self {
            child,
        })
    }

    /// Performs the mandatory Model Context Protocol (2024-11-05) initialization handshake
    async fn perform_handshake(&mut self) -> Result<(), String> {
        let stdin = self.child.stdin.as_mut().ok_or("No stdin handle")?;
        let init_req = json!({
            "jsonrpc": "2.0",
            "id": "init_1",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "friday-client",
                    "version": "1.0.0"
                }
            }
        });

        let init_str = init_req.to_string() + "\n";
        stdin
            .write_all(init_str.as_bytes())
            .await
            .map_err(|e| format!("Handshake write failed: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Handshake flush failed: {}", e))?;

        let stdout = self.child.stdout.as_mut().ok_or("No stdout handle")?;
        let mut reader = BufReader::new(stdout);
        let mut init_resp_line = String::new();
        reader
            .read_line(&mut init_resp_line)
            .await
            .map_err(|e| format!("Handshake read failed: {}", e))?;

        let notif = json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let notif_str = notif.to_string() + "\n";
        let stdin = self.child.stdin.as_mut().ok_or("No stdin handle")?;
        stdin
            .write_all(notif_str.as_bytes())
            .await
            .map_err(|e| format!("Notification write failed: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Notification flush failed: {}", e))?;

        info!("Successfully completed MCP handshake with Python core.");
        Ok(())
    }

    /// Generic MCP JSON-RPC 2.0 tool caller with auto-respawn resilience
    pub async fn call_tool(&mut self, name: &str, arguments: Value) -> Result<Value, String> {
        tokio::time::timeout(std::time::Duration::from_secs(30), self.call_tool_internal(name,arguments)).await
            .map_err(|_|"MCP tool timed out; reconcile its outcome before retrying".to_string())?
    }

    async fn call_tool_internal(&mut self, name: &str, arguments: Value) -> Result<Value, String> {
        let stdin = self.child.stdin.as_mut().ok_or("No stdin handle")?;

        let req = json!({
            "jsonrpc": "2.0",
            "id": uuid::Uuid::now_v7().to_string(),
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        });

        let req_str = req.to_string() + "\n";
        stdin
            .write_all(req_str.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())?;

        let stdout = self.child.stdout.as_mut().ok_or("No stdout handle")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        reader
            .read_line(&mut line)
            .await
            .map_err(|e| e.to_string())?;

        let resp: Value = serde_json::from_str(&line)
            .map_err(|e| format!("Failed to parse MCP response '{}': {}", line.trim(), e))?;

        if let Some(err) = resp.get("error") {
            return Err(format!("MCP Error: {}", err));
        }

        if let Some(content_arr) = resp
            .get("result")
            .and_then(|r| r.get("content"))
            .and_then(|c| c.as_array())
        {
            if let Some(first) = content_arr.first() {
                if let Some(text) = first.get("text").and_then(|t| t.as_str()) {
                    if let Ok(parsed) = serde_json::from_str::<Value>(text) {
                        return Ok(parsed);
                    }
                    return Ok(json!({ "result": text }));
                }
            }
        }

        Ok(resp.get("result").cloned().unwrap_or(json!({})))
    }

    pub async fn process_utterance(&mut self, text: &str) -> Result<String, String> {
        let res = self.call_tool("process_utterance", json!({ "text": text })).await?;
        if let Some(s) = res.get("say").and_then(|s| s.as_str()) {
            return Ok(s.to_string());
        }
        if let Some(r) = res.get("result").and_then(|r| r.as_str()) {
            return Ok(r.to_string());
        }
        Ok(res.to_string())
    }

    pub async fn synthesize_tts(&mut self, text: &str) -> Result<String, String> {
        let res = self.call_tool("synthesize_tts", json!({ "text": text })).await?;
        if let Some(p) = res.get("result").and_then(|r| r.as_str()) {
            return Ok(p.to_string());
        }
        if let Some(s) = res.as_str() {
            return Ok(s.to_string());
        }
        Ok(String::new())
    }
}
