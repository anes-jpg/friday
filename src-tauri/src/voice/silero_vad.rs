/// A Rust wrapper for Silero VAD.
/// In a full build, this would load the Silero ONNX model via the `ort` crate.
/// For now, it stubs the VAD interface to prevent blocking CPAL audio.
pub struct SileroVadNode {
    pub is_speaking: bool,
}

impl Default for SileroVadNode {
    fn default() -> Self {
        Self::new()
    }
}

impl SileroVadNode {
    pub fn new() -> Self {
        Self { is_speaking: false }
    }

    /// Processes a raw audio chunk (f32 format) and returns true if speech is detected.
    pub fn process_chunk(&mut self, _audio_data: &[f32]) -> bool {
        // Silero VAD heuristic logic would go here.
        // E.g. running the ONNX session: session.run(inputs)

        // Mocking VAD detection as always true to pass through to Sherpa
        true
    }
}
