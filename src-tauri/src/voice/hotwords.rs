//! Contextual Hotwords Biasing & Correction Dictionary (§04 Voice Pipeline)
//!
//! Provides technical domain phrase biasing boost scores, phonetic
//! correction mappings for Nigerian-accented English and developer vocabulary,
//! NATO spelling mode decoding, dictation punctuation transforms, and dynamic
//! learning from user transcript corrections.

use std::collections::HashMap;

/// A hotword entry with an acoustic boost score for sherpa-onnx / transducer decoding
#[derive(Debug, Clone, PartialEq)]
pub struct HotwordEntry {
    pub phrase: String,
    pub boost_score: f32,
}

/// Hotwords manager providing decode-time bias lists, phonetic corrections,
/// spelling mode decoding, and punctuation formatting for dictation mode.
pub struct HotwordsEngine {
    hotwords: Vec<HotwordEntry>,
    corrections: HashMap<String, String>,
}

impl Default for HotwordsEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl HotwordsEngine {
    /// Initialize with the baseline domain vocabulary specified in §04 of the build plan
    pub fn new() -> Self {
        let mut engine = Self {
            hotwords: Vec::new(),
            corrections: HashMap::new(),
        };

        // Standard developer and environment domain vocabulary with boost scores
        let defaults = [
            ("Tauri", 2.5),
            ("Notion", 2.0),
            ("OKLCH", 3.0),
            ("Vercel", 2.0),
            ("Awwwards", 2.0),
            ("Antigravity", 2.5),
            ("GLM", 2.5),
            ("Zipformer", 2.5),
            ("Kwame", 2.0),
            ("AN STUDIO", 2.0),
            ("Lagos", 2.0),
            ("bge-small", 2.5),
            ("Kokoro", 2.5),
            ("Piper", 2.0),
            ("SQLCipher", 2.5),
            ("Mica", 2.0),
            ("Acrylic", 2.0),
            ("Alt Space", 2.0),
            ("Zustand", 2.5),
            ("Vite", 2.0),
        ];

        for (phrase, boost) in defaults {
            engine.register_hotword(phrase, boost);
        }

        // Common acoustic mishearings to target vocabulary
        engine.register_correction("torrie", "Tauri");
        engine.register_correction("tori", "Tauri");
        engine.register_correction("ok lch", "OKLCH");
        engine.register_correction("gl m", "GLM");
        engine.register_correction("zip former", "Zipformer");
        engine.register_correction("an studio", "AN STUDIO");
        engine.register_correction("anti gravity", "Antigravity");
        engine.register_correction("co coro", "Kokoro");
        engine.register_correction("cue coro", "Kokoro");

        engine
    }

    /// Add a hotword with a boost score
    pub fn register_hotword(&mut self, phrase: &str, boost_score: f32) {
        if !self
            .hotwords
            .iter()
            .any(|h| h.phrase.eq_ignore_ascii_case(phrase))
        {
            self.hotwords.push(HotwordEntry {
                phrase: phrase.to_string(),
                boost_score,
            });
        }
    }

    /// Add a post-decode correction mapping
    pub fn register_correction(&mut self, mishearing: &str, correction: &str) {
        self.corrections
            .insert(mishearing.to_lowercase(), correction.to_string());
    }

    /// Learn from an inline transcript edit (§04: "A per-user correction dictionary learns from every inline transcript edit")
    pub fn learn_correction(&mut self, original_mishearing: &str, user_correction: &str) {
        let orig = original_mishearing.trim().to_lowercase();
        let corr = user_correction.trim().to_string();
        if !orig.is_empty() && !corr.is_empty() && orig != corr.to_lowercase() {
            self.corrections.insert(orig, corr.clone());
            // Also boost the corrected term as a hotword
            self.register_hotword(&corr, 2.5);
        }
    }

