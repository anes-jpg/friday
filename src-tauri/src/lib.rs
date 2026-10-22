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
    pub piper: Arc<tokio::sync::Mutex<crate::voice::piper::PiperEngine>>,
    pub perception: Arc<crate::agent::perception::WindowsPerceptionEngine>,
    pub overwatch: Arc<crate::agent::overwatch::OverwatchManager>,
    pub legion: Arc<crate::agent::legion::IronLegionSwarm>,
    pub episodic: Arc<crate::memory::episodic::EpisodicContextEngine>,
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
fn create_thread(
    id: Option<String>,
    title: Option<String>,
    state: State<'_, AppState>,
) -> Result<DbThread, String> {
    let now_sec = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let thread_id = id.unwrap_or_else(|| format!("t-{}", now_ms));
    let thread_title = title.unwrap_or_else(|| "New session".to_string());
    let thread = DbThread {
        id: thread_id.clone(),
        title: thread_title,
        created_at: now_sec,
        updated_at: now_sec,
        pinned: false,
        message_count: 0,
    };
    let db = state.agent.db.lock().map_err(|e| e.to_string())?;
    db.insert_thread(&thread).map_err(|e| e.to_string())?;
    db.set_active_thread_id(&thread_id).map_err(|e| e.to_string())?;
    Ok(thread)
}

#[tauri::command]
fn add_message(
    thread_id: String,
    role: String,
    say: Option<String>,
    show: Option<String>,
    state: State<'_, AppState>,
) -> Result<DbMessage, String> {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let msg = DbMessage {
        id: format!("msg-{}", now_ms),
        thread_id: thread_id.clone(),
        role,
        say,
        show,
        latency_ms: None,
        created_at: (now_ms / 1000) as i64,
    };
    let db = state.agent.db.lock().map_err(|e| e.to_string())?;
    db.ensure_thread_exists(&thread_id, "Session")
        .map_err(|e| e.to_string())?;
    db.insert_message(&msg).map_err(|e| e.to_string())?;
    Ok(msg)
}

