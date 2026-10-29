use crate::memory::db::{Database, DbAuditEntry, DbAutomation};
use crate::tools::ToolRegistry;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri_plugin_notification::NotificationExt;
use tokio_cron_scheduler::Job;
pub mod schedules;
use schedules::{ReminderSchedule,next_occurrence};

fn next_for(auto:&DbAutomation)->Result<Option<i64>,String> {
    if let Some(value)=&auto.schedule {
        let schedule:ReminderSchedule=serde_json::from_value(value.clone()).map_err(|e|e.to_string())?;
        next_occurrence(&schedule,&auto.timezone,now()).map(Some)
    } else {next_run(&auto.trigger_expr).map(Some)}
}

#[derive(Clone)]
pub struct SchedulerManager {
    db: Arc<Mutex<Database>>,
    tools: Arc<ToolRegistry>,
    is_running: Arc<AtomicBool>,
    active: Arc<Mutex<HashSet<String>>>,
    app: Arc<Mutex<Option<tauri::AppHandle>>>,
}

/// Five-field expressions are minute/hour/day/month/weekday. Schedules use UTC.
pub fn next_run(expr: &str) -> Result<i64, String> {
    let fields = expr.split_whitespace().count();
    let schedule = match fields {
        5 => format!("0 {expr}"),
        6 | 7 => expr.to_string(),
        _ => return Err("Use a five-field cron expression (minute hour day month weekday).".into()),
    };
    let mut job = Job::new(schedule.as_str(), |_, _| {}).map_err(|e| format!("Invalid cron expression: {e}"))?;
    let next = job.job_data().map_err(|e| e.to_string())?.next_tick;
    if next == 0 { return Err("The schedule has no future occurrence.".into()); }
    i64::try_from(next).map_err(|e| e.to_string())
}

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64
}

pub fn validate_action(tool: &str, args: &str) -> Result<Value, String> {
    // Unattended execution is limited to these reviewed, non-destructive actions.
    if !["notify.toast", "system.info", "window.list"].contains(&tool) {
        return Err("This action requires an interactive instruction. Scheduled actions support reminders, system checks and window lists.".into());
    }
    let value: Value = serde_json::from_str(args).map_err(|e| format!("Invalid action arguments: {e}"))?;
    if !value.is_object() { return Err("Action arguments must be a JSON object.".into()); }
    if tool == "notify.toast" && value.get("message").and_then(Value::as_str).is_none_or(|s| s.trim().is_empty()) {
        return Err("Enter a reminder message.".into());
    }
    Ok(value)
}

struct ActiveRun { active: Arc<Mutex<HashSet<String>>>, id: String }
impl Drop for ActiveRun {
    fn drop(&mut self) {
        if let Ok(mut active) = self.active.lock() { active.remove(&self.id); }
    }
}

