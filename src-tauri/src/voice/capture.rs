use super::PhraseBank;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::traits::{Producer, Split};
use ringbuf::HeapRb;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

pub struct AudioCaptureManager {
    is_capturing: Arc<AtomicBool>,
    current_rms: Arc<Mutex<f32>>,
    phrase_bank: Arc<Mutex<Option<Arc<PhraseBank>>>>,
}

impl Default for AudioCaptureManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioCaptureManager {
    pub fn new() -> Self {
        Self {
            is_capturing: Arc::new(AtomicBool::new(false)),
            current_rms: Arc::new(Mutex::new(0.0)),
            phrase_bank: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_phrase_bank(&self, pb: Arc<PhraseBank>) {
        if let Ok(mut lock) = self.phrase_bank.lock() {
            *lock = Some(pb);
        }
    }

    pub fn get_current_rms(&self) -> f32 {
        *self.current_rms.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Spawns the dedicated, time-critical audio capture thread (§02 Architecture Process Model)
    pub fn start_capture(&self) -> Result<(), String> {
        // Instant barge-in: If user presses push-to-talk while FRIDAY speaks, duck and stop voice immediately
        if let Ok(pb_lock) = self.phrase_bank.lock() {
            if let Some(ref pb) = *pb_lock {
                if pb.is_speaking() {
                    pb.barge_in();
                    tracing::info!("Barge-in: Push-to-talk initiated during speech playback, voice stopped.");
                }
            }
        }

        if self.is_capturing.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.is_capturing.store(true, Ordering::SeqCst);
        let capturing = self.is_capturing.clone();
        let rms_holder = self.current_rms.clone();
        let pb_holder = self.phrase_bank.clone();

        std::thread::spawn(move || {
            let host = cpal::default_host();
            let device = match host.default_input_device() {
                Some(d) => d,
                None => {
                    tracing::warn!("No default audio input device found.");
                    capturing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let config = match device.default_input_config() {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("Failed to obtain default input config: {}", e);
                    capturing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            // Lock-free ring buffer for 16kHz audio samples (32000 samples = 2 sec buffer)
            let rb = HeapRb::<f32>::new(32000);
            let (mut prod, _cons) = rb.split();

            let err_fn = |err| tracing::error!("cpal input stream error: {}", err);

            let stream_res = match config.sample_format() {
                cpal::SampleFormat::F32 => device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &_| {
                        // Calculate RMS for live Orb visualization and barge-in
                        let sum_sq: f32 = data.iter().map(|&s| s * s).sum();
                        let rms = (sum_sq / data.len().max(1) as f32).sqrt();

                        if let Ok(mut lock) = rms_holder.try_lock() {
                            *lock = rms.clamp(0.0, 1.0);
                        }

                        // Barge-in check: If user speaks (> 0.15 RMS) while FRIDAY is speaking, duck/stop voice immediately
                        if rms > 0.15 {
                            if let Ok(pb_lock) = pb_holder.try_lock() {
                                if let Some(ref pb) = *pb_lock {
                                    if pb.is_speaking() {
                                        pb.barge_in();
                                        tracing::info!("Barge-in: User speech detected ({:.2} RMS) during playback, interrupted within budget.", rms);
                                    }
                                }
                            }
                        }

                        for &sample in data {
                            let _ = prod.try_push(sample);
                        }
                    },
                    err_fn,
                    None,
                ),
                _ => {
                    tracing::warn!("Unsupported sample format for microphone");
                    return;
                }
            };

            if let Ok(stream) = stream_res {
                if let Err(e) = stream.play() {
                    tracing::error!("Failed to play cpal input stream: {}", e);
                    return;
                }

                while capturing.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
        });

        Ok(())
    }

    pub fn stop_capture(&self) {
        self.is_capturing.store(false, Ordering::SeqCst);
        if let Ok(mut lock) = self.current_rms.lock() {
            *lock = 0.0;
        }
    }
}

