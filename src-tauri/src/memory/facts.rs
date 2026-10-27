use super::db::{Database, DbFact};
use std::sync::{Arc, Mutex};

pub struct FactExtractor;

impl FactExtractor {
    /// Extracts a user name from an assertion or correction
    pub fn extract_user_name(utterance: &str) -> Option<String> {
        let trimmed = utterance.trim().trim_end_matches(['.', '!', '?']);
        let lower = trimmed.to_lowercase();

        let patterns = [
            "remember that my name is ",
            "remember that i am ",
            "remember my name is ",
            "remember my name: ",
            "actually my name is ",
            "actually it's ",
            "actually it is ",
            "no my name is ",
            "no, my name is ",
            "my name is actually ",
            "my name is ",
            "the name is ",
            "please call me ",
            "call me ",
            "you can call me ",
            "i am ",
            "i'm ",
        ];

        for pattern in patterns {
            if let Some(pos) = lower.find(pattern) {
                let after = &trimmed[pos + pattern.len()..];
                let name_candidate = after
                    .split([' ', ',', ';', '-', '!', '?'])
                    .next()
                    .unwrap_or("")
                    .trim_matches(|c: char| !c.is_alphabetic());

                if !name_candidate.is_empty()
                    && name_candidate.len() >= 2
                    && ![
                        "not",
                        "actually",
                        "here",
                        "ready",
                        "fine",
                        "online",
                        "listening",
                        "trying",
                        "going",
                        "sorry",
                    ]
                    .contains(&name_candidate.to_lowercase().as_str())
                {
                    let mut chars = name_candidate.chars();
                    let capitalized = match chars.next() {
                        None => String::new(),
                        Some(f) => {
                            f.to_uppercase().collect::<String>()
                                + chars.as_str().to_lowercase().as_str()
                        }
                    };
                    return Some(capitalized);
                }
            }
        }

        None
    }

    /// Extracts factual user assertions, preferences, and project rules
    pub fn try_extract(utterance: &str, source_message_id: Option<String>) -> Option<DbFact> {
        let lower = utterance.trim().to_lowercase();

        // 1. Check user name assertion / correction first
        if let Some(name) = Self::extract_user_name(utterance) {
            let now_sec = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            return Some(DbFact {
                id: format!("fact-name-{}", now_sec),
                content: format!(
                    "The user's name is {}. Always address the user as {}.",
                    name, name
                ),
                confidence: 1.0,
                source_message_id,
                created_at: now_sec,
            });
        }

        let is_preference = lower.starts_with("remember that")
            || lower.starts_with("remember:")
            || lower.starts_with("remember ")
            || lower.contains("save in your memory")
            || lower.contains("save to your memory")
            || lower.contains("save in memory")
            || lower.contains("save to memory")
            || lower.contains("save this in memory")
            || lower.contains("save this to memory")
            || lower.contains("save that in your memory")
            || lower.contains("save that in memory")
            || lower.starts_with("save that ")
            || lower.contains("store in memory")
            || lower.contains("store in your memory")
            || lower.contains("add to memory")
            || lower.contains("add this to memory")
            || lower.contains("keep in mind")
            || lower.contains("don't forget that")
            || lower.contains("dont forget that")
            || lower.contains("never forget that")
            || lower.contains("note that")
            || lower.contains("i prefer")
            || lower.contains("my preference is")
            || lower.contains("always use")
            || lower.contains("never use")
            || lower.contains("should be archived")
            || lower.contains("prefers");

        if !is_preference {
            return None;
        }

        // Clean statement
        let mut clean = utterance.trim();
        const PREFIXES: &[&str] = &[
            "save in your memory that ",
            "save in your memory: ",
            "save in your memory ",
            "save to your memory that ",
            "save to your memory: ",
            "save to your memory ",
            "save in memory that ",
            "save in memory: ",
            "save in memory ",
            "save to memory that ",
            "save to memory: ",
            "save to memory ",
            "save this in memory: ",
            "save this in memory ",
            "save this to memory: ",
            "save this to memory ",
            "save that in your memory that ",
            "save that in your memory ",
            "save that in memory that ",
            "save that in memory ",
            "save that ",
            "store in your memory that ",
            "store in your memory: ",
            "store in your memory ",
            "store in memory that ",
            "store in memory: ",
            "store in memory ",
            "add to memory that ",
            "add to memory: ",
            "add to memory ",
            "add this to memory that ",
            "add this to memory: ",
            "add this to memory ",
            "don't forget that ",
            "dont forget that ",
            "never forget that ",
            "keep in mind that ",
            "keep in mind: ",
            "keep in mind ",
            "note that ",
            "remember that ",
            "remember: ",
            "remember ",
        ];

        for prefix in PREFIXES {
            if clean.len() >= prefix.len() && clean[..prefix.len()].eq_ignore_ascii_case(prefix) {
                clean = clean[prefix.len()..].trim();
                break;
            }
        }

        // Also strip common trailing phrases like "in your memory", "in memory", "to memory"
        const SUFFIXES: &[&str] = &[
            " in your memory",
            " in memory",
            " to your memory",
            " to memory",
            " in mind",
        ];
        for suffix in SUFFIXES {
            if clean.len() >= suffix.len()
                && clean[clean.len() - suffix.len()..].eq_ignore_ascii_case(suffix)
            {
                clean = clean[..clean.len() - suffix.len()].trim();
                break;
            }
        }

        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let confidence = if lower.contains("always")
            || lower.contains("never")
            || lower.contains("remember")
            || lower.contains("save")
            || lower.contains("memory")
        {
            0.98
        } else {
            0.90
        };

        let final_content = if clean.contains("—") || clean.contains(':') {
            clean.to_string()
        } else if clean.to_lowercase().starts_with("i ")
            || clean.to_lowercase().starts_with("my ")
            || clean.to_lowercase().starts_with("you should ")
            || clean.to_lowercase().starts_with("user ")
        {
            let mut capitalized = clean.to_string();
            if let Some(first) = capitalized.get_mut(0..1) {
                first.make_ascii_uppercase();
            }
            format!("Preference — {}", capitalized)
        } else {
            let mut capitalized = clean.to_string();
            if let Some(first) = capitalized.get_mut(0..1) {
                first.make_ascii_uppercase();
            }
            capitalized
        };

        Some(DbFact {
            id: format!("fact-{}", now_sec),
            content: final_content,
            confidence,
            source_message_id,
            created_at: now_sec,
        })
    }
}

