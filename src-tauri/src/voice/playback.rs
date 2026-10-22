use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tracing::{error, info};

/// A Rust audio playback engine using Rodio.
/// Used to play Piper & Kokoro TTS streams natively in Rust, avoiding JS audio context overhead.
#[derive(Clone)]
pub struct RodioPlaybackNode {
    is_playing: Arc<AtomicBool>,
    current_sink: Arc<Mutex<Option<Arc<Sink>>>>,
}

impl Default for RodioPlaybackNode {
    fn default() -> Self {
        Self::new()
    }
}

impl RodioPlaybackNode {
    pub fn new() -> Self {
        Self {
            is_playing: Arc::new(AtomicBool::new(false)),
            current_sink: Arc::new(Mutex::new(None)),
        }
    }

    /// Plays a WAV or audio file from disk
    pub fn play_audio_file(&mut self, path: String) {
        self.stop();
        self.is_playing.store(true, Ordering::SeqCst);
        let is_playing = self.is_playing.clone();
        let current_sink = self.current_sink.clone();

        thread::spawn(move || {
            info!("Playing audio file: {}", path);
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to get output stream: {}", e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let sink = match Sink::try_new(&stream_handle) {
                Ok(s) => Arc::new(s),
                Err(e) => {
                    error!("Failed to create sink: {}", e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            if let Ok(mut lock) = current_sink.lock() {
                *lock = Some(sink.clone());
            }

            let file = match File::open(&path) {
                Ok(f) => f,
                Err(e) => {
                    error!("Failed to open audio file '{}': {}", path, e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let source = match Decoder::new(BufReader::new(file)) {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to decode audio file: {}", e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            sink.append(source);
            sink.sleep_until_end();

            if let Ok(mut lock) = current_sink.lock() {
                *lock = None;
            }
            is_playing.store(false, Ordering::SeqCst);
            info!("Audio playback finished.");
        });
    }

    /// Plays raw f32 PCM samples directly from Piper TTS with sub-80ms cancellation
    pub fn play_pcm_samples(
        &mut self,
        samples: Vec<f32>,
        sample_rate: u32,
        cancel_token: Option<Arc<AtomicBool>>,
    ) {
        self.stop();
        if samples.is_empty() {
            return;
        }

        self.is_playing.store(true, Ordering::SeqCst);
        let is_playing = self.is_playing.clone();
        let current_sink = self.current_sink.clone();

        thread::spawn(move || {
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    error!("Rodio: Failed to obtain default audio output stream: {}", e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let sink = match Sink::try_new(&stream_handle) {
                Ok(s) => Arc::new(s),
                Err(e) => {
                    error!("Rodio: Failed to create audio Sink: {}", e);
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            if let Ok(mut lock) = current_sink.lock() {
                *lock = Some(sink.clone());
            }

            let source = SamplesBuffer::new(1, sample_rate, samples);
            sink.append(source);

            // Poll until finished or cancelled
            while !sink.empty() {
                if let Some(ref token) = cancel_token {
                    if token.load(Ordering::SeqCst) {
                        info!("Rodio: Barge-in triggered, stopping PCM playback immediately");
                        sink.stop();
                        break;
                    }
                }
                if !is_playing.load(Ordering::SeqCst) {
                    sink.stop();
                    break;
                }
                thread::sleep(std::time::Duration::from_millis(20));
            }

            if let Ok(mut lock) = current_sink.lock() {
                *lock = None;
            }
            is_playing.store(false, Ordering::SeqCst);
        });
    }

    /// Barge-In: immediately halts ongoing playback in <= 50ms
    pub fn stop(&mut self) {
        self.is_playing.store(false, Ordering::SeqCst);
        if let Ok(mut lock) = self.current_sink.lock() {
            if let Some(sink) = lock.take() {
                sink.stop();
            }
        }
    }

    /// Check if audio is currently playing
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }
}
