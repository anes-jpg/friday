use super::db::Database;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub version: u32,
    pub projects: Vec<Value>,
    pub items: Vec<Value>,
    pub places: Vec<Value>,
    pub collections: Vec<Value>,
    pub captures: Vec<Value>,
    pub routines: Vec<Value>,
    pub resumes: Vec<Value>,
    pub active_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceImport {
    pub source_id: String,
    pub originals: Value,
    pub projects: Vec<Value>,
    pub items: Vec<Value>,
    pub places: Vec<Value>,
}

fn invalid(message: impl Into<String>) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
        std::io::ErrorKind::InvalidInput, message.into(),
    )))
}

pub fn validate_record(kind: &str, record: &Value) -> rusqlite::Result<(String, Option<String>, String)> {
    let object = record.as_object().ok_or_else(|| invalid("Record must be an object"))?;
    let id = object.get("id").and_then(Value::as_str).filter(|v| !v.trim().is_empty() && v.len() <= 200)
        .ok_or_else(|| invalid("Record needs a bounded ID"))?.to_string();
    let title_key = if ["item", "capture"].contains(&kind) { "title" } else { "name" };
    let title = object.get(title_key).and_then(Value::as_str).filter(|v| !v.trim().is_empty() && v.len() <= 1000)
        .ok_or_else(|| invalid("Record needs a name or title"))?.to_string();
    let project = object.get("projectId").and_then(Value::as_str).filter(|id| !id.is_empty()).map(str::to_string);
    match kind {
        "project" | "collection" => {},
        "item" => {
            if !["project", "task", "note", "goal", "milestone", "reminder"].contains(&object.get("type").and_then(Value::as_str).unwrap_or("")) {
                return Err(invalid("Invalid workspace item type"));
            }
            if !["todo", "in-progress", "done"].contains(&object.get("status").and_then(Value::as_str).unwrap_or("")) {
                return Err(invalid("Invalid item status"));
            }
        },
        "capture" | "routine" | "resume" => crate::daily_work::validate(kind, record).map_err(invalid)?,
        "place" => {
            let lat = object.get("lat").and_then(Value::as_f64).ok_or_else(|| invalid("Place needs latitude"))?;
            let lng = object.get("lng").and_then(Value::as_f64).ok_or_else(|| invalid("Place needs longitude"))?;
            if !lat.is_finite() || !lng.is_finite() || lat.abs() > 90.0 || lng.abs() > 180.0 {
                return Err(invalid("Invalid place coordinates"));
            }
        },
        _ => return Err(invalid("Unknown workspace record kind")),
    }
    if record.to_string().len() > 2_000_000 { return Err(invalid("Record exceeds storage limit")); }
    Ok((id, project, title))
}

impl Database {
    pub fn backup_before_workspace_migration(&self, path: &Path) -> rusqlite::Result<()> {
        let migrated: i64 = self.conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='workspace_migrations'", [], |r| r.get(0))?;
        if migrated == 0 {
            let count: i64 = self.conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table'", [], |r| r.get(0))?;
            let backup = path.with_extension(format!("pre-workspace-{}.db", uuid::Uuid::now_v7()));
            if count > 0 { self.conn.execute("VACUUM INTO ?1", params![backup.to_string_lossy()])?; }
        }
        Ok(())
    }