pub struct FactRetriever {
    db: Arc<Mutex<Database>>,
}

impl FactRetriever {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self { db }
    }

    /// Retrieves relevant facts matching the query or user context
    pub fn retrieve_context(&self, query: &str) -> Vec<DbFact> {
        let tokens: Vec<String> = query
            .split_whitespace()
            .map(|t| {
                t.trim_matches(|c: char| !c.is_alphanumeric())
                    .to_lowercase()
            })
            .filter(|t| t.len() > 3)
            .collect();

        if let Ok(db) = self.db.lock() {
            let mut matches = Vec::new();
            for token in &tokens {
                if let Ok(facts) = db.search_facts(token) {
                    for f in facts {
                        if !matches.iter().any(|existing: &DbFact| existing.id == f.id) {
                            matches.push(f);
                        }
                    }
                }
            }

            // Always ensure any core identity facts (like user name) are included!
            if let Ok(all) = db.get_all_facts() {
                for f in &all {
                    if (f.content.contains("user's name is")
                        || f.content.contains("The user's name"))
                        && !matches.iter().any(|existing| existing.id == f.id)
                    {
                        matches.insert(0, f.clone());
                    }
                }
            }

            // If query didn't yield specific keyword hits, return top 3 highest confidence facts
            if matches.is_empty() {
                if let Ok(all) = db.get_all_facts() {
                    matches = all.into_iter().take(3).collect();
                }
            }

            matches
        } else {
            Vec::new()
        }
    }

    /// Formats retrieved facts for context injection into prompt
    pub fn format_facts_xml(&self, facts: &[DbFact]) -> String {
        if facts.is_empty() {
            return String::new();
        }

        let mut output = String::from("<user-facts>\n");
        for f in facts {
            output.push_str(&format!(
                "  <fact confidence=\"{:.2}\">{}</fact>\n",
                f.confidence, f.content
            ));
        }
        output.push_str("</user-facts>");
        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fact_extraction() {
        let fact =
            FactExtractor::try_extract("Remember that Kwame prefers Figma over Sketch", None);
        assert!(fact.is_some());
        let f = fact.unwrap();
        assert!(f.content.contains("Kwame prefers"));
        assert_eq!(f.confidence, 0.98);

        // Verify explicit memory save command from user
        let pizza_fact =
            FactExtractor::try_extract("save in your memory that i love pizza", None);
        assert!(pizza_fact.is_some());
        let pf = pizza_fact.unwrap();
        assert!(pf.content.contains("Preference — I love pizza"));
        assert_eq!(pf.confidence, 0.98);

        let non_fact = FactExtractor::try_extract("What's on my screen right now?", None);
        assert!(non_fact.is_none());
    }

    #[test]
    fn test_fact_retriever() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        db.lock().expect("test DB lock").insert_fact(&crate::memory::db::DbFact {
            id: "retriever-fixture".into(), content: "Kwame prefers WhatsApp over email".into(),
            confidence: 0.95, source_message_id: None, created_at: 1000,
        }).expect("save test fact");
        let retriever = FactRetriever::new(db.clone());

        let facts = retriever.retrieve_context("Does Kwame prefer WhatsApp?");
        assert!(!facts.is_empty());
        let xml = retriever.format_facts_xml(&facts);
        assert!(xml.contains("<user-facts>"));
        assert!(xml.contains("WhatsApp"));
    }
}