#[tauri::command]
fn delete_thread(thread_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .delete_thread(&thread_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_thread(
    thread_id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .rename_thread(&thread_id, &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_thread_pin(thread_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .toggle_thread_pin(&thread_id)
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
async fn piper_speak(
    text: String,
    style: Option<String>,
    speed: Option<f32>,
    state: State<'_, AppState>,
) -> Result<crate::voice::piper::PiperSpeakResult, String> {
    let mut engine = state.piper.lock().await;
    let prosody = style.as_deref().map(crate::voice::piper::PiperProsodyStyle::parse);
    engine.speak(&text, prosody, speed)
}

#[tauri::command]
async fn piper_stop(state: State<'_, AppState>) -> Result<(), String> {
    let mut engine = state.piper.lock().await;
    engine.stop();
    Ok(())
}

#[tauri::command]
async fn get_piper_engine_status(
    state: State<'_, AppState>,
) -> Result<crate::voice::piper::PiperEngineStatus, String> {
    let engine = state.piper.lock().await;
    Ok(engine.get_status())
}

#[tauri::command]
async fn configure_piper(
    model_path: Option<String>,
    tokens_path: Option<String>,
    data_dir: Option<String>,
    style: Option<String>,
    state: State<'_, AppState>,
) -> Result<crate::voice::piper::PiperEngineStatus, String> {
    let mut engine = state.piper.lock().await;
    if let Some(s) = style {
        engine.set_style(crate::voice::piper::PiperProsodyStyle::parse(&s));
    }
    if model_path.is_some() || tokens_path.is_some() || data_dir.is_some() {
        engine.discover_and_load(
            model_path.as_deref(),
            tokens_path.as_deref(),
            data_dir.as_deref(),
        );
    }
    Ok(engine.get_status())
}

// ── UIA Perception Commands ───────────────────────────────────────────────────

#[tauri::command]
fn inspect_cursor_element(
    state: State<'_, AppState>,
) -> Result<crate::agent::perception::UiCursorElement, String> {
    state.perception.element_under_cursor()
}

#[tauri::command]
fn inspect_focused_app(
    state: State<'_, AppState>,
) -> Result<crate::agent::perception::FocusedAppSnapshot, String> {
    state.perception.inspect_focused_app()
}

#[tauri::command]
fn actuate_uia_element(
    element_id: String,
    action: String,
    val: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.perception.actuate_element(&element_id, &action, val.as_deref())
}

// ── Overwatch Mode Commands ──────────────────────────────────────────────────

#[tauri::command]
fn get_overwatch_interjections(
    state: State<'_, AppState>,
) -> Result<Vec<crate::agent::overwatch::OverwatchInterjection>, String> {
    Ok(state.overwatch.get_active_interjections())
}

#[tauri::command]
fn dismiss_overwatch_interjection(
    id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.overwatch.dismiss(&id))
}

#[tauri::command]
fn inspect_clipboard_for_overwatch(
    text: String,
    state: State<'_, AppState>,
) -> Result<Option<crate::agent::overwatch::OverwatchInterjection>, String> {
    Ok(state.overwatch.inspect_clipboard_text(&text))
}

// ── Iron Legion Protocol Commands ────────────────────────────────────────────

#[tauri::command]
async fn dispatch_legion_swarm(
    directive: String,
    state: State<'_, AppState>,
) -> Result<crate::agent::legion::LegionSwarmPlan, String> {
    state.legion.dispatch_directive(&directive).await
}

#[tauri::command]
fn get_legion_status(
    state: State<'_, AppState>,
) -> Result<Option<crate::agent::legion::LegionSwarmPlan>, String> {
    Ok(state.legion.get_active_plan())
}

// ── Episodic Timeline Recall Commands ────────────────────────────────────────

#[tauri::command]
fn get_episodic_timeline(
    limit: Option<usize>,
    since_ts: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<crate::memory::db::DbEpisodicEvent>, String> {
    state.episodic.get_timeline(limit.unwrap_or(50), since_ts)
}

#[tauri::command]
fn search_episodic_timeline(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::memory::db::DbEpisodicEvent>, String> {
    state.episodic.search(&query)
}

#[tauri::command]
fn record_episodic_event(
    app_name: String,
    window_title: String,
    file_path: Option<String>,
    git_branch: Option<String>,
    summary: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<crate::memory::db::DbEpisodicEvent>, String> {
    state.episodic.record_context_shift(
        &app_name,
        &window_title,
        file_path.as_deref(),
        git_branch.as_deref(),
        summary.as_deref(),
    )
}

// ── God's Eye 9-Layer Telemetry & Fullscreen OS Commands ─────────────────────

#[tauri::command]
fn get_network_telemetry() -> Result<crate::tools::net_telemetry::NetworkSocketArcResponse, String> {
    let engine = crate::tools::net_telemetry::NetTelemetryEngine::new();
    Ok(crate::tools::net_telemetry::NetworkSocketArcResponse {
        arcs: engine.get_socket_arcs(),
        cables: engine.get_cables(),
    })
}

#[tauri::command]
fn terminate_process_socket(pid: u32, process_name: String) -> Result<bool, String> {
    tracing::info!("Terminating process socket PID: {} ({})", pid, process_name);
    crate::tools::net_telemetry::NetTelemetryEngine::terminate_process(pid)
}

#[tauri::command]
fn get_orbital_telemetry() -> Result<Vec<crate::tools::orbital_maritime::SatelliteTrack>, String> {
    let engine = crate::tools::orbital_maritime::OrbitalMaritimeEngine::new();
    Ok(engine.get_satellites())
}

#[tauri::command]
fn get_maritime_telemetry() -> Result<Vec<crate::tools::orbital_maritime::MaritimeVessel>, String> {
    let engine = crate::tools::orbital_maritime::OrbitalMaritimeEngine::new();
    Ok(engine.get_vessels())
}

#[tauri::command]
fn get_geospatial_telemetry() -> Result<crate::tools::geospatial::GeospatialResponse, String> {
    let engine = crate::tools::geospatial::GeospatialTelemetryEngine::new();
    Ok(crate::tools::geospatial::GeospatialResponse {
        flights: engine.get_flights(),
        seismic: engine.get_seismic_events(),
        weather: engine.get_weather(),
    })
}

#[tauri::command]
fn get_hardware_vitals() -> Result<crate::tools::hardware::SystemHardwareTelemetry, String> {
    let engine = crate::tools::hardware::HardwareTelemetryEngine::new();
    Ok(engine.get_telemetry())
}

#[tauri::command]
fn toggle_os_fullscreen(window: tauri::Window, exclusive: Option<bool>) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    let target = !is_fullscreen;
    if target {
        #[cfg(target_os = "windows")]
        if exclusive.unwrap_or(false) {
            let _ = window_vibrancy::clear_mica(&window);
        }
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    } else {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        #[cfg(target_os = "windows")]
        let _ = window_vibrancy::apply_mica(&window, None);
    }
    Ok(target)
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
async fn search_code(
    query: String,
    max_results: Option<usize>,
    literal: Option<bool>,
) -> Result<Vec<crate::agent::beast::Hit>, String> {
    tokio::task::spawn_blocking(move || {
        let searcher = crate::agent::beast::BeastSearcher::new(".");
        searcher.search(&query, max_results.unwrap_or(20), literal.unwrap_or(false))
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn find_symbols(
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<crate::agent::beast::SymbolHit>, String> {
    tokio::task::spawn_blocking(move || {
        let searcher = crate::agent::beast::BeastSearcher::new(".");
        searcher.find_symbols(&query, max_results.unwrap_or(30))
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rrf_search(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::agent::beast::Hit>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let q = query.clone();
    let (code_hits, symbol_hits_raw) = tokio::task::spawn_blocking(move || {
        let searcher = crate::agent::beast::BeastSearcher::new(".");
        searcher.search_code_and_symbols(&q, 20, 20)
    })
    .await
    .map_err(|e| e.to_string())?;

    let symbol_hits: Vec<crate::agent::beast::Hit> = symbol_hits_raw
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

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScriptInfo {
    pub name: String,
    pub command: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadataDto {
    pub name: String,
    pub description: String,
    pub framework: String,
    pub package_manager: String,
    pub git_branch: Option<String>,
    pub uncommitted_changes_count: usize,
    pub dependencies_count: usize,
    pub dev_dependencies_count: usize,
    pub scripts: Vec<ProjectScriptInfo>,
    pub total_files_count: usize,
    pub last_modified: String,
}

#[tauri::command]
fn inspect_project_metadata(path: String) -> Result<ProjectMetadataDto, String> {
    let root = std::path::PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Project directory does not exist: {}", path));
    }

    let folder_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();

    let mut name = folder_name.clone();
    let mut description = String::new();
    let mut framework = "Generic Workspace".to_string();
    let mut package_manager = "npm".to_string();
    let mut dependencies_count = 0;
    let mut dev_dependencies_count = 0;
    let mut scripts = Vec::new();

    let pkg_json_path = root.join("package.json");
    let cargo_path = root.join("Cargo.toml");
    let readme_path = root.join("README.md");

    // Read README.md for real project description if available
    if readme_path.exists() {
        if let Ok(readme_content) = std::fs::read_to_string(&readme_path) {
            for line in readme_content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if trimmed.starts_with('#') {
                    let heading_text = trimmed.trim_start_matches('#').trim();
                    if !heading_text.eq_ignore_ascii_case(&name) && description.is_empty() {
                        description = heading_text.to_string();
                    }
                    continue;
                }
                if description.is_empty() && !trimmed.starts_with("```") {
                    description = trimmed.to_string();
                    break;
                }
            }
        }
    }

    // Inspect package.json
    if pkg_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(n) = json.get("name").and_then(|v| v.as_str()) {
                    if !n.trim().is_empty() {
                        name = n.to_string();
                    }
                }
                if description.is_empty() {
                    if let Some(desc) = json.get("description").and_then(|v| v.as_str()) {
                        description = desc.to_string();
                    }
                }

                let mut deps_list = Vec::new();
                if let Some(d) = json.get("dependencies").and_then(|v| v.as_object()) {
                    dependencies_count = d.len();
                    for k in d.keys() {
                        deps_list.push(k.as_str());
                    }
                }
                if let Some(d) = json.get("devDependencies").and_then(|v| v.as_object()) {
                    dev_dependencies_count = d.len();
                    for k in d.keys() {
                        deps_list.push(k.as_str());
                    }
                }

                // Detect framework from dependencies
                if deps_list.iter().any(|&d| d == "next") {
                    framework = "Next.js".to_string();
                } else if root.join("src-tauri").exists() || deps_list.iter().any(|&d| d.starts_with("@tauri-apps")) {
                    framework = "Tauri Desktop".to_string();
                } else if deps_list.iter().any(|&d| d == "vite") {
                    framework = if deps_list.iter().any(|&d| d == "react") {
                        "React + Vite".to_string()
                    } else if deps_list.iter().any(|&d| d == "vue") {
                        "Vue + Vite".to_string()
                    } else {
                        "Vite".to_string()
                    };
                } else if deps_list.iter().any(|&d| d == "react") {
                    framework = "React".to_string();
                } else if deps_list.iter().any(|&d| d == "express" || d == "hono" || d == "fastify") {
                    framework = "Node.js API".to_string();
                } else {
                    framework = "JavaScript/TypeScript".to_string();
                }

                // Extract scripts
                if let Some(s) = json.get("scripts").and_then(|v| v.as_object()) {
                    for (k, v) in s {
                        if let Some(cmd) = v.as_str() {
                            scripts.push(ProjectScriptInfo {
                                name: k.clone(),
                                command: cmd.to_string(),
                            });
                        }
                    }
                }

                // Detect package manager from lockfiles
                if root.join("bun.lock").exists() || root.join("bun.lockb").exists() {
                    package_manager = "bun".to_string();
                } else if root.join("pnpm-lock.yaml").exists() {
                    package_manager = "pnpm".to_string();
                } else if root.join("yarn.lock").exists() {
                    package_manager = "yarn".to_string();
                } else if root.join("package-lock.json").exists() {
                    package_manager = "npm".to_string();
                } else {
                    package_manager = "npm".to_string();
                }
            }
        }
    } else if cargo_path.exists() {
        framework = if root.join("src-tauri").exists() {
            "Tauri Desktop".to_string()
        } else {
            "Rust Crate".to_string()
        };
        package_manager = "cargo".to_string();
        if let Ok(content) = std::fs::read_to_string(&cargo_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name =") && name == folder_name {
                    if let Some(val) = trimmed.split('=').nth(1) {
                        name = val.trim().trim_matches('"').to_string();
                    }
                }
                if trimmed.starts_with("description =") && description.is_empty() {
                    if let Some(val) = trimmed.split('=').nth(1) {
                        description = val.trim().trim_matches('"').to_string();
                    }
                }
            }
        }
        scripts.push(ProjectScriptInfo { name: "run".to_string(), command: "cargo run".to_string() });
        scripts.push(ProjectScriptInfo { name: "build".to_string(), command: "cargo build".to_string() });
        scripts.push(ProjectScriptInfo { name: "test".to_string(), command: "cargo test".to_string() });
    }

    if description.is_empty() {
        description = format!("Active workspace at {}", path);
    }

    // Git branch detection
    let mut git_branch = None;
    let head_path = root.join(".git").join("HEAD");
    if head_path.exists() {
        if let Ok(head_str) = std::fs::read_to_string(&head_path) {
            let trimmed = head_str.trim();
            if let Some(branch) = trimmed.strip_prefix("ref: refs/heads/") {
                git_branch = Some(branch.to_string());
            } else if !trimmed.is_empty() {
                git_branch = Some(trimmed.chars().take(7).collect());
            }
        }
    }

    // Git uncommitted changes count
    let mut uncommitted_changes_count = 0;
    if root.join(".git").exists() {
        let status_res = std::process::Command::new("git")
            .args(["-C", &path, "status", "--porcelain"])
            .output()
            .ok();
        if let Some(output) = status_res {
            let raw_str = String::from_utf8_lossy(&output.stdout);
            uncommitted_changes_count = raw_str.lines().filter(|l| !l.trim().is_empty()).count();
        }
    }

    // Count files recursively excluding node_modules, target, .git
    let mut total_files_count = 0;
    let mut stack = vec![root.clone()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" || file_name == "dist" {
                    continue;
                }
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        if stack.len() < 30 {
                            stack.push(entry.path());
                        }
                    } else {
                        total_files_count += 1;
                    }
                }
            }
        }
    }

    // Last modified time
    let last_modified = root
        .metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|time| std::time::SystemTime::now().duration_since(time).ok())
        .map(|dur| {
            let hours = dur.as_secs() / 3600;
            if hours < 24 {
                "Today".to_string()
            } else {
                let days = hours / 24;
                if days == 1 {
                    "Yesterday".to_string()
                } else {
                    format!("{}d ago", days)
                }
            }
        })
        .unwrap_or_else(|| "Recently".to_string());

    Ok(ProjectMetadataDto {
        name,
        description,
        framework,
        package_manager,
        git_branch,
        uncommitted_changes_count,
        dependencies_count,
        dev_dependencies_count,
        scripts,
        total_files_count,
        last_modified,
    })
}

#[tauri::command]
fn init_project_git(path: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "init"])
        .output()
        .map_err(|e| format!("Failed to run git init: {}", e))?;
    if output.status.success() {
        Ok("Initialized empty Git repository".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
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

    let skills = Arc::new(SkillRegistry::new(db.clone()));
    let piper = Arc::new(tokio::sync::Mutex::new(crate::voice::piper::PiperEngine::new()));
    let perception = Arc::new(crate::agent::perception::WindowsPerceptionEngine::new());
    let overwatch = Arc::new(crate::agent::overwatch::OverwatchManager::new());
    let legion = Arc::new(crate::agent::legion::IronLegionSwarm::new());
    let episodic = Arc::new(crate::memory::episodic::EpisodicContextEngine::new(db));
    spawn_kokoro_service_if_needed();

    tauri::Builder::default()
        .manage(AppState {
            agent,
            kernel,
            audio_capture,
            scheduler,
            skills,
            piper,
            perception,
            overwatch,
            legion,
            episodic,
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
            create_thread,
            add_message,
            delete_thread,
            rename_thread,
            toggle_thread_pin,
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
            piper_speak,
            piper_stop,
            get_piper_engine_status,
            configure_piper,
            inspect_cursor_element,
            inspect_focused_app,
            actuate_uia_element,
            get_overwatch_interjections,
            dismiss_overwatch_interjection,
            inspect_clipboard_for_overwatch,
            dispatch_legion_swarm,
            get_legion_status,
            get_episodic_timeline,
            search_episodic_timeline,
            record_episodic_event,
            get_network_telemetry,
            terminate_process_socket,
            get_orbital_telemetry,
            get_maritime_telemetry,
            get_geospatial_telemetry,
            get_hardware_vitals,
            toggle_os_fullscreen,
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
            commit_project_changes,
            inspect_project_metadata,
            init_project_git
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
                    let _ = main_window.show();
                    let _ = main_window.unminimize();
                    let _ = main_window.set_focus();
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
                if let Some(icon) = app.default_window_icon() {
                    let _ = main_win.set_icon(icon.clone());
                }
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
