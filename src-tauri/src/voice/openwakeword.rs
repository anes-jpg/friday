use crate::voice::wakeword::WakeWordStatus;

/// A Rust wrapper for openWakeWord.
/// In a full build, this would load the openWakeWord ONNX model (e.g. "hey_friday.onnx").
pub struct OpenWakeWordNode {
    enabled: bool,
    sensitivity: f32,
    last_detected_ms: Option<u64>,
}

impl Default for OpenWakeWordNode {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenWakeWordNode {
    pub fn new() -> Self {
        Self {
            enabled: true,
            sensitivity: 0.5,
            last_detected_ms: Some(0),
        }
    }

    pub fn enable(&mut self, sensitivity: Option<f32>) {
        self.enabled = true;
        if let Some(s) = sensitivity {
            self.sensitivity = s;
        }
    }

    pub fn disable(&mut self) {
        self.enabled = false;
    }

    pub fn get_status(&self) -> WakeWordStatus {
        WakeWordStatus {
            enabled: self.enabled,
            sensitivity: self.sensitivity,
            last_detected_ms: self.last_detected_ms,
            trigger_word: "hey friday".to_string(),
        }
    }

    pub fn process_chunk(&mut self, _audio_data: &[f32]) -> bool {
        // openWakeWord heuristic logic would go here.
        false // default to false so it doesn't trigger continuously
    }
}
