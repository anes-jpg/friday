use crate::memory::db::{Database, DbSemanticCacheEntry};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct SemanticCache {
    db: Arc<Mutex<Database>>,
}

impl SemanticCache {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self { db }
    }

    /// Normalizes prompt text and extracts distinct tokens for deterministic matching
    pub fn normalize(prompt: &str) -> (String, Vec<String>) {
        let mut clean = prompt.trim().to_lowercase();

        // Strip common leading wake-words
        for prefix in &[
            "hey friday,", "hey friday:", "hey friday",
            "hi friday,", "hi friday:", "hi friday",
            "ok friday,", "ok friday:", "ok friday",
            "friday,", "friday:", "friday ",
        ] {
            if clean.starts_with(prefix) {
                clean = clean[prefix.len()..].trim().to_string();
                break;
            }
        }

        // Keep alphanumeric chars and spaces only
        let filtered: String = clean
            .chars()
            .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
            .collect();

        let tokens: Vec<String> = filtered
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        let normalized = tokens.join(" ");
        (normalized, tokens)
    }

    /// Computes a deterministic 64-bit hex hash of the normalized prompt string
    pub fn compute_hash(normalized: &str) -> String {
        let mut hasher = DefaultHasher::new();
        normalized.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Queries the semantic cache for an exact normalized match or high-similarity match (>= 0.85 Jaccard)
    pub fn lookup(&self, prompt: &str) -> Option<DbSemanticCacheEntry> {
        let (normalized, tokens) = Self::normalize(prompt);
        if normalized.is_empty() || tokens.is_empty() {
            return None;
        }

        let hash = Self::compute_hash(&normalized);

        let db = match self.db.lock() {
            Ok(guard) => guard,
            Err(_) => return None,
        };

        // 1. O(1) Exact normalized query hash hit (<1ms)
        if let Ok(Some(entry)) = db.get_semantic_cache_by_hash(&hash) {
            let _ = db.record_semantic_cache_hit(&entry.id);
            return Some(entry);
        }

        // 2. Fuzzy Token Similarity Match (Jaccard >= 0.85 for multi-token queries)
        if tokens.len() >= 3 {
            if let Ok(recent) = db.get_recent_semantic_cache(50) {
                let query_set: HashSet<&str> = tokens.iter().map(|s| s.as_str()).collect();

                for item in recent {
                    let (_, item_tokens) = Self::normalize(&item.prompt);
                    if item_tokens.len() < 3 {
                        continue;
                    }

                    let item_set: HashSet<&str> = item_tokens.iter().map(|s| s.as_str()).collect();
                    let intersection = query_set.intersection(&item_set).count();
                    let union = query_set.union(&item_set).count();

                    if union > 0 {
                        let similarity = intersection as f32 / union as f32;
                        if similarity >= 0.85 {
                            let _ = db.record_semantic_cache_hit(&item.id);
                            return Some(item);
                        }
                    }
                }
            }
        }

        None
    }

    /// Stores a successful LLM turn or deterministic synthesis into the semantic cache
    pub fn store(&self, prompt: &str, say: &str, show: &str, tool_name: Option<&str>) {
        let (normalized, tokens) = Self::normalize(prompt);
        if normalized.is_empty() || tokens.is_empty() {
            return;
        }

        // Do not cache error responses or confirmation waits
        let say_lower = say.to_lowercase();
        if say_lower.contains("failed")
            || say_lower.contains("error")
            || say_lower.contains("are you sure")
            || say_lower.contains("confirm")
            || say.len() < 5
        {
            return;
        }

        let hash = Self::compute_hash(&normalized);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let entry = DbSemanticCacheEntry {
            id: format!("sem-{}", Uuid::now_v7()),
            query_hash: hash,
            prompt: prompt.trim().to_string(),
            say: say.to_string(),
            show: show.to_string(),
            tool_name: tool_name.map(|s| s.to_string()),
            hit_count: 1,
            created_at: now,
            last_accessed_at: now,
        };

        if let Ok(db) = self.db.lock() {
            let _ = db.store_semantic_cache(&entry);
            // Cap semantic cache table at 500 entries to maintain microsecond query performance
            let _ = db.prune_semantic_cache(500);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization_and_hash() {
        let (norm1, tokens1) = SemanticCache::normalize("Hey Friday, calculate loan payment!");
        let (norm2, tokens2) = SemanticCache::normalize("calculate loan payment");

        assert_eq!(norm1, norm2);
        assert_eq!(tokens1, tokens2);

        let hash1 = SemanticCache::compute_hash(&norm1);
        let hash2 = SemanticCache::compute_hash(&norm2);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_cache_store_and_lookup() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let cache = SemanticCache::new(db);

        // Store
        cache.store(
            "What is the capital of France?",
            "The capital of France is Paris.",
            "### Paris\nCapital of France.",
            None,
        );

        // Exact match
        let hit = cache.lookup("what is the capital of France?");
        assert!(hit.is_some());
        let res = hit.unwrap();
        assert_eq!(res.say, "The capital of France is Paris.");

        // Wake word prefix variation
        let hit2 = cache.lookup("Hey Friday, what is the capital of France");
        assert!(hit2.is_some());
    }

    #[test]
    fn test_cache_fuzzy_similarity_lookup() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let cache = SemanticCache::new(db);

        cache.store(
            "show me monthly payment schedule for thirty year mortgage",
            "Here is the monthly payment schedule.",
            "### Mortgage Table",
            Some("openui.mortgage"),
        );

        // Query with minor stop word difference ("the", "a")
        let hit = cache.lookup("show me the monthly payment schedule for thirty year mortgage");
        assert!(hit.is_some());
    }
}
