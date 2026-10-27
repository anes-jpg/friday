use super::db::Database;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub fn now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus { Queued, Running, AwaitingConfirmation, Completed, Failed, Cancelled, Interrupted }
impl RunStatus {
    pub fn as_str(self) -> &'static str {
        match self { Self::Queued => "queued", Self::Running => "running", Self::AwaitingConfirmation => "awaiting_confirmation", Self::Completed => "completed", Self::Failed => "failed", Self::Cancelled => "cancelled", Self::Interrupted => "interrupted" }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    pub request_id: Option<String>,
    pub thread_id: String,
    pub project_id: Option<String>,
    pub provider_profile_id: Option<String>,
    pub utterance: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RunEvent {
    pub run_id: String,
    pub sequence: i64,
    pub timestamp: i64,
    pub step: Option<String>,
    pub status: RunStatus,
    pub detail: Value,
}

fn invalid(message: &str) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, message)))
}

impl Database {
    pub fn init_run_schema(&self) -> rusqlite::Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,request_id TEXT UNIQUE,thread_id TEXT NOT NULL,project_id TEXT,provider_profile_id TEXT,utterance TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS runs_project ON runs(project_id,created_at);
            CREATE TABLE IF NOT EXISTS run_events(run_id TEXT NOT NULL REFERENCES runs(id),sequence INTEGER NOT NULL,timestamp INTEGER NOT NULL,step TEXT,status TEXT NOT NULL,detail TEXT NOT NULL CHECK(json_valid(detail)),PRIMARY KEY(run_id,sequence));
            CREATE TABLE IF NOT EXISTS run_actions(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),tool_name TEXT NOT NULL,args TEXT NOT NULL CHECK(json_valid(args)),tier TEXT NOT NULL,status TEXT NOT NULL,outcome TEXT,reconcile_required INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),plan TEXT NOT NULL CHECK(json_valid(plan)),tier TEXT NOT NULL,status TEXT NOT NULL,expires_at INTEGER,consumed_at INTEGER);
            CREATE TABLE IF NOT EXISTS inverse_receipts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),action_id TEXT NOT NULL REFERENCES run_actions(id),operation TEXT NOT NULL,path TEXT NOT NULL,source TEXT,before_bytes BLOB,after_bytes BLOB NOT NULL,status TEXT NOT NULL);
            INSERT OR IGNORE INTO workspace_migrations VALUES(2,unixepoch());")?;
        tx.commit()
    }

    pub fn create_run(&self, run: &RunRecord) -> rusqlite::Result<()> {
        self.conn.execute("INSERT INTO runs VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)", params![run.id,run.request_id,run.thread_id,run.project_id,run.provider_profile_id,run.utterance,run.status,run.created_at,run.updated_at])?;
        Ok(())
    }

    pub fn run_history(&self, project_id: Option<&str>, thread_id: Option<&str>) -> rusqlite::Result<Vec<RunRecord>> {
        let mut stmt = self.conn.prepare("SELECT id,request_id,thread_id,project_id,provider_profile_id,utterance,status,created_at,updated_at FROM runs WHERE (?1 IS NULL OR project_id=?1) AND (?2 IS NULL OR thread_id=?2) ORDER BY created_at DESC LIMIT 200")?;
        let rows = stmt.query_map(params![project_id,thread_id], |r| Ok(RunRecord { id:r.get(0)?,request_id:r.get(1)?,thread_id:r.get(2)?,project_id:r.get(3)?,provider_profile_id:r.get(4)?,utterance:r.get(5)?,status:r.get(6)?,created_at:r.get(7)?,updated_at:r.get(8)? }))?;
        rows.collect()
    }

    pub fn run_event(&self, run_id: &str, step: Option<&str>, status: RunStatus, detail: Value) -> rusqlite::Result<RunEvent> {
        let tx = self.conn.unchecked_transaction()?;
        let terminal: bool = tx.query_row("SELECT status IN ('completed','failed','cancelled','interrupted') FROM runs WHERE id=?1", params![run_id], |r| r.get(0))?;
        if terminal { return Err(invalid("Run has already ended; late updates are rejected")); }
        let sequence: i64 = tx.query_row("SELECT COALESCE(MAX(sequence),0)+1 FROM run_events WHERE run_id=?1", params![run_id], |r| r.get(0))?;
        let event = RunEvent { run_id:run_id.into(),sequence,timestamp:now_ms(),step:step.map(str::to_string),status,detail };
        tx.execute("INSERT INTO run_events VALUES(?1,?2,?3,?4,?5,?6)", params![event.run_id,event.sequence,event.timestamp,event.step,status.as_str(),event.detail.to_string()])?;
        tx.execute("UPDATE runs SET status=?1,updated_at=?2 WHERE id=?3", params![status.as_str(),event.timestamp,run_id])?;
        tx.commit()?;
        Ok(event)
    }

    pub fn run_events(&self, run_id: &str) -> rusqlite::Result<Vec<RunEvent>> {
        let mut stmt = self.conn.prepare("SELECT sequence,timestamp,step,status,detail FROM run_events WHERE run_id=?1 ORDER BY sequence")?;
        let rows = stmt.query_map(params![run_id], |r| {
            let raw_status: String = r.get(3)?;
            let raw_detail: String = r.get(4)?;
            let status = serde_json::from_value(Value::String(raw_status)).map_err(|e| rusqlite::Error::FromSqlConversionFailure(3,rusqlite::types::Type::Text,Box::new(e)))?;
            let detail = serde_json::from_str(&raw_detail).map_err(|e| rusqlite::Error::FromSqlConversionFailure(4,rusqlite::types::Type::Text,Box::new(e)))?;
            Ok(RunEvent { run_id:run_id.into(),sequence:r.get(0)?,timestamp:r.get(1)?,step:r.get(2)?,status,detail })
        })?;
        rows.collect()
    }

    pub fn plan_action(&self, run_id: &str, tool: &str, args: &Value, tier: &str) -> rusqlite::Result<String> {
        let id = uuid::Uuid::now_v7().to_string();
        self.conn.execute("INSERT INTO run_actions(id,run_id,tool_name,args,tier,status) SELECT ?1,id,?3,?4,?5,'queued' FROM runs WHERE id=?2 AND status IN ('queued','running','awaiting_confirmation')", params![id,run_id,tool,args.to_string(),tier])?;
        let exists: bool = self.conn.query_row("SELECT EXISTS(SELECT 1 FROM run_actions WHERE id=?1)",params![id],|r|r.get(0))?;
        if !exists { return Err(invalid("Run no longer accepts actions")); }
        Ok(id)
    }

    pub fn reconcile_required_actions(&self) -> rusqlite::Result<Vec<Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,run_id,tool_name,args,outcome,status,reconcile_required FROM run_actions WHERE status='interrupted' OR reconcile_required=1 ORDER BY run_id,id LIMIT 200",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_,String>(0)?,
                "run_id": r.get::<_,String>(1)?,
                "tool": r.get::<_,String>(2)?,
                "args": serde_json::from_str::<Value>(&r.get::<_,String>(3)?).unwrap_or_else(|_| Value::Null),
                "outcome": r.get::<_,Option<String>>(4)?,
                "status": r.get::<_,String>(5)?,
                "reconcile_required": r.get::<_,bool>(6)?,
            }))
        })?;
        rows.collect()
    }

    pub fn action_status(&self, id: &str, status: &str, outcome: Option<&Value>) -> rusqlite::Result<()> {
        self.conn.execute("UPDATE run_actions SET status=?1,outcome=?2,reconcile_required=CASE WHEN ?1='interrupted' THEN 1 ELSE 0 END WHERE id=?3 AND status NOT IN ('cancelled','interrupted','completed','failed')",params![status,outcome.map(Value::to_string),id])?;
        Ok(())
    }

    pub fn save_approval(&self, id: &str, run_id: &str, plan: &Value, tier: &str) -> rusqlite::Result<()> {
        self.conn.execute("INSERT INTO approvals VALUES(?1,?2,?3,?4,'awaiting_confirmation',?5,NULL)",params![id,run_id,plan.to_string(),tier,if tier=="Amber" {Some(now_ms()+8000)} else {None}])?;
        Ok(())
    }

    pub fn approval_plan(&self, id: &str) -> rusqlite::Result<Option<(String, Value)>> {
        self.conn.query_row("SELECT run_id,plan FROM approvals WHERE id=?1",params![id],|r| {
            let raw: String = r.get(1)?;
            let plan = serde_json::from_str(&raw).map_err(|e| rusqlite::Error::FromSqlConversionFailure(1,rusqlite::types::Type::Text,Box::new(e)))?;
            Ok((r.get(0)?,plan))
        }).optional()
    }

    pub fn consume_approval(&self, id: &str, expected: &Value, explicit_red: bool) -> rusqlite::Result<()> {
        let changed = self.conn.execute("UPDATE approvals SET status='consumed',consumed_at=?1 WHERE id=?2 AND plan=?3 AND status='awaiting_confirmation' AND (expires_at IS NULL OR expires_at>?1) AND (tier!='Red' OR ?4) AND EXISTS(SELECT 1 FROM runs WHERE runs.id=approvals.run_id AND runs.status='awaiting_confirmation')", params![now_ms(),id,expected.to_string(),explicit_red])?;
        if changed!=1 { return Err(invalid("Approval was used, cancelled, expired, changed, or lacks explicit confirmation")); }
        Ok(())
    }

    pub fn expire_approval(&self,id:&str) -> rusqlite::Result<Option<RunEvent>> {
        let run_id:Option<String>=self.conn.query_row("SELECT run_id FROM approvals WHERE id=?1 AND status='awaiting_confirmation' AND expires_at<=?2",params![id,now_ms()],|r|r.get(0)).optional()?;
        if let Some(run_id)=run_id {
            let event=self.cancel_run_records(&run_id)?;
            self.conn.execute("UPDATE approvals SET status='expired' WHERE id=?1",params![id])?;
            Ok(Some(event))
        } else {Ok(None)}
    }

    pub fn cancel_run_records(&self, id: &str) -> rusqlite::Result<RunEvent> {
        let event = self.run_event(id,None,RunStatus::Cancelled,serde_json::json!({"message":"Stopped; in-flight outcomes may require reconciliation"}))?;
        let tx = self.conn.unchecked_transaction()?;
        tx.execute("UPDATE approvals SET status='cancelled' WHERE run_id=?1 AND status='awaiting_confirmation'",params![id])?;
        tx.execute("UPDATE run_actions SET reconcile_required=CASE WHEN status='running' THEN 1 ELSE 0 END,status=CASE WHEN status='running' THEN 'interrupted' ELSE 'cancelled' END WHERE run_id=?1 AND status IN ('queued','running')",params![id])?;
        tx.commit()?;
        Ok(event)
    }

    pub fn recover_unfinished_runs(&self) -> rusqlite::Result<usize> {
        let ids: Vec<String> = {
            let mut stmt = self.conn.prepare("SELECT id FROM runs WHERE status IN ('queued','running','awaiting_confirmation')")?;
            let result = stmt.query_map([],|r|r.get(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
            result
        };
        for id in &ids {
            self.run_event(id,None,RunStatus::Interrupted,serde_json::json!({"message":"Application restarted; reconcile uncertain actions before retrying"}))?;
            self.conn.execute("UPDATE run_actions SET reconcile_required=CASE WHEN status='running' THEN 1 ELSE 0 END,status='interrupted' WHERE run_id=?1 AND status IN ('queued','running')",params![id])?;
            self.conn.execute("UPDATE approvals SET status='interrupted' WHERE run_id=?1 AND status='awaiting_confirmation'",params![id])?;
        }
        Ok(ids.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn started(db: &Database) -> RunRecord {
        let run=RunRecord {id:uuid::Uuid::now_v7().to_string(),request_id:None,thread_id:"thread-1".into(),project_id:Some("p".into()),provider_profile_id:Some("profile-a".into()),utterance:"write a file".into(),status:"queued".into(),created_at:now_ms(),updated_at:now_ms()};
        db.create_run(&run).unwrap();
        db.run_event(&run.id,None,RunStatus::Running,json!({})).unwrap();
        run
    }
    #[test]
    fn approvals_are_single_use_cancel_safe_and_plan_bound() {
        let db=Database::open_in_memory().unwrap();let run=started(&db);let plan=json!({"tool":"fs.write","content":"original"});
        db.save_approval("a",&run.id,&plan,"Red").unwrap();
        db.run_event(&run.id,None,RunStatus::AwaitingConfirmation,json!({})).unwrap();
        assert!(db.consume_approval("a",&plan,false).is_err());
        assert!(db.consume_approval("a",&json!({"changed":true}),true).is_err());
        db.consume_approval("a",&plan,true).unwrap();
        assert!(db.consume_approval("a",&plan,true).is_err());
        db.save_approval("b",&run.id,&plan,"Amber").unwrap();
        db.cancel_run_records(&run.id).unwrap();
        assert!(db.consume_approval("b",&plan,true).is_err());
        assert!(db.run_event(&run.id,None,RunStatus::Completed,json!({})).is_err());
    }
    #[test]
    fn restart_interrupts_without_replaying_and_orders_events() {
        let db=Database::open_in_memory().unwrap();let run=started(&db);
        let action=db.plan_action(&run.id,"fs.write",&json!({"path":"a"}),"Amber").unwrap();
        db.action_status(&action,"running",None).unwrap();
        assert_eq!(db.recover_unfinished_runs().unwrap(),1);
        assert_eq!(db.recover_unfinished_runs().unwrap(),0);
        let events=db.run_events(&run.id).unwrap();assert_eq!(events[1].sequence,2);assert_eq!(events[1].status,RunStatus::Interrupted);
        let uncertain:bool=db.conn.query_row("SELECT reconcile_required FROM run_actions WHERE id=?1",params![action],|r|r.get(0)).unwrap();assert!(uncertain);
        assert_eq!(db.run_history(Some("p"),None).unwrap()[0].provider_profile_id.as_deref(),Some("profile-a"));
    }
}
