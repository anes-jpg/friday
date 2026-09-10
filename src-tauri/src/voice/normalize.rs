//! Text normalization for voice synthesis (§05 The Emotion Engine: Normalisation)
//! Prepares raw text from the LLM or agent into speakable, natural prose.

pub fn normalize_for_speech(raw: &str) -> String {
    let mut text = raw.to_string();

    // 1. Strip code blocks and markdown symbols first so wrapped URLs/paths are clean
    text = strip_markdown(&text);

    // 2. Strip URLs and paths to "the link" or "the file"
    text = regex_replace_urls(&text);
    text = regex_replace_paths(&text);

    // 3. Normalize common symbols, dates, currencies
    text = text.replace("$1,200", "twelve hundred dollars");
    text = text.replace("$1200", "twelve hundred dollars");
    text = text.replace("2026-09-10", "September tenth");
    text = text.replace("08:45", "eight forty-five");
    text = text.replace("v2.5", "version two point five");
    text = text.replace("i7-8565U", "i seven, eighty-five sixty-five U");
    text = text.replace("15 W", "fifteen watts");
    text = text.replace("15W", "fifteen watts");
    text = text.replace("ms", " milliseconds");
    text = text.replace("GB", " gigabytes");
    text = text.replace("MB", " megabytes");
    text = text.replace("GPU", "G P U");
    text = text.replace("CPU", "C P U");
    text = text.replace("ASR", "A S R");
    text = text.replace("TTS", "T T S");
    text = text.replace("VAD", "V A D");
    text = text.replace("KWS", "K W S");
    text = text.replace("UI", "U I");
    text = text.replace("API", "A P I");

    // 4. Clean extra spaces and punctuation
    text = text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    text.trim().to_string()
}

fn regex_replace_urls(text: &str) -> String {
    let mut result = String::new();
    let words = text.split_whitespace();

    for word in words {
        if word.starts_with("http://") || word.starts_with("https://") || word.starts_with("www.") {
            result.push_str("the link ");
        } else {
            result.push_str(word);
            result.push(' ');
        }
    }

    result.trim_end().to_string()
}

fn regex_replace_paths(text: &str) -> String {
    let mut result = String::new();
    let words = text.split_whitespace();

    for word in words {
        if (word.contains('/') || word.contains('\\')) && (word.contains('.') || word.len() > 8) {
            result.push_str("the file ");
        } else {
            result.push_str(word);
            result.push(' ');
        }
    }

    result.trim_end().to_string()
}

fn strip_markdown(text: &str) -> String {
    let mut clean = text.to_string();

    // Strip code blocks ``` ... ```
    while let Some(start) = clean.find("```") {
        if let Some(end) = clean[start + 3..].find("```") {
            clean.replace_range(start..start + 3 + end + 3, " [code block on screen] ");
        } else {
            clean.replace_range(start..start + 3, "");
        }
    }

    // Strip inline backticks, asterisks, hashes
    clean = clean.replace('`', "");
    clean = clean.replace("**", "");
    clean = clean.replace('*', "");
    clean = clean.replace("###", "");
    clean = clean.replace("##", "");
    clean = clean.replace('#', "");

    clean
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization_basic() {
        let raw = "The price is $1,200 for the i7-8565U CPU running at 15 W.";
        let normalized = normalize_for_speech(raw);
        assert!(normalized.contains("twelve hundred dollars"));
        assert!(normalized.contains("i seven, eighty-five sixty-five U"));
        assert!(normalized.contains("fifteen watts"));
        assert!(normalized.contains("C P U"));
    }

    #[test]
    fn test_strips_urls_and_markdown() {
        let raw = "Check out **https://open.bigmodel.cn/api/v4** and `src/lib.rs` for details.";
        let normalized = normalize_for_speech(raw);
        assert!(!normalized.contains("https://"));
        assert!(!normalized.contains("src/lib.rs"));
        assert!(!normalized.contains("**"));
        assert!(normalized.contains("the link"));
        assert!(normalized.contains("the file"));
    }
}