impl SchedulerManager {
    pub fn new(db: Arc<Mutex<Database>>, tools: Arc<ToolRegistry>) -> Self {
        Self { db, tools, is_running: Arc::new(AtomicBool::new(false)), active: Arc::new(Mutex::new(HashSet::new())), app: Arc::new(Mutex::new(None)) }
    }
    pub fn set_app_handle(&self, app: tauri::AppHandle) -> Result<(), String> {
        *self.app.lock().map_err(|e| e.to_string())? = Some(app);
        Ok(())
    }
    pub fn is_running(&self) -> bool { self.is_running.load(Ordering::SeqCst) }
    pub fn start(&self) {
        if self.is_running.swap(true, Ordering::SeqCst) { return; }
        let scheduler = self.clone();
        let result = std::thread::Builder::new().name("friday-scheduler".into()).spawn(move || {
            let rt = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
                Ok(rt) => rt,
                Err(error) => { tracing::error!("Scheduler runtime unavailable: {error}"); scheduler.stop(); return; }
            };
            rt.block_on(async {
                while scheduler.is_running() {
                    if let Err(error) = scheduler.tick().await { tracing::error!("Scheduler check failed: {error}"); }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            });
        });
        if let Err(error) = result { tracing::error!("Scheduler thread unavailable: {error}"); self.stop(); }
    }
    pub fn stop(&self) { self.is_running.store(false, Ordering::SeqCst); }
    async fn tick(&self) -> Result<(), String> {
        let automations = self.db.lock().map_err(|e| e.to_string())?.get_automations().map_err(|e| e.to_string())?;
        for auto in automations {
            if !auto.enabled || !["cron","reminder"].contains(&auto.trigger_type.as_str()) { continue; }
            if auto.next_run.is_some_and(|due|due<=now()) {if let Err(error)=self.execute(auto,true).await {tracing::warn!("Scheduled action failed: {error}");}continue;}
            let next = match next_for(&auto).and_then(|next| validate_action(&auto.action_tool, &auto.action_args).map(|_| next)) {
                Ok(next) => next,
                Err(error) => {
                    self.db.lock().map_err(|e| e.to_string())?.set_automation_enabled(&auto.id, false, None).map_err(|e| e.to_string())?;
                    tracing::warn!("Automation {} disabled: {error}", auto.id);
                    continue;
                }
            };
            if let Some(next)=next.filter(|_|auto.next_run.is_none()) {
                self.db.lock().map_err(|e| e.to_string())?.initialize_automation_schedule(&auto.id, next).map_err(|e| e.to_string())?;
            } else if auto.next_run.is_some_and(|due| due <= now()) {
                if let Err(error) = self.execute(auto, true).await { tracing::warn!("Scheduled action failed: {error}"); }
            }
        }
        Ok(())
    }
    pub fn create(&self, name: String, expr: String, tool: String, args: String) -> Result<DbAutomation, String> {
        if name.trim().is_empty() || name.len() > 160 { return Err("Enter a name of at most 160 characters.".into()); }
        validate_action(&tool, &args)?;
        let auto = DbAutomation {
            id: uuid::Uuid::now_v7().to_string(), name: name.trim().into(), trigger_type: "cron".into(),
            trigger_expr: expr.trim().into(), action_tool: tool, action_args: args, enabled: true,
            last_run: None, next_run: Some(next_run(&expr)?), last_result: None,
            timezone:"UTC".into(),schedule:None,
        };
        self.db.lock().map_err(|e| e.to_string())?.insert_automation(&auto).map_err(|e| e.to_string())?;
        Ok(auto)
    }
    pub fn toggle(&self, id: &str) -> Result<bool, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        let auto = db.get_automations().map_err(|e| e.to_string())?.into_iter().find(|auto| auto.id == id).ok_or("Automation not found")?;
        let enabled = !auto.enabled;
        let next = if enabled { validate_action(&auto.action_tool, &auto.action_args)?; next_for(&auto)? } else { None };
        db.set_automation_enabled(id, enabled, next).map_err(|e| e.to_string())
    }
    pub fn save_reminder(&self,id:Option<String>,name:String,schedule:ReminderSchedule,timezone:Option<String>,tool:String,args:String)->Result<DbAutomation,String> {
        if name.trim().is_empty() || name.len()>160 {return Err("Enter a name of at most 160 characters".into());}
        validate_action(&tool,&args)?;
        let db=self.db.lock().map_err(|e|e.to_string())?;
        let existing=if let Some(id)=&id {Some(db.get_automations().map_err(|e|e.to_string())?.into_iter().find(|auto|auto.id==*id).ok_or("Reminder no longer exists")?)} else {None};
        if existing.as_ref().is_some_and(|auto|auto.last_result.as_deref()==Some("Running")) {return Err("Wait for the current reminder attempt to finish before editing".into());}
        let timezone=timezone.or_else(||existing.as_ref().map(|auto|auto.timezone.clone())).unwrap_or_else(||"Africa/Algiers".into());
        schedules::validate_new_occurrence(&schedule,&timezone)?;
        let next=next_occurrence(&schedule,&timezone,now())?;
        let record=DbAutomation {id:id.unwrap_or_else(||uuid::Uuid::now_v7().to_string()),name:name.trim().into(),trigger_type:"reminder".into(),trigger_expr:format!("{} at {}",schedule.kind,schedule.time),action_tool:tool,action_args:args,enabled:existing.as_ref().is_none_or(|auto|auto.enabled),last_run:existing.as_ref().and_then(|auto|auto.last_run),next_run:if existing.as_ref().is_none_or(|auto|auto.enabled) {Some(next)} else {None},last_result:existing.and_then(|auto|auto.last_result),timezone,schedule:Some(serde_json::to_value(schedule).map_err(|e|e.to_string())?)};
        db.insert_automation(&record).map_err(|e|e.to_string())?;Ok(record)
    }
    pub async fn trigger_now(&self, id: &str) -> Result<String, String> {
        let auto = self.db.lock().map_err(|e| e.to_string())?.get_automations().map_err(|e| e.to_string())?
            .into_iter().find(|auto| auto.id == id).ok_or("Automation not found")?;
        self.execute(auto, false).await
    }
    async fn execute(&self, auto: DbAutomation, scheduled: bool) -> Result<String, String> {
        let args = validate_action(&auto.action_tool, &auto.action_args)?;
        {
            let mut active = self.active.lock().map_err(|e| e.to_string())?;
            if !active.insert(auto.id.clone()) { return Err("This automation is already running.".into()); }
        }
        let _run = ActiveRun { active: self.active.clone(), id: auto.id.clone() };
        let once=auto.schedule.as_ref().is_some_and(|schedule|schedule["kind"]=="once");
        let next=if once {None} else {next_for(&auto)?};
        let attempt=self.db.lock().map_err(|e|e.to_string())?.claim_reminder(&auto.id,next,scheduled,now()).map_err(|e|e.to_string())?.ok_or("The automation was disabled, deleted or already claimed")?;
        let start = Instant::now();
        let result = if auto.action_tool == "notify.toast" {
            let app = self.app.lock().map_err(|e| e.to_string())?.clone();
            match app {
                Some(app) => app.notification().builder().title(&auto.name).body(args["message"].as_str().unwrap_or("")).show()
                    .map(|_| "Reminder sent".to_string()).map_err(|e| e.to_string()),
                None => Err("Desktop notifications are unavailable.".into()),
            }
        } else {
            self.tools.invoke(&auto.action_tool, args).await.and_then(|result| {
                if !result.allowed { Err("The action was denied.".into()) }
                else { Ok(result.output.to_string()) }
            })
        };
        let outcome = match &result { Ok(output) => format!("Completed: {output}"), Err(error) => format!("Failed: {error}") };
        let audit = DbAuditEntry {
            id: uuid::Uuid::now_v7().to_string(), tool_name: auto.action_tool, args_hash: format!("{:x}", audit_hash(&auto.action_args)),
            tier: "Green".into(), decision: if result.is_ok() { "automation_completed" } else { "automation_failed" }.into(),
            duration_ms: start.elapsed().as_millis() as i64, created_at: now(),
        };
        self.db.lock().map_err(|e| e.to_string())?.finish_reminder(&auto.id,&attempt, now(), &outcome, &audit,once)
            .map_err(|e| format!("Action finished, but its history could not be saved: {e}"))?;
        result
    }
}