    /// Dynamic Contextual Hotwords Ingestion from user memory facts (§04: "regenerate nightly from your memory store")
    pub fn ingest_from_facts(&mut self, fact_contents: &[String]) {
        for fact in fact_contents {
            for word in fact.split_whitespace() {
                let clean = word.trim_matches(|c: char| !c.is_alphanumeric());
                // Boost capitalized domain entities of length >= 3
                if clean.len() >= 3
                    && clean
                        .chars()
                        .next()
                        .map(|c| c.is_uppercase())
                        .unwrap_or(false)
                {
                    self.register_hotword(clean, 2.0);
                }
            }
        }
    }

    /// Decodes spelling mode input (§04: "a spelling mode handles the hopeless cases ('spell it: alpha november echo sierra')")
    pub fn decode_spelling_mode(&self, input: &str) -> Option<String> {
        let lower = input.trim().to_lowercase();
        let prefix = if lower.starts_with("spell it:") {
            Some("spell it:")
        } else if lower.starts_with("spell it ") {
            Some("spell it ")
        } else if lower.starts_with("spell:") {
            Some("spell:")
        } else if lower.starts_with("spell ") {
            Some("spell ")
        } else {
            None
        };

        let prefix = prefix?;
        let tokens = lower[prefix.len()..].split_whitespace();
        let mut decoded = String::new();

        for token in tokens {
            let clean = token.trim_matches(|c: char| !c.is_alphabetic());
            let ch = match clean {
                "alpha" => Some('a'),
                "bravo" => Some('b'),
                "charlie" => Some('c'),
                "delta" => Some('d'),
                "echo" => Some('e'),
                "foxtrot" => Some('f'),
                "golf" => Some('g'),
                "hotel" => Some('h'),
                "india" => Some('i'),
                "juliet" | "juliett" => Some('j'),
                "kilo" => Some('k'),
                "lima" => Some('l'),
                "mike" => Some('m'),
                "november" => Some('n'),
                "oscar" => Some('o'),
                "papa" => Some('p'),
                "quebec" => Some('q'),
                "romeo" => Some('r'),
                "sierra" => Some('s'),
                "tango" => Some('t'),
                "uniform" => Some('u'),
                "victor" => Some('v'),
                "whiskey" => Some('w'),
                "xray" | "x-ray" => Some('x'),
                "yankee" => Some('y'),
                "zulu" => Some('z'),
                single if single.len() == 1 => single.chars().next(),
                _ => None,
            };

            if let Some(c) = ch {
                decoded.push(c);
            }
        }

        if decoded.is_empty() {
            None
        } else {
            Some(decoded)
        }
    }

    /// Punctuation commands for verbatim dictation (§04: "punctuation commands work in dictation")
    pub fn apply_dictation_punctuation(&self, raw: &str) -> String {
        let mut text = format!(" {} ", raw);

        let punctuation_rules = [
            (" period", "."),
            (" full stop", "."),
            (" comma", ","),
            (" question mark", "?"),
            (" exclamation point", "!"),
            (" exclamation mark", "!"),
            (" semicolon", ";"),
            (" colon", ":"),
            (" new paragraph", "\n\n"),
            (" new line", "\n"),
            (" dash", " -"),
            (" hyphen", "-"),
            (" open quote", " \""),
            (" close quote", "\""),
        ];

        for (spoken, symbol) in punctuation_rules {
            text = text.replace(spoken, symbol);
            // Also case-insensitive replace
            let spoken_cap = format!(" {}{}", spoken[1..2].to_uppercase(), &spoken[2..]);
            text = text.replace(&spoken_cap, symbol);
        }

        // Clean up whitespace around punctuation
        let mut result = text.trim().to_string();
        result = result.replace(" .", ".");
        result = result.replace(" ,", ",");
        result = result.replace(" ?", "?");
        result = result.replace(" !", "!");
        result = result.replace(" :", ":");
        result = result.replace(" ;", ";");
        result = result.replace("\n ", "\n");
        result = result.replace("\n\n ", "\n\n");

        // Capitalize first character if non-empty
        if let Some(first) = result.chars().next() {
            if first.is_ascii_lowercase() {
                result = format!("{}{}", first.to_ascii_uppercase(), &result[1..]);
            }
        }

        result
    }

