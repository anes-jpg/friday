use crate::providers::glm::{GlmConfig, GlmProvider};
use crate::providers::models::{AiModel, ModelStatus, ModelTelemetry};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tauri::State;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    pub id: String, pub name: String, pub base_url: String,
    pub model: String, pub light_model: String, pub api_mode: String,
    pub has_key: bool, pub fallback: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct VoiceSettings { pub profile: String, pub endpoint: String, pub style: String }
#[derive(Clone, Serialize, Deserialize)]
pub struct ListeningSettings { pub enabled: bool, pub sensitivity: f32 }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings { pub theme: String, pub reduced_motion: bool }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitoringSettings { pub preview_limit: u8, pub storage_limit_gb: f64 }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub version: u8, pub revision: u64, pub active_profile_id: String,
    pub profiles: Vec<ProviderProfile>, pub voice: VoiceSettings,
    pub listening: ListeningSettings, pub appearance: AppearanceSettings,
    pub monitoring: MonitoringSettings, pub daily_spend_cap_usd: f64,
}
pub fn credential(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("friday-assistant", &format!("provider/{id}")).map_err(|e| e.to_string())
}
pub fn read_key(id: &str) -> Result<Option<String>, String> {
    match credential(id)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Credential store unavailable: {error}")),
    }
}
pub fn validate(settings: &DesktopSettings) -> Result<(), String> {
    if settings.version != 2 { return Err("Unsupported settings version".into()); }
    if settings.profiles.is_empty() || !settings.profiles.iter().any(|p| p.id == settings.active_profile_id) { return Err("Select an active provider".into()); }
    let mut ids = HashSet::new();
    for profile in &settings.profiles {
        if profile.id.is_empty() || profile.id.len() > 128 || !ids.insert(&profile.id) || profile.name.trim().is_empty() { return Err("Provider names and IDs must be valid and unique".into()); }
        crate::providers::glm::validate_provider_config(&profile.base_url, &profile.model)?;
        crate::providers::glm::validate_provider_config(&profile.base_url, &profile.light_model)?;
        if !["chat", "responses"].contains(&profile.api_mode.as_str()) { return Err("Choose Chat Completions or Responses".into()); }
    }
    let endpoint = reqwest::Url::parse(&settings.voice.endpoint).map_err(|e| e.to_string())?;
    if !["http", "https"].contains(&endpoint.scheme()) || !["localhost", "127.0.0.1", "[::1]", "::1"].contains(&endpoint.host_str().unwrap_or("")) { return Err("Speech must use a local endpoint".into()); }
    if !settings.daily_spend_cap_usd.is_finite() || settings.daily_spend_cap_usd < 0.0 { return Err("Invalid daily spend cap".into()); }
    if !(1..=4).contains(&settings.monitoring.preview_limit) || !(1.0..=1000.0).contains(&settings.monitoring.storage_limit_gb) || !(0.2..=0.95).contains(&settings.listening.sensitivity) { return Err("Invalid monitoring or listening limits".into()); }
    if !["dark", "bright"].contains(&settings.appearance.theme.as_str()) { return Err("Invalid theme".into()); }
    Ok(())
}
pub fn profile_url(profile: &ProviderProfile) -> String {
    let endpoint = profile.base_url.trim_end_matches('/');
    let base = endpoint.strip_suffix("/responses").or_else(|| endpoint.strip_suffix("/chat/completions")).unwrap_or(endpoint);
    let chat = crate::providers::glm::normalize_api_url(base);
    if profile.api_mode == "responses" { chat.trim_end_matches("/chat/completions").to_string() + "/responses" }
    else { chat }
}
fn read_settings(state: &AppState) -> Result<Option<DesktopSettings>, String> {
    let db = state.agent.db.lock().map_err(|e| e.to_string())?;
    db.get_setting("desktop_settings_v2").map_err(|e| e.to_string())?
        .map(|raw| serde_json::from_str(&raw).map_err(|e| format!("Saved settings could not be read: {e}"))).transpose()
}
pub fn load(state: &AppState) -> Result<DesktopSettings, String> {
    if let Some(mut settings) = read_settings(state)? {
        validate(&settings)?;
        for profile in &mut settings.profiles { profile.has_key = read_key(&profile.id)?.is_some(); }
        return Ok(settings);
    }
    let config = state.agent.glm.lock().map_err(|e| e.to_string())?.config.clone();
    let legacy_key = {
        let db = state.agent.db.lock().map_err(|e| e.to_string())?;
        db.get_setting("glm_api_key").map_err(|e| e.to_string())?.filter(|k| !k.is_empty()).unwrap_or(config.api_key.clone())
    };
    // Copy before removing the old key. Migration failure leaves legacy settings intact.
    let key = if !legacy_key.is_empty() { Some(legacy_key) } else { GlmProvider::get_key_from_keyring().ok() };
    if let Some(value) = key.as_deref() { credential("primary")?.set_password(value).map_err(|e| e.to_string())?; }
    let settings = DesktopSettings {
        version: 2, revision: 0, active_profile_id: "primary".into(),
        profiles: vec![ProviderProfile { id: "primary".into(), name: "Primary provider".into(), base_url: config.base_url, model: config.heavy_model, light_model: config.light_model, api_mode: "chat".into(), has_key: key.is_some(), fallback: false }],
        voice: VoiceSettings { profile: "en_GB-alba-medium".into(), endpoint: "http://127.0.0.1:8880/v1".into(), style: "calm".into() },
        listening: ListeningSettings { enabled: false, sensitivity: 0.55 },
        appearance: AppearanceSettings { theme: "dark".into(), reduced_motion: false },
        monitoring: MonitoringSettings { preview_limit: 2, storage_limit_gb: 10.0 }, daily_spend_cap_usd: 5.0,
    };
    validate(&settings)?;
    let raw = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    state.agent.db.lock().map_err(|e| e.to_string())?.save_settings_batch(&[("desktop_settings_v2", &raw)], &["glm_api_key"]).map_err(|e| e.to_string())?;
    Ok(settings)
}
fn runtime_models(settings: &DesktopSettings) -> Result<Vec<AiModel>, String> {
    settings.profiles.iter().enumerate().map(|(priority, profile)| Ok(AiModel {
        id: profile.id.clone(), name: profile.model.clone(), provider: format!("profile:{}", profile.id),
        base_url: profile_url(profile), api_key: read_key(&profile.id)?,
        capabilities: vec![profile.api_mode.clone()], priority: priority as u32,
        status: if profile.id == settings.active_profile_id || profile.fallback { ModelStatus::Normal } else { ModelStatus::NoTraffic },
        is_active: profile.id == settings.active_profile_id,
        telemetry: ModelTelemetry { availability_pct: 0.0, ttft_p90_ms: 0, avg_latency_ms: 0, tracker_history: vec![] },
    })).collect()
}
pub fn apply(state: &AppState, settings: &DesktopSettings) -> Result<(), String> {
    let models = runtime_models(settings)?;
    let profile = settings.profiles.iter().find(|p| p.id == settings.active_profile_id).ok_or("Active provider missing")?;
    let config = GlmConfig { base_url: profile_url(profile), heavy_model: profile.model.clone(), light_model: profile.light_model.clone(), api_key: read_key(&profile.id)?.unwrap_or_default() };
    let mut router = state.agent.router.lock().map_err(|e| e.to_string())?;
    let mut glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
    router.models = models;
    glm.config = config;
    glm.isolated_credentials = true;
    if settings.listening.enabled { state.audio_capture.wake_word.enable(Some(settings.listening.sensitivity)); }
    else { state.audio_capture.wake_word.disable(); }
    Ok(())
}
#[tauri::command]
pub fn get_desktop_settings(state: State<'_, AppState>) -> Result<DesktopSettings, String> {
    let settings = load(&state)?;
    apply(&state, &settings)?;
    Ok(settings)
}
fn rollback_keys(previous: &[(String, Option<String>)]) -> Result<(), String> {
    let mut errors = Vec::new();
    for (id, key) in previous.iter().rev() {
        let result = credential(id).and_then(|entry| {
            if let Some(value) = key { entry.set_password(value).map_err(|e| e.to_string()) }
            else { match entry.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) } }
        });
        if let Err(error) = result { errors.push(format!("{id}: {error}")); }
    }
    if errors.is_empty() { Ok(()) } else { Err(errors.join("; ")) }
}
fn save_error(error: String, previous: &[(String, Option<String>)]) -> String {
    match rollback_keys(previous) {
        Ok(()) => error,
        Err(rollback) => format!("{error}. Credential rollback failed: {rollback}. Check saved keys before retrying."),
    }
}
pub fn save(state: &AppState, mut settings: DesktopSettings, keys: HashMap<String, String>) -> Result<DesktopSettings, String> {
    validate(&settings)?;
    let mut router = state.agent.router.lock().map_err(|e| e.to_string())?;
    let mut glm = state.agent.glm.lock().map_err(|e| e.to_string())?;
    let db = state.agent.db.lock().map_err(|e| e.to_string())?;
    let revision = db.get_setting("desktop_settings_v2").map_err(|e| e.to_string())?
        .map(|raw| serde_json::from_str::<DesktopSettings>(&raw).map(|s| s.revision).map_err(|e| e.to_string())).transpose()?.unwrap_or(0);
    if settings.revision != revision { return Err("Settings changed in another window. Reload before saving; your draft is retained.".into()); }
    let old_settings = db.get_setting("desktop_settings_v2").map_err(|e| e.to_string())?
        .map(|raw| serde_json::from_str::<DesktopSettings>(&raw).map_err(|e| e.to_string())).transpose()?;
    if let Some(previous) = &old_settings {
        for profile in &settings.profiles {
            if previous.profiles.iter().any(|old| old.id == profile.id && old.base_url != profile.base_url && read_key(&old.id).ok().flatten().is_some()) && !keys.contains_key(&profile.id) {
                return Err("Replace or remove the API key when changing its endpoint, or create another provider.".into());
            }
        }
    }
    let mut previous = Vec::new();
    let prepared = (|| -> Result<(), String> {
        for profile in &mut settings.profiles {
            if let Some(key) = keys.get(&profile.id) {
                previous.push((profile.id.clone(), read_key(&profile.id)?));
                if key.trim().is_empty() {
                    match credential(&profile.id)?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => {}, Err(error) => return Err(error.to_string()) }
                } else {
                    credential(&profile.id)?.set_password(key.trim()).map_err(|e| e.to_string())?;
                }
            }
            profile.has_key = read_key(&profile.id)?.is_some();
        }
        if let Some(old) = &old_settings {
            for profile in &old.profiles {
                if !settings.profiles.iter().any(|current| current.id == profile.id) {
                    previous.push((profile.id.clone(), read_key(&profile.id)?));
                    match credential(&profile.id)?.delete_credential() {
                        Ok(()) | Err(keyring::Error::NoEntry) => {},
                        Err(error) => return Err(error.to_string()),
                    }
                }
            }
        }
        Ok(())
    })();
    if let Err(error) = prepared { return Err(save_error(error, &previous)); }
    settings.revision += 1;
    let models = match runtime_models(&settings) { Ok(models) => models, Err(error) => { return Err(save_error(error, &previous)); } };
    let profile = settings.profiles.iter().find(|p| p.id == settings.active_profile_id).ok_or("Active provider missing")?;
    let config = GlmConfig { base_url: profile_url(profile), heavy_model: profile.model.clone(), light_model: profile.light_model.clone(), api_key: models.iter().find(|m| m.is_active).and_then(|m| m.api_key.clone()).unwrap_or_default() };
    let raw = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    if let Err(error) = db.save_settings_batch(&[("desktop_settings_v2", &raw), ("glm_base_url", &config.base_url), ("glm_heavy_model", &config.heavy_model), ("glm_light_model", &config.light_model)], &["glm_api_key"]) {
        return Err(save_error(format!("Settings were not saved: {error}"), &previous));
    }
    router.models = models;
    glm.config = config;
    glm.isolated_credentials = true;
    if settings.listening.enabled { state.audio_capture.wake_word.enable(Some(settings.listening.sensitivity)); }
    else { state.audio_capture.wake_word.disable(); }
    Ok(settings)
}
#[tauri::command]
pub fn save_desktop_settings(settings: DesktopSettings, keys: HashMap<String, String>, state: State<'_, AppState>) -> Result<DesktopSettings, String> { save(&state, settings, keys) }
#[tauri::command]
pub fn activate_provider_profile(profile_id: String, state: State<'_, AppState>) -> Result<DesktopSettings, String> {
    let mut settings = load(&state)?;
    settings.active_profile_id = profile_id;
    save(&state, settings, HashMap::new())
}
#[tauri::command]
pub async fn test_provider_profile(profile: ProviderProfile, api_key: Option<String>, state: State<'_, AppState>) -> Result<String, String> {
    crate::providers::glm::validate_provider_config(&profile.base_url, &profile.model)?;
    let key = match api_key {
        Some(key) => key.trim().to_string(),
        None => {
            let saved = load(&state)?;
            if saved.profiles.iter().any(|old| old.id == profile.id && old.base_url != profile.base_url) {
                return Err("Enter a replacement key to test a changed endpoint, or create another provider.".into());
            }
            read_key(&profile.id)?.unwrap_or_default()
        }
    };
    let mut provider = GlmProvider::new(GlmConfig { base_url: profile_url(&profile), heavy_model: profile.model.clone(), light_model: profile.model, api_key: key });
    provider.isolated_credentials = true;
    let start = std::time::Instant::now();
    provider.stream_completion(vec![serde_json::json!({"role":"user","content":"Reply with OK."})], vec![], true, |_| {}).await?;
    Ok(format!("Connection verified in {} ms", start.elapsed().as_millis()))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> DesktopSettings {
        DesktopSettings {
            version: 2, revision: 0, active_profile_id: "one".into(),
            profiles: vec![ProviderProfile { id: "one".into(), name: "Friendly label".into(), base_url: "https://example.com/v1".into(), model: "vendor/exact:model".into(), light_model: "small:model".into(), api_mode: "responses".into(), has_key: false, fallback: false }],
            voice: VoiceSettings { profile: "local".into(), endpoint: "http://127.0.0.1:8880/v1".into(), style: "calm".into() },
            listening: ListeningSettings { enabled: true, sensitivity: 0.55 },
            appearance: AppearanceSettings { theme: "dark".into(), reduced_motion: false },
            monitoring: MonitoringSettings { preview_limit: 2, storage_limit_gb: 10.0 }, daily_spend_cap_usd: 5.0,
        }
    }
    #[test]
    fn profile_names_do_not_change_model_identifiers() {
        let settings = fixture();
        assert!(validate(&settings).is_ok());
        assert_eq!(settings.profiles[0].model, "vendor/exact:model");
        assert_eq!(profile_url(&settings.profiles[0]), "https://example.com/v1/responses");
        assert!(!serde_json::to_string(&settings).expect("valid settings").contains("apiKey"));
    }
    #[test]
    fn rejects_duplicate_profiles_and_remote_speech() {
        let mut settings = fixture();
        settings.profiles.push(settings.profiles[0].clone());
        assert!(validate(&settings).is_err());
        settings.profiles.pop();
        settings.voice.endpoint = "https://speech.example/v1".into();
        assert!(validate(&settings).is_err());
    }
}
