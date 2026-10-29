use crate::{AppState,memory::{workspace::{WorkspaceSnapshot,WorkspaceImport},runs::{RunRecord,RunEvent}}};
use serde_json::{json,Value};
use tauri::{State, Manager};

#[tauri::command]
pub fn workspace_create_website_folder(id:String,app:tauri::AppHandle)->Result<String,String> {
    let root=website_project_folder(&app.path().app_data_dir().map_err(|e|e.to_string())?,&id)?;
    std::fs::create_dir_all(&root).map_err(|e|format!("Could not create website working folder: {e}"))?;
    Ok(root.to_string_lossy().to_string())
}

fn website_project_folder(base:&std::path::Path,id:&str)->Result<std::path::PathBuf,String> {
    // Use a parsed UUID as the directory component; business names never become paths.
    let id=uuid::Uuid::parse_str(id).map_err(|_|"Invalid website project ID")?;
    Ok(base.join("website-projects").join(id.to_string()))
}

#[cfg(test)]
mod website_folder_tests {
    use super::website_project_folder;
    #[test]
    fn website_folder_stays_inside_app_projects() {
        let base=std::path::Path::new("app-data");
        let id="550e8400-e29b-41d4-a716-446655440000";
        let path=website_project_folder(base,id).expect("Valid project UUID");
        assert_eq!(path,base.join("website-projects").join(id));
    }
    #[test]
    fn website_folder_rejects_traversal_and_absolute_paths() {
        for id in ["../outside","..\\outside","C:\\outside","","website; command"] {
            assert!(website_project_folder(std::path::Path::new("app-data"),id).is_err());
        }
    }
}

#[tauri::command]
pub fn workspace_select(id:Option<String>,state:State<'_,AppState>)->Result<(),String> {
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    if let Some(id)=id.filter(|id|!id.is_empty()) {
        if !db.workspace_snapshot().map_err(|e|e.to_string())?.projects.iter().any(|project|project["id"].as_str()==Some(&id)) {return Err("Project no longer exists".into());}
        db.save_setting("workspace_active_id",&id).map_err(|e|e.to_string())
    } else {db.conn.execute("DELETE FROM settings WHERE key='workspace_active_id'",[]).map_err(|e|e.to_string())?;Ok(())}
}

#[tauri::command]
pub fn get_message_context(message_id:String,state:State<'_,AppState>)->Result<Value,String> {
    let Some(run_id)=message_id.strip_prefix("msg-").and_then(|id|id.strip_suffix("-assistant")) else {return Ok(json!({"sourceIds":[]}));};
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    let events=db.run_events(run_id).map_err(|e|e.to_string())?;
    let detail=events.first().map(|event|event.detail.clone()).unwrap_or_default();
    let ids:Vec<&Value>=detail["sources"].as_array().map(|sources|sources.iter().filter_map(|source|source.get("id")).collect()).unwrap_or_default();
    Ok(json!({"sourceIds":ids,"projectId":detail["project_id"]}))
}
#[tauri::command]
pub fn save_explicit_preference(text:String,origin:Value,state:State<'_,AppState>)->Result<(),String> {
    if text.trim().is_empty() || text.len()>4096 {return Err("Write a preference of at most 4096 bytes".into());}
    let message_id=origin["messageId"].as_str().ok_or("Preference needs its originating message")?;
    let thread_id=origin["threadId"].as_str().ok_or("Preference needs its originating conversation")?;
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    if !db.get_messages_for_thread(thread_id).map_err(|e|e.to_string())?.iter().any(|message|message.id==message_id) {return Err("Originating message was not saved; retry after the conversation is stored".into());}
    db.insert_fact(&crate::memory::db::DbFact {id:uuid::Uuid::now_v7().to_string(),content:format!("Preference: {}",text.trim()),confidence:1.0,source_message_id:Some(message_id.into()),created_at:crate::memory::runs::now_ms()/1000}).map_err(|e|e.to_string())
}

