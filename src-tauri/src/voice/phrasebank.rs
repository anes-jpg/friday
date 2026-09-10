use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

pub struct PhraseBank {
    pub acknowledgements: Vec<&'static str>,
    pub confirmations: Vec<&'static str>,
    cue_counter: AtomicUsize,
    is_speaking: Arc<AtomicBool>,
    output_rms: Arc<Mutex<f32>>,
    active_sink: Arc<Mutex<Option<rodio::Sink>>>,
}

impl Default for PhraseBank {
    fn default() -> Self {
        Self::new()
    }
}

impl PhraseBank {
    pub fn new() -> Self {
        Self {
            acknowledgements: vec![
                "On it.",
                "Understood.",
                "Working on that.",
                "One moment.",
            ],
            confirmations: vec![
                "Done.",
                "Executed.",
                "Task completed.",
                "Finished.",
            ],
            cue_counter: AtomicUsize::new(0),
            is_speaking: Arc::new(AtomicBool::new(false)),
            output_rms: Arc::new(Mutex::new(0.0)),
            active_sink: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_acknowledgement(&self, index: usize) -> &'static str {
        self.acknowledgements[index % self.acknowledgements.len()]
    }

    pub fn is_speaking(&self) -> bool {
        self.is_speaking.load(Ordering::SeqCst)
    }

    pub fn get_output_rms(&self) -> f32 {
        *self.output_rms.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Barge-in: immediately stops ongoing speech playback within ≤ 200 ms budget (§05 Latency Budgets)
    pub fn barge_in(&self) {
        self.is_speaking.store(false, Ordering::SeqCst);
        if let Ok(mut lock) = self.active_sink.lock() {
            if let Some(sink) = lock.take() {
                sink.stop();
            }
        }
        if let Ok(mut rms) = self.output_rms.lock() {
            *rms = 0.0;
        }
    }

    /// Generates a warm, sub-150ms non-verbal acoustic cue wave buffer
    /// Rotates among 3 variants: breath, soft warm tick, gentle dual-tone
    pub fn generate_cue_samples(&self) -> Vec<f32> {
        let variant = self.cue_counter.fetch_add(1, Ordering::Relaxed) % 3;
        let sample_rate = 16000;
        let duration_secs = 0.12; // 120ms (< 150ms budget)
        let total_samples = (sample_rate as f32 * duration_secs) as usize;
        let mut samples = Vec::with_capacity(total_samples);

        for i in 0..total_samples {
            let t = i as f32 / sample_rate as f32;
            // Smooth Tukey/Hanning envelope to eliminate any clicks
            let envelope = (std::f32::consts::PI * t / duration_secs).sin();

            let sample = match variant {
                0 => {
                    // Soft warm tick: 440Hz decaying fast
                    let tone = (2.0 * std::f32::consts::PI * 440.0 * t).sin();
                    tone * envelope * 0.15
                }
                1 => {
                    // Dual tone chime: 520Hz + 660Hz
                    let t1 = (2.0 * std::f32::consts::PI * 520.0 * t).sin();
                    let t2 = (2.0 * std::f32::consts::PI * 660.0 * t).sin();
                    (t1 + t2) * 0.5 * envelope * 0.12
                }
                _ => {
                    // Subtle low frequency resonance: 320Hz
                    let tone = (2.0 * std::f32::consts::PI * 320.0 * t).sin();
                    tone * envelope * 0.18
                }
            };

            samples.push(sample);
        }

        samples
    }

    /// Plays the 120ms acknowledgement cue immediately (≤ 150ms budget)
    pub fn play_instant_acknowledgement(&self) {
        let samples = self.generate_cue_samples();

        // Spawn playback in background so it never blocks the caller
        std::thread::spawn(move || {
            if let Ok((_stream, handle)) = rodio::OutputStream::try_default() {
                if let Ok(sink) = rodio::Sink::try_new(&handle) {
                    let source = rodio::buffer::SamplesBuffer::new(1, 16000, samples);
                    sink.append(source);
                    sink.sleep_until_end();
                }
            }
        });
    }

    /// Attempts to load a pre-recorded high fidelity WAV asset for common phrases
    pub fn load_phrase_wav(&self, text: &str) -> Option<Vec<f32>> {
        let slug: String = text
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ')
            .collect::<String>()
            .to_lowercase()
            .replace(' ', "_");

        let candidates = [
            format!("assets/phrasebank/{}.wav", slug),
            format!("../assets/phrasebank/{}.wav", slug),
        ];

        for path_str in &candidates {
            let p = Path::new(path_str);
            if p.exists() {
                if let Ok(mut reader) = hound::WavReader::open(p) {
                    let spec = reader.spec();
                    let samples: Vec<f32> = match spec.sample_format {
                        hound::SampleFormat::Float => reader.samples::<f32>().filter_map(Result::ok).collect(),
                        hound::SampleFormat::Int => {
                            let max_val = (1i64 << (spec.bits_per_sample - 1)) as f32;
                            reader
                                .samples::<i32>()
                                .filter_map(Result::ok)
                                .map(|s| (s as f32 / max_val).clamp(-1.0, 1.0))
                                .collect()
                        }
                    };
                    if !samples.is_empty() {
                        return Some(samples);
                    }
                }
            }
        }
        None
    }

    /// Synthesizes acoustic speech samples using a multi-formant vocal tract model
    /// Sample rate: 24,000 Hz (Kokoro / Piper standard)
    pub fn generate_speech_samples(&self, text: &str) -> Vec<f32> {
        let sample_rate = 24000;
        let words: Vec<&str> = text.split_whitespace().collect();
        if words.is_empty() {
            return Vec::new();
        }

        let mut all_samples = Vec::new();
        let total_words = words.len();

        for (word_idx, word) in words.iter().enumerate() {
            // Natural sentence pitch contour: gentle declination with slight question lift
            let sentence_progress = word_idx as f32 / total_words.max(1) as f32;
            let is_question = text.trim_end().ends_with('?');
            let base_pitch = if is_question && sentence_progress > 0.7 {
                210.0 + (sentence_progress - 0.7) * 45.0 // rise for questions
            } else {
                215.0 - sentence_progress * 25.0 // slight natural declination
            };

            for ch in word.chars() {
                let lower = ch.to_ascii_lowercase();
                let (dur_sec, f1, f2, f3, is_unvoiced) = match lower {
                    'a' => (0.075, 730.0, 1090.0, 2440.0, false),
                    'e' => (0.070, 530.0, 1840.0, 2480.0, false),
                    'i' => (0.065, 270.0, 2290.0, 3010.0, false),
                    'o' => (0.075, 570.0, 840.0, 2410.0, false),
                    'u' => (0.070, 300.0, 870.0, 2240.0, false),
                    's' | 'z' | 'f' => (0.045, 1200.0, 3500.0, 5000.0, true),
                    't' | 'k' | 'p' => (0.035, 800.0, 2800.0, 4200.0, true),
                    'm' | 'n' => (0.060, 250.0, 1200.0, 2200.0, false),
                    'l' | 'r' => (0.055, 380.0, 1300.0, 2500.0, false),
                    c if c.is_alphabetic() => (0.050, 450.0, 1500.0, 2500.0, false),
                    _ => (0.020, 0.0, 0.0, 0.0, true),
                };

                let sample_count = (sample_rate as f32 * dur_sec) as usize;
                for i in 0..sample_count {
                    let t = i as f32 / sample_rate as f32;
                    let envelope = (std::f32::consts::PI * t / dur_sec).sin().powi(2);

                    let sample = if is_unvoiced {
                        // High-frequency shaped turbulence noise for consonants
                        let noise = ((i * 1103515245 + 12345) % 65536) as f32 / 32768.0 - 1.0;
                        let hf = (2.0 * std::f32::consts::PI * f2 * t).sin();
                        (noise * 0.4 + hf * 0.6) * envelope * 0.12
                    } else if f1 > 0.0 {
                        // Resonant vocal tract: fundamental + 3 formants
                        let f0_tone = (2.0 * std::f32::consts::PI * base_pitch * t).sin();
                        let form1 = (2.0 * std::f32::consts::PI * f1 * t).sin() * 0.45;
                        let form2 = (2.0 * std::f32::consts::PI * f2 * t).sin() * 0.28;
                        let form3 = (2.0 * std::f32::consts::PI * f3 * t).sin() * 0.14;
                        (f0_tone * 0.25 + form1 + form2 + form3) * envelope * 0.22
                    } else {
                        0.0
                    };

                    all_samples.push(sample);
                }
            }

            // Word pause (35ms silence)
            let pause_samples = (sample_rate as f32 * 0.035) as usize;
            all_samples.extend(std::iter::repeat_n(0.0, pause_samples));
        }

        all_samples
    }

    /// Speaks the given sentence aloud, ducking/stopping previous playback immediately
    /// Tracks active RMS for live Orb visualization and supports sub-200ms barge-in
    pub fn speak_sentence(&self, text: &str) {
        self.barge_in();

        let clean_text = text.trim();
        if clean_text.is_empty() {
            return;
        }

        // Try pre-recorded asset first, fallback to acoustic formant synthesis
        let samples = self
            .load_phrase_wav(clean_text)
            .unwrap_or_else(|| self.generate_speech_samples(clean_text));

        if samples.is_empty() {
            return;
        }

        self.is_speaking.store(true, Ordering::SeqCst);
        let is_speaking = self.is_speaking.clone();
        let output_rms = self.output_rms.clone();
        let active_sink = self.active_sink.clone();

        std::thread::spawn(move || {
            let (_stream, handle) = match rodio::OutputStream::try_default() {
                Ok(res) => res,
                Err(e) => {
                    tracing::warn!("Failed to initialize audio output stream: {}", e);
                    is_speaking.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let sink = match rodio::Sink::try_new(&handle) {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("Failed to create rodio sink: {}", e);
                    is_speaking.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let sample_rate = 24000;
            let chunk_size = 1200; // 50ms chunks for smooth RMS tracking

            // Store sink for barge-in cancellation
            if let Ok(mut lock) = active_sink.lock() {
                *lock = Some(sink);
            }

            let chunks: Vec<Vec<f32>> = samples.chunks(chunk_size).map(|c| c.to_vec()).collect();

            for chunk in chunks {
                if !is_speaking.load(Ordering::SeqCst) {
                    break;
                }

                // Compute output RMS for this slice to drive reactive Orb
                let sum_sq: f32 = chunk.iter().map(|&s| s * s).sum();
                let rms = (sum_sq / chunk.len().max(1) as f32).sqrt();
                if let Ok(mut r) = output_rms.lock() {
                    *r = (rms * 2.2).clamp(0.0, 1.0);
                }

                let source = rodio::buffer::SamplesBuffer::new(1, sample_rate, chunk);
                if let Ok(lock) = active_sink.lock() {
                    if let Some(ref sink_ref) = *lock {
                        sink_ref.append(source);
                    } else {
                        break;
                    }
                } else {
                    break;
                }

                // Sleep for chunk duration while checking is_speaking for barge-in
                let slice_dur = std::time::Duration::from_millis(10);
                let mut slept = std::time::Duration::ZERO;
                let target_chunk_dur = std::time::Duration::from_millis(50);
                while slept < target_chunk_dur {
                    if !is_speaking.load(Ordering::SeqCst) {
                        break;
                    }
                    std::thread::sleep(slice_dur);
                    slept += slice_dur;
                }
            }

            // Wait for remaining audio buffer to drain unless barged-in
            while is_speaking.load(Ordering::SeqCst) {
                let is_empty = if let Ok(lock) = active_sink.lock() {
                    lock.as_ref().map(|s| s.empty()).unwrap_or(true)
                } else {
                    true
                };
                if is_empty {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }

            // Playback completed or barged in
            is_speaking.store(false, Ordering::SeqCst);
            if let Ok(mut r) = output_rms.lock() {
                *r = 0.0;
            }
            if let Ok(mut lock) = active_sink.lock() {
                *lock = None;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cue_duration_budget() {
        let pb = PhraseBank::new();
        let samples = pb.generate_cue_samples();
        let duration_ms = (samples.len() as f32 / 16000.0) * 1000.0;

        // Must strictly satisfy the ≤ 150ms non-verbal acknowledgement budget
        assert!(duration_ms <= 150.0);
        assert!(duration_ms >= 100.0);
    }

    #[test]
    fn test_speech_synthesis_generation() {
        let pb = PhraseBank::new();
        let samples = pb.generate_speech_samples("Understood. Task completed.");
        assert!(!samples.is_empty());
        // At 24kHz, a 3-word sentence should have over 5,000 samples
        assert!(samples.len() > 5000);

        // Verify amplitude is bounded and non-clipping
        for &s in &samples {
            assert!(s >= -1.0 && s <= 1.0);
        }
    }

    #[test]
    fn test_barge_in_stop_latency() {
        let pb = PhraseBank::new();
        pb.is_speaking.store(true, Ordering::SeqCst);
        let start = std::time::Instant::now();
        pb.barge_in();
        let elapsed_ms = start.elapsed().as_millis();

        // Barge-in must stop well within ≤ 200 ms
        assert!(elapsed_ms <= 200);
        assert!(!pb.is_speaking());
        assert_eq!(pb.get_output_rms(), 0.0);
    }
}

