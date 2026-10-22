use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbThread {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub message_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbMessage {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub say: Option<String>,
    pub show: Option<String>,
    pub latency_ms: Option<i64>,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbFact {
    pub id: String,
    pub content: String,
    pub confidence: f32,
    pub source_message_id: Option<String>,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbEpisodicEvent {
    pub id: String,
    pub app_name: String,
    pub window_title: String,
    pub file_path: Option<String>,
    pub git_branch: Option<String>,
    pub summary: String,
    pub created_at: i64,
    pub duration_secs: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbAuditEntry {
    pub id: String,
    pub tool_name: String,
    pub args_hash: String,
    pub tier: String,
    pub decision: String,
    pub duration_ms: i64,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbAutomation {
    pub id: String,
    pub name: String,
    pub trigger_type: String,
    pub trigger_expr: String,
    pub action_tool: String,
    pub action_args: String,
    pub enabled: bool,
    pub last_run: Option<i64>,
    pub next_run: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbSkill {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub permissions: Vec<String>,
    pub enabled: bool,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let _ = conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             PRAGMA cache_size = -64000;
             PRAGMA mmap_size = 268435456;
             PRAGMA busy_timeout = 5000;
             PRAGMA foreign_keys = ON;",
        );
        let db = Self { conn };
        db.init_schema()?;
        db.seed_defaults_if_empty()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let _ = conn.execute_batch(
            "PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             PRAGMA foreign_keys = ON;",
        );
        let db = Self { conn };
        db.init_schema()?;
        db.seed_defaults_if_empty()?;
        Ok(db)
    }

    /// Automatically opens or creates `%APPDATA%/FRIDAY/friday.db`
    pub fn open_app_database() -> Result<Self> {
        let path = Self::get_app_db_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        Self::open(path)
    }

    fn get_app_db_path() -> PathBuf {
        if let Ok(appdata) = std::env::var("APPDATA") {
            PathBuf::from(appdata).join("FRIDAY").join("friday.db")
        } else {
            PathBuf::from("friday.db")
        }
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                pinned INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                say TEXT,
                show TEXT,
                latency_ms INTEGER,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (thread_id) REFERENCES threads(id)
            );

            CREATE TABLE IF NOT EXISTS facts (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                confidence REAL NOT NULL,
                source_message_id TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                tool_name TEXT NOT NULL,
                args_hash TEXT NOT NULL,
                tier TEXT NOT NULL,
                decision TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS automations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                trigger_expr TEXT NOT NULL,
                action_tool TEXT NOT NULL,
                action_args TEXT NOT NULL,
                enabled INTEGER NOT NULL,
                last_run INTEGER,
                next_run INTEGER
            );

            CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT NOT NULL,
                permissions TEXT NOT NULL,
                enabled INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                capabilities TEXT NOT NULL,
                status TEXT NOT NULL,
                priority INTEGER NOT NULL,
                is_active INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS model_telemetry (
                model_id TEXT PRIMARY KEY,
                availability_pct REAL NOT NULL,
                ttft_p90_ms INTEGER NOT NULL,
                avg_latency_ms INTEGER NOT NULL,
                tracker_history TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS episodic_timeline (
                id TEXT PRIMARY KEY,
                app_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                file_path TEXT,
                git_branch TEXT,
                summary TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                duration_secs INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
            CREATE INDEX IF NOT EXISTS idx_messages_thread_time ON messages(thread_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_models_active ON ai_models(is_active);
            CREATE INDEX IF NOT EXISTS idx_facts_created ON facts(created_at);
            CREATE INDEX IF NOT EXISTS idx_facts_confidence ON facts(confidence);
            CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
            CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled);
            CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic_timeline(created_at);
            "#,
        )?;
        let _ = self
            .conn
            .execute("ALTER TABLE threads ADD COLUMN pinned INTEGER DEFAULT 0", []);
        Ok(())
    }

    fn seed_defaults_if_empty(&self) -> Result<()> {
        let skill_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM skills", [], |r| r.get(0))
            .unwrap_or(0);

        if skill_count == 0 {
            self.insert_skill(&DbSkill {
                id: "standup-digest".to_string(),
                name: "Standup Digest".to_string(),
                version: "1.0.0".to_string(),
                description:
                    "Summarize yesterday's commits and task changes into a clean standup note."
                        .to_string(),
                permissions: vec![
                    "notion.read".to_string(),
                    "web.fetch:api.github.com".to_string(),
                    "notify.toast".to_string(),
                ],
                enabled: true,
            })?;

            self.insert_skill(&DbSkill {
                id: "notion-operator".to_string(),
                name: "Notion Workspace Bridge".to_string(),
                version: "1.2.0".to_string(),
                description:
                    "Direct bi-directional search and task mutations across AN STUDIO Notion pages."
                        .to_string(),
                permissions: vec!["notion.read".to_string(), "notion.write".to_string()],
                enabled: true,
            })?;
        }

        let auto_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM automations", [], |r| r.get(0))
            .unwrap_or(0);

        if auto_count == 0 {
            self.insert_automation(&DbAutomation {
                id: "auto-1".to_string(),
                name: "Morning brief".to_string(),
                trigger_type: "cron".to_string(),
                trigger_expr: "0 9 * * 1-5".to_string(),
                action_tool: "notify.toast".to_string(),
                action_args:
                    r#"{"title":"Morning brief","body":"Check calendar and unread emails"}"#
                        .to_string(),
                enabled: true,
                last_run: None,
                next_run: None,
            })?;

            self.insert_automation(&DbAutomation {
                id: "auto-2".to_string(),
                name: "Archive downloads older than 30 days".to_string(),
                trigger_type: "cron".to_string(),
                trigger_expr: "0 0 * * 0".to_string(),
                action_tool: "fs.archive".to_string(),
                action_args: r#"{"path":"~/Downloads","days":30}"#.to_string(),
                enabled: true,
                last_run: None,
                next_run: None,
            })?;
        }

        let fact_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM facts", [], |r| r.get(0))
            .unwrap_or(0);

        if fact_count == 0 {
            self.insert_fact(&DbFact {
                id: "fact-init-1".to_string(),
                content: "Kwame prefers WhatsApp over email".to_string(),
                confidence: 0.95,
                source_message_id: None,
                created_at: 1000,
            })?;
        }

        let model_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM ai_models", [], |r| r.get(0))
            .unwrap_or(0);

        if model_count == 0 {
            for model in crate::providers::models::get_default_models_fleet() {
                let _ = self.save_ai_model(&model);
            }
        } else {
            // Synchronize with user's Agent Router fleet:
            // gpt-6-astra is Normal and ACTIVE
            // glm-5.3, claude-fable-5, gpt-5.6-sol have No traffic
            let _ = self.conn.execute(
                "UPDATE ai_models SET status = 'No traffic', is_active = 0 WHERE id IN ('glm-5.3', 'claude-fable-5', 'gpt-5.6-sol')",
                [],
            );
            let _ = self.conn.execute(
                "UPDATE ai_models SET status = 'Normal', is_active = 1 WHERE id = 'gpt-6-astra'",
                [],
            );
            let _ = self.conn.execute(
                "UPDATE ai_models SET status = 'Demote' WHERE id IN ('deepseek-v4-flash', 'claude-opus-5', 'claude-opus-4-8')",
                [],
            );
            let _ = self.conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('glm_heavy_model', 'gpt-6-astra')",
                [],
            );
            let _ = self.conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('glm_light_model', 'deepseek-v4-flash')",
                [],
            );
            let _ = self.conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('glm_base_url', 'https://agentrouter.org/v1')",
                [],
            );
        }

        Ok(())
    }

    // --- AI Model Operations ---
    pub fn get_all_ai_models(&self) -> Result<Vec<crate::providers::models::AiModel>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, provider, base_url, api_key, capabilities, status, priority, is_active FROM ai_models ORDER BY priority ASC"
        )?;

        let model_rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let provider: String = row.get(2)?;
            let base_url: String = row.get(3)?;
            let api_key: Option<String> = row.get(4)?;
            let caps_str: String = row.get(5)?;
            let status_str: String = row.get(6)?;
            let priority: u32 = row.get(7)?;
            let is_active_int: i64 = row.get(8)?;

            let capabilities: Vec<String> = serde_json::from_str(&caps_str).unwrap_or_default();
            let status = crate::providers::models::ModelStatus::from_str(&status_str);

            Ok((
                id,
                name,
                provider,
                base_url,
                api_key,
                capabilities,
                status,
                priority,
                is_active_int != 0,
            ))
        })?;

        let mut models = Vec::new();
        for res in model_rows {
            let (id, name, provider, base_url, api_key, capabilities, status, priority, is_active) =
                res?;

            let telemetry = self.get_model_telemetry(&id).unwrap_or_else(|_| {
                crate::providers::models::ModelTelemetry {
                    availability_pct: 0.0,
                    ttft_p90_ms: 0,
                    avg_latency_ms: 0,
                    tracker_history: Vec::new(),
                }
            });

            models.push(crate::providers::models::AiModel {
                id,
                name,
                provider,
                base_url,
                api_key,
                capabilities,
                status,
                priority,
                is_active,
                telemetry,
            });
        }

        Ok(models)
    }

    pub fn get_model_telemetry(
        &self,
        model_id: &str,
    ) -> Result<crate::providers::models::ModelTelemetry> {
        self.conn.query_row(
            "SELECT availability_pct, ttft_p90_ms, avg_latency_ms, tracker_history FROM model_telemetry WHERE model_id = ?1",
            params![model_id],
            |row| {
                let availability_pct: f64 = row.get(0)?;
                let ttft_p90_ms: i64 = row.get(1)?;
                let avg_latency_ms: i64 = row.get(2)?;
                let history_str: String = row.get(3)?;
                let tracker_history = serde_json::from_str(&history_str).unwrap_or_default();

                Ok(crate::providers::models::ModelTelemetry {
                    availability_pct,
                    ttft_p90_ms: ttft_p90_ms as u64,
                    avg_latency_ms: avg_latency_ms as u64,
                    tracker_history,
                })
            }
        )
    }

    pub fn save_ai_model(&self, model: &crate::providers::models::AiModel) -> Result<()> {
        let caps_json =
            serde_json::to_string(&model.capabilities).unwrap_or_else(|_| "[]".to_string());
        let status_str = model.status.as_str();

        self.conn.execute(
            r#"
            INSERT INTO ai_models (id, name, provider, base_url, api_key, capabilities, status, priority, is_active)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                provider = excluded.provider,
                base_url = excluded.base_url,
                api_key = excluded.api_key,
                capabilities = excluded.capabilities,
                status = excluded.status,
                priority = excluded.priority,
                is_active = excluded.is_active
            "#,
            params![
                model.id,
                model.name,
                model.provider,
                model.base_url,
                model.api_key,
                caps_json,
                status_str,
                model.priority,
                if model.is_active { 1 } else { 0 },
            ],
        )?;

        self.update_model_telemetry(&model.id, &model.telemetry)?;
        Ok(())
    }

    pub fn set_active_ai_model(&self, id: &str) -> Result<()> {
        self.conn
            .execute("UPDATE ai_models SET is_active = 0", [])?;
        self.conn.execute(
            "UPDATE ai_models SET is_active = 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn delete_ai_model(&self, id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM model_telemetry WHERE model_id = ?1",
            params![id],
        )?;
        self.conn
            .execute("DELETE FROM ai_models WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_model_telemetry(
        &self,
        model_id: &str,
        telemetry: &crate::providers::models::ModelTelemetry,
    ) -> Result<()> {
        let history_json =
            serde_json::to_string(&telemetry.tracker_history).unwrap_or_else(|_| "[]".to_string());
        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            r#"
            INSERT INTO model_telemetry (model_id, availability_pct, ttft_p90_ms, avg_latency_ms, tracker_history, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(model_id) DO UPDATE SET
                availability_pct = excluded.availability_pct,
                ttft_p90_ms = excluded.ttft_p90_ms,
                avg_latency_ms = excluded.avg_latency_ms,
                tracker_history = excluded.tracker_history,
                updated_at = excluded.updated_at
            "#,
            params![
                model_id,
                telemetry.availability_pct,
                telemetry.ttft_p90_ms as i64,
                telemetry.avg_latency_ms as i64,
                history_json,
                now_sec,
            ],
        )?;
        Ok(())
    }

    // --- Thread Operations ---
    pub fn get_threads(&self) -> Result<Vec<DbThread>> {
        let mut stmt = self.conn.prepare(
            r#"SELECT t.id, t.title, t.created_at, t.updated_at, t.pinned, COUNT(m.id) as msg_count
               FROM threads t
               LEFT JOIN messages m ON t.id = m.thread_id
               GROUP BY t.id
               ORDER BY t.pinned DESC, t.updated_at DESC"#,
        )?;
        let rows = stmt.query_map([], |row| {
            let pinned_int: i64 = row.get(4).unwrap_or(0);
            let msg_count: i64 = row.get(5).unwrap_or(0);
            Ok(DbThread {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                pinned: pinned_int != 0,
                message_count: msg_count,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn insert_thread(&self, thread: &DbThread) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO threads (id, title, created_at, updated_at, pinned) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                thread.id,
                thread.title,
                thread.created_at,
                thread.updated_at,
                if thread.pinned { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn rename_thread(&self, id: &str, title: &str) -> Result<bool> {
        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let count = self.conn.execute(
            "UPDATE threads SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now_sec, id],
        )?;
        Ok(count > 0)
    }

    pub fn toggle_thread_pin(&self, id: &str) -> Result<bool> {
        let count = self.conn.execute(
            "UPDATE threads SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![id],
        )?;
        if count == 0 {
            return Ok(false);
        }
        let new_state: i64 = self.conn.query_row(
            "SELECT pinned FROM threads WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )?;
        Ok(new_state != 0)
    }

    pub fn delete_thread(&self, id: &str) -> Result<bool> {
        let tx = self.conn.unchecked_transaction()?;
        tx.execute("DELETE FROM messages WHERE thread_id = ?1", params![id])?;
        let count = tx.execute("DELETE FROM threads WHERE id = ?1", params![id])?;
        if count > 0 {
            let active: Option<String> = tx
                .query_row(
                    "SELECT value FROM settings WHERE key = 'active_thread_id'",
                    [],
                    |r| r.get(0),
                )
                .ok();
            if active.as_deref() == Some(id) {
                let latest: Option<String> = tx
                    .query_row(
                        "SELECT id FROM threads ORDER BY pinned DESC, updated_at DESC LIMIT 1",
                        [],
                        |r| r.get(0),
                    )
                    .ok();
                if let Some(next_id) = latest {
                    let _ = tx.execute(
                        "UPDATE settings SET value = ?1 WHERE key = 'active_thread_id'",
                        params![next_id],
                    );
                } else {
                    let _ = tx.execute("DELETE FROM settings WHERE key = 'active_thread_id'", []);
                }
            }
        }
        tx.commit()?;
        Ok(count > 0)
    }

    pub fn ensure_thread_exists(&self, thread_id: &str, title: &str) -> Result<()> {
        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        self.conn.execute(
            "INSERT OR IGNORE INTO threads (id, title, created_at, updated_at, pinned) VALUES (?1, ?2, ?3, ?4, 0)",
            params![thread_id, title, now_sec, now_sec],
        )?;
        Ok(())
    }

    pub fn get_active_thread_id(&self) -> Result<String> {
        match self.get_setting("active_thread_id")? {
            Some(id) if !id.trim().is_empty() => Ok(id),
            _ => Ok("thread-1".to_string()),
        }
    }

    pub fn set_active_thread_id(&self, thread_id: &str) -> Result<()> {
        self.save_setting("active_thread_id", thread_id)
    }

    // --- Message Operations ---
    pub fn insert_message(&self, msg: &DbMessage) -> Result<()> {
        self.conn.execute(
            "INSERT INTO messages (id, thread_id, role, say, show, latency_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                msg.id,
                msg.thread_id,
                msg.role,
                msg.say,
                msg.show,
                msg.latency_ms,
                msg.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_messages_for_thread(&self, thread_id: &str) -> Result<Vec<DbMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, thread_id, role, say, show, latency_ms, created_at
             FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![thread_id], |row| {
            Ok(DbMessage {
                id: row.get(0)?,
                thread_id: row.get(1)?,
                role: row.get(2)?,
                say: row.get(3)?,
                show: row.get(4)?,
                latency_ms: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // --- Fact Operations ---
    pub fn insert_fact(&self, fact: &DbFact) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO facts (id, content, confidence, source_message_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                fact.id,
                fact.content,
                fact.confidence,
                fact.source_message_id,
                fact.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_all_facts(&self) -> Result<Vec<DbFact>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content, confidence, source_message_id, created_at FROM facts ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DbFact {
                id: row.get(0)?,
                content: row.get(1)?,
                confidence: row.get(2)?,
                source_message_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn search_facts(&self, query: &str) -> Result<Vec<DbFact>> {
        let query_pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, content, confidence, source_message_id, created_at
             FROM facts WHERE content LIKE ?1 ORDER BY confidence DESC",
        )?;
        let rows = stmt.query_map(params![query_pattern], |row| {
            Ok(DbFact {
                id: row.get(0)?,
                content: row.get(1)?,
                confidence: row.get(2)?,
                source_message_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_fact(&self, id: &str) -> Result<bool> {
        let count = self
            .conn
            .execute("DELETE FROM facts WHERE id = ?1", params![id])?;
        Ok(count > 0)
    }

    // --- Audit Log Operations ---
    pub fn insert_audit_entry(&self, entry: &DbAuditEntry) -> Result<()> {
        self.conn.execute(
            "INSERT INTO audit_log (id, tool_name, args_hash, tier, decision, duration_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                entry.id,
                entry.tool_name,
                entry.args_hash,
                entry.tier,
                entry.decision,
                entry.duration_ms,
                entry.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_audit_log(&self, limit: usize) -> Result<Vec<DbAuditEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, tool_name, args_hash, tier, decision, duration_ms, created_at
             FROM audit_log ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(DbAuditEntry {
                id: row.get(0)?,
                tool_name: row.get(1)?,
                args_hash: row.get(2)?,
                tier: row.get(3)?,
                decision: row.get(4)?,
                duration_ms: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // --- Automations Operations ---
    pub fn get_automations(&self) -> Result<Vec<DbAutomation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, trigger_type, trigger_expr, action_tool, action_args, enabled, last_run, next_run
             FROM automations ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let enabled_int: i64 = row.get(6)?;
            Ok(DbAutomation {
                id: row.get(0)?,
                name: row.get(1)?,
                trigger_type: row.get(2)?,
                trigger_expr: row.get(3)?,
                action_tool: row.get(4)?,
                action_args: row.get(5)?,
                enabled: enabled_int != 0,
                last_run: row.get(7)?,
                next_run: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn insert_automation(&self, auto: &DbAutomation) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO automations (id, name, trigger_type, trigger_expr, action_tool, action_args, enabled, last_run, next_run)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                auto.id,
                auto.name,
                auto.trigger_type,
                auto.trigger_expr,
                auto.action_tool,
                auto.action_args,
                if auto.enabled { 1 } else { 0 },
                auto.last_run,
                auto.next_run
            ],
        )?;
        Ok(())
    }

    pub fn toggle_automation(&self, id: &str) -> Result<bool> {
        let current: Option<i64> = self
            .conn
            .query_row(
                "SELECT enabled FROM automations WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .ok();

        if let Some(en) = current {
            let new_state = if en == 0 { 1 } else { 0 };
            self.conn.execute(
                "UPDATE automations SET enabled = ?1 WHERE id = ?2",
                params![new_state, id],
            )?;
            Ok(new_state != 0)
        } else {
            Ok(false)
        }
    }

    pub fn delete_automation(&self, id: &str) -> Result<bool> {
        let count = self
            .conn
            .execute("DELETE FROM automations WHERE id = ?1", params![id])?;
        Ok(count > 0)
    }

    // --- Skills Operations ---
    pub fn get_skills(&self) -> Result<Vec<DbSkill>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, version, description, permissions, enabled FROM skills ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let perms_json: String = row.get(4)?;
            let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
            let enabled_int: i64 = row.get(5)?;
            Ok(DbSkill {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                description: row.get(3)?,
                permissions: perms,
                enabled: enabled_int != 0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn insert_skill(&self, skill: &DbSkill) -> Result<()> {
        let perms_json =
            serde_json::to_string(&skill.permissions).unwrap_or_else(|_| "[]".to_string());
        self.conn.execute(
            "INSERT OR REPLACE INTO skills (id, name, version, description, permissions, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                skill.id,
                skill.name,
                skill.version,
                skill.description,
                perms_json,
                if skill.enabled { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn toggle_skill(&self, id: &str) -> Result<bool> {
        let current: Option<i64> = self
            .conn
            .query_row(
                "SELECT enabled FROM skills WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .ok();

        if let Some(en) = current {
            let new_state = if en == 0 { 1 } else { 0 };
            self.conn.execute(
                "UPDATE skills SET enabled = ?1 WHERE id = ?2",
                params![new_state, id],
            )?;
            Ok(new_state != 0)
        } else {
            Ok(false)
        }
    }

    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_user_name(&self) -> Result<Option<String>> {
        self.get_setting("user_name")
    }

    pub fn set_user_name(&self, name: &str) -> Result<()> {
        let clean_name = name.trim();
        if clean_name.is_empty() {
            return Ok(());
        }
        self.save_setting("user_name", clean_name)?;

        // Remove any prior conflicting user name facts and the seed placeholder if present
        let _ = self.conn.execute(
            "DELETE FROM facts WHERE content LIKE '%The user''s name is%' OR content LIKE '%user name is%' OR id = 'fact-init-1'",
            [],
        );

        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let fact = DbFact {
            id: format!("fact-name-{}", now_sec),
            content: format!(
                "The user's name is {}. Always address the user as {}.",
                clean_name, clean_name
            ),
            confidence: 1.0,
            source_message_id: Some("user-identity".to_string()),
            created_at: now_sec,
        };
        self.insert_fact(&fact)?;
        Ok(())
    }

    pub fn insert_episodic_event(&self, event: &DbEpisodicEvent) -> Result<()> {
        self.conn.execute(
            "INSERT INTO episodic_timeline (id, app_name, window_title, file_path, git_branch, summary, created_at, duration_secs)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                event.id,
                event.app_name,
                event.window_title,
                event.file_path,
                event.git_branch,
                event.summary,
                event.created_at,
                event.duration_secs,
            ],
        )?;
        Ok(())
    }

    pub fn get_episodic_timeline(
        &self,
        limit: usize,
        since_ts: Option<i64>,
    ) -> Result<Vec<DbEpisodicEvent>> {
        if let Some(since) = since_ts {
            let mut stmt = self.conn.prepare(
                "SELECT id, app_name, window_title, file_path, git_branch, summary, created_at, duration_secs
                 FROM episodic_timeline
                 WHERE created_at >= ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )?;
            let rows = stmt.query_map(params![since, limit as i64], |row| {
                Ok(DbEpisodicEvent {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    file_path: row.get(3)?,
                    git_branch: row.get(4)?,
                    summary: row.get(5)?,
                    created_at: row.get(6)?,
                    duration_secs: row.get(7)?,
                })
            })?;
            let mut events = Vec::new();
            for r in rows {
                events.push(r?);
            }
            Ok(events)
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT id, app_name, window_title, file_path, git_branch, summary, created_at, duration_secs
                 FROM episodic_timeline
                 ORDER BY created_at DESC
                 LIMIT ?1",
            )?;
            let rows = stmt.query_map(params![limit as i64], |row| {
                Ok(DbEpisodicEvent {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    file_path: row.get(3)?,
                    git_branch: row.get(4)?,
                    summary: row.get(5)?,
                    created_at: row.get(6)?,
                    duration_secs: row.get(7)?,
                })
            })?;
            let mut events = Vec::new();
            for r in rows {
                events.push(r?);
            }
            Ok(events)
        }
    }

    pub fn search_episodic_timeline(&self, query: &str) -> Result<Vec<DbEpisodicEvent>> {
        let pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, app_name, window_title, file_path, git_branch, summary, created_at, duration_secs
             FROM episodic_timeline
             WHERE app_name LIKE ?1 OR window_title LIKE ?1 OR summary LIKE ?1 OR file_path LIKE ?1
             ORDER BY created_at DESC
             LIMIT 50",
        )?;

        let rows = stmt.query_map(params![pattern], |row| {
            Ok(DbEpisodicEvent {
                id: row.get(0)?,
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                file_path: row.get(3)?,
                git_branch: row.get(4)?,
                summary: row.get(5)?,
                created_at: row.get(6)?,
                duration_secs: row.get(7)?,
            })
        })?;

        let mut events = Vec::new();
        for r in rows {
            events.push(r?);
        }
        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_init_and_crud() {
        let db = Database::open_in_memory().unwrap();

        let fact = DbFact {
            id: "fact-test".to_string(),
            content: "Kwame prefers WhatsApp over email".to_string(),
            confidence: 0.95,
            source_message_id: None,
            created_at: 1000,
        };

        db.insert_fact(&fact).unwrap();
        let facts = db.get_all_facts().unwrap();
        assert!(facts.iter().any(|f| f.id == "fact-test"));
        assert!(db.delete_fact("fact-test").unwrap());

        let automations = db.get_automations().unwrap();
        assert!(!automations.is_empty());

        let skills = db.get_skills().unwrap();
        assert!(!skills.is_empty());

        // Test settings persistence
        db.save_setting("glm_base_url", "https://agentrouter.org/")
            .unwrap();
        let val = db.get_setting("glm_base_url").unwrap();
        assert_eq!(val, Some("https://agentrouter.org/".to_string()));

        // Test active thread persistence and crash recovery
        assert_eq!(db.get_active_thread_id().unwrap(), "thread-1");
        db.ensure_thread_exists("session-42", "Project X Discussion")
            .unwrap();
        db.set_active_thread_id("session-42").unwrap();
        assert_eq!(db.get_active_thread_id().unwrap(), "session-42");
        let threads = db.get_threads().unwrap();
        assert!(threads.iter().any(|t| t.id == "session-42"));
    }

    #[test]
    fn test_thread_lifecycle_rename_pin_delete() {
        let db = Database::open_in_memory().unwrap();

        // 1. Create thread
        let thread = DbThread {
            id: "thread-test-1".to_string(),
            title: "Original Title".to_string(),
            created_at: 1000,
            updated_at: 1000,
            pinned: false,
            message_count: 0,
        };
        db.insert_thread(&thread).unwrap();

        // Verify inserted
        let threads = db.get_threads().unwrap();
        let found = threads.iter().find(|t| t.id == "thread-test-1").unwrap();
        assert_eq!(found.title, "Original Title");
        assert!(!found.pinned);
        assert_eq!(found.message_count, 0);

        // 2. Rename thread
        assert!(db.rename_thread("thread-test-1", "Renamed Session").unwrap());
        let threads = db.get_threads().unwrap();
        let found = threads.iter().find(|t| t.id == "thread-test-1").unwrap();
        assert_eq!(found.title, "Renamed Session");

        // 3. Toggle pin
        assert!(db.toggle_thread_pin("thread-test-1").unwrap());
        let threads = db.get_threads().unwrap();
        let found = threads.iter().find(|t| t.id == "thread-test-1").unwrap();
        assert!(found.pinned);

        // 4. Pin unpin ordering
        let thread2 = DbThread {
            id: "thread-test-2".to_string(),
            title: "Second Thread".to_string(),
            created_at: 2000,
            updated_at: 2000,
            pinned: false,
            message_count: 0,
        };
        db.insert_thread(&thread2).unwrap();
        let threads = db.get_threads().unwrap();
        // Pinned thread should be first even if thread2 has higher updated_at
        assert_eq!(threads[0].id, "thread-test-1");

        // 5. Add a message to thread-test-1
        let msg = DbMessage {
            id: "msg-1".to_string(),
            thread_id: "thread-test-1".to_string(),
            role: "user".to_string(),
            say: Some("Hello Friday".to_string()),
            show: None,
            latency_ms: None,
            created_at: 1050,
        };
        db.insert_message(&msg).unwrap();
        assert_eq!(db.get_messages_for_thread("thread-test-1").unwrap().len(), 1);
        let threads_after_msg = db.get_threads().unwrap();
        let found_after_msg = threads_after_msg.iter().find(|t| t.id == "thread-test-1").unwrap();
        assert_eq!(found_after_msg.message_count, 1);

        // 6. Delete thread with cascading message deletion
        assert!(db.delete_thread("thread-test-1").unwrap());
        let remaining_threads = db.get_threads().unwrap();
        assert!(!remaining_threads.iter().any(|t| t.id == "thread-test-1"));
        let remaining_messages = db.get_messages_for_thread("thread-test-1").unwrap();
        assert!(remaining_messages.is_empty());
    }
}
