pub mod agent;
pub mod memory;
pub mod providers;
pub mod scheduler;
pub mod skills;
pub mod tools;
pub mod voice;

use agent::{AgentCore, PendingPlan, TurnResult};
use memory::db::{Database, DbAuditEntry, DbAutomation, DbFact, DbMessage, DbSkill, DbThread};
use providers::glm::{GlmConfig, GlmProvider};
use scheduler::SchedulerManager;
use serde::{Deserialize, Serialize};
use skills::SkillRegistry;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use voice::AudioCaptureManager;

pub struct AppState {
    pub agent: Arc<AgentCore>, // Keeping legacy for now in case of deep dependencies
    pub kernel: Arc<crate::agent::machine::HarnessKernel>,
    pub audio_capture: Arc<AudioCaptureManager>,
    pub scheduler: Arc<SchedulerManager>,
    pub skills: Arc<SkillRegistry>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TelemetryResponse {
    pub cpu_percent: f32,
    pub idle_rss_mb: u32,
    pub peak_rss_mb: u32,
    pub glm_ttft_ms: u32,
    pub last_voice_roundtrip_ms: u32,
    pub active_window: String,
    pub clipboard_preview: String,
    pub offline_mode: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AudioRmsResponse {
    pub mic_rms: f32,
    pub output_rms: f32,
}

#[tauri::command]
async fn submit_utterance(
    utterance: String,
    mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<TurnResult, String> {
    let mode_str = mode.unwrap_or_else(|| "command".to_string());
    state.agent.execute_turn(&utterance, &mode_str).await
}

#[tauri::command]
async fn confirm_plan(plan_id: String, state: State<'_, AppState>) -> Result<PendingPlan, String> {
    state.agent.confirm_plan(&plan_id).await.map(|(p, _)| p)
}

#[tauri::command]
fn undo_last(state: State<'_, AppState>) -> Result<String, String> {
    state.agent.undo_last()
}

#[tauri::command]
fn start_mic_capture(state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.start_capture()
}

#[tauri::command]
fn stop_mic_capture(state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.stop_capture();
    Ok(())
}

#[tauri::command]
fn start_listening(state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.start_capture()
}

#[tauri::command]
fn stop_listening(state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.stop_capture();
    Ok(())
}

#[tauri::command]
fn get_audio_rms(state: State<'_, AppState>) -> AudioRmsResponse {
    AudioRmsResponse {
        mic_rms: state.audio_capture.get_current_rms(),
        output_rms: state.agent.phrase_bank.get_output_rms(),
    }
}

#[tauri::command]
fn barge_in(state: State<'_, AppState>) -> Result<(), String> {
    state.agent.phrase_bank.barge_in();
    Ok(())
}

#[tauri::command]
fn is_speaking(state: State<'_, AppState>) -> bool {
    state.agent.phrase_bank.is_speaking()
}

#[tauri::command]
fn speak_text(text: String, state: State<'_, AppState>) -> Result<(), String> {
    state.agent.phrase_bank.speak_sentence(&text);
    Ok(())
}

// --- M5b Wake-Word IPC Commands ---
#[tauri::command]
fn start_wake_word(
    sensitivity: Option<f32>,
    state: State<'_, AppState>,
) -> Result<voice::WakeWordStatus, String> {
    state.audio_capture.wake_word.enable(sensitivity);
    state.audio_capture.ensure_stream_running()?;
    Ok(state.audio_capture.wake_word.get_status())
}

#[tauri::command]
fn stop_wake_word(state: State<'_, AppState>) -> Result<voice::WakeWordStatus, String> {
    state.audio_capture.wake_word.disable();
    state.audio_capture.stop_capture();
    Ok(state.audio_capture.wake_word.get_status())
}

#[tauri::command]
fn get_wake_word_status(state: State<'_, AppState>) -> voice::WakeWordStatus {
    state.audio_capture.wake_word.get_status()
}

#[tauri::command]
fn set_wake_word_sensitivity(sensitivity: f32, state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.wake_word.set_sensitivity(sensitivity);
    Ok(())
}

// --- M6 Facts & Memory IPC Commands ---
#[tauri::command]
fn get_facts(state: State<'_, AppState>) -> Result<Vec<DbFact>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_all_facts()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_fact(
    content: String,
    confidence: Option<f32>,
    state: State<'_, AppState>,
) -> Result<DbFact, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let fact = DbFact {
        id: format!("fact-{}", now.as_millis()),
        content,
        confidence: confidence.unwrap_or(0.95),
        source_message_id: Some("user-memory".to_string()),
        created_at: now.as_secs() as i64,
    };
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .insert_fact(&fact)
        .map_err(|e| e.to_string())?;
    Ok(fact)
}

#[tauri::command]
fn delete_fact(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .delete_fact(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_audit_log(state: State<'_, AppState>) -> Result<Vec<DbAuditEntry>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_audit_log(50)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_threads(state: State<'_, AppState>) -> Result<Vec<DbThread>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_threads()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_active_thread(state: State<'_, AppState>) -> Result<String, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_active_thread_id()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_active_thread(thread_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.agent.db.lock().map_err(|e| e.to_string())?;
    db.ensure_thread_exists(&thread_id, "Session")
        .map_err(|e| e.to_string())?;
    db.set_active_thread_id(&thread_id)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_messages(thread_id: String, state: State<'_, AppState>) -> Result<Vec<DbMessage>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_messages_for_thread(&thread_id)
        .map_err(|e| e.to_string())
}

// --- M7 Automations IPC Commands ---
#[tauri::command]
fn get_automations(state: State<'_, AppState>) -> Result<Vec<DbAutomation>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_automations()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_automation(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .toggle_automation(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn trigger_automation(id: String, state: State<'_, AppState>) -> Result<String, String> {
    state.scheduler.trigger_now(&id).await
}

// --- M8 Skills IPC Commands ---
#[tauri::command]
fn get_skills(state: State<'_, AppState>) -> Result<Vec<DbSkill>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_skills()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_skill(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .toggle_skill(&id)
        .map_err(|e| e.to_string())
}

// --- Windows Credential Manager, Keyring & GLM Settings IPC Commands (§D10) ---
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlmSettingsDto {
    #[serde(alias = "base_url")]
    pub base_url: String,
    #[serde(alias = "heavy_model")]
    pub heavy_model: String,
    #[serde(alias = "light_model")]
    pub light_model: String,
    #[serde(alias = "has_key")]
    pub has_key: bool,
    #[serde(alias = "key_length")]
    pub key_length: Option<usize>,
}

#[tauri::command]
fn get_glm_settings(state: State<'_, AppState>) -> Result<GlmSettingsDto, String> {
    let (base_url, heavy_model, light_model, config_key) = {
        let glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
        (
            glm.config.base_url.clone(),
            glm.config.heavy_model.clone(),
            glm.config.light_model.clone(),
            glm.config.api_key.clone(),
        )
    };
    let db_key = if let Ok(db) = state.agent.db.lock() {
        match db.get_setting("glm_api_key") {
            Ok(Some(k)) => k,
            _ => String::new(),
        }
    } else {
        String::new()
    };
    let keyring_key = GlmProvider::get_key_from_keyring().unwrap_or_default();
    let env_key = std::env::var("GLM_API_KEY")
        .or_else(|_| std::env::var("ZHIPU_API_KEY"))
        .unwrap_or_default();

    let key_length = if !config_key.trim().is_empty() {
        Some(config_key.trim().len())
    } else if !db_key.trim().is_empty() {
        Some(db_key.trim().len())
    } else if !keyring_key.trim().is_empty() {
        Some(keyring_key.trim().len())
    } else if !env_key.trim().is_empty() {
        Some(env_key.trim().len())
    } else {
        None
    };

    let has_key = key_length.is_some();

    Ok(GlmSettingsDto {
        base_url,
        heavy_model,
        light_model,
        has_key,
        key_length,
    })
}

#[tauri::command]
fn update_glm_settings(
    base_url: String,
    heavy_model: String,
    light_model: String,
    api_key: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let clean_key = api_key
        .as_ref()
        .map(|k| k.trim())
        .filter(|k| !k.is_empty() && !k.contains('•'));

    // 1. Persist to SQLite settings table
    if let Ok(db) = state.agent.db.lock() {
        let _ = db.save_setting("glm_base_url", &base_url);
        let _ = db.save_setting("glm_heavy_model", &heavy_model);
        let _ = db.save_setting("glm_light_model", &light_model);
        if let Some(key) = clean_key {
            let _ = db.save_setting("glm_api_key", key);
        }
    }

    // 2. Update in-memory GlmProvider config first so it works even if keyring fails
    {
        let mut glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
        glm.config.base_url = base_url.clone();
        glm.config.heavy_model = heavy_model.clone();
        glm.config.light_model = light_model;
        if let Some(key) = clean_key {
            glm.config.api_key = key.to_string();
        }
    }

    // 2b. Synchronize with active model in AiRouter
    if let Ok(mut router) = state.agent.router.lock() {
        let matching_id = router
            .models
            .iter()
            .find(|m| {
                m.id.eq_ignore_ascii_case(&heavy_model) || m.name.eq_ignore_ascii_case(&heavy_model)
            })
            .map(|m| m.id.clone());

        if let Some(target_id) = matching_id {
            for m in &mut router.models {
                m.is_active = m.id == target_id;
                if m.is_active {
                    m.base_url = base_url.clone();
                    if let Some(key) = clean_key {
                        m.api_key = Some(key.to_string());
                    }
                }
            }
        } else if let Some(active) = router.models.iter_mut().find(|m| m.is_active) {
            active.base_url = base_url.clone();
            active.name = heavy_model.clone();
            if let Some(key) = clean_key {
                active.api_key = Some(key.to_string());
            }
        }

        if let Some(active_model) = router.get_active_model().cloned() {
            if let Ok(db) = state.agent.db.lock() {
                let _ = db.save_ai_model(&active_model);
            }
        }
    }

    // 3. Best-effort save to Windows Credential Manager
    if let Some(key) = clean_key {
        let _ = GlmProvider::save_key_to_keyring(key);
    }

    Ok(())
}

fn spawn_piper_service_if_needed() {
    std::thread::spawn(|| {
        // Quick TCP connection test to 127.0.0.1:8880 without needing Tokio reactor
        if std::net::TcpStream::connect_timeout(
            &std::net::SocketAddr::from(([127, 0, 0, 1], 8880)),
            std::time::Duration::from_millis(500),
        )
        .is_ok()
        {
            return; // Already listening!
        }

        let python_execs = [
            r"C:\Users\anesx\AppData\Local\Programs\Python\Python312\python.exe",
            "python.exe",
            "python",
            "py",
        ];

        let mut script_candidates = vec![
            std::path::PathBuf::from(r"C:\Users\anesx\Desktop\friday\scripts\piper_server.py"),
            std::path::PathBuf::from("scripts/piper_server.py"),
            std::path::PathBuf::from("../scripts/piper_server.py"),
            std::path::PathBuf::from("../../scripts/piper_server.py"),
        ];

        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                script_candidates.push(parent.join("scripts").join("piper_server.py"));
                if let Some(gp) = parent.parent() {
                    script_candidates.push(gp.join("scripts").join("piper_server.py"));
                    if let Some(ggp) = gp.parent() {
                        script_candidates.push(ggp.join("scripts").join("piper_server.py"));
                    }
                }
            }
        }

        let script = script_candidates.into_iter().find(|p| p.exists());
        if let Some(script_path) = script {
            for py in &python_execs {
                let mut cmd = std::process::Command::new(py);
                if *py == "py" {
                    cmd.arg("-3.12");
                }
                cmd.arg(&script_path).arg("8880");
                if let Some(script_dir) = script_path.parent() {
                    if let Some(project_root) = script_dir.parent() {
                        cmd.current_dir(project_root);
                    }
                }
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                if cmd.spawn().is_ok() {
                    tracing::info!("[Piper TTS] Auto-spawned background neural speech runtime daemon.");
                    break;
                }
            }
        }
    });
}

fn spawn_kokoro_service_if_needed() {
    spawn_piper_service_if_needed();
}

#[tauri::command]
async fn get_piper_status() -> Result<bool, String> {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1000))
        .build()
    {
        Ok(c) => c,
        Err(e) => return Err(e.to_string()),
    };
    let is_ok = match client.get("http://127.0.0.1:8880/v1/health").send().await {
        Ok(r) => r.status().is_success(),
        Err(_) => false,
    };
    if !is_ok {
        spawn_piper_service_if_needed();
    }
    Ok(is_ok)
}

#[tauri::command]
async fn get_kokoro_status() -> Result<bool, String> {
    get_piper_status().await
}

#[tauri::command]
fn get_ai_models(
    state: State<'_, AppState>,
) -> Result<Vec<crate::providers::models::AiModel>, String> {
    if let Ok(router) = state.agent.router.lock() {
        return Ok(router.models.clone());
    }
    if let Ok(db) = state.agent.db.lock() {
        return db.get_all_ai_models().map_err(|e| e.to_string());
    }
    Ok(crate::providers::models::get_default_models_fleet())
}

#[tauri::command]
fn set_active_model(model_id: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut router) = state.agent.router.lock() {
        router.set_active_model(&model_id)?;
        if let Some(active) = router.get_active_model() {
            if let Ok(mut glm) = state.agent.glm.lock() {
                glm.config.base_url = active.base_url.clone();
                glm.config.heavy_model = active.name.clone();
                glm.config.light_model = active.name.clone();
            }
        }
    }
    if let Ok(db) = state.agent.db.lock() {
        db.set_active_ai_model(&model_id)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn update_ai_model(
    model: crate::providers::models::AiModel,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Ok(mut router) = state.agent.router.lock() {
        router.update_model(model.clone());
    }
    if let Ok(db) = state.agent.db.lock() {
        db.save_ai_model(&model).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn add_ai_model(
    model: crate::providers::models::AiModel,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Ok(mut router) = state.agent.router.lock() {
        router.add_model(model.clone());
    }
    if let Ok(db) = state.agent.db.lock() {
        db.save_ai_model(&model).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn delete_ai_model(model_id: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut router) = state.agent.router.lock() {
        router.delete_model(&model_id)?;
    }
    if let Ok(db) = state.agent.db.lock() {
        db.delete_ai_model(&model_id).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_model_status(
    model_id: String,
    status: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let new_status = crate::providers::models::ModelStatus::from_str(&status);
    if let Ok(mut router) = state.agent.router.lock() {
        router.toggle_status(&model_id, new_status)?;
        if let Some(m) = router.models.iter().find(|m| m.id == model_id) {
            let m_clone = m.clone();
            if let Ok(db) = state.agent.db.lock() {
                let _ = db.save_ai_model(&m_clone);
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn test_model_connection(
    model_id: String,
    state: State<'_, AppState>,
) -> Result<crate::providers::models::AiModel, String> {
    let effective_key = {
        let glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
        glm.get_effective_api_key()
    };

    let mut router = {
        let guard = state.agent.router.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let test_res = router.test_model(&model_id, &effective_key).await;

    let updated_model = if let Ok(mut original_router) = state.agent.router.lock() {
        if let Some(src) = router.models.iter().find(|m| m.id == model_id) {
            original_router.update_model(src.clone());
            if let Ok(db) = state.agent.db.lock() {
                let _ = db.save_ai_model(src);
            }
            src.clone()
        } else {
            return Err("Model not found".to_string());
        }
    } else {
        return Err("Failed to acquire router lock".to_string());
    };

    match test_res {
        Ok(_) => Ok(updated_model),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn test_all_models(
    state: State<'_, AppState>,
) -> Result<Vec<crate::providers::models::AiModel>, String> {
    let effective_key = {
        let glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
        glm.get_effective_api_key()
    };

    let model_ids: Vec<String> = {
        let router = state.agent.router.lock().map_err(|e| e.to_string())?;
        router.models.iter().map(|m| m.id.clone()).collect()
    };

    for id in model_ids {
        let mut router_clone = {
            let guard = state.agent.router.lock().map_err(|e| e.to_string())?;
            guard.clone()
        };
        let _ = router_clone.test_model(&id, &effective_key).await;
        if let Ok(mut r) = state.agent.router.lock() {
            if let Some(src) = router_clone.models.iter().find(|m| m.id == id) {
                r.update_model(src.clone());
                if let Ok(db) = state.agent.db.lock() {
                    let _ = db.save_ai_model(src);
                }
            }
        }
    }

    let models = {
        let router = state.agent.router.lock().map_err(|e| e.to_string())?;
        router.models.clone()
    };
    Ok(models)
}

#[tauri::command]
fn save_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let clean = key.trim();
    if clean.is_empty() || clean.contains('•') {
        return Err("Cannot save empty or masked API key".to_string());
    }
    if let Ok(db) = state.agent.db.lock() {
        let _ = db.save_setting("glm_api_key", clean);
    }
    if let Ok(mut glm) = state.agent.glm.lock() {
        glm.config.api_key = clean.to_string();
    }
    let _ = GlmProvider::save_key_to_keyring(clean);
    Ok(())
}

#[tauri::command]
fn get_api_key_status(state: State<'_, AppState>) -> Result<bool, String> {
    if let Ok(glm) = state.agent.glm.lock() {
        if !glm.config.api_key.trim().is_empty() {
            return Ok(true);
        }
    }
    if let Ok(db) = state.agent.db.lock() {
        if let Ok(Some(k)) = db.get_setting("glm_api_key") {
            if !k.trim().is_empty() {
                return Ok(true);
            }
        }
    }
    match GlmProvider::get_key_from_keyring() {
        Ok(key) => Ok(!key.trim().is_empty()),
        Err(_) => Ok(std::env::var("GLM_API_KEY")
            .or_else(|_| std::env::var("ZHIPU_API_KEY"))
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false)),
    }
}

#[tauri::command]
async fn test_glm_connection(
    base_url: Option<String>,
    model: Option<String>,
    api_key: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let raw_key = if let Some(ref k) = api_key {
        let clean = k.trim();
        if !clean.is_empty() && !clean.contains('•') {
            clean.to_string()
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let key = if !raw_key.is_empty() {
        raw_key
    } else {
        let in_memory = if let Ok(glm) = state.agent.glm.lock() {
            glm.config.api_key.trim().to_string()
        } else {
            String::new()
        };
        if !in_memory.is_empty() {
            in_memory
        } else {
            let db_key = if let Ok(db) = state.agent.db.lock() {
                db.get_setting("glm_api_key")
                    .unwrap_or(None)
                    .unwrap_or_default()
                    .trim()
                    .to_string()
            } else {
                String::new()
            };
            if !db_key.is_empty() {
                db_key
            } else if let Ok(k) = GlmProvider::get_key_from_keyring() {
                if !k.trim().is_empty() {
                    k.trim().to_string()
                } else {
                    std::env::var("GLM_API_KEY")
                        .or_else(|_| std::env::var("DEEPSEEK_API_KEY"))
                        .or_else(|_| std::env::var("ZHIPU_API_KEY"))
                        .unwrap_or_default()
                        .trim()
                        .to_string()
                }
            } else {
                std::env::var("GLM_API_KEY")
                    .or_else(|_| std::env::var("DEEPSEEK_API_KEY"))
                    .or_else(|_| std::env::var("ZHIPU_API_KEY"))
                    .unwrap_or_default()
                    .trim()
                    .to_string()
            }
        }
    };

    if key.trim().is_empty() {
        return Err("No API key entered or found in configuration. Please enter your API key in the field and click Save Settings or Test Connection.".to_string());
    }

    let raw_url = base_url.unwrap_or_else(|| "https://api.deepseek.com/v1".to_string());
    let endpoint = crate::providers::glm::normalize_api_url(&raw_url);
    let test_model = model.unwrap_or_else(|| "deepseek-chat".to_string());
    let is_reasoner = test_model.contains("reasoner") || test_model.contains("r1");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("Cline/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".to_string(), serde_json::json!(test_model));
    body_map.insert(
        "messages".to_string(),
        serde_json::json!([{"role": "user", "content": "ping"}]),
    );
    body_map.insert("max_tokens".to_string(), serde_json::json!(16));
    if !is_reasoner {
        body_map.insert("temperature".to_string(), serde_json::json!(0.1));
    }
    let body = serde_json::Value::Object(body_map);

    let res = client
        .post(&endpoint)
        .bearer_auth(&key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error reaching endpoint ({}): {}", endpoint, e))?;

    if res.status().is_success() {
        // Auto-persist valid key!
        if let Ok(db) = state.agent.db.lock() {
            let _ = db.save_setting("glm_api_key", &key);
            let _ = db.save_setting("glm_base_url", &raw_url);
            let _ = db.save_setting("glm_heavy_model", &test_model);
            let _ = db.save_setting("glm_light_model", &test_model);
        }
        if let Ok(mut glm) = state.agent.glm.lock() {
            glm.config.api_key = key.clone();
            glm.config.base_url = raw_url;
            glm.config.heavy_model = test_model.clone();
            glm.config.light_model = test_model.clone();
        }
        let _ = GlmProvider::save_key_to_keyring(&key);

        Ok(format!(
            "Successfully connected to {} with model {}.",
            endpoint, test_model
        ))
    } else {
        let status = res.status();
        let body_text = res.text().await.unwrap_or_default();
        Err(format!("Endpoint returned HTTP {}: {}", status, body_text))
    }
}

// --- Contextual Hotwords & Learn Correction IPC Commands (§04) ---
#[tauri::command]
fn learn_correction(
    misheard: String,
    corrected: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.agent.learn_correction(&misheard, &corrected);
    Ok(())
}

#[tauri::command]
fn get_hotwords(state: State<'_, AppState>) -> Result<String, String> {
    let hw = state.agent.hotwords.lock().map_err(|e| e.to_string())?;
    Ok(hw.export_hotwords_file())
}

#[tauri::command]
fn get_telemetry() -> TelemetryResponse {
    #[cfg(target_os = "windows")]
    let active_window = {
        let (title, process) = crate::tools::win32::get_active_window_info();
        format!("{} - {}", process, title)
    };
    #[cfg(not(target_os = "windows"))]
    let active_window = String::new();

    TelemetryResponse {
        cpu_percent: 0.0,
        idle_rss_mb: 0,
        peak_rss_mb: 0,
        glm_ttft_ms: 0,
        last_voice_roundtrip_ms: 0,
        active_window,
        clipboard_preview: String::new(),
        offline_mode: false,
    }
}

#[tauri::command]
fn show_console(tab: Option<String>, app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.show().map_err(|e| e.to_string())?;
        win.unminimize().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        if let Some(t) = tab {
            let _ = win.emit("switch-console-tab", t);
        }
    }
    Ok(())
}

#[tauri::command]
fn hide_console(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_bar(app: AppHandle) -> Result<(), String> {
    show_console(None, app)
}

#[tauri::command]
fn hide_bar(app: AppHandle) -> Result<(), String> {
    hide_console(app)
}

#[tauri::command]
fn app_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().unwrap_or(false);
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn app_is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn app_start_dragging(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_close(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.audio_capture.shutdown();
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn set_bar_height(_height: u32, _app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn resize_bar(height: u32, app: AppHandle) -> Result<(), String> {
    set_bar_height(height, app)
}

#[tauri::command]
fn set_click_through(_ignore: bool, _app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn process_voice_utterance(
    utterance: String,
    mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<TurnResult, String> {
    submit_utterance(utterance, mode, state).await
}

#[tauri::command]
fn search_code(
    query: String,
    max_results: Option<usize>,
    literal: Option<bool>,
) -> Result<Vec<crate::agent::beast::Hit>, String> {
    let searcher = crate::agent::beast::BeastSearcher::new(".");
    Ok(searcher.search(&query, max_results.unwrap_or(20), literal.unwrap_or(false)))
}

#[tauri::command]
fn find_symbols(
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<crate::agent::beast::SymbolHit>, String> {
    let searcher = crate::agent::beast::BeastSearcher::new(".");
    Ok(searcher.find_symbols(&query, max_results.unwrap_or(30)))
}

#[tauri::command]
fn rrf_search(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::agent::beast::Hit>, String> {
    let searcher = crate::agent::beast::BeastSearcher::new(".");
    let code_hits = searcher.search(&query, 20, false);
    let symbol_hits: Vec<crate::agent::beast::Hit> = searcher
        .find_symbols(&query, 20)
        .into_iter()
        .map(|s| crate::agent::beast::Hit {
            file: s.file,
            line: s.line,
            span: (s.line, s.line),
            score: 1.0,
            why: format!("symbol:{} [{}]", s.kind, s.name),
            symbol: Some(s.name.clone()),
            content: Some(s.name),
        })
        .collect();

    let mut lists = vec![
        ("code_search", 1.0, code_hits),
        ("symbols", 0.8, symbol_hits),
    ];

    if let Ok(db) = state.agent.db.lock() {
        if let Ok(facts) = db.get_all_facts() {
            let q_low = query.to_lowercase();
            let fact_hits: Vec<crate::agent::beast::Hit> = facts
                .into_iter()
                .filter(|f| f.content.to_lowercase().contains(&q_low))
                .map(|f| crate::agent::beast::Hit {
                    file: "memory://facts".to_string(),
                    line: 1,
                    span: (1, 1),
                    score: f.confidence,
                    why: format!("fact: {}", f.content),
                    symbol: None,
                    content: Some(f.content),
                })
                .collect();
            lists.push(("facts", 0.9, fact_hits));
        }
    }

    Ok(crate::agent::beast::rrf_merge(&lists, 25))
}

#[tauri::command]
fn read_file_content(path: String, max_lines: Option<usize>) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let limit = max_lines.unwrap_or(400);
    let lines: Vec<&str> = content.lines().take(limit).collect();
    let truncated = content.lines().count() > limit;
    Ok(serde_json::json!({
        "path": path,
        "lines_returned": lines.len(),
        "truncated": truncated,
        "content": lines.join("\n")
    }))
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<serde_json::Value>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for entry in entries.flatten() {
        list.push(serde_json::json!({
            "name": entry.file_name().to_string_lossy().to_string(),
            "is_dir": entry.file_type().map(|t| t.is_dir()).unwrap_or(false),
        }));
    }
    Ok(list)
}

#[tauri::command]
fn process_text(action: String, input: String) -> Result<serde_json::Value, String> {
    match action.as_str() {
        "json_pretty" => {
            let res = crate::tools::delphi::DelphiTools::format_json(&input, true)?;
            Ok(serde_json::json!({ "result": res }))
        }
        "json_minify" => {
            let res = crate::tools::delphi::DelphiTools::format_json(&input, false)?;
            Ok(serde_json::json!({ "result": res }))
        }
        "uuid" => {
            let id = crate::tools::delphi::DelphiTools::generate_uuid();
            Ok(serde_json::json!({ "uuid": id }))
        }
        "jwt_decode" => {
            let payload = crate::tools::delphi::DelphiTools::decode_jwt_payload(&input)?;
            Ok(serde_json::json!({ "payload": payload }))
        }
        _ => Err(format!("Unknown action: {}", action)),
    }
}

#[tauri::command]
fn probe_media(path: String) -> Result<crate::tools::delphi::MediaProbeResult, String> {
    crate::tools::delphi::DelphiTools::probe_file(&path)
}

#[tauri::command]
async fn browser_snapshot(url: String) -> Result<crate::agent::browser::BrowserSnapshot, String> {
    let mut op = crate::agent::browser::BrowserOperator::new();
    op.snapshot_url(&url).await
}

#[tauri::command]
fn browser_action(
    node: usize,
    action: String,
    text: Option<String>,
) -> Result<crate::agent::browser::ActionExecutionResult, String> {
    let mut op = crate::agent::browser::BrowserOperator::new();
    op.execute_action(node, &action, text.as_deref())
}

#[tauri::command]
fn review_diff() -> Result<serde_json::Value, String> {
    let output_bytes = std::process::Command::new("git")
        .args(["diff", "HEAD"])
        .output()
        .map(|o| o.stdout)
        .unwrap_or_default();
    let raw_diff = String::from_utf8_lossy(&output_bytes);
    let diff_files = crate::agent::review::CodeReviewEngine::parse_git_diff(&raw_diff);
    let bundles = crate::agent::review::CodeReviewEngine::bundle_files(&diff_files);
    Ok(serde_json::json!({
        "files_count": diff_files.len(),
        "files": diff_files,
        "bundles": bundles
    }))
}

#[tauri::command]
fn review_scan() -> Result<serde_json::Value, String> {
    let output_bytes = std::process::Command::new("git")
        .args(["diff", "HEAD"])
        .output()
        .map(|o| o.stdout)
        .unwrap_or_default();
    let raw_diff = String::from_utf8_lossy(&output_bytes);
    let diff_files = crate::agent::review::CodeReviewEngine::parse_git_diff(&raw_diff);
    let findings = crate::agent::review::CodeReviewEngine::review_diff(&diff_files);
    Ok(serde_json::json!({
        "findings_count": findings.len(),
        "findings": findings
    }))
}

#[tauri::command]
fn code_chunk(path: String) -> Result<Vec<crate::agent::beast::CodeChunk>, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    let searcher = crate::agent::beast::BeastSearcher::new(".");
    Ok(searcher.chunk_file(&path, &content))
}

#[tauri::command]
fn capture_screen(target: Option<String>) -> Result<serde_json::Value, String> {
    let t = target.as_deref().unwrap_or("active_window");
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    match crate::tools::win32::capture_screen(t) {
        Ok((bytes, width, height, title, app)) => {
            let b64 = crate::tools::win32::base64_encode(&bytes);
            Ok(serde_json::json!({
                "status": "captured",
                "target": t,
                "app": app,
                "title": title,
                "width": width,
                "height": height,
                "data_url": format!("data:image/bmp;base64,{}", b64),
                "timestamp": now_ms,
            }))
        }
        Err(e) => {
            let (title, process) = crate::tools::win32::get_active_window_info();
            Ok(serde_json::json!({
                "status": "fallback",
                "app": process,
                "title": title,
                "error": e,
                "timestamp": now_ms,
            }))
        }
    }
}

#[tauri::command]
async fn screen_ocr(
    target: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let t = target.unwrap_or_else(|| "active_window".to_string());
    let res = state
        .agent
        .tools
        .invoke("screen.ocr", serde_json::json!({ "target": t }))
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.output)
}

#[tauri::command]
fn set_stt_cadence(cadence: String, state: State<'_, AppState>) -> Result<(), String> {
    let frames = match cadence.to_lowercase().as_str() {
        "snappy" => 2,
        "dictation" => 8,
        _ => 4,
    };
    state.audio_capture.set_stt_cadence(frames);
    Ok(())
}

#[tauri::command]
fn list_windows() -> Result<Vec<crate::tools::win32::WindowInfo>, String> {
    Ok(crate::tools::win32::list_windows())
}

#[tauri::command]
fn focus_window(query: String) -> Result<bool, String> {
    crate::tools::win32::focus_window(&query)
}

#[tauri::command]
fn set_window_state(query: String, state: String) -> Result<bool, String> {
    crate::tools::win32::set_window_state(&query, &state)
}

#[tauri::command]
fn scan_desktop_repos() -> Result<Vec<crate::tools::scaffold::DiscoveredRepoInfo>, String> {
    Ok(crate::tools::scaffold::ScaffoldEngine::scan_desktop_repositories())
}

#[tauri::command]
fn scaffold_project_archetype(
    archetype: String,
    project_name: String,
    target_path: String,
) -> Result<String, String> {
    crate::tools::scaffold::ScaffoldEngine::scaffold_archetype(&archetype, &project_name, &target_path)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectFileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: Option<u64>,
    pub children: Option<Vec<ProjectFileNode>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectCommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

fn build_project_tree(dir: &std::path::Path, current_depth: usize, max_depth: usize) -> Vec<ProjectFileNode> {
    let mut nodes = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return nodes,
    };

    let ignored_names = [
        "node_modules", ".git", "target", "dist", ".next", "build", ".turbo",
        "cache", "__pycache__", ".vscode", ".idea", ".DS_Store", "Thumbs.db",
    ];

    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if ignored_names.contains(&name.as_str()) {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let size_bytes = if !is_dir {
            entry.metadata().ok().map(|m| m.len())
        } else {
            None
        };

        let children = if is_dir && current_depth < max_depth {
            Some(build_project_tree(&path, current_depth + 1, max_depth))
        } else if is_dir {
            Some(Vec::new())
        } else {
            None
        };

        nodes.push(ProjectFileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size_bytes,
            children,
        });
    }

    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    nodes
}

#[tauri::command]
fn inspect_project_tree(path: String, max_depth: Option<usize>) -> Result<Vec<ProjectFileNode>, String> {
    let root = std::path::PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    let depth_limit = max_depth.unwrap_or(3);
    Ok(build_project_tree(&root, 0, depth_limit))
}

#[tauri::command]
fn read_project_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_project_file(path: String, content: String) -> Result<bool, String> {
    let file_path = std::path::PathBuf::from(&path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
        }
    }
    std::fs::write(&file_path, content).map(|_| true).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn create_project_file_or_dir(path: String, is_dir: bool) -> Result<bool, String> {
    let target = std::path::PathBuf::from(&path);
    if is_dir {
        std::fs::create_dir_all(&target).map(|_| true).map_err(|e| format!("Failed to create directory: {}", e))
    } else {
        if let Some(parent) = target.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
        }
        if !target.exists() {
            std::fs::write(&target, "").map(|_| true).map_err(|e| format!("Failed to create file: {}", e))
        } else {
            Ok(true)
        }
    }
}

#[tauri::command]
fn delete_project_path(path: String) -> Result<bool, String> {
    let target = std::path::PathBuf::from(&path);
    if !target.exists() {
        return Ok(true);
    }
    if target.is_dir() {
        std::fs::remove_dir_all(&target).map(|_| true).map_err(|e| format!("Failed to remove directory: {}", e))
    } else {
        std::fs::remove_file(&target).map(|_| true).map_err(|e| format!("Failed to remove file: {}", e))
    }
}

#[tauri::command]
async fn execute_project_command(
    project_path: String,
    command: String,
) -> Result<ProjectCommandResult, String> {
    let start = std::time::Instant::now();
    let root = std::path::PathBuf::from(&project_path);
    if !root.exists() {
        return Err(format!("Working directory does not exist: {}", project_path));
    }

    #[cfg(target_os = "windows")]
    let output = {
        let mut cmd = tokio::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &command]);
        cmd.current_dir(&root);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.output().await.map_err(|e| format!("Failed to execute command: {}", e))?
    };

    #[cfg(not(target_os = "windows"))]
    let output = {
        let mut cmd = tokio::process::Command::new("sh");
        cmd.args(["-c", &command]);
        cmd.current_dir(&root);
        cmd.output().await.map_err(|e| format!("Failed to execute command: {}", e))?
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    let exit_code = output.status.code().unwrap_or(if output.status.success() { 0 } else { 1 });
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(ProjectCommandResult {
        exit_code,
        stdout,
        stderr,
        duration_ms,
    })
}

#[tauri::command]
fn get_project_git_diff(project_path: String) -> Result<serde_json::Value, String> {
    let root = std::path::PathBuf::from(&project_path);
    if !root.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    let branch_output = std::process::Command::new("git")
        .args(["-C", &project_path, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok();
    let branch = branch_output
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "main".to_string());

    let status_output = std::process::Command::new("git")
        .args(["-C", &project_path, "status", "--porcelain"])
        .output()
        .ok();
    let raw_status = status_output
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let mut modified_files = Vec::new();
    for line in raw_status.lines() {
        let trimmed = line.trim();
        if trimmed.len() > 3 {
            modified_files.push(trimmed[3..].trim().to_string());
        }
    }

    let diff_output = std::process::Command::new("git")
        .args(["-C", &project_path, "diff", "HEAD"])
        .output()
        .ok();
    let diff = diff_output
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    Ok(serde_json::json!({
        "branch": branch,
        "diff": diff,
        "modified_files": modified_files,
        "has_changes": !modified_files.is_empty() || !diff.is_empty(),
    }))
}

#[tauri::command]
fn commit_project_changes(project_path: String, message: String) -> Result<serde_json::Value, String> {
    let clean_msg = message.trim();
    if clean_msg.is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    let add_res = std::process::Command::new("git")
        .args(["-C", &project_path, "add", "-A"])
        .output()
        .map_err(|e| format!("git add failed: {}", e))?;

    if !add_res.status.success() {
        return Err(String::from_utf8_lossy(&add_res.stderr).to_string());
    }

    let commit_res = std::process::Command::new("git")
        .args(["-C", &project_path, "commit", "-m", clean_msg])
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&commit_res.stdout).to_string();
    let stderr = String::from_utf8_lossy(&commit_res.stderr).to_string();

    Ok(serde_json::json!({
        "success": commit_res.status.success(),
        "stdout": stdout,
        "stderr": stderr,
    }))
}

pub fn run() {
    let db = match Database::open_app_database() {
        Ok(d) => Arc::new(Mutex::new(d)),
        Err(_) => match Database::open_in_memory() {
            Ok(mem_db) => Arc::new(Mutex::new(mem_db)),
            Err(e) => {
                eprintln!("CRITICAL: Failed to initialize SQLite: {e}");
                return;
            }
        },
    };

    let mut glm_config = GlmConfig::default();
    if let Ok(db_guard) = db.lock() {
        if let Ok(Some(url)) = db_guard.get_setting("glm_base_url") {
            if !url.trim().is_empty() {
                glm_config.base_url = url;
            }
        }
        if let Ok(Some(hm)) = db_guard.get_setting("glm_heavy_model") {
            if !hm.trim().is_empty() {
                glm_config.heavy_model = hm;
            }
        }
        if let Ok(Some(lm)) = db_guard.get_setting("glm_light_model") {
            if !lm.trim().is_empty() {
                glm_config.light_model = lm;
            }
        }
        if let Ok(Some(k)) = db_guard.get_setting("glm_api_key") {
            if !k.trim().is_empty() {
                glm_config.api_key = k;
            }
        }
    }

    let agent = Arc::new(AgentCore::new(db.clone(), glm_config));
    let kernel = Arc::new(crate::agent::machine::HarnessKernel::with_mcp_client(
        agent.tools.mcp_client.clone(),
    ));

    // Boot the kernel (spawns Python MCP Server)
    let k_clone = kernel.clone();
    tauri::async_runtime::spawn(async move {
        let _ = k_clone.boot().await;
    });


    let audio_capture = Arc::new(AudioCaptureManager::new(kernel.clone(), agent.clone()));
    audio_capture.set_phrase_bank(agent.phrase_bank.clone());

    let scheduler = Arc::new(SchedulerManager::new(db.clone(), agent.tools.clone()));
    scheduler.start();

    let skills = Arc::new(SkillRegistry::new(db));
    spawn_kokoro_service_if_needed();

    tauri::Builder::default()
        .manage(AppState {
            agent,
            kernel,
            audio_capture,
            scheduler,
            skills,
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let alt_shift_l = Shortcut::new(Some(Modifiers::ALT), Code::ShiftLeft);
                    let alt_shift_r = Shortcut::new(Some(Modifiers::ALT), Code::ShiftRight);
                    let is_alt_shift = shortcut == &alt_shift_l || shortcut == &alt_shift_r;

                    let mut is_alt_space = false;
                    if let Ok(alt_space) = "alt+space".parse::<Shortcut>() {
                        if shortcut == &alt_space {
                            is_alt_space = true;
                        }
                    }

                    if is_alt_shift || is_alt_space {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(bar) = app.get_webview_window("main") {
                                let _ = bar.show();
                                let _ = bar.set_focus();
                                let _ = bar.emit("global-shortcut-voice-toggle", "pressed");
                                let _ = bar.emit("global-shortcut-alt-space", "pressed");
                            }
                        } else if event.state() == ShortcutState::Released {
                            if let Some(bar) = app.get_webview_window("main") {
                                let _ = bar.emit("global-shortcut-voice-toggle", "released");
                                let _ = bar.emit("global-shortcut-alt-space", "released");
                            }
                        }
                    }
                    if let Ok(alt_shift_space) = "alt+shift+space".parse::<Shortcut>() {
                        if shortcut == &alt_shift_space && event.state() == ShortcutState::Pressed {
                            if let Some(console) = app
                                .get_webview_window("console")
                                .or_else(|| app.get_webview_window("main"))
                            {
                                let _ = console.show();
                                let _ = console.unminimize();
                                let _ = console.set_focus();
                                let _ = console.emit("global-shortcut-console", "toggle");
                            }
                        }
                    }
                    if let Ok(alt_shift_d) = "alt+shift+d".parse::<Shortcut>() {
                        if shortcut == &alt_shift_d && event.state() == ShortcutState::Pressed {
                            if let Some(bar) = app.get_webview_window("main") {
                                let _ = bar.show();
                                let _ = bar.set_focus();
                                let _ = bar.emit("global-shortcut-dictation", "toggle");
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            submit_utterance,
            confirm_plan,
            undo_last,
            get_telemetry,
            start_mic_capture,
            stop_mic_capture,
            get_audio_rms,
            barge_in,
            is_speaking,
            speak_text,
            get_facts,
            add_fact,
            delete_fact,
            get_audit_log,
            get_threads,
            get_active_thread,
            set_active_thread,
            get_messages,
            get_automations,
            toggle_automation,
            trigger_automation,
            get_skills,
            toggle_skill,
            save_api_key,
            get_api_key_status,
            get_glm_settings,
            update_glm_settings,
            test_glm_connection,
            get_kokoro_status,
            get_piper_status,
            get_ai_models,
            set_active_model,
            update_ai_model,
            add_ai_model,
            delete_ai_model,
            toggle_model_status,
            test_model_connection,
            test_all_models,
            learn_correction,
            get_hotwords,
            show_console,
            hide_console,
            show_bar,
            hide_bar,
            set_bar_height,
            resize_bar,
            set_click_through,
            process_voice_utterance,
            search_code,
            find_symbols,
            rrf_search,
            read_file_content,
            list_directory,
            process_text,
            probe_media,
            browser_snapshot,
            browser_action,
            review_diff,
            review_scan,
            code_chunk,
            start_wake_word,
            stop_wake_word,
            get_wake_word_status,
            set_wake_word_sensitivity,
            start_listening,
            stop_listening,
            capture_screen,
            screen_ocr,
            set_stt_cadence,
            list_windows,
            focus_window,
            set_window_state,
            app_minimize,
            app_toggle_maximize,
            app_is_maximized,
            app_start_dragging,
            app_close,
            scan_desktop_repos,
            scaffold_project_archetype,
            inspect_project_tree,
            read_project_file,
            write_project_file,
            create_project_file_or_dir,
            delete_project_path,
            execute_project_command,
            get_project_git_diff,
            commit_project_changes
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            state.audio_capture.set_app_handle(app.handle().clone());
            state.audio_capture.wake_word.enable(Some(0.55));
            let _ = state.audio_capture.ensure_stream_running();

            #[cfg(target_os = "windows")]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = window_vibrancy::apply_mica(&main_window, None);
                }
            }

            // Windows System Tray Icon setup
            if let Ok(quit_i) = MenuItem::with_id(app, "quit", "Quit FRIDAY", true, None::<&str>) {
                if let Ok(show_i) =
                    MenuItem::with_id(app, "show", "Open FRIDAY", true, None::<&str>)
                {
                    if let Ok(menu) = Menu::with_items(app, &[&show_i, &quit_i]) {
                        let mut tray_builder = TrayIconBuilder::new()
                            .tooltip("FRIDAY — Desktop Operator")
                            .menu(&menu)
                            .show_menu_on_left_click(false)
                            .on_menu_event(|app, event| match event.id.as_ref() {
                                "quit" => {
                                    let state = app.state::<AppState>();
                                    state.audio_capture.shutdown();
                                    app.exit(0);
                                }
                                "show" => {
                                    if let Some(win) = app.get_webview_window("main") {
                                        let _ = win.show();
                                        let _ = win.unminimize();
                                        let _ = win.set_focus();
                                    }
                                }
                                _ => {}
                            })
                            .on_tray_icon_event(|tray, event| {
                                if let TrayIconEvent::Click {
                                    button: MouseButton::Left,
                                    button_state: MouseButtonState::Up,
                                    ..
                                } = event
                                {
                                    let app = tray.app_handle();
                                    if let Some(win) = app.get_webview_window("main") {
                                        let _ = win.show();
                                        let _ = win.unminimize();
                                        let _ = win.set_focus();
                                    }
                                }
                            });

                        if let Some(icon) = app.default_window_icon() {
                            tray_builder = tray_builder.icon(icon.clone());
                        }

                        let _ = tray_builder.build(app);
                    }
                }
            }

            if let Some(main_win) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let state = app_handle.state::<AppState>();
                        state.audio_capture.shutdown();
                        app_handle.exit(0);
                    }
                });
            }

            let alt_shift_l = Shortcut::new(Some(Modifiers::ALT), Code::ShiftLeft);
            let alt_shift_r = Shortcut::new(Some(Modifiers::ALT), Code::ShiftRight);
            let _ = app.global_shortcut().register(alt_shift_l);
            let _ = app.global_shortcut().register(alt_shift_r);

            if let Ok(alt_space) = "alt+space".parse::<Shortcut>() {
                let _ = app.global_shortcut().register(alt_space);
            }
            if let Ok(alt_shift_space) = "alt+shift+space".parse::<Shortcut>() {
                let _ = app.global_shortcut().register(alt_shift_space);
            }
            if let Ok(alt_shift_d) = "alt+shift+d".parse::<Shortcut>() {
                let _ = app.global_shortcut().register(alt_shift_d);
            }

            tracing::info!("FRIDAY core runtime ready.");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running friday application");
}
