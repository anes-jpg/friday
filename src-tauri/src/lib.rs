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
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use voice::AudioCaptureManager;

pub struct AppState {
    pub agent: Arc<AgentCore>,
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
fn submit_utterance(
    utterance: String,
    mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<TurnResult, String> {
    let mode_str = mode.unwrap_or_else(|| "command".to_string());
    tauri::async_runtime::block_on(async { state.agent.execute_turn(&utterance, &mode_str).await })
}

#[tauri::command]
fn confirm_plan(
    plan_id: String,
    state: State<'_, AppState>,
) -> Result<PendingPlan, String> {
    tauri::async_runtime::block_on(async { state.agent.confirm_plan(&plan_id).await })
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

// --- M6 Facts & Memory IPC Commands ---
#[tauri::command]
fn get_facts(state: State<'_, AppState>) -> Result<Vec<DbFact>, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.get_all_facts().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_fact(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.delete_fact(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_audit_log(state: State<'_, AppState>) -> Result<Vec<DbAuditEntry>, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.get_audit_log(50).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_threads(state: State<'_, AppState>) -> Result<Vec<DbThread>, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.get_threads().map_err(|e| e.to_string())
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
    state.agent.db.lock().map_err(|e| e.to_string())?.get_automations().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_automation(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.toggle_automation(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn trigger_automation(id: String, state: State<'_, AppState>) -> Result<String, String> {
    state.scheduler.trigger_now(&id).await
}

// --- M8 Skills IPC Commands ---
#[tauri::command]
fn get_skills(state: State<'_, AppState>) -> Result<Vec<DbSkill>, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.get_skills().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_skill(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.agent.db.lock().map_err(|e| e.to_string())?.toggle_skill(&id).map_err(|e| e.to_string())
}

// --- Windows Credential Manager & Keyring IPC Commands (§D10) ---
#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    GlmProvider::save_key_to_keyring(&key)
}

#[tauri::command]
fn get_api_key_status() -> Result<bool, String> {
    match GlmProvider::get_key_from_keyring() {
        Ok(key) => Ok(!key.trim().is_empty()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn test_glm_connection(base_url: Option<String>, model: Option<String>) -> Result<String, String> {
    let key = GlmProvider::get_key_from_keyring().unwrap_or_default();
    if key.trim().is_empty() {
        return Err("No API key found in Windows Credential Manager. Please enter and save an API key.".to_string());
    }

    let url = base_url.unwrap_or_else(|| "https://open.bigmodel.cn/api/paas/v4".to_string());
    let test_model = model.unwrap_or_else(|| "glm-4-flash".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": test_model,
        "messages": [
            {"role": "user", "content": "ping"}
        ],
        "max_tokens": 5
    });

    let res = client
        .post(format!("{}/chat/completions", url.trim_end_matches('/')))
        .bearer_auth(&key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error reaching GLM endpoint: {}", e))?;

    if res.status().is_success() {
        Ok("Successfully connected to GLM API with credential vault authentication.".to_string())
    } else {
        Err(format!("GLM API returned HTTP {}: {}", res.status(), res.text().await.unwrap_or_default()))
    }
}

// --- Contextual Hotwords & Learn Correction IPC Commands (§04) ---
#[tauri::command]
fn learn_correction(misheard: String, corrected: String, state: State<'_, AppState>) -> Result<(), String> {
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
    TelemetryResponse {
        cpu_percent: 2.1,
        idle_rss_mb: 184,
        peak_rss_mb: 495,
        glm_ttft_ms: 680,
        last_voice_roundtrip_ms: 1420,
        active_window: "Visual Studio Code - Friday".to_string(),
        clipboard_preview: "https://open.bigmodel.cn/api/paas/v4".to_string(),
        offline_mode: false,
    }
}

#[tauri::command]
fn show_console(tab: Option<String>, app: AppHandle) -> Result<(), String> {
    if let Some(console_win) = app.get_webview_window("console") {
        console_win.show().map_err(|e| e.to_string())?;
        console_win.unminimize().map_err(|e| e.to_string())?;
        console_win.set_focus().map_err(|e| e.to_string())?;
        if let Some(t) = tab {
            let _ = console_win.emit("switch-console-tab", t);
        }
    }
    Ok(())
}

#[tauri::command]
fn hide_console(app: AppHandle) -> Result<(), String> {
    if let Some(console_win) = app.get_webview_window("console") {
        console_win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_bar(app: AppHandle) -> Result<(), String> {
    if let Some(bar_win) = app.get_webview_window("main") {
        bar_win.show().map_err(|e| e.to_string())?;
        bar_win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_bar(app: AppHandle) -> Result<(), String> {
    if let Some(bar_win) = app.get_webview_window("main") {
        bar_win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_bar_height(height: u32, app: AppHandle) -> Result<(), String> {
    if let Some(bar_win) = app.get_webview_window("main") {
        bar_win
            .set_size(tauri::LogicalSize::new(720, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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

    let glm_config = GlmConfig::default();
    let agent = Arc::new(AgentCore::new(db.clone(), glm_config));
    let audio_capture = Arc::new(AudioCaptureManager::new());
    audio_capture.set_phrase_bank(agent.phrase_bank.clone());

    let scheduler = Arc::new(SchedulerManager::new(db.clone(), agent.tools.clone()));
    scheduler.start();

    let skills = Arc::new(SkillRegistry::new(db));

    tauri::Builder::default()
        .manage(AppState {
            agent,
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
                    if let Ok(alt_space) = "alt+space".parse::<Shortcut>() {
                        if shortcut == &alt_space {
                            if event.state() == ShortcutState::Pressed {
                                if let Some(bar) = app.get_webview_window("main") {
                                    let _ = bar.show();
                                    let _ = bar.set_focus();
                                    let _ = bar.emit("global-shortcut-alt-space", "pressed");
                                }
                            } else if event.state() == ShortcutState::Released {
                                if let Some(bar) = app.get_webview_window("main") {
                                    let _ = bar.emit("global-shortcut-alt-space", "released");
                                }
                            }
                        }
                    }
                    if let Ok(alt_shift_space) = "alt+shift+space".parse::<Shortcut>() {
                        if shortcut == &alt_shift_space && event.state() == ShortcutState::Pressed {
                            if let Some(console) = app.get_webview_window("console") {
                                let _ = console.show();
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
            delete_fact,
            get_audit_log,
            get_threads,
            get_messages,
            get_automations,
            toggle_automation,
            trigger_automation,
            get_skills,
            toggle_skill,
            save_api_key,
            get_api_key_status,
            test_glm_connection,
            learn_correction,
            get_hotwords,
            show_console,
            hide_console,
            show_bar,
            hide_bar,
            set_bar_height
        ])
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                if let Some(console_window) = app.get_webview_window("console") {
                    let _ = window_vibrancy::apply_mica(&console_window, None);
                }
            }

            if let Some(console_win) = app.get_webview_window("console") {
                let win_clone = console_win.clone();
                console_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

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