#[tauri::command]
pub async fn capture_webpage(url:String)->Result<Value,String> {
    let url=crate::daily_work::validate_url(&url)?;
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e|e.to_string())?;
    let mut response=client.get(url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
    let final_url=response.url().to_string();
    let mime=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|value|value.to_str().ok()).unwrap_or("").to_string();
    if !mime.starts_with("text/") && !mime.is_empty() {return Err(format!("Unsupported webpage content type: {mime}. Share text or code instead."));}
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|e|e.to_string())? { if bytes.len()+chunk.len()>2_000_000 {return Err("Webpage exceeds the capture limit".into());} bytes.extend_from_slice(&chunk); }
    let html=String::from_utf8(bytes).map_err(|_|"The page is not UTF-8 text")?;
    let snapshot=crate::agent::browser::BrowserOperator::new().parse_html_snapshot(&final_url,&html,0);
    let text=if mime.starts_with("text/plain") {html} else {crate::daily_work::readable_html(&html)};
    if text.trim().is_empty() {return Err("No readable text was found. Paste the excerpt you want to share.".into());}
    Ok(json!({"sourceKind":"url","title":snapshot.title,"text":text,"url":final_url,"capturedAt":chrono::Utc::now().to_rfc3339()}))
}
#[tauri::command]
pub fn capture_text_file(path:String)->Result<Value,String> {
    let path=std::path::PathBuf::from(path);
    if !path.is_absolute() || !path.is_file() {return Err("Choose an existing absolute file path".into());}
    let title=path.file_name().and_then(|value|value.to_str()).unwrap_or("File");
    let base=json!({"sourceKind":"file","title":title,"text":"","path":path.to_string_lossy(),"capturedAt":chrono::Utc::now().to_rfc3339()});
    let extension=path.extension().and_then(|value|value.to_str()).unwrap_or("").to_lowercase();
    if !["txt","md","markdown","json","jsonl","csv","tsv","log","diff","patch","ts","tsx","js","jsx","mjs","cjs","rs","py","html","css","scss","sql","yaml","yml","toml","xml","sh","ps1","ini","cfg","c","cpp","h","java","go","rb","vue","svelte"].contains(&extension.as_str()) && !["Dockerfile","Makefile",".gitignore"].contains(&title) {let mut value=base;value["extractionError"]=json!("This document format is not supported yet. Share a text or code file.");return Ok(value);}
    if std::fs::metadata(&path).map_err(|e|e.to_string())?.len()>1_000_000 {return Err("File exceeds the capture limit".into());}
    let text=std::fs::read_to_string(&path).map_err(|e|e.to_string())?;
    if text.contains('\0') {return Err("File contains binary data".into());}
    let mut value=base;value["text"]=json!(text);Ok(value)
}

