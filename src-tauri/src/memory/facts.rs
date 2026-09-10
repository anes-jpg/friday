use super::db::{Database, DbFact};
use std::sync::{Arc, Mutex};

pub struct FactExtractor;

impl FactExtractor {
    /// Extracts factual user assertions, preferences, and project rules
    pub fn try_extract(utterance: &str, source_message_id: Option<String>) -> Option<DbFact> {
        let lower = utterance.trim().to_lowercase();

        let is_preference = lower.starts_with("remember that")
            || lower.starts_with("remember:")
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
        if let Some(stripped) = clean.strip_prefix("remember that ") {
            clean = stripped;
        } else if let Some(stripped) = clean.strip_prefix("Remember that ") {
            clean = stripped;
        } else if let Some(stripped) = clean.strip_prefix("remember: ") {
            clean = stripped;
        } else if let Some(stripped) = clean.strip_prefix("Remember: ") {
            clean = stripped;
        }

        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let confidence = if lower.contains("always") || lower.contains("never") || lower.starts_with("remember") {
            0.98
        } else {
            0.90
        };

        Some(DbFact {
            id: format!("fact-{}", now_sec),
            content: clean.to_string(),
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
            .map(|t| t.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
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
            output.push_str(&format!("  <fact confidence=\"{:.2}\">{}</fact>\n", f.confidence, f.content));
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
        let fact = FactExtractor::try_extract("Remember that Kwame prefers Figma over Sketch", None);
        assert!(fact.is_some());
        let f = fact.unwrap();
        assert!(f.content.contains("Kwame prefers"));
        assert_eq!(f.confidence, 0.98);

        let non_fact = FactExtractor::try_extract("What's on my screen right now?", None);
        assert!(non_fact.is_none());
    }

    #[test]
    fn test_fact_retriever() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let retriever = FactRetriever::new(db.clone());

        let facts = retriever.retrieve_context("Does Kwame prefer WhatsApp?");
        assert!(!facts.is_empty());
        let xml = retriever.format_facts_xml(&facts);
        assert!(xml.contains("<user-facts>"));
        assert!(xml.contains("WhatsApp"));
    }
}
