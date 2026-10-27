use super::db::Database;
use rusqlite::{params, OptionalExtension};
use serde_json::Value;
use std::path::{Path, PathBuf};

fn bounded_read(path: &Path) -> Result<Vec<u8>,String> {
    let size=std::fs::metadata(path).map_err(|e|e.to_string())?.len();
    if size>16*1024*1024 {return Err("File exceeds the 16 MB undo receipt limit".into());}
    std::fs::read(path).map_err(|e|e.to_string())
}
impl Database {
    /// The inverse and expected postimage are durable before a mutation starts.
    pub fn prepare_inverse(&self,run_id:&str,action_id:&str,tool:&str,args:&Value)->Result<Option<String>,String> {
        let (operation,path,source,before,after)=match tool {
            "fs.write"=>{
                let path=crate::tools::resolve_user_path(args["path"].as_str().ok_or("Missing path")?);
                let before=if path.exists() {Some(bounded_read(&path)?)} else {None};
                let after=args["content"].as_str().ok_or("Missing content")?.as_bytes().to_vec();
                if after.len()>16*1024*1024 {return Err("File exceeds the 16 MB undo receipt limit".into());}
                ("write",path,None,before,after)
            },
            "fs.move"=>{
                let source=crate::tools::resolve_user_path(args["source"].as_str().ok_or("Missing source")?);
                let path=crate::tools::resolve_user_path(args["destination"].as_str().ok_or("Missing destination")?);
                if path.exists() {return Err("Move destination already exists; choose a new destination".into());}
                if !source.is_file() {return Ok(None);}
                ("move",path,Some(source.to_string_lossy().to_string()),None,bounded_read(&source)?)
            },
            _=>return Ok(None),
        };
        let id=uuid::Uuid::now_v7().to_string();
        self.conn.execute("INSERT INTO inverse_receipts VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'prepared')",params![id,run_id,action_id,operation,path.to_string_lossy(),source,before,after]).map_err(|e|e.to_string())?;
        Ok(Some(id))
    }
    pub fn finish_inverse(&self,id:&str,success:bool)->Result<(),String> {
        self.conn.execute("UPDATE inverse_receipts SET status=?1 WHERE id=?2 AND status='prepared'",params![if success {"valid"} else {"failed"},id]).map_err(|e|e.to_string())?;Ok(())
    }
    pub fn valid_inverse(&self,run_id:&str)->Result<Option<String>,String> {
        self.conn.query_row("SELECT id FROM inverse_receipts WHERE run_id=?1 AND status='valid' ORDER BY rowid DESC LIMIT 1",params![run_id],|r|r.get(0)).optional().map_err(|e|e.to_string())
    }
    pub fn undo_receipt(&self,id:Option<&str>)->Result<String,String> {
        let receipt=self.conn.query_row("SELECT id,operation,path,source,before_bytes,after_bytes FROM inverse_receipts WHERE status='valid' AND (?1 IS NULL OR id=?1) ORDER BY rowid DESC LIMIT 1",params![id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Option<String>>(3)?,r.get::<_,Option<Vec<u8>>>(4)?,r.get::<_,Vec<u8>>(5)?))).optional().map_err(|e|e.to_string())?.ok_or("No valid file undo receipt is available")?;
        let (id,operation,path,source,before,after)=receipt;let target=PathBuf::from(&path);
        if bounded_read(&target)?!=after {return Err("Undo conflict: the file changed after this action; keep or reconcile those edits".into());}
        if operation=="move" && source.as_ref().is_some_and(|p|Path::new(p).exists()) {return Err("Undo conflict: the original path is now occupied".into());}
        // Claim once before touching disk. A crash while restoring leaves a receipt
        // requiring reconciliation rather than advertising a second safe undo.
        let changed=self.conn.execute("UPDATE inverse_receipts SET status='restoring' WHERE id=?1 AND status='valid'",params![id]).map_err(|e|e.to_string())?;
        if changed!=1 {return Err("Undo receipt has already been used".into());}
        let restored=match operation.as_str() {
            "write"=>if let Some(bytes)=before {std::fs::write(&target,bytes)} else {std::fs::remove_file(&target)},
            "move"=>std::fs::rename(&target,source.ok_or("Invalid move receipt")?),
            _=>return Err("Unsupported inverse operation".into()),
        };
        restored.map_err(|e|format!("Undo interrupted; reconcile the file before retrying: {e}"))?;
        self.conn.execute("UPDATE inverse_receipts SET status='restored' WHERE id=?1",params![id]).map_err(|e|e.to_string())?;
        Ok("Restored the file using its saved inverse operation.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::runs::{now_ms,RunRecord};
    use serde_json::json;
    #[test]
    fn persisted_undo_checks_subsequent_edits_and_is_single_use() {
        let db=Database::open_in_memory().unwrap();let id=uuid::Uuid::now_v7().to_string();
        let path=std::env::temp_dir().join(format!("friday-undo-{id}.txt"));std::fs::write(&path,b"before").unwrap();
        db.create_run(&RunRecord {id:id.clone(),request_id:None,thread_id:"thread-1".into(),project_id:None,provider_profile_id:None,utterance:"write".into(),status:"running".into(),created_at:now_ms(),updated_at:now_ms()}).unwrap();
        let args=json!({"path":path.to_string_lossy(),"content":"after"});let action=db.plan_action(&id,"fs.write",&args,"Amber").unwrap();
        let receipt=db.prepare_inverse(&id,&action,"fs.write",&args).unwrap().unwrap();std::fs::write(&path,b"after").unwrap();db.finish_inverse(&receipt,true).unwrap();
        std::fs::write(&path,b"subsequent edit").unwrap();assert!(db.undo_receipt(Some(&receipt)).is_err());assert_eq!(std::fs::read(&path).unwrap(),b"subsequent edit");
        std::fs::write(&path,b"after").unwrap();db.undo_receipt(Some(&receipt)).unwrap();assert_eq!(std::fs::read(&path).unwrap(),b"before");assert!(db.undo_receipt(Some(&receipt)).is_err());std::fs::remove_file(path).unwrap();
    }
}