#[tauri::command]
pub fn workspace_import_daily(data:Value,state:State<'_,AppState>)->Result<(),String> {
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    if db.get_setting("daily_browser_imported").map_err(|e|e.to_string())?.is_some() {return Ok(());}
    let tx=db.conn.unchecked_transaction().map_err(|e|e.to_string())?;
    for (kind,field) in [("capture","captures"),("routine","routines"),("resume","resumes")] {
        let records=data[field].as_array().ok_or("Invalid daily workspace import")?;
        for record in records {
            // A browser import never replaces an existing native record.
            let exists:bool=db.conn.query_row("SELECT EXISTS(SELECT 1 FROM workspace_records WHERE kind=?1 AND id=?2)",rusqlite::params![kind,record["id"].as_str().ok_or("Invalid record ID")?],|r|r.get(0)).map_err(|e|e.to_string())?;
            if !exists {db.workspace_save(kind,record).map_err(|e|e.to_string())?;}
        }
    }
    db.save_setting("daily_browser_import_original",&data.to_string()).map_err(|e|e.to_string())?;
    db.save_setting("daily_browser_imported","1").map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn get_daily_preferences(state:State<'_,AppState>)->Result<Option<String>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.get_setting("daily_preferences").map_err(|e|e.to_string())
}
#[tauri::command]
pub fn save_daily_preferences(preferences:Value,state:State<'_,AppState>)->Result<(),String> {
    let timezone=preferences["timezone"].as_str().ok_or("Timezone is required")?;
    timezone.parse::<chrono_tz::Tz>().map_err(|_|"Invalid timezone")?;
    if preferences["restoreView"].as_bool().is_none() || preferences["shortcut"].as_str().is_none() || preferences.to_string().len()>10_000 {return Err("Invalid daily preferences".into());}
    state.agent.db.lock().map_err(|e|e.to_string())?.save_setting("daily_preferences",&preferences.to_string()).map_err(|e|e.to_string())
}

#[tauri::command]
pub fn workspace_snapshot(state:State<'_,AppState>)->Result<WorkspaceSnapshot,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.workspace_snapshot().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn workspace_save(kind:String,record:Value,state:State<'_,AppState>)->Result<(),String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.workspace_save(&kind,&record).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn workspace_delete(kind:String,id:String,state:State<'_,AppState>)->Result<bool,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.workspace_delete(&kind,&id).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn workspace_import(import:WorkspaceImport,state:State<'_,AppState>)->Result<bool,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.workspace_import(&import).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn workspace_search(query:String,state:State<'_,AppState>)->Result<Vec<Value>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.workspace_search(&query).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn workspace_agenda(today:String,state:State<'_,AppState>)->Result<Value,String> {
    if today.len()!=10 || !today.chars().all(|c|c.is_ascii_digit() || c=='-') {return Err("Expected a local date as YYYY-MM-DD".into());}
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    let snapshot=db.workspace_snapshot().map_err(|e|e.to_string())?;
    let pending:Vec<&Value>=snapshot.items.iter().filter(|item|item["type"]=="task" && item["status"]!="done").collect();
    let overdue:Vec<&Value>=pending.iter().copied().filter(|item|item["dueDate"].as_str().is_some_and(|date|date.get(..10).unwrap_or(date)<today.as_str())).collect();
    let tasks:Vec<&Value>=pending.iter().copied().filter(|item|item["dueDate"].as_str().is_some_and(|date|date.get(..10).unwrap_or(date)==today)).collect();
    Ok(json!({"overdue":overdue,"today":tasks,"reminders":db.get_automations().map_err(|e|e.to_string())?,"activity":db.run_history(None,None).map_err(|e|e.to_string())?.into_iter().take(20).collect::<Vec<_>>()}))
}
#[tauri::command]
pub fn get_run_history(project_id:Option<String>,thread_id:Option<String>,state:State<'_,AppState>)->Result<Vec<RunRecord>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.run_history(project_id.as_deref(),thread_id.as_deref()).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn get_run_events(run_id:String,state:State<'_,AppState>)->Result<Vec<RunEvent>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.run_events(&run_id).map_err(|e|e.to_string())
}

#[tauri::command]
pub fn get_run_receipt(run_id:String,state:State<'_,AppState>)->Result<Option<String>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.valid_inverse(&run_id)
}
#[tauri::command]
pub fn undo_action(receipt_id:String,state:State<'_,AppState>)->Result<String,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.undo_receipt(Some(&receipt_id))
}

#[tauri::command]
pub fn save_reminder(id:Option<String>,name:String,schedule:crate::scheduler::schedules::ReminderSchedule,timezone:Option<String>,tool:String,args:String,state:State<'_,AppState>)->Result<crate::memory::db::DbAutomation,String> {
    state.scheduler.save_reminder(id,name,schedule,timezone,tool,args)
}
#[tauri::command]
pub fn preview_reminder(schedule:crate::scheduler::schedules::ReminderSchedule,timezone:String)->Result<Value,String> {
    crate::scheduler::schedules::validate_new_occurrence(&schedule,&timezone)?;
    let timestamp=crate::scheduler::schedules::next_occurrence(&schedule,&timezone,crate::memory::runs::now_ms()/1000)?;
    Ok(json!({"timestamp":timestamp,"description":crate::scheduler::schedules::describe_occurrence(timestamp,&timezone)?}))
}
#[tauri::command]
pub fn get_automation_history(id:String,state:State<'_,AppState>)->Result<Vec<crate::memory::schedule_history::AutomationAttempt>,String> {
    state.agent.db.lock().map_err(|e|e.to_string())?.automation_history(&id).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn get_reconcile_actions(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    state
        .agent
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .reconcile_required_actions()
        .map_err(|e| e.to_string())
}

