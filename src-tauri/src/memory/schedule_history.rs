use super::db::{Database,DbAuditEntry};
use rusqlite::params;
use serde::{Serialize,Deserialize};

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct AutomationAttempt {pub id:String,pub automation_id:String,pub started_at:i64,pub finished_at:Option<i64>,pub status:String,pub result:Option<String>,pub duration_ms:Option<i64>}

impl Database {
    pub fn init_schedule_schema(&self)->rusqlite::Result<()> {
        let columns:Vec<String>={let mut stmt=self.conn.prepare("PRAGMA table_info(automations)")?;let rows=stmt.query_map([],|r|r.get(1))?;rows.collect::<rusqlite::Result<_>>()?};
        let tx=self.conn.unchecked_transaction()?;
        if !columns.iter().any(|column|column=="timezone") {tx.execute("ALTER TABLE automations ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'",[])?;}
        if !columns.iter().any(|column|column=="schedule_json") {tx.execute("ALTER TABLE automations ADD COLUMN schedule_json TEXT",[])?;}
        tx.execute_batch("CREATE TABLE IF NOT EXISTS automation_history(id TEXT PRIMARY KEY,automation_id TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,status TEXT NOT NULL,result TEXT,duration_ms INTEGER);
            INSERT OR IGNORE INTO workspace_migrations VALUES(3,unixepoch());")?;
        tx.execute("UPDATE automation_history SET status='interrupted',finished_at=unixepoch(),result='Application restarted during this attempt; no automatic replay' WHERE status='running'",[])?;
        tx.execute("UPDATE automations SET last_result='Interrupted: application restarted during this attempt' WHERE last_result='Running'",[])?;
        tx.commit()
    }
    pub fn claim_reminder(&self,id:&str,next:Option<i64>,scheduled:bool,now:i64)->rusqlite::Result<Option<String>> {
        let tx=self.conn.unchecked_transaction()?;
        let changed=tx.execute("UPDATE automations SET next_run=?1,last_result='Running' WHERE id=?2 AND COALESCE(last_result,'')!='Running' AND (?3=0 OR(enabled=1 AND next_run<=?4))",params![next,id,scheduled,now])?;
        if changed==0 {return Ok(None);}
        let attempt=uuid::Uuid::now_v7().to_string();
        tx.execute("INSERT INTO automation_history VALUES(?1,?2,?3,NULL,'running',NULL,NULL)",params![attempt,id,now])?;
        tx.commit()?;Ok(Some(attempt))
    }
    pub fn finish_reminder(&self,id:&str,attempt:&str,now:i64,result:&str,audit:&DbAuditEntry,once:bool)->rusqlite::Result<()> {
        let tx=self.conn.unchecked_transaction()?;
        tx.execute("UPDATE automations SET last_run=?1,last_result=?2,enabled=CASE WHEN ?3 THEN 0 ELSE enabled END WHERE id=?4",params![now,result,once,id])?;
        tx.execute("UPDATE automation_history SET finished_at=?1,status=?2,result=?3,duration_ms=?4 WHERE id=?5 AND status='running'",params![now,if result.starts_with("Failed:") {"failed"} else {"completed"},result,audit.duration_ms,attempt])?;
        tx.execute("INSERT INTO audit_log VALUES(?1,?2,?3,?4,?5,?6,?7)",params![audit.id,audit.tool_name,audit.args_hash,audit.tier,audit.decision,audit.duration_ms,audit.created_at])?;
        tx.commit()
    }
    pub fn automation_history(&self,id:&str)->rusqlite::Result<Vec<AutomationAttempt>> {
        let mut stmt=self.conn.prepare("SELECT id,automation_id,started_at,finished_at,status,result,duration_ms FROM automation_history WHERE automation_id=?1 ORDER BY started_at DESC LIMIT 100")?;
        let rows=stmt.query_map(params![id],|r|Ok(AutomationAttempt{id:r.get(0)?,automation_id:r.get(1)?,started_at:r.get(2)?,finished_at:r.get(3)?,status:r.get(4)?,result:r.get(5)?,duration_ms:r.get(6)?}))?;
        rows.collect()
    }
}
