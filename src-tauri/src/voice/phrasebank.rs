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
    phrase_cache: Arc<Mutex<std::collections::HashMap<String, Vec<f32>>>>,
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
                "Got it.",
                "Right away.",
                "I'm on that.",
                "One second.",
            ],
            confirmations: vec![
                "Done.",
                "All done.",
                "Took care of that.",
                "All set.",
                "Sorted.",
            ],
            cue_counter: AtomicUsize::new(0),
            is_speaking: Arc::new(AtomicBool::new(false)),
            output_rms: Arc::new(Mutex::new(0.0)),
            active_sink: Arc::new(Mutex::new(None)),
            phrase_cache: Arc::new(Mutex::new(std::collections::HashMap::new())),
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
        let duration_secs = 0.11; // 110ms (< 150ms budget, satisfies duration_ms >= 100)
        let total_samples = (sample_rate as f32 * duration_secs) as usize;
        let mut samples = Vec::with_capacity(total_samples);

        for i in 0..total_samples {
            let t = i as f32 / sample_rate as f32;
            let decay = (-t * 30.0).exp();
            let envelope = (std::f32::consts::PI * t / duration_secs).sin() * decay;

            let sample = match variant {
                0 => {
                    // Soft warm chord: 440Hz + 880Hz harmonic
                    let tone = (2.0 * std::f32::consts::PI * 440.0 * t).sin() * 0.7
                        + (2.0 * std::f32::consts::PI * 880.0 * t).sin() * 0.3;
                    tone * envelope * 0.04
                }
                1 => {
                    // Dual tone chime: 520Hz + 660Hz
                    let t1 = (2.0 * std::f32::consts::PI * 520.0 * t).sin();
                    let t2 = (2.0 * std::f32::consts::PI * 660.0 * t).sin();
                    (t1 + t2) * 0.5 * envelope * 0.035
                }
                _ => {
                    // Subtle low frequency resonance: 330Hz
                    let tone = (2.0 * std::f32::consts::PI * 330.0 * t).sin();
                    tone * envelope * 0.04
                }
            };

            samples.push(sample);
        }

        samples
    }

    /// Plays the 120ms acknowledgement cue immediately (≤ 150ms budget)
    /// Silenced by default to avoid repetitive acoustic irritation during active voice listening.
    pub fn play_instant_acknowledgement(&self) {
        // Respect user acoustic comfort: acknowledgement is rendered via visual Orb states rather than acoustic beeps.
    }

    /// Attempts to load a pre-recorded high fidelity WAV asset for common phrases
    pub fn load_phrase_wav(&self, text: &str) -> Option<Vec<f32>> {
        let slug: String = text
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ')
            .collect::<String>()
            .to_lowercase()
            .replace(' ', "_");

        if let Ok(cache) = self.phrase_cache.lock() {
            if let Some(samples) = cache.get(&slug) {
                return Some(samples.clone());
            }
        }

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
                        hound::SampleFormat::Float => {
                            reader.samples::<f32>().filter_map(Result::ok).collect()
                        }
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
                        if let Ok(mut cache) = self.phrase_cache.lock() {
                            cache.insert(slug, samples.clone());
                        }
                        return Some(samples);
                    }
                }
            }
        }
        None
    }

    /// Speaks the given sentence aloud if a pre-recorded high-fidelity WAV asset exists.
    /// Dynamic text synthesis is exclusively managed by the frontend engine to guarantee
    /// exactly one audio stream with zero duplicate playback.
    pub fn speak_sentence(&self, text: &str) {
        let clean_text = text.trim();
        if clean_text.is_empty() {
            return;
        }

        // Only play pre-recorded WAV assets over rodio; arbitrary sentence synthesis is handled by the voice engine
        let samples = match self.load_phrase_wav(clean_text) {
            Some(s) => s,
            None => return,
        };

        self.barge_in();
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

    pub fn play_dynamic_wav(&self, path: &str) {
        self.barge_in();
        self.is_speaking.store(true, Ordering::SeqCst);
        let is_speaking = self.is_speaking.clone();
        let output_rms = self.output_rms.clone();
        let active_sink = self.active_sink.clone();
        let path = path.to_string();

        std::thread::spawn(move || {
            let (_stream, stream_handle) = match rodio::OutputStream::try_default() {
                Ok(s) => s,
                Err(_) => return,
            };

            let sink = match rodio::Sink::try_new(&stream_handle) {
                Ok(s) => s,
                Err(_) => return,
            };

            let file = match std::fs::File::open(&path) {
                Ok(f) => f,
                Err(_) => return,
            };
            let source = match rodio::Decoder::new(std::io::BufReader::new(file)) {
                Ok(s) => s,
                Err(_) => return,
            };

            sink.append(source);

            if let Ok(mut lock) = active_sink.lock() {
                *lock = Some(sink);
            }

            loop {
                if !is_speaking.load(Ordering::SeqCst) {
                    break;
                }
                let mut is_empty = false;
                if let Ok(lock) = active_sink.lock() {
                    if let Some(s) = lock.as_ref() {
                        if s.empty() {
                            is_empty = true;
                        }
                    } else {
                        break;
                    }
                }
                
                if is_empty {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }

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
