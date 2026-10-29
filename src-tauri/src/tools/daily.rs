use super::{RiskTier, ToolDefinition, ToolRegistry};
use serde_json::{json,Value};

pub fn register(registry:&mut ToolRegistry) {
    registry.register(ToolDefinition {name:"workspace.save".into(),description:"Preview and save a capture, task, or note linked to this request and its explicitly shared sources".into(),tier:RiskTier::Amber,schema:json!({"type":"object","properties":{"kind":{"type":"string","enum":["capture","task","note"]},"title":{"type":"string","minLength":1,"maxLength":1000},"text":{"type":"string","maxLength":1000000}},"required":["kind","title","text"],"additionalProperties":false})});
    registry.register(ToolDefinition {name:"project.command".into(),description:"Preview a project check or command; execute in the run's selected project folder after explicit confirm, returning real stdout, stderr, and exit code".into(),tier:RiskTier::Red,schema:json!({"type":"object","properties":{"command":{"type":"string","minLength":1,"maxLength":20000}},"required":["command"],"additionalProperties":false})});
}
pub async fn execute(name:&str,args:&Value)->Result<Value,String> {
    let context=crate::agent::runs::current().ok_or("This action requires a user-initiated run")?;
    context.check()?;
    match name {
        "workspace.save"=>{
            let kind=args["kind"].as_str().ok_or("Missing record kind")?;
            let source_ids:Vec<&Value>=context.sources.iter().filter_map(|source|source.get("id")).collect();
            let id=uuid::Uuid::now_v7().to_string();
            let origin=json!({"threadId":context.run.thread_id,"messageId":format!("msg-{}-user",context.run.id)});
            let mut record=if kind=="capture" {json!({"id":id,"title":args["title"],"text":args["text"],"sourceKind":"idea","capturedAt":chrono::Utc::now().to_rfc3339(),"inbox":true,"origin":origin})} else {json!({"id":id,"title":args["title"],"description":args["text"],"type":kind,"status":"todo","projectId":context.run.project_id.as_deref().unwrap_or(""),"sourceIds":source_ids,"origin":origin})};
            if kind=="capture" {if let Some(project)=&context.run.project_id {record["projectId"]=json!(project);}}
            context.db.lock().map_err(|e|e.to_string())?.workspace_save(if kind=="capture" {"capture"} else {"item"},&record).map_err(|e|e.to_string())?;
            Ok(json!({"status":"saved","record":record}))
        },
        "project.command"=>{
            let root=context.project_root.as_ref().ok_or("Attach a project folder before running a command")?;
            let command=args["command"].as_str().ok_or("Missing project command")?;
            #[cfg(target_os="windows")]
            let mut process={let mut process=tokio::process::Command::new("powershell");process.args(["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",command]);process.creation_flags(0x08000000);process};
            #[cfg(not(target_os="windows"))]
            let mut process={let mut process=tokio::process::Command::new("sh");process.args(["-c",command]);process};
            process.current_dir(root).kill_on_drop(true);
            let output=process.output().await.map_err(|e|e.to_string())?;
            Ok(json!({"command":command,"exit_code":output.status.code().unwrap_or(-1),"stdout":String::from_utf8_lossy(&output.stdout),"stderr":String::from_utf8_lossy(&output.stderr)}))
        },
        _=>Err("Unknown daily action".into()),
    }
}