    /// Returns the hotwords formatted for sherpa-onnx hotwords input
    pub fn export_hotwords_file(&self) -> String {
        let mut lines = Vec::new();
        for entry in &self.hotwords {
            lines.push(format!("{} : {:.1}", entry.phrase, entry.boost_score));
        }
        lines.join("\n")
    }

    /// Apply correction dictionary to raw transcript
    pub fn apply_corrections(&self, raw_transcript: &str) -> String {
        let mut result = raw_transcript.to_string();
        for (mishearing, corrected) in &self.corrections {
            let lower = result.to_lowercase();
            if let Some(idx) = lower.find(mishearing) {
                let end = idx + mishearing.len();
                let before = &result[..idx];
                let after = &result[end..];
                result = format!("{}{}{}", before, corrected, after);
            }
        }
        result
    }

    /// Full pipeline transcription preprocessor
    pub fn process_transcript(&self, input: &str, is_dictation: bool) -> String {
        // 1. Check spelling mode
        if let Some(spelled) = self.decode_spelling_mode(input) {
            return spelled;
        }

        // 2. Apply phonetic correction dictionary
        let mut processed = self.apply_corrections(input);

        // 3. Apply punctuation commands if in dictation mode
        if is_dictation {
            processed = self.apply_dictation_punctuation(&processed);
        }

        processed
    }

    /// Get total number of registered hotwords
    pub fn hotword_count(&self) -> usize {
        self.hotwords.len()
    }

    /// Get total number of active phonetic corrections
    pub fn correction_count(&self) -> usize {
        self.corrections.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotwords_export_and_count() {
        let engine = HotwordsEngine::new();
        assert!(engine.hotword_count() >= 20);
        let exported = engine.export_hotwords_file();
        assert!(exported.contains("Tauri : 2.5"));
        assert!(exported.contains("OKLCH : 3.0"));
    }

    #[test]
    fn test_phonetic_correction_dictionary() {
        let engine = HotwordsEngine::new();
        let input = "Please open tori and check the ok lch color palette.";
        let corrected = engine.apply_corrections(input);
        assert!(corrected.contains("Tauri"));
        assert!(corrected.contains("OKLCH"));
    }

    #[test]
    fn test_spelling_mode_nato_decoding() {
        let engine = HotwordsEngine::new();
        let spelled = engine
            .decode_spelling_mode("spell it: alpha november echo sierra")
            .unwrap();
        assert_eq!(spelled, "anes");

        let spelled2 = engine.decode_spelling_mode("spell: t a u r i").unwrap();
        assert_eq!(spelled2, "tauri");
    }

    #[test]
    fn test_dictation_punctuation() {
        let engine = HotwordsEngine::new();
        let input = "Hello world comma this is a test period New line Ready question mark";
        let formatted = engine.apply_dictation_punctuation(input);
        assert_eq!(formatted, "Hello world, this is a test.\nReady?");
    }

    #[test]
    fn test_learn_correction() {
        let mut engine = HotwordsEngine::new();
        let initial_count = engine.correction_count();
        engine.learn_correction("zarvis", "Jarvis");
        assert_eq!(engine.correction_count(), initial_count + 1);
        let corrected = engine.apply_corrections("Call zarvis now");
        assert_eq!(corrected, "Call Jarvis now");
    }

    #[test]
    fn test_ingest_from_facts() {
        let mut engine = HotwordsEngine::new();
        let facts = vec![
            "Kwame prefers WhatsApp over Slack for urgent issues".to_string(),
            "Vesper is the internal code name for project Artemis".to_string(),
        ];
        engine.ingest_from_facts(&facts);
        let exported = engine.export_hotwords_file();
        assert!(exported.contains("Vesper"));
        assert!(exported.contains("Artemis"));
    }
}