    pub fn init_workspace_schema(&self) -> rusqlite::Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS workspace_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS workspace_records(kind TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT, title TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), updated_at INTEGER NOT NULL, PRIMARY KEY(kind,id));
            CREATE INDEX IF NOT EXISTS workspace_project ON workspace_records(project_id,kind);
            CREATE TABLE IF NOT EXISTS workspace_imports(source_id TEXT PRIMARY KEY, originals TEXT NOT NULL CHECK(json_valid(originals)), imported_at INTEGER NOT NULL);
            INSERT OR IGNORE INTO workspace_migrations VALUES(1,unixepoch());
            INSERT OR IGNORE INTO workspace_migrations VALUES(2,unixepoch());")?;
        tx.commit()
    }

    pub fn workspace_snapshot(&self) -> rusqlite::Result<WorkspaceSnapshot> {
        let mut snapshot = WorkspaceSnapshot { version: 4, projects: vec![], items: vec![], places: vec![], collections: vec![], captures: vec![], routines: vec![], resumes: vec![], active_id: self.get_setting("workspace_active_id")? };
        let mut stmt = self.conn.prepare("SELECT kind,data FROM workspace_records ORDER BY updated_at,id")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_,String>(0)?, r.get::<_,String>(1)?)))?;
        for row in rows {
            let (kind, raw) = row?;
            let value: Value = serde_json::from_str(&raw).map_err(|e| invalid(e.to_string()))?;
            match kind.as_str() { "project" => snapshot.projects.push(value), "item" => snapshot.items.push(value), "place" => snapshot.places.push(value), "collection" => snapshot.collections.push(value), "capture" => snapshot.captures.push(value), "routine" => snapshot.routines.push(value), "resume" => snapshot.resumes.push(value), _ => {} }
        }
        Ok(snapshot)
    }

    pub fn workspace_save(&self, kind: &str, record: &Value) -> rusqlite::Result<()> {
        let (id, project, title) = validate_record(kind, record)?;
        if let Some(parent) = &project {
            let exists: bool = self.conn.query_row("SELECT EXISTS(SELECT 1 FROM workspace_records WHERE kind='project' AND id=?1)", params![parent], |r| r.get(0))?;
            if !exists { return Err(invalid("Originating project no longer exists")); }
        }
        self.conn.execute("INSERT INTO workspace_records(kind,id,project_id,title,data,updated_at) VALUES(?1,?2,?3,?4,?5,unixepoch()) ON CONFLICT(kind,id) DO UPDATE SET project_id=excluded.project_id,title=excluded.title,data=excluded.data,updated_at=excluded.updated_at", params![kind,id,project,title,record.to_string()])?;
        Ok(())
    }

    pub fn workspace_delete(&self, kind: &str, id: &str) -> rusqlite::Result<bool> {
        let tx = self.conn.unchecked_transaction()?;
        if kind == "project" {
            tx.execute("DELETE FROM workspace_records WHERE kind IN ('item','resume') AND project_id=?1", params![id])?;
            // Keep captured material and named routines after removing their optional project.
            tx.execute("UPDATE workspace_records SET project_id=NULL,data=json_remove(data,'$.projectId') WHERE kind IN ('capture','routine') AND project_id=?1", params![id])?;
        }
        let deleted = tx.execute("DELETE FROM workspace_records WHERE kind=?1 AND id=?2", params![kind,id])? > 0;
        tx.commit()?;
        Ok(deleted)
    }

    pub fn workspace_import(&self, import: &WorkspaceImport) -> rusqlite::Result<bool> {
        if import.source_id.trim().is_empty() || import.originals.to_string().len() > 16_000_000 { return Err(invalid("Invalid import source")); }
        let tx = self.conn.unchecked_transaction()?;
        if tx.query_row("SELECT 1 FROM workspace_imports WHERE source_id=?1", params![import.source_id], |r| r.get::<_,i64>(0)).optional()?.is_some() { return Ok(false); }
        for (kind, records) in [("project", &import.projects), ("item", &import.items), ("place", &import.places)] {
            for record in records {
                let (id, project, title) = validate_record(kind, record)?;
                if let Some(parent) = &project {
                    let exists: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM workspace_records WHERE kind='project' AND id=?1)", params![parent], |r| r.get(0))?;
                    if !exists { return Err(invalid("Import contains an orphan item")); }
                }
                tx.execute("INSERT OR IGNORE INTO workspace_records(kind,id,project_id,title,data,updated_at) VALUES(?1,?2,?3,?4,?5,unixepoch())", params![kind,id,project,title,record.to_string()])?;
            }
        }
        tx.execute("INSERT INTO workspace_imports VALUES(?1,?2,unixepoch())", params![import.source_id,import.originals.to_string()])?;
        tx.commit()?;
        Ok(true)
    }

    /// Search the durable workspace, conversation history and learned facts.
    /// The query is a plain-text term; empty queries intentionally return nothing.
    pub fn workspace_search(&self, query: &str) -> rusqlite::Result<Vec<Value>> {
        let query = query.trim();
        if query.is_empty() { return Ok(vec![]); }
        let sql = "
            SELECT 'record',kind,id,project_id,title FROM workspace_records
                WHERE instr(lower(title),lower(?1)) > 0 OR instr(lower(data),lower(?1)) > 0
            UNION ALL
            SELECT 'thread','thread',id,NULL,title FROM threads
                WHERE instr(lower(title),lower(?1)) > 0 OR instr(lower(COALESCE(title,'')),lower(?1)) > 0
            UNION ALL
            SELECT 'fact','fact',id,NULL,content FROM facts
                WHERE instr(lower(content),lower(?1)) > 0
            UNION ALL
            SELECT 'message',role,id,thread_id,substr(COALESCE(say,show,''),1,160) FROM messages
                WHERE instr(lower(COALESCE(say,'')),lower(?1)) > 0
                   OR instr(lower(COALESCE(show,'')),lower(?1)) > 0
            LIMIT 150
        ";
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(params![query], |r| Ok(json!({
            "source": r.get::<_,String>(0)?,
            "kind": r.get::<_,String>(1)?,
            "id": r.get::<_,String>(2)?,
            "threadId": if r.get::<_,String>(0)?=="message" {r.get::<_,Option<String>>(3)?} else {None},
            "projectId": if r.get::<_,String>(0)?=="record" {r.get::<_,Option<String>>(3)?} else {None},
            "title": r.get::<_,String>(4)?,
        })))?;
        rows.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn import_is_atomic_idempotent_and_preserves_originals() {
        let db = Database::open_in_memory().unwrap();
        let mut import = WorkspaceImport { source_id: "browser-v2".into(), originals: json!({"raw":"retained"}), projects: vec![json!({"id":"p","name":"Research","custom":"keep"})], items: vec![json!({"id":"t","projectId":"p","type":"task","title":"Check","status":"todo"})], places: vec![json!({"id":"node/1","name":"Alger","lat":36.7,"lng":3.0})] };
        import.items.push(json!({"id":"bad","title":"invalid"}));
        assert!(db.workspace_import(&import).is_err());
        assert!(db.workspace_snapshot().unwrap().projects.is_empty());
        import.items.pop();
        assert!(db.workspace_import(&import).unwrap());
        assert!(!db.workspace_import(&import).unwrap());
        let snapshot = db.workspace_snapshot().unwrap();
        assert_eq!(snapshot.projects[0]["custom"], "keep");
        assert_eq!(snapshot.items.len(),1);
        assert_eq!(snapshot.places.len(),1);
    }
}
