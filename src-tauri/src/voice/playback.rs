use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::thread;
use tracing::{error, info};

/// A Rust wrapper for Rodio.
/// Used to play Kokoro TTS streams natively in Rust, avoiding JS audio context overhead.
pub struct RodioPlaybackNode {
    is_playing: bool,
}

impl Default for RodioPlaybackNode {
    fn default() -> Self {
        Self::new()
    }
}

impl RodioPlaybackNode {
    pub fn new() -> Self {
        Self { is_playing: false }
    }

    pub fn play_audio_file(&mut self, path: String) {
        self.is_playing = true;
        thread::spawn(move || {
            info!("Playing audio file: {}", path);
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to get output stream: {}", e);
                    return;
                }
            };

            let sink = match Sink::try_new(&stream_handle) {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to create sink: {}", e);
                    return;
                }
            };

            let file = match File::open(&path) {
                Ok(f) => f,
                Err(e) => {
                    error!("Failed to open audio file '{}': {}", path, e);
                    return;
                }
            };

            let source = match Decoder::new(BufReader::new(file)) {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to decode audio file: {}", e);
                    return;
                }
            };

            sink.append(source);
            sink.sleep_until_end();
            info!("Audio playback finished.");
        });
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
    }
}
