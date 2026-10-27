use crate::{AppState,memory::{workspace::{WorkspaceSnapshot,WorkspaceImport},runs::{RunRecord,RunEvent}}};
use serde_json::{json,Value};
use tauri::State;

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

