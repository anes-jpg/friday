use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbThread {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
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
        let db = Self { conn };
        db.init_schema()?;
        db.seed_defaults_if_empty()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
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
                updated_at INTEGER NOT NULL
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

            CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
            CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
            "#,
        )?;
        Ok(())
    }

    fn seed_defaults_if_empty(&self) -> Result<()> {
        let thread_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM threads", [], |r| r.get(0))
            .unwrap_or(0);

        if thread_count == 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            self.insert_thread(&DbThread {
                id: "thread-1".to_string(),
                title: "Active Desktop Session".to_string(),
                created_at: now - 3600,
                updated_at: now,
            })?;

            self.insert_thread(&DbThread {
                id: "thread-2".to_string(),
                title: "AN STUDIO Design Brief Sync".to_string(),
                created_at: now - 86400,
                updated_at: now - 82000,
            })?;

            self.insert_fact(&DbFact {
                id: "fact-1".to_string(),
                content: "Kwame prefers WhatsApp over email for fast coordination".to_string(),
                confidence: 0.96,
                source_message_id: Some("msg-1".to_string()),
                created_at: now - 3600,
            })?;

            self.insert_fact(&DbFact {
                id: "fact-2".to_string(),
                content: "Desktop screenshots should be archived into Assets after review".to_string(),
                confidence: 0.94,
                source_message_id: None,
                created_at: now - 1800,
            })?;

            self.insert_automation(&DbAutomation {
                id: "auto-1".to_string(),
                name: "Daily Standup Digest".to_string(),
                trigger_type: "cron".to_string(),
                trigger_expr: "0 45 8 * * MON-FRI".to_string(),
                action_tool: "standup.generate".to_string(),
                action_args: "{}".to_string(),
                enabled: true,
                last_run: Some(now - 86400),
                next_run: Some(now + 36000),
            })?;

            self.insert_automation(&DbAutomation {
                id: "auto-2".to_string(),
                name: "Desktop Screenshot Auto-Tag".to_string(),
                trigger_type: "event".to_string(),
                trigger_expr: "fs.watch:Desktop/Screenshots".to_string(),
                action_tool: "fs.move".to_string(),
                action_args: "{\"target\": \"Desktop/Assets\"}".to_string(),
                enabled: true,
                last_run: Some(now - 14400),
                next_run: None,
            })?;

            self.insert_skill(&DbSkill {
                id: "standup-digest".to_string(),
                name: "Standup Digest".to_string(),
                version: "1.0.0".to_string(),
                description: "Summarize yesterday's commits and task changes into a clean standup note.".to_string(),
                permissions: vec!["notion.read".to_string(), "web.fetch:api.github.com".to_string(), "notify.toast".to_string()],
                enabled: true,
            })?;

            self.insert_skill(&DbSkill {
                id: "notion-operator".to_string(),
                name: "Notion Workspace Bridge".to_string(),
                version: "1.2.0".to_string(),
                description: "Direct bi-directional search and task mutations across AN STUDIO Notion pages.".to_string(),
                permissions: vec!["notion.read".to_string(), "notion.write".to_string()],
                enabled: true,
            })?;
        }

        Ok(())
    }

    // --- Thread Operations ---
    pub fn get_threads(&self) -> Result<Vec<DbThread>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(DbThread {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
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
            "INSERT OR REPLACE INTO threads (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![thread.id, thread.title, thread.created_at, thread.updated_at],
        )?;
        Ok(())
    }

    pub fn delete_thread(&self, id: &str) -> Result<bool> {
        let count = self.conn.execute("DELETE FROM threads WHERE id = ?1", params![id])?;
        Ok(count > 0)
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
        let count = self.conn.execute("DELETE FROM facts WHERE id = ?1", params![id])?;
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
            .query_row("SELECT enabled FROM automations WHERE id = ?1", params![id], |r| r.get(0))
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
        let count = self.conn.execute("DELETE FROM automations WHERE id = ?1", params![id])?;
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
        let perms_json = serde_json::to_string(&skill.permissions).unwrap_or_else(|_| "[]".to_string());
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
            .query_row("SELECT enabled FROM skills WHERE id = ?1", params![id], |r| r.get(0))
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
    }
}

