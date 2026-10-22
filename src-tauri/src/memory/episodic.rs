use crate::memory::db::{Database, DbEpisodicEvent};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::info;

pub struct EpisodicContextEngine {
    db: Arc<Mutex<Database>>,
    last_event: Arc<Mutex<Option<(String, String, u64)>>>, // (app_name, title, timestamp)
}

impl EpisodicContextEngine {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            db,
            last_event: Arc::new(Mutex::new(None)),
        }
    }

    /// Record a foreground app transition or user work milestone with 5s debounce
    pub fn record_context_shift(
        &self,
        app_name: &str,
        window_title: &str,
        file_path: Option<&str>,
        git_branch: Option<&str>,
        summary: Option<&str>,
    ) -> Result<Option<DbEpisodicEvent>, String> {
        let now = now_timestamp_secs();

        // 5-second debounce check to prevent spamming timeline during rapid alt-tabs
        if let Ok(mut last) = self.last_event.lock() {
            if let Some((ref prev_app, ref prev_title, prev_time)) = *last {
                if prev_app == app_name && prev_title == window_title && (now - prev_time) < 5 {
                    return Ok(None);
                }
            }
            *last = Some((app_name.to_string(), window_title.to_string(), now));
        }

        let event = DbEpisodicEvent {
            id: format!("ep-{}", now_timestamp_ms()),
            app_name: app_name.to_string(),
            window_title: window_title.to_string(),
            file_path: file_path.map(|s| s.to_string()),
            git_branch: git_branch.map(|s| s.to_string()),
            summary: summary
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("Active in {} ({})", app_name, window_title)),
            created_at: now as i64,
            duration_secs: 0,
        };

        if let Ok(db) = self.db.lock() {
            db.insert_episodic_event(&event).map_err(|e| e.to_string())?;
            info!(
                "Episodic memory recorded: {} - {}",
                event.app_name, event.window_title
            );
            return Ok(Some(event));
        }

        Err("Database lock contention in episodic engine".to_string())
    }

    pub fn get_timeline(&self, limit: usize, since_ts: Option<i64>) -> Result<Vec<DbEpisodicEvent>, String> {
        if let Ok(db) = self.db.lock() {
            db.get_episodic_timeline(limit, since_ts).map_err(|e| e.to_string())
        } else {
            Err("Database lock contention in episodic engine".to_string())
        }
    }

    pub fn search(&self, query: &str) -> Result<Vec<DbEpisodicEvent>, String> {
        if let Ok(db) = self.db.lock() {
            db.search_episodic_timeline(query).map_err(|e| e.to_string())
        } else {
            Err("Database lock contention in episodic engine".to_string())
        }
    }
}

fn now_timestamp_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn now_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_episodic_debounce_and_recording() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = EpisodicContextEngine::new(db);

        // First transition records
        let ev1 = engine
            .record_context_shift("Code.exe", "friday - src/lib/store.ts", None, Some("master"), None)
            .expect("record");
        assert!(ev1.is_some());

        // Same transition within 5s is debounced
        let ev2 = engine
            .record_context_shift("Code.exe", "friday - src/lib/store.ts", None, Some("master"), None)
            .expect("record");
        assert!(ev2.is_none());

        // Query timeline
        let timeline = engine.get_timeline(10, None).expect("get timeline");
        assert_eq!(timeline.len(), 1);
        assert_eq!(timeline[0].app_name, "Code.exe");
    }
}