fn audit_hash(s: &str) -> u64 {
    s.bytes().fold(14695981039346656037, |hash, byte| (hash ^ byte as u64).wrapping_mul(1099511628211))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn scheduler() -> SchedulerManager {
        SchedulerManager::new(Arc::new(Mutex::new(Database::open_in_memory().expect("test DB"))), Arc::new(ToolRegistry::new()))
    }
    #[test]
    fn validates_cron_and_does_not_run_on_creation() {
        let scheduler = scheduler();
        assert!(next_run("bad cron").is_err());
        let auto = scheduler.create("System check".into(), "0 9 * * 1-5".into(), "system.info".into(), "{}".into()).expect("valid job");
        assert!(auto.next_run.is_some_and(|next| next > now()));
        assert!(auto.last_run.is_none());
    }
    #[tokio::test]
    async fn records_manual_result_and_pause() {
        let scheduler = scheduler();
        let auto = scheduler.create("Windows".into(), "0 9 * * *".into(), "window.list".into(), "{}".into()).expect("valid job");
        scheduler.trigger_now(&auto.id).await.expect("read windows");
        let saved = scheduler.db.lock().expect("DB lock").get_automations().expect("saved jobs").pop().expect("one job");
        assert!(saved.last_result.is_some_and(|result| result.starts_with("Completed:")));
        assert!(!scheduler.toggle(&auto.id).expect("pause"));
        let saved = scheduler.db.lock().expect("DB lock").get_automations().expect("saved jobs").pop().expect("one job");
        assert!(!saved.enabled);
        assert!(saved.next_run.is_none());
    }
    #[test]
    fn refuses_interactive_actions_and_invalid_arguments() {
        assert!(validate_action("shell.run", "{}").is_err());
        assert!(validate_action("fs.write", "{}").is_err());
        assert!(validate_action("notify.toast", "{}").is_err());
        assert!(validate_action("system.info", "[]").is_err());
    }
}
