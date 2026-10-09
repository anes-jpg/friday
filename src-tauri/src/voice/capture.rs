use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use tauri::Emitter;
use tracing::{error, info};

use crate::agent::loop_legacy::AgentCore;
use crate::agent::machine::HarnessKernel;

pub struct SherpaAudioNode {
    _kernel: Arc<HarnessKernel>,
    _agent: Arc<AgentCore>,
    app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
    active_child: Arc<Mutex<Option<Child>>>,
}

impl SherpaAudioNode {
    pub fn new(kernel: Arc<HarnessKernel>, agent: Arc<AgentCore>) -> Self {
        Self {
            _kernel: kernel,
            _agent: agent,
            app_handle: Arc::new(RwLock::new(None)),
            active_child: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, app: tauri::AppHandle) {
        if let Ok(mut lock) = self.app_handle.write() {
            *lock = Some(app);
        }
    }

    pub fn stop(&self) {
        if let Ok(mut lock) = self.active_child.lock() {
            if let Some(mut child) = lock.take() {
                let _ = child.kill();
                let _ = child.wait();
                info!("Stopped STT daemon process.");
            }
        }
    }

    pub fn start(&self) -> Result<(), String> {
        // If already running, do not re-spawn
        if let Ok(mut lock) = self.active_child.lock() {
            if let Some(ref mut child) = *lock {
                if let Ok(None) = child.try_wait() {
                    info!("Whistle STT Daemon is already active.");
                    return Ok(());
                }
            }
        }

        info!("Starting Whistle STT Daemon...");

        let app_handle_clone = self.app_handle.clone();
        let active_child_clone = self.active_child.clone();

        // Resolve absolute path to core/stt_daemon.py
        let candidates = [
            std::path::PathBuf::from(r"C:\Users\anesx\Desktop\friday\core\stt_daemon.py"),
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("core").join("stt_daemon.py")))
                .unwrap_or_default(),
            std::path::PathBuf::from("../core/stt_daemon.py"),
            std::path::PathBuf::from("core/stt_daemon.py"),
        ];

        let found_script = candidates.into_iter().find(|p| p.exists());
        let script_path = match found_script {
            Some(p) => p,
            None => {
                let err_msg = "Could not find core/stt_daemon.py in standard locations.";
                error!("{}", err_msg);
                return Err(err_msg.to_string());
            }
        };

        let script_dir = script_path.parent().unwrap_or(std::path::Path::new("."));

        let mut cmd = Command::new("py");
        cmd.arg("-3")
            .arg(&script_path)
            .current_dir(script_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("Failed to spawn STT daemon: {}", e);
                error!("{}", err_msg);
                return Err(err_msg);
            }
        };

        let stdout = child.stdout.take().ok_or("Failed to capture STT stdout")?;

        if let Ok(mut lock) = active_child_clone.lock() {
            *lock = Some(child);
        }

        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);

            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        if let Ok(json) = serde_json::from_str::<Value>(&l) {
                            if let Some(status) = json.get("status") {
                                info!("Whistle Daemon Status: {}", status);
                            }
                            if let Some(text) = json.get("text").and_then(|t| t.as_str()) {
                                let trimmed = text.trim();
                                if !trimmed.is_empty() {
                                    info!("Heard from STT daemon: {}", trimmed);
                                    if let Ok(guard) = app_handle_clone.read() {
                                        if let Some(ref app) = *guard {
                                            let _ = app.emit("friday://voice-command", trimmed);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Error reading from STT daemon: {}", e);
                        break;
                    }
                }
            }

            if let Ok(mut lock) = active_child_clone.lock() {
                if let Some(mut child) = lock.take() {
                    let _ = child.wait();
                }
            }
        });

        Ok(())
    }
}

pub struct WakeWordStub {}
impl WakeWordStub {
    pub fn enable(&self, _s: Option<f32>) {}
    pub fn disable(&self) {}
    pub fn get_status(&self) -> crate::voice::wakeword::WakeWordStatus {
        crate::voice::wakeword::WakeWordStatus {
            enabled: true,
            sensitivity: 0.5,
            last_detected_ms: Some(0),
            trigger_word: "friday".to_string(),
        }
    }
    pub fn set_sensitivity(&self, _s: f32) {}
}

pub struct AudioCaptureManager {
    node: SherpaAudioNode,
    pub wake_word: WakeWordStub,
}

impl AudioCaptureManager {
    pub fn new(kernel: Arc<HarnessKernel>, agent: Arc<AgentCore>) -> Self {
        Self {
            node: SherpaAudioNode::new(kernel, agent),
            wake_word: WakeWordStub {},
        }
    }
    pub fn start_capture(&self) -> Result<(), String> {
        self.node.start()
    }
    pub fn stop_capture(&self) {
        self.node.stop();
    }
    pub fn get_current_rms(&self) -> f32 {
        0.0
    }
    pub fn ensure_stream_running(&self) -> Result<(), String> {
        self.start_capture()
    }
    pub fn shutdown(&self) {
        self.node.stop();
    }
    pub fn set_stt_cadence(&self, _frames: usize) {}
    pub fn set_app_handle(&self, app: tauri::AppHandle) {
        self.node.set_app_handle(app);
    }
    pub fn set_phrase_bank(&self, _pb: Arc<crate::voice::phrasebank::PhraseBank>) {}
}
