use crate::voice::normalize::normalize_for_speech;
use crate::voice::playback::RodioPlaybackNode;
use serde::{Deserialize, Serialize};
use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsModelConfig,
    OfflineTtsVitsModelConfig,
};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tracing::{error, info};

/// Companion prosody personality styles conforming to the FRIDAY Constitution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PiperProsodyStyle {
    /// Canonical Kerry Condon cadence: composed, crisp, articulate
    Calm,
    /// Amber/Red alerts and high-stress commands: direct, grounded, rapid
    Tactical,
    /// Proactive Overwatch whispers & late-night mode: soft, intimate
    Whisper,
    /// Conversational rapport & witty desktop banter
    Witty,
}

impl Default for PiperProsodyStyle {
    fn default() -> Self {
        Self::Calm
    }
}

impl PiperProsodyStyle {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().trim() {
            "tactical" | "alert" => Self::Tactical,
            "whisper" | "stealth" | "night" => Self::Whisper,
            "witty" | "humor" | "casual" => Self::Witty,
            _ => Self::Calm,
        }
    }

    /// Dynamic prosody scalars: (length_scale, noise_scale, noise_scale_w)
    pub fn scalars(&self) -> (f32, f32, f32) {
        match self {
            Self::Calm => (0.95, 0.667, 0.80),
            Self::Tactical => (0.88, 0.500, 0.65),
            Self::Whisper => (0.98, 0.600, 0.75),
            Self::Witty => (1.00, 0.740, 0.85),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Calm => "calm",
            Self::Tactical => "tactical",
            Self::Whisper => "whisper",
            Self::Witty => "witty",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiperSpeakResult {
    pub success: bool,
    pub text: String,
    pub sample_count: usize,
    pub sample_rate: u32,
    pub duration_ms: u64,
    pub style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiperEngineStatus {
    pub ready: bool,
    pub is_playing: bool,
    pub model_path: Option<String>,
    pub tokens_path: Option<String>,
    pub data_dir: Option<String>,
    pub active_style: String,
    pub sample_rate: i32,
    pub num_speakers: i32,
}

pub struct PiperEngine {
    tts: Option<OfflineTts>,
    model_path: Option<PathBuf>,
    tokens_path: Option<PathBuf>,
    data_dir: Option<PathBuf>,
    current_style: PiperProsodyStyle,
    speed: f32,
    playback: RodioPlaybackNode,
    cancel_token: Arc<AtomicBool>,
}

impl Default for PiperEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl PiperEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            tts: None,
            model_path: None,
            tokens_path: None,
            data_dir: None,
            current_style: PiperProsodyStyle::Calm,
            speed: 1.0,
            playback: RodioPlaybackNode::new(),
            cancel_token: Arc::new(AtomicBool::new(false)),
        };

        // Attempt discovery from standard model folders
        engine.discover_and_load(None, None, None);
        engine
    }

    /// Locate model, tokens, and espeak-ng-data directory
    pub fn discover_and_load(
        &mut self,
        custom_model: Option<&str>,
        custom_tokens: Option<&str>,
        custom_data: Option<&str>,
    ) -> bool {
        let (m, t, d) = Self::resolve_paths(custom_model, custom_tokens, custom_data);
        self.model_path = m.clone();
        self.tokens_path = t.clone();
        self.data_dir = d.clone();

        if let (Some(ref model_file), Some(ref tokens_file), Some(ref data_folder)) = (&m, &t, &d) {
            if model_file.exists() && tokens_file.exists() && data_folder.exists() {
                let (length_scale, noise_scale, noise_w) = self.current_style.scalars();

                let vits_config = OfflineTtsVitsModelConfig {
                    model: Some(model_file.to_string_lossy().to_string()),
                    lexicon: None,
                    tokens: Some(tokens_file.to_string_lossy().to_string()),
                    data_dir: Some(data_folder.to_string_lossy().to_string()),
                    noise_scale,
                    noise_scale_w: noise_w,
                    length_scale,
                    dict_dir: None,
                };

                let config = OfflineTtsConfig {
                    model: OfflineTtsModelConfig {
                        vits: vits_config,
                        num_threads: 2,
                        debug: false,
                        provider: Some("cpu".to_string()),
                        ..Default::default()
                    },
                    silence_scale: 0.2,
                    max_num_sentences: 2,
                    ..Default::default()
                };

                match OfflineTts::create(&config) {
                    Some(instance) => {
                        info!(
                            "Piper TTS: Successfully loaded model {:?} (sample rate: {} Hz)",
                            model_file.file_name(),
                            instance.sample_rate()
                        );
                        self.tts = Some(instance);
                        return true;
                    }
                    None => {
                        error!("Piper TTS: OfflineTts::create returned null pointer with configured paths");
                    }
                }
            } else {
                info!("Piper TTS: One or more required model assets not found on disk");
            }
        } else {
            info!("Piper TTS: Standalone model files not discovered; voice engine ready in deferred standby");
        }

        self.tts = None;
        false
    }

    fn resolve_paths(
        custom_model: Option<&str>,
        custom_tokens: Option<&str>,
        custom_data: Option<&str>,
    ) -> (Option<PathBuf>, Option<PathBuf>, Option<PathBuf>) {
        // 1. Explicit paths if provided
        if let Some(m) = custom_model {
            let m_path = PathBuf::from(m);
            let t_path = custom_tokens.map(PathBuf::from).or_else(|| {
                let adjacent = m_path.with_extension("tokens.txt");
                if adjacent.exists() {
                    Some(adjacent)
                } else {
                    m_path.parent().map(|p| p.join("tokens.txt"))
                }
            });
            let d_path = custom_data.map(PathBuf::from).or_else(|| {
                m_path.parent().map(|p| p.join("espeak-ng-data"))
            });
            return (Some(m_path), t_path, d_path);
        }

        // 2. Standard search directories
        let appdata_dir = std::env::var("APPDATA")
            .ok()
            .map(|d| PathBuf::from(d).join("com.friday.app").join("models").join("piper"));
        let local_appdata_dir = std::env::var("LOCALAPPDATA")
            .ok()
            .map(|d| PathBuf::from(d).join("friday").join("models").join("piper"));

        let candidates = [
            appdata_dir,
            local_appdata_dir,
            Some(PathBuf::from("models").join("piper")),
            Some(PathBuf::from("src-tauri").join("models").join("piper")),
        ];

        for base in candidates.into_iter().flatten() {
            if !base.exists() {
                continue;
            }

            // Look for any .onnx file (e.g. en_GB-alba-medium.onnx)
            if let Ok(entries) = std::fs::read_dir(&base) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "onnx") {
                        let tokens = base.join("tokens.txt");
                        let data = base.join("espeak-ng-data");
                        return (Some(path), Some(tokens), Some(data));
                    }
                }
            }
        }

        (None, None, None)
    }

    /// Check if native piper TTS is ready to synthesize
    pub fn is_ready(&self) -> bool {
        self.tts.is_some()
    }

    /// Set dynamic companion prosody style and reload scalars
    pub fn set_style(&mut self, style: PiperProsodyStyle) {
        self.current_style = style;
        // Re-initialize engine with new style scalars if model path is set
        if self.model_path.is_some() {
            let m = self.model_path.as_ref().map(|p| p.to_string_lossy().to_string());
            let t = self.tokens_path.as_ref().map(|p| p.to_string_lossy().to_string());
            let d = self.data_dir.as_ref().map(|p| p.to_string_lossy().to_string());
            self.discover_and_load(m.as_deref(), t.as_deref(), d.as_deref());
        }
    }

    /// Synthesize and speak text directly into rodio audio sink with sub-80ms cancellation
    pub fn speak(
        &mut self,
        text: &str,
        style: Option<PiperProsodyStyle>,
        speed: Option<f32>,
    ) -> Result<PiperSpeakResult, String> {
        if let Some(st) = style {
            if st != self.current_style {
                self.set_style(st);
            }
        }

        let tts = match self.tts.as_ref() {
            Some(t) => t,
            None => {
                return Err(
                    "Piper TTS engine not ready: model files missing. Place Alba VITS onnx, tokens.txt, and espeak-ng-data into %APPDATA%/com.friday.app/models/piper/".to_string(),
                );
            }
        };

        let normalized = normalize_for_speech(text);
        if normalized.trim().is_empty() {
            return Ok(PiperSpeakResult {
                success: true,
                text: String::new(),
                sample_count: 0,
                sample_rate: 22050,
                duration_ms: 0,
                style: self.current_style.as_str().to_string(),
            });
        }

        // Reset cancellation token
        self.cancel_token.store(false, Ordering::SeqCst);
        let cancel_token = self.cancel_token.clone();

        let (length_scale, _, _) = self.current_style.scalars();
        let target_speed = speed.unwrap_or(self.speed) / length_scale;

        let gen_config = GenerationConfig {
            silence_scale: 0.2,
            speed: target_speed,
            sid: 0,
            ..Default::default()
        };

        let start_time = std::time::Instant::now();

        // Synthesize with abort callback
        let audio = tts.generate_with_config(
            &normalized,
            &gen_config,
            Some(move |_samples: &[f32], _progress: f32| -> bool {
                // Return false if barge-in was requested
                !cancel_token.load(Ordering::SeqCst)
            }),
        );

        let audio = match audio {
            Some(a) => a,
            None => {
                return Err("Piper TTS synthesis returned no audio samples (possibly cancelled)".to_string());
            }
        };

        let sample_rate = audio.sample_rate() as u32;
        let samples = audio.samples().to_vec();
        let sample_count = samples.len();
        let duration_ms = if sample_rate > 0 {
            (sample_count as u64 * 1000) / sample_rate as u64
        } else {
            0
        };

        let elapsed = start_time.elapsed();
        info!(
            "Piper TTS synthesized {} samples ({}ms) in {}ms for: \"{}\"",
            sample_count,
            duration_ms,
            elapsed.as_millis(),
            normalized
        );

        // Send directly to Rodio playback node
        self.playback.play_pcm_samples(samples, sample_rate, Some(self.cancel_token.clone()));

        Ok(PiperSpeakResult {
            success: true,
            text: normalized,
            sample_count,
            sample_rate,
            duration_ms,
            style: self.current_style.as_str().to_string(),
        })
    }

    /// Immediate barge-in cutoff: terminates ongoing synthesis and rodio audio playback in <= 50ms
    pub fn stop(&mut self) {
        self.cancel_token.store(true, Ordering::SeqCst);
        self.playback.stop();
        info!("Piper TTS: Immediate barge-in stop executed");
    }

    /// Query engine status
    pub fn get_status(&self) -> PiperEngineStatus {
        let (sample_rate, num_speakers) = if let Some(ref tts) = self.tts {
            (tts.sample_rate(), tts.num_speakers())
        } else {
            (0, 0)
        };

        PiperEngineStatus {
            ready: self.is_ready(),
            is_playing: self.playback.is_playing(),
            model_path: self.model_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            tokens_path: self.tokens_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            data_dir: self.data_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
            active_style: self.current_style.as_str().to_string(),
            sample_rate,
            num_speakers,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_piper_prosody_style_parsing() {
        assert_eq!(PiperProsodyStyle::parse("calm"), PiperProsodyStyle::Calm);
        assert_eq!(PiperProsodyStyle::parse("tactical"), PiperProsodyStyle::Tactical);
        assert_eq!(PiperProsodyStyle::parse("alert"), PiperProsodyStyle::Tactical);
        assert_eq!(PiperProsodyStyle::parse("whisper"), PiperProsodyStyle::Whisper);
        assert_eq!(PiperProsodyStyle::parse("night"), PiperProsodyStyle::Whisper);
        assert_eq!(PiperProsodyStyle::parse("witty"), PiperProsodyStyle::Witty);
        assert_eq!(PiperProsodyStyle::parse("unknown_string"), PiperProsodyStyle::Calm);
    }

    #[test]
    fn test_piper_prosody_scalars() {
        let (len, noise, noise_w) = PiperProsodyStyle::Calm.scalars();
        assert_eq!(len, 0.95);
        assert_eq!(noise, 0.667);
        assert_eq!(noise_w, 0.80);

        let (len_t, noise_t, noise_wt) = PiperProsodyStyle::Tactical.scalars();
        assert_eq!(len_t, 0.88);
        assert_eq!(noise_t, 0.500);
        assert_eq!(noise_wt, 0.65);

        let (len_w, noise_w, noise_ww) = PiperProsodyStyle::Whisper.scalars();
        assert_eq!(len_w, 0.98);
        assert_eq!(noise_w, 0.600);
        assert_eq!(noise_ww, 0.75);

        let (len_wi, noise_wi, noise_wwi) = PiperProsodyStyle::Witty.scalars();
        assert_eq!(len_wi, 1.00);
        assert_eq!(noise_wi, 0.740);
        assert_eq!(noise_wwi, 0.85);
    }

    #[test]
    fn test_piper_engine_lifecycle_and_barge_in() {
        let mut engine = PiperEngine::new();
        // Without preloaded assets, engine enters clean deferred standby
        let status = engine.get_status();
        assert_eq!(status.active_style, "calm");
        assert!(!status.is_playing);

        // Immediate stop does not panic
        engine.stop();
        assert!(!engine.playback.is_playing());
    }
}

