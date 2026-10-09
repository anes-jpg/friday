use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoiceEmotion {
    Neutral,
    Warm,
    Bright,
    CalmConcerned,
    DryAmused,
    Focused,
    Apologetic,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeliveryDirective {
    pub emotion: VoiceEmotion,
    pub pace: f32,   // Clamped 0.85 to 1.12 (§05 The Emotion Engine)
    pub energy: f32, // 0.0 to 1.0
    pub pause_before_ms: u32,
    pub emphasis: Vec<String>,
}

impl Default for DeliveryDirective {
    fn default() -> Self {
        Self {
            emotion: VoiceEmotion::Neutral,
            pace: 1.0,
            energy: 0.5,
            pause_before_ms: 0,
            emphasis: Vec::new(),
        }
    }
}

pub struct CompiledSynthesisParams {
    pub speed: f32,
    pub pitch_shift_cents: i32,
    pub gain_db: f32,
    pub pause_ms: u32,
}

impl DeliveryDirective {
    /// Compiles delivery directive into concrete synthesis parameters
    pub fn compile(&self) -> CompiledSynthesisParams {
        // Clamp pace strictly to 0.85 .. 1.12
        let speed = self.pace.clamp(0.85, 1.12);

        let (pitch_shift_cents, gain_db) = match self.emotion {
            VoiceEmotion::Neutral => (0, 0.0),
            VoiceEmotion::Warm => (-15, 0.5),
            VoiceEmotion::Bright => (25, 1.0),
            VoiceEmotion::CalmConcerned => (-30, -1.0),
            VoiceEmotion::DryAmused => (10, 0.2),
            VoiceEmotion::Focused => (0, 0.8),
            VoiceEmotion::Apologetic => (-20, -1.5),
        };

        CompiledSynthesisParams {
            speed,
            pitch_shift_cents,
            gain_db,
            pause_ms: self.pause_before_ms,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_directive_clamping() {
        let mut directive = DeliveryDirective {
            pace: 2.5,
            ..Default::default()
        };
        let params = directive.compile();
        assert_eq!(params.speed, 1.12);

        directive.pace = 0.5; // Out of bounds low
        let params_low = directive.compile();
        assert_eq!(params_low.speed, 0.85);
    }
}
