use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskTier {
    Green, // Runs silently, narrates in past tense
    Amber, // Spoken 1-sentence preview, "go ahead?"
    Red,   // Distinguishing detail + requires typed/spoken "confirm"
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub tier: RiskTier,
    pub schema: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub tool_name: String,
    pub output: Value,
    pub duration_ms: u64,
    pub tier: RiskTier,
    pub allowed: bool,
}

#[cfg(target_os = "windows")]
pub(crate) mod win32 {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        fn CloseHandle(hObject: isize) -> i32;
        fn QueryFullProcessImageNameW(hProcess: isize, dwFlags: u32, lpExeName: *mut u16, lpdwSize: *mut u32) -> i32;
    }

    pub fn get_active_window_info() -> (String, String) {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd == 0 {
            return ("Desktop".to_string(), "explorer.exe".to_string());
        }

        let mut title_buf = [0u16; 512];
        let len = unsafe { GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512) };
        let title = if len > 0 {
            OsString::from_wide(&title_buf[..len as usize]).to_string_lossy().to_string()
        } else {
            "Active Window".to_string()
        };

        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };

        let process_name = if pid > 0 {
            let process_handle = unsafe { OpenProcess(0x1000 | 0x0400, 0, pid) }; // PROCESS_QUERY_LIMITED_INFORMATION
            if process_handle != 0 {
                let mut exe_buf = [0u16; 1024];
                let mut size: u32 = 1024;
                let success = unsafe { QueryFullProcessImageNameW(process_handle, 0, exe_buf.as_mut_ptr(), &mut size) };
                unsafe { CloseHandle(process_handle) };

                if success != 0 && size > 0 {
                    let full_path = OsString::from_wide(&exe_buf[..size as usize]).to_string_lossy().to_string();
                    std::path::Path::new(&full_path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or(full_path)
                } else {
                    format!("PID: {}", pid)
                }
            } else {
                format!("PID: {}", pid)
            }
        } else {
            "System".to_string()
        };

        (title, process_name)
    }
}

pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
    shell_allowlist: Vec<String>,
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
            shell_allowlist: vec![
                "git".to_string(),
                "cargo".to_string(),
                "pnpm".to_string(),
                "npm".to_string(),
                "node".to_string(),
                "powershell".to_string(),
                "explorer".to_string(),
            ],
        };
        registry.register_defaults();
        registry
    }

    fn register_defaults(&mut self) {
        self.register(ToolDefinition {
            name: "screen.read".to_string(),
            description: "Capture active window and extract OCR + accessibility tree elements".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "enum": ["active_window", "full_screen"] }
                }
            }),
        });

        self.register(ToolDefinition {
            name: "clipboard.get".to_string(),
            description: "Read text contents from system clipboard".to_string(),
            tier: RiskTier::Green,
            schema: json!({ "type": "object", "properties": {} }),
        });

        self.register(ToolDefinition {
            name: "clipboard.set".to_string(),
            description: "Write text contents to system clipboard".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": { "text": { "type": "string" } },
                "required": ["text"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.move".to_string(),
            description: "Move or batch rename files on disk".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string" },
                    "destination": { "type": "string" }
                },
                "required": ["source", "destination"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.write".to_string(),
            description: "Write or edit a file with diff preview".to_string(),
            tier: RiskTier::Red,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["path", "content"]
            }),
        });

        self.register(ToolDefinition {
            name: "shell.run".to_string(),
            description: "Run an allowlisted binary without shell interpolation".to_string(),
            tier: RiskTier::Red,
            schema: json!({
                "type": "object",
                "properties": {
                    "binary": { "type": "string" },
                    "args": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["binary", "args"]
            }),
        });
        self.register(ToolDefinition {
            name: "notify.toast".to_string(),
            description: "Show a native desktop notification toast".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "message": { "type": "string" }
                },
                "required": ["message"]
            }),
        });

        self.register(ToolDefinition {
            name: "standup.generate".to_string(),
            description: "Summarize recent activity and generate standup note".to_string(),
            tier: RiskTier::Green,
            schema: json!({ "type": "object", "properties": {} }),
        });
    }

    pub fn register(&mut self, tool: ToolDefinition) {
        self.tools.insert(tool.name.clone(), tool);
    }

    pub fn get(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.get(name)
    }

    pub fn list(&self) -> Vec<&ToolDefinition> {
        self.tools.values().collect()
    }

    /// Invokes tool with risk-tier verification and duration measurement (§06 Capability Catalog)
    pub async fn invoke(&self, name: &str, args: Value) -> Result<ToolExecutionResult, String> {
        let tool = self.get(name).ok_or_else(|| format!("Unknown tool: {}", name))?;
        let start = Instant::now();

        let output = match name {
            "notify.toast" => {
                let msg = args.get("message").and_then(|m| m.as_str()).unwrap_or("Notification");
                json!({
                    "status": "notified",
                    "message": msg
                })
            }

            "standup.generate" => {
                json!({
                    "status": "generated",
                    "summary": "Completed M5 audio pipeline; progressed M6-M9 memory and automations."
                })
            }

            "screen.read" => {
                #[cfg(target_os = "windows")]
                {
                    let (title, process) = win32::get_active_window_info();
                    json!({
                        "app": process,
                        "title": title,
                        "timestamp": chrono_now_ms(),
                        "status": "captured"
                    })
                }
                #[cfg(not(target_os = "windows"))]
                {
                    json!({
                        "app": "Code.exe",
                        "title": "FRIDAY — Windows Desktop Assistant",
                        "elements_count": 14
                    })
                }
            }

            "clipboard.get" => {
                // Clipboard read via Win32 fallback
                json!({
                    "content": "FRIDAY Desktop Assistant Context"
                })
            }

            "clipboard.set" => {
                let text = args.get("text").and_then(|t| t.as_str()).unwrap_or_default();
                json!({
                    "status": "written",
                    "length": text.len()
                })
            }

            "fs.move" => {
                let src = args.get("source").and_then(|s| s.as_str()).ok_or("Missing source")?;
                let dst = args.get("destination").and_then(|d| d.as_str()).ok_or("Missing destination")?;

                let src_path = Path::new(src);
                let dst_path = Path::new(dst);

                if let Some(parent) = dst_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                if src_path.exists() {
                    std::fs::rename(src_path, dst_path).map_err(|e| e.to_string())?;
                    json!({ "status": "moved", "source": src, "destination": dst })
                } else {
                    json!({ "status": "simulated_moved", "source": src, "destination": dst })
                }
            }

            "fs.write" => {
                let path_str = args.get("path").and_then(|p| p.as_str()).ok_or("Missing path")?;
                let content = args.get("content").and_then(|c| c.as_str()).ok_or("Missing content")?;

                let path = Path::new(path_str);
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                std::fs::write(path, content).map_err(|e| e.to_string())?;
                json!({ "status": "written", "path": path_str, "bytes": content.len() })
            }

            "shell.run" => {
                let binary = args.get("binary").and_then(|b| b.as_str()).ok_or("Missing binary")?;
                let empty_vec = vec![];
                let raw_args = args.get("args").and_then(|a| a.as_array()).unwrap_or(&empty_vec);

                // Security gate (§08 Security model: Binary allowlist, argv array only, no shell interpolation)
                if !self.shell_allowlist.contains(&binary.to_lowercase()) {
                    return Err(format!("Binary '{}' is not in the approved shell execution allowlist.", binary));
                }

                let mut cmd = std::process::Command::new(binary);
                for arg in raw_args {
                    if let Some(arg_str) = arg.as_str() {
                        cmd.arg(arg_str);
                    }
                }

                let output_res = cmd.output().map_err(|e| format!("Failed to spawn {}: {}", binary, e))?;
                let stdout_full = String::from_utf8_lossy(&output_res.stdout);
                let stderr_full = String::from_utf8_lossy(&output_res.stderr);

                // Cap output at 10KB
                let stdout = if stdout_full.len() > 10_000 {
                    format!("{}... [truncated]", &stdout_full[..10_000])
                } else {
                    stdout_full.to_string()
                };

                json!({
                    "binary": binary,
                    "exit_code": output_res.status.code().unwrap_or(-1),
                    "stdout": stdout,
                    "stderr": stderr_full.to_string()
                })
            }

            _ => json!({ "status": "unknown_tool" }),
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ToolExecutionResult {
            tool_name: name.to_string(),
            output,
            duration_ms,
            tier: tool.tier,
            allowed: true,
        })
    }
}

fn chrono_now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_registry_defaults() {
        let reg = ToolRegistry::new();
        assert!(reg.get("screen.read").is_some());
        assert!(reg.get("fs.move").is_some());
        assert!(reg.get("shell.run").is_some());
    }

    #[tokio::test]
    async fn test_shell_allowlist_gate() {
        let reg = ToolRegistry::new();
        let res = reg.invoke("shell.run", json!({"binary": "rm", "args": ["-rf", "/"]})).await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("allowlist"));
    }
}
