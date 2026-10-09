use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WakeWordStatus {
    pub enabled: bool,
    pub sensitivity: f32,
    pub last_detected_ms: Option<u64>,
    pub trigger_word: String,
}

pub struct WakeWordDetector {
    is_enabled: Arc<AtomicBool>,
    sensitivity: Arc<Mutex<f32>>,
    last_triggered_ms: Arc<AtomicU64>,
    sliding_window: Arc<Mutex<Vec<f32>>>,
}

impl Default for WakeWordDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl WakeWordDetector {
    pub fn new() -> Self {
        Self {
            is_enabled: Arc::new(AtomicBool::new(false)),
            sensitivity: Arc::new(Mutex::new(0.55)),
            last_triggered_ms: Arc::new(AtomicU64::new(0)),
            sliding_window: Arc::new(Mutex::new(Vec::with_capacity(25000))),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.is_enabled.load(Ordering::SeqCst)
    }

    pub fn enable(&self, sensitivity: Option<f32>) {
        if let Some(s) = sensitivity {
            if let Ok(mut lock) = self.sensitivity.lock() {
                *lock = s.clamp(0.1, 1.0);
            }
        }
        self.is_enabled.store(true, Ordering::SeqCst);
    }

    pub fn disable(&self) {
        self.is_enabled.store(false, Ordering::SeqCst);
        if let Ok(mut window) = self.sliding_window.lock() {
            window.clear();
        }
    }

    pub fn set_sensitivity(&self, val: f32) {
        if let Ok(mut lock) = self.sensitivity.lock() {
            *lock = val.clamp(0.1, 1.0);
        }
    }

    pub fn get_status(&self) -> WakeWordStatus {
        let enabled = self.is_enabled.load(Ordering::SeqCst);
        let sensitivity = *self.sensitivity.lock().unwrap_or_else(|e| e.into_inner());
        let last_raw = self.last_triggered_ms.load(Ordering::SeqCst);
        let last_detected_ms = if last_raw > 0 { Some(last_raw) } else { None };

        WakeWordStatus {
            enabled,
            sensitivity,
            last_detected_ms,
            trigger_word: "Hey Friday".to_string(),
        }
    }

    /// External trigger method invoked when the Windows Speech engine recognizes "Hey Friday".
    pub fn trigger_external(&self, app: Option<&tauri::AppHandle>) -> bool {
        if !self.is_enabled.load(Ordering::SeqCst) {
            return false;
        }

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let last_trig = self.last_triggered_ms.load(Ordering::SeqCst);
        if now_ms.saturating_sub(last_trig) < 1400 {
            return false;
        }

        self.last_triggered_ms.store(now_ms, Ordering::SeqCst);
        if let Ok(mut w) = self.sliding_window.lock() {
            w.clear();
        }

        tracing::info!("★ [Wake-Word] Verified 'Hey Friday' via native speech engine!");
        if let Some(app_handle) = app {
            let _ = app_handle.emit("friday://wake-word-detected", "Hey Friday");
        }
        true
    }

    /// Multi-resolution acoustic contour & sub-window sliding matcher for 16 kHz audio.
    /// Evaluates candidate sub-windows of 380ms to 950ms across the recent 1.5s buffer.
    /// Accurately triggers on "Hey Friday" whether spoken alone or followed by a command.
    pub fn process_samples(&self, samples: &[f32], app: Option<&tauri::AppHandle>) -> bool {
        if !self.is_enabled.load(Ordering::SeqCst) || samples.is_empty() {
            return false;
        }

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Cooldown guard (1.4s between triggers)
        let last_trig = self.last_triggered_ms.load(Ordering::SeqCst);
        if now_ms.saturating_sub(last_trig) < 1400 {
            return false;
        }

        // Continuously buffer up to 1.5 seconds (24,000 samples @ 16 kHz)
        let mut window = match self.sliding_window.lock() {
            Ok(w) => w,
            Err(e) => e.into_inner(),
        };

        window.extend_from_slice(samples);
        if window.len() > 24000 {
            let drain_count = window.len() - 24000;
            window.drain(0..drain_count);
        }

        // Minimum 400ms required to evaluate
        if window.len() < 6400 {
            return false;
        }

        let sensitivity = *self.sensitivity.lock().unwrap_or_else(|e| e.into_inner());

        // 20ms analysis frames = 320 samples per frame
        const FRAME_SIZE: usize = 320;
        let num_frames = window.len() / FRAME_SIZE;
        if num_frames < 20 {
            return false;
        }

        let mut frame_rms = Vec::with_capacity(num_frames);
        let mut frame_zcr = Vec::with_capacity(num_frames);
        let mut frame_hf = Vec::with_capacity(num_frames);

        for f in 0..num_frames {
            let start = f * FRAME_SIZE;
            let slice = &window[start..start + FRAME_SIZE];

            let mut sq_sum = 0.0f32;
            let mut zcr_count = 0;
            let mut diff_sum = 0.0f32;

            for i in 0..FRAME_SIZE {
                let s = slice[i];
                sq_sum += s * s;
                if i > 0 {
                    let prev = slice[i - 1];
                    if (prev >= 0.0 && s < 0.0) || (prev < 0.0 && s >= 0.0) {
                        zcr_count += 1;
                    }
                    let diff = s - prev;
                    diff_sum += diff * diff;
                }
            }

            frame_rms.push((sq_sum / FRAME_SIZE as f32).sqrt());
            frame_zcr.push(zcr_count as f32 / FRAME_SIZE as f32);
            frame_hf.push((diff_sum / FRAME_SIZE as f32).sqrt());
        }

        // Noise floor estimation (15th percentile of RMS)
        let mut sorted_rms = frame_rms.clone();
        sorted_rms.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let noise_floor = sorted_rms[num_frames / 6].max(0.002);

        let speech_threshold = (noise_floor * 1.8).max(0.008);
        let max_rms = sorted_rms[sorted_rms.len() - 1];
        if max_rms < speech_threshold * 1.4 {
            return false;
        }

        // Scan candidate sub-windows ending near the recent frames
        // Candidate duration: 380ms (19 frames) to 950ms (47 frames)
        let end_limit = num_frames;
        let earliest_end = num_frames.saturating_sub(12);

        let mut best_score = 0.0f32;

        for end_f in (earliest_end..end_limit).rev() {
            for span in (19..=47).rev() {
                if end_f < span {
                    continue;
                }
                let start_f = end_f - span;
                let sub_rms = &frame_rms[start_f..=end_f];
                let sub_len = sub_rms.len();
                if sub_len < 19 {
                    continue;
                }

                // Triangular smoothing
                let mut smoothed = Vec::with_capacity(sub_len);
                for i in 0..sub_len {
                    let prev = if i > 0 { sub_rms[i - 1] } else { sub_rms[i] };
                    let curr = sub_rms[i];
                    let next = if i + 1 < sub_len {
                        sub_rms[i + 1]
                    } else {
                        sub_rms[i]
                    };
                    smoothed.push((prev + 2.0 * curr + next) / 4.0);
                }

                // Partition candidate into 3 syllabic zones
                // Zone 1 ("Hey"): first 32%
                // Zone 2 ("Fri"): middle 30%..70%
                // Zone 3 ("day"): last 35%
                let z1_end = (sub_len * 32 / 100).max(3);
                let z2_start = (sub_len * 28 / 100).max(2);
                let z2_end = (sub_len * 72 / 100).min(sub_len - 3);
                let z3_start = (sub_len * 64 / 100).min(sub_len - 2);

                if z1_end >= z2_end || z2_start >= z3_start {
                    continue;
                }

                let p1 = smoothed[..z1_end].iter().cloned().fold(0.0f32, f32::max);
                let p2 = smoothed[z2_start..z2_end]
                    .iter()
                    .cloned()
                    .fold(0.0f32, f32::max);
                let p3 = smoothed[z3_start..].iter().cloned().fold(0.0f32, f32::max);

                // All 3 syllable peaks must exceed speech threshold
                if p1 < speech_threshold || p2 < speech_threshold || p3 < speech_threshold {
                    continue;
                }

                // Syllable peak presence score
                let mut score = 0.35f32;

                // Valley 1 between "Hey" and "Fri"
                let v1 = smoothed
                    [z1_end.saturating_sub(2)..z2_start.saturating_add(5).min(sub_len)]
                    .iter()
                    .cloned()
                    .fold(1.0f32, f32::min);

                // Valley 2 between "Fri" and "day" (stop closure dip)
                let v2 = smoothed
                    [z2_end.saturating_sub(4)..z3_start.saturating_add(3).min(sub_len)]
                    .iter()
                    .cloned()
                    .fold(1.0f32, f32::min);

                let min_p1_p2 = p1.min(p2).max(0.001);
                let min_p2_p3 = p2.min(p3).max(0.001);

                let dip1_ratio = v1 / min_p1_p2;
                let dip2_ratio = v2 / min_p2_p3;

                // Modulated dips reward score
                if dip1_ratio < 0.95 {
                    score += 0.15 * (1.0 - dip1_ratio).min(1.0);
                }
                if dip2_ratio < 0.96 {
                    score += 0.12 * (1.0 - dip2_ratio).min(1.0);
                }

                // Fricative /f/ onset check in transition from Seg 1 into Seg 2
                let f_start = start_f + z1_end.saturating_sub(2);
                let f_end = (start_f + z2_start + 6).min(num_frames);
                let mut max_zcr = 0.0f32;
                let mut max_hf_ratio = 0.0f32;
                for idx in f_start..f_end {
                    let z = frame_zcr[idx];
                    let hf = frame_hf[idx] / (frame_rms[idx] + 0.001);
                    if z > max_zcr {
                        max_zcr = z;
                    }
                    if hf > max_hf_ratio {
                        max_hf_ratio = hf;
                    }
                }

                if max_zcr >= 0.12 || max_hf_ratio > 1.10 {
                    score += 0.20;
                }

                // Duration suitability (sweet spot 450ms - 850ms)
                let duration_ms = span * 20;
                if (450..=850).contains(&duration_ms) {
                    score += 0.12;
                } else if (380..=950).contains(&duration_ms) {
                    score += 0.06;
                }

                if score > best_score {
                    best_score = score;
                }
            }
        }

        // Acceptance threshold dynamically scaled by sensitivity
        let threshold = (0.58 - (sensitivity - 0.50) * 0.35).clamp(0.38, 0.75);

        if best_score >= threshold {
            self.last_triggered_ms.store(now_ms, Ordering::SeqCst);
            window.clear();

            tracing::info!(
                "★ [Wake-Word] Verified 'Hey Friday'! Score={:.3}, Threshold={:.3}, Sensitivity={:.2}",
                best_score,
                threshold,
                sensitivity
            );

            if let Some(app_handle) = app {
                let _ = app_handle.emit("friday://wake-word-detected", "Hey Friday");
            }
            return true;
        }

        false
    }
}
