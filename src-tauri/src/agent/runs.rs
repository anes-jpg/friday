//! Run lifetime belongs to AgentCore. Task-local context reaches every native tool
//! without consulting mutable UI selection or introducing another orchestrator.
use super::{AgentCore, PendingPlan, PlanStep, TurnResult};
use crate::memory::db::Database;
use crate::memory::runs::{now_ms, RunRecord, RunStatus};
use crate::providers::{glm::GlmProvider, router::AiRouter};
use crate::tools::{RiskTier, ToolDefinition, ToolExecutionResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};
use tauri::Emitter;
use tokio::sync::Notify;

#[derive(Clone, Default, Debug, Serialize, Deserialize)]
pub struct RequestContext {
    pub request_id: Option<String>,
    pub thread_id: Option<String>,
    pub project_id: Option<String>,
    pub provider_profile_id: Option<String>,
    #[serde(default)] pub source_ids: Vec<String>,
    pub task_id: Option<String>,
    pub routine_id: Option<String>,
    pub tool_call: Option<Value>,
}

#[derive(Clone)]
pub struct StagedAction { pub id: String, pub definition: ToolDefinition, pub args: Value }
#[derive(Default)]
pub struct RoutineProgress { pub next_step: usize, pub results: Vec<Value> }
pub struct RunContext {
    pub run: RunRecord,
    pub db: Arc<Mutex<Database>>,
    pub provider: GlmProvider,
    pub router: AiRouter,
    pub project_root: Option<std::path::PathBuf>,
    pub sources: Vec<Value>,
    pub project: Option<Value>,
    pub task: Option<Value>,
    pub routine: Option<crate::daily_work::Routine>,
    pub routine_progress: Mutex<RoutineProgress>,
    pub write_preimages: Mutex<std::collections::HashMap<String,Option<Vec<u8>>>>,
    pub cancelled: AtomicBool,
    pub cancel_signal: Notify,
    pub approval_signal: Notify,
    pub staged: Mutex<Vec<StagedAction>>,
    pub authorized: Mutex<Vec<StagedAction>>,
    pub app: Option<tauri::AppHandle>,
}

tokio::task_local! { pub static CURRENT_RUN: Arc<RunContext>; }
pub fn current() -> Option<Arc<RunContext>> { CURRENT_RUN.try_with(Arc::clone).ok() }
pub fn captured_thread(db: &Database) -> String {
    current().map(|c|c.run.thread_id.clone()).unwrap_or_else(|| db.get_active_thread_id().unwrap_or_else(|_|"thread-1".into()))
}

impl RunContext {
    pub fn check(&self) -> Result<(),String> {
        if self.cancelled.load(Ordering::Acquire) { Err("Run cancelled; no more tools or response updates are accepted".into()) } else { Ok(()) }
    }
    pub fn event(&self, step: Option<&str>, status: RunStatus, detail: Value) -> Result<(),String> {
        self.check()?;
        let event=self.db.lock().map_err(|e|e.to_string())?.run_event(&self.run.id,step,status,detail).map_err(|e|e.to_string())?;
        if let Some(app)=&self.app { let _=app.emit("run-event",&event); }
        Ok(())
    }
    pub fn before_tool(&self, definition: &ToolDefinition, args: &Value) -> Result<String,String> {
        self.check()?;
        crate::tools::validate_tool_args(&definition.schema,args).map_err(|e|e.to_string())?;
        let authorized={
            let mut approved=self.authorized.lock().map_err(|e|e.to_string())?;
            approved.iter().position(|a|a.definition.name==definition.name && a.args==*args).map(|i|approved.remove(i))
        };
        let id=if let Some(action)=authorized { action.id } else {
            let id=self.db.lock().map_err(|e|e.to_string())?.plan_action(&self.run.id,&definition.name,args,&format!("{:?}",definition.tier)).map_err(|e|e.to_string())?;
            if definition.tier!=RiskTier::Green {
                self.staged.lock().map_err(|e|e.to_string())?.push(StagedAction {id,definition:definition.clone(),args:args.clone()});
                self.approval_signal.notify_one();
                return Err("Interactive approval required; tool has not run".into());
            }
            id
        };
        self.check()?;
        self.db.lock().map_err(|e|e.to_string())?.action_status(&id,"running",None).map_err(|e|e.to_string())?;
        self.event(Some(&id),RunStatus::Running,json!({"tool":definition.name,"message":definition.description}))?;
        Ok(id)
    }
    pub fn after_tool(&self,id:&str,result:&Result<ToolExecutionResult,String>) -> Result<(),String> {
        self.check()?;
        let (status,outcome)=match result { Ok(r)=>("completed",r.output.clone()),Err(e)=>("failed",json!({"error":e})) };
        self.db.lock().map_err(|e|e.to_string())?.action_status(id,status,Some(&outcome)).map_err(|e|e.to_string())?;
        self.event(Some(id),RunStatus::Running,json!({"outcome":status,"result":outcome}))
    }
}

impl AgentCore {
    pub async fn confirm_plan_explicit(&self,id:&str,explicit_red:bool)->Result<(PendingPlan,Vec<ToolExecutionResult>),String> {
        let (run_id,value)=self.db.lock().map_err(|e|e.to_string())?.approval_plan(id).map_err(|e|e.to_string())?.ok_or("Plan not found")?;
        let mut plan:PendingPlan=serde_json::from_value(value.clone()).map_err(|e|e.to_string())?;
        let context=self.runs.lock().map_err(|e|e.to_string())?.get(&run_id).cloned().ok_or("Execution was interrupted; reconcile before creating a new plan")?;
        context.check()?;
        let pending=plan.pending_tools.clone().filter(|tools|!tools.is_empty()).ok_or("Plan has no executable actions")?;
        let current_plan=self.pending_plans.lock().map_err(|e|e.to_string())?.iter().find(|p|p.id==id).cloned().ok_or("Plan no longer active")?;
        if serde_json::to_value(current_plan).map_err(|e|e.to_string())?!=value {return Err("Plan changed; review a new preview".into());}
        let mut actions=vec![];
        for call in &pending {
            let name=call["function"]["name"].as_str().ok_or("Invalid planned tool")?;
            let definition=self.tools.get(name).ok_or("Tool no longer available")?.clone();
            let raw=&call["function"]["arguments"];
            let args=if let Some(raw)=raw.as_str() {serde_json::from_str(raw).map_err(|e|e.to_string())?} else {raw.clone()};
            crate::tools::validate_tool_args(&definition.schema,&args).map_err(|e|e.to_string())?;
            if definition.tier==RiskTier::Red && plan.tier!=RiskTier::Red {return Err("Risk tier changed; review a new Red preview".into());}
            let action_id=if let Some(staged)=context.staged.lock().map_err(|e|e.to_string())?.iter().find(|a|a.definition.name==definition.name && a.args==args) {staged.id.clone()} else {
                self.db.lock().map_err(|e|e.to_string())?.plan_action(&run_id,&definition.name,&args,&format!("{:?}",definition.tier)).map_err(|e|e.to_string())?
            };
            actions.push(StagedAction {id:action_id,definition,args});
        }
        for action in &actions {
            if action.definition.name=="fs.write" {
                let raw=action.args["path"].as_str().ok_or("Missing write path")?;
                let path=planned_path(&context,raw);
                let actual=if path.exists() {Some(std::fs::read(&path).map_err(|e|e.to_string())?)} else {None};
                if context.write_preimages.lock().map_err(|e|e.to_string())?.get(raw).is_some_and(|expected|expected!=&actual) {return Err("The file changed after the preview. Prepare a new diff before confirming.".into());}
            }
        }
        self.db.lock().map_err(|e|e.to_string())?.consume_approval(id,&value,explicit_red).map_err(|e|e.to_string())?;
        *context.authorized.lock().map_err(|e|e.to_string())?=actions.clone();
        context.event(None,RunStatus::Running,json!({"message":"Confirmation accepted","plan_id":id}))?;
        plan.status="executing".into();
        let executed=CURRENT_RUN.scope(context.clone(),async {
            let mut results=vec![];
            for action in actions {
                context.check()?;
                let result=tokio::select! {biased;_=context.cancel_signal.notified()=>Err("Run cancelled".into()),result=self.tools.invoke(&action.definition.name,action.args)=>result};
                results.push(result?);
            }
            Ok::<_,String>(results)
        }).await;
        context.check()?;
        let results=match executed {
            Ok(results)=>results,
            Err(error)=>{plan.status="failed".into();plan.result_summary=Some(error.clone());context.event(None,RunStatus::Failed,json!({"error":error}))?;self.runs.lock().map_err(|e|e.to_string())?.remove(&run_id);return Err(error);}
        };
        plan.status="done".into();plan.current_step_index=plan.steps.len();for step in &mut plan.steps {step.completed=true;}
        plan.result_summary=Some(super::synthesize_operator_turn(&plan.heard,&results).1);
        plan.undoable=self.db.lock().map_err(|e|e.to_string())?.valid_inverse(&run_id)?.is_some();
        if let Some(stored)=self.pending_plans.lock().map_err(|e|e.to_string())?.iter_mut().find(|p|p.id==id) {*stored=plan.clone();}
        if context.routine.is_some() {
            context.staged.lock().map_err(|e|e.to_string())?.clear();
            {
                let mut progress=context.routine_progress.lock().map_err(|e|e.to_string())?;
                let step=progress.next_step;
                progress.results.push(json!({"step":step,"tools":results}));
                progress.next_step+=1;
            }
            let continued=CURRENT_RUN.scope(context.clone(),self.execute_routine(context.clone())).await;
            let response=self.finish_request(context.clone(),continued,&context.run.utterance)?;
            if let Some(next)=response.pending_plan {return Ok((next,results));}
            plan.result_summary=Some(response.show);
        } else {
            context.staged.lock().map_err(|e|e.to_string())?.clear();
            let (say,show)=super::synthesize_operator_turn(&plan.heard,&results);
            let response=self.finish_request(context.clone(),Ok(TurnResult {run_id:Some(run_id.clone()),say,show,pending_plan:None,tool_calls:results.clone(),latency_ms:0,ttft_ms:0,tokens:0}),&plan.heard)?;
            plan.result_summary=Some(response.show);
        }
        Ok((plan,results))
    }

    pub async fn execute_request(&self,utterance:&str,mode:&str,mut request:RequestContext) -> Result<TurnResult,String> {
        let started=std::time::Instant::now();
        let confirmation=utterance.trim().to_lowercase();
        if ["go ahead","confirm"].contains(&confirmation.as_str()) {
            let thread={let db=self.db.lock().map_err(|e|e.to_string())?;request.thread_id.clone().unwrap_or_else(||captured_thread(&db))};
            let plan=self.pending_plans.lock().map_err(|e|e.to_string())?.iter().rev().find(|plan|plan.status=="awaiting_confirm" && plan.run_id.as_ref().is_some_and(|id|self.runs.lock().is_ok_and(|runs|runs.get(id).is_some_and(|run|run.run.thread_id==thread)))).cloned().ok_or("No active plan awaits confirmation in this conversation")?;
            let (plan,results)=self.confirm_plan_explicit(&plan.id,confirmation=="confirm").await?;
            let (say,show)=super::synthesize_operator_turn(&plan.heard,&results);
            return Ok(TurnResult {run_id:plan.run_id.clone(),say:crate::voice::normalize_for_speech(&say),show:plan.diff.clone().filter(|_|plan.status=="awaiting_confirm").or_else(||plan.result_summary.clone()).unwrap_or(show),pending_plan:if plan.status=="awaiting_confirm" {Some(plan)} else {None},tool_calls:results,latency_ms:started.elapsed().as_millis() as u64,ttft_ms:0,tokens:0});
        }
        let routine=if let Some(id)=&request.routine_id {
            let snapshot=self.db.lock().map_err(|e|e.to_string())?.workspace_snapshot().map_err(|e|e.to_string())?;
            let value=snapshot.routines.iter().find(|record|record["id"].as_str()==Some(id)).ok_or("Routine no longer exists")?;
            let routine:crate::daily_work::Routine=serde_json::from_value(value.clone()).map_err(|e|e.to_string())?;
            if request.project_id.is_some() && request.project_id!=routine.project_id {return Err("Routine belongs to another project".into());}
            request.project_id=routine.project_id.clone();
            Some(routine)
        } else if let Some(call)=&request.tool_call {
            let name=call["name"].as_str().ok_or("Missing action name")?;
            let definition=self.tools.get(name).ok_or("Action is unavailable")?;
            crate::tools::validate_tool_args(&definition.schema,&call["args"]).map_err(|e|e.to_string())?;
            Some(crate::daily_work::Routine {id:uuid::Uuid::now_v7().to_string(),name:definition.description.clone(),project_id:request.project_id.clone(),steps:vec![crate::daily_work::RoutineStep::Tool {tool:name.into(),args:call["args"].clone()}],source_ids:request.source_ids.clone(),pinned:false,updated_at:chrono::Utc::now().to_rfc3339()})
        } else {None};
        let provider=self.glm.lock().map_err(|e|e.to_string())?.clone();
        let mut router=self.router.lock().map_err(|e|e.to_string())?.clone();
        if let Some(id)=request.provider_profile_id.as_deref() {
            router.set_active_model(id)?;
            // Explicit selection is pinned for this run; unrelated profiles cannot
            // silently replace it on a disconnect.
            router.models.retain(|model|model.id==id);
        }
        let provider_profile_id=request.provider_profile_id.clone().or_else(||router.get_active_model().map(|m|m.id.clone()));
        let (run,root,sources,project,task)={
            let db=self.db.lock().map_err(|e|e.to_string())?;
            let thread=request.thread_id.clone().unwrap_or_else(||captured_thread(&db));
            db.ensure_thread_exists(&thread,"New conversation").map_err(|e|e.to_string())?;
            let snapshot=db.workspace_snapshot().map_err(|e|e.to_string())?;
            let sources=crate::daily_work::resolve_sources(&snapshot,&request.source_ids)?;
            let project=request.project_id.as_ref().and_then(|id|snapshot.projects.iter().find(|p|p["id"].as_str()==Some(id))).cloned();
            let task=if let Some(id)=&request.task_id {let task=snapshot.items.iter().find(|t|t["id"].as_str()==Some(id) && t["type"]=="task").ok_or("Selected task no longer exists")?; if task["projectId"].as_str().filter(|id|!id.is_empty())!=request.project_id.as_deref() {return Err("Selected task belongs to another project".into());} Some(task.clone())} else {None};
            let root=if let Some(id)=&request.project_id {
                let project=snapshot.projects.iter().find(|p|p["id"].as_str()==Some(id)).ok_or("Project no longer exists")?;
                project["rootPath"].as_str().filter(|p|!p.is_empty()).map(std::path::PathBuf::from)
            } else {None};
            let run=RunRecord { id:uuid::Uuid::now_v7().to_string(),request_id:request.request_id,thread_id:thread,project_id:request.project_id,provider_profile_id,utterance:utterance.into(),status:"queued".into(),created_at:now_ms(),updated_at:now_ms() };
            db.create_run(&run).map_err(|e|e.to_string())?;
            db.insert_message(&crate::memory::db::DbMessage {id:format!("msg-{}-user",run.id),thread_id:run.thread_id.clone(),role:"user".into(),say:Some(utterance.into()),show:None,latency_ms:None,created_at:now_ms()/1000}).map_err(|e|e.to_string())?;
            (run,root,sources,project,task)
        };
        let context=Arc::new(RunContext {run,db:self.db.clone(),provider,router,project_root:root,sources,project,task,routine,routine_progress:Mutex::new(RoutineProgress::default()),write_preimages:Mutex::new(std::collections::HashMap::new()),cancelled:AtomicBool::new(false),cancel_signal:Notify::new(),approval_signal:Notify::new(),staged:Mutex::new(vec![]),authorized:Mutex::new(vec![]),app:self.app.lock().map_err(|e|e.to_string())?.clone()});
        self.runs.lock().map_err(|e|e.to_string())?.insert(context.run.id.clone(),context.clone());
        context.event(None,RunStatus::Queued,json!({"heard":utterance,"request_id":context.run.request_id,"thread_id":context.run.thread_id,"project_id":context.run.project_id,"provider_profile_id":context.run.provider_profile_id,"sources":context.sources,"task":context.task,"project":context.project,"routine_id":request.routine_id}))?;
        context.event(None,RunStatus::Running,json!({"message":"Understanding request"}))?;
        let result=CURRENT_RUN.scope(context.clone(),async {
            if context.routine.is_some() {return self.execute_routine(context.clone()).await;}
            tokio::select! {
                biased;
                _=context.cancel_signal.notified()=>Err("Run cancelled".into()),
                _=context.approval_signal.notified()=>Ok(TurnResult {run_id:None,say:String::new(),show:String::new(),pending_plan:None,tool_calls:vec![],latency_ms:started.elapsed().as_millis() as u64,ttft_ms:0,tokens:0}),
                result=self.execute_turn_inner(utterance,mode)=>result,
            }
        }).await;
        context.check()?;
        self.finish_request(context,result,utterance)
    }

    fn finish_request(&self,context:Arc<RunContext>,result:Result<TurnResult,String>,utterance:&str)->Result<TurnResult,String> {
        match result {
            Ok(mut result)=>{
                result.run_id=Some(context.run.id.clone());
                result.say=crate::voice::normalize_for_speech(&result.say);
                let staged=context.staged.lock().map_err(|e|e.to_string())?.clone();
                if !staged.is_empty() {
                    let tier=if staged.iter().any(|a|a.definition.tier==RiskTier::Red) {RiskTier::Red} else {RiskTier::Amber};
                    let plan=PendingPlan {id:uuid::Uuid::now_v7().to_string(),run_id:Some(context.run.id.clone()),expires_at:if tier==RiskTier::Amber {Some(now_ms()+8000)} else {None},heard:utterance.into(),steps:staged.iter().map(|a|PlanStep {description:a.definition.description.clone(),tier:a.definition.tier,completed:false}).collect(),current_step_index:0,diff:Some(serde_json::to_string_pretty(&staged.iter().map(|a|json!({"tool":a.definition.name,"arguments":a.args})).collect::<Vec<_>>()).map_err(|e|e.to_string())?),filename:None,tier,status:"awaiting_confirm".into(),result_summary:Some("Preview only; nothing has executed.".into()),undoable:false,pending_tools:Some(staged.iter().map(|a|json!({"id":a.id,"function":{"name":a.definition.name,"arguments":a.args}})).collect())};
                    result.say=if tier==RiskTier::Amber {"Review the preview and say go ahead within eight seconds.".into()} else {"Review the full details and say confirm to continue.".into()};
                    result.show=plan.diff.clone().unwrap_or_default();result.pending_plan=Some(plan);
                }
                {
                    let db=self.db.lock().map_err(|e|e.to_string())?;
                    db.conn.execute("INSERT INTO messages(id,thread_id,role,say,show,latency_ms,created_at) VALUES(?1,?2,'assistant',?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET say=excluded.say,show=excluded.show,latency_ms=excluded.latency_ms",rusqlite::params![format!("msg-{}-assistant",context.run.id),context.run.thread_id,result.say,result.show,result.latency_ms,now_ms()/1000]).map_err(|e|e.to_string())?;
                }
                if let Some(plan)=&mut result.pending_plan {
                    plan.run_id=Some(context.run.id.clone());plan.undoable=false;
                    if let Some(calls)=&plan.pending_tools {plan.diff=Some(action_preview(&context,calls)?);result.show=plan.diff.clone().unwrap_or_default();}
                    let value=serde_json::to_value(&*plan).map_err(|e|e.to_string())?;
                    self.db.lock().map_err(|e|e.to_string())?.save_approval(&plan.id,&context.run.id,&value,&format!("{:?}",plan.tier)).map_err(|e|e.to_string())?;
                    self.pending_plans.lock().map_err(|e|e.to_string())?.retain(|p|p.id!=plan.id);
                    self.pending_plans.lock().map_err(|e|e.to_string())?.push(plan.clone());
                    context.event(None,RunStatus::AwaitingConfirmation,json!({"plan":plan}))?;
                    if plan.tier==RiskTier::Amber {
                        let context=context.clone();let id=plan.id.clone();let runs=self.runs.clone();
                        tokio::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_secs(8)).await;
                            let expired=context.db.lock().ok().and_then(|db|db.expire_approval(&id).ok()).flatten();
                            if let Some(mut event)=expired {
                                context.cancelled.store(true,Ordering::Release);context.cancel_signal.notify_one();
                                event.detail=json!({"message":"Preview expired after eight seconds; nothing was executed","plan_id":id});
                                if let Some(app)=&context.app {let _=app.emit("run-event",event);}
                                if let Ok(mut runs)=runs.lock() {runs.remove(&context.run.id);}
                            }
                        });
                    }
                } else {
                    context.event(None,RunStatus::Completed,json!({"say":result.say,"show":result.show,"latency_ms":result.latency_ms}))?;
                    self.runs.lock().map_err(|e|e.to_string())?.remove(&context.run.id);
                }

                Ok(result)
            },
            Err(error)=>{let completed=context.routine_progress.lock().map_err(|e|e.to_string())?.results.clone();context.event(None,RunStatus::Failed,json!({"error":error,"completed_steps":completed}))?;self.runs.lock().map_err(|e|e.to_string())?.remove(&context.run.id);Err(error)}
        }
    }

    pub fn cancel_run(&self,id:&str)->Result<(),String> {
        let context=self.runs.lock().map_err(|e|e.to_string())?.get(id).cloned().ok_or("Run has already ended")?;
        context.cancelled.store(true,Ordering::Release);
        context.cancel_signal.notify_one();
        let event=self.db.lock().map_err(|e|e.to_string())?.cancel_run_records(id).map_err(|e|e.to_string())?;
        if let Some(app)=&context.app {let _=app.emit("run-event",event);}
        for plan in self.pending_plans.lock().map_err(|e|e.to_string())?.iter_mut().filter(|p|p.run_id.as_deref()==Some(id)) {plan.status="cancelled".into();plan.undoable=false;}
        self.phrase_bank.barge_in();
        self.runs.lock().map_err(|e|e.to_string())?.remove(id);
        Ok(())
    }
}

fn empty_turn() -> TurnResult {
    TurnResult {run_id:None,say:String::new(),show:String::new(),pending_plan:None,tool_calls:vec![],latency_ms:0,ttft_ms:0,tokens:0}
}
fn planned_path(context:&RunContext,raw:&str)->std::path::PathBuf {
    let path=std::path::Path::new(raw);
    if path.is_relative() && !raw.starts_with('~') && !raw.starts_with('%') {
        if let Some(root)=&context.project_root {return root.join(path);}
    }
    crate::tools::resolve_user_path(raw)
}
fn action_preview(context:&RunContext,calls:&[Value])->Result<String,String> {
    let mut details=vec![];
    for call in calls {
        let name=call["function"]["name"].as_str().ok_or("Missing preview tool")?;
        let raw=&call["function"]["arguments"];
        let args:Value=if let Some(raw)=raw.as_str() {serde_json::from_str(raw).map_err(|e|e.to_string())?} else {raw.clone()};
        if name=="fs.write" || name=="fs_write" {
            let raw_path=args["path"].as_str().ok_or("Missing write path")?;
            let path=planned_path(context,raw_path);
            if path.exists() && std::fs::metadata(&path).map_err(|e|e.to_string())?.len()>16*1024*1024 {return Err("File exceeds the diff and undo limit".into());}
            let before=if path.exists() {Some(std::fs::read(&path).map_err(|e|e.to_string())?)} else {None};
            let old=before.as_ref().map(|bytes|String::from_utf8(bytes.clone())).transpose().map_err(|_|"Cannot propose a text edit to a binary file")?.unwrap_or_default();
            let new=args["content"].as_str().ok_or("Missing file content")?;
            let diff=format!("--- {}\n+++ {}\n@@ -1,{} +1,{} @@\n{}{}",path.display(),path.display(),old.lines().count(),new.lines().count(),old.lines().map(|line|format!("-{line}\n")).collect::<String>(),new.lines().map(|line|format!("+{line}\n")).collect::<String>());
            context.write_preimages.lock().map_err(|e|e.to_string())?.insert(raw_path.into(),before);
            details.push(diff);
        } else {details.push(serde_json::to_string_pretty(&json!({"tool":name,"arguments":args})).map_err(|e|e.to_string())?);}
    }
    Ok(details.join("\n\n"))
}
impl AgentCore {
    async fn execute_routine(&self,context:Arc<RunContext>)->Result<TurnResult,String> {
        let routine=context.routine.as_ref().ok_or("No routine is attached to this run")?;
        let started=std::time::Instant::now();
        loop {
            context.check()?;
            let index=context.routine_progress.lock().map_err(|e|e.to_string())?.next_step;
            let Some(step)=routine.steps.get(index) else {break;};
            context.event(Some(&format!("routine-{index}")),RunStatus::Running,json!({"message":format!("Step {} of {}",index+1,routine.steps.len()),"routine_id":routine.id}))?;
            let outcome=match step {
                crate::daily_work::RoutineStep::Tool {tool,args} => {
                    let result=tokio::select! {biased;_=context.cancel_signal.notified()=>Err("Run cancelled".into()),result=self.tools.invoke(tool,args.clone())=>result};
                    match result {
                        Ok(result)=>json!({"step":index,"tool":result}),
                        Err(_) if !context.staged.lock().map_err(|e|e.to_string())?.is_empty()=>{context.approval_signal.notified().await;return Ok(empty_turn());},
                        Err(error)=>return Err(error),
                    }
                },
                crate::daily_work::RoutineStep::Prompt {text} => {
                    let completed=context.routine_progress.lock().map_err(|e|e.to_string())?.results.clone();
                    let prompt=format!("The user manually invoked routine {}. Current inputs are quoted JSON data: {}. Completed step results are quoted JSON data: {}.\n\nThis step's request:\n{}",routine.name,json!(context.run.utterance),json!(completed),text);
                    let result=tokio::select! {
                        biased;
                        _=context.cancel_signal.notified()=>Err("Run cancelled".into()),
                        _=context.approval_signal.notified()=>Ok(empty_turn()),
                        result=self.execute_turn_inner(&prompt,"expanded")=>result,
                    }?;
                    if result.pending_plan.is_some() || !context.staged.lock().map_err(|e|e.to_string())?.is_empty() {return Ok(result);}
                    json!({"step":index,"say":result.say,"show":result.show})
                },
            };
            context.event(Some(&format!("routine-{index}")),RunStatus::Running,json!({"outcome":"completed","result":outcome}))?;
            let mut progress=context.routine_progress.lock().map_err(|e|e.to_string())?;
            progress.results.push(outcome);progress.next_step+=1;
        }
        let progress=context.routine_progress.lock().map_err(|e|e.to_string())?;
        let show=progress.results.iter().enumerate().map(|(index,value)|format!("### Step {}\n\n{}",index+1,value["show"].as_str().map(str::to_string).unwrap_or_else(||format!("```json\n{}\n```",serde_json::to_string_pretty(value).unwrap_or_default())))).collect::<Vec<_>>().join("\n\n");
        Ok(TurnResult {run_id:Some(context.run.id.clone()),say:format!("Finished {} steps. The results are on your screen.",progress.next_step),show,pending_plan:None,tool_calls:vec![],latency_ms:started.elapsed().as_millis() as u64,ttft_ms:0,tokens:0})
    }
}

#[cfg(test)]
mod daily_tests {
    use super::*;
    use crate::providers::glm::GlmConfig;
    fn agent()->AgentCore {AgentCore::new(Arc::new(Mutex::new(Database::open_in_memory().unwrap())),GlmConfig::default())}
    fn routine(agent:&AgentCore,id:&str,steps:Value) {
        agent.db.lock().unwrap().workspace_save("routine",&json!({"id":id,"name":"Daily test routine","steps":steps,"updatedAt":"2026-10-28T12:00:00Z"})).unwrap();
    }
    #[tokio::test]
    async fn daily_routine_pauses_at_each_confirmation_and_cancellation_stops_remaining_steps() {
        let agent=agent();
        routine(&agent,"r",json!([{"kind":"tool","tool":"shell.run","args":{"binary":"git","args":["--version"]}},{"kind":"tool","tool":"shell.run","args":{"binary":"git","args":["--version"]}}]));
        let response=agent.execute_request("Run daily routine","command",RequestContext {routine_id:Some("r".into()),..Default::default()}).await.unwrap();
        let first=response.pending_plan.unwrap();assert_eq!(first.tier,RiskTier::Red);
        assert!(agent.confirm_plan_explicit(&first.id,false).await.is_err());
        let (second,results)=agent.confirm_plan_explicit(&first.id,true).await.unwrap();
        assert_eq!(results[0].output["exit_code"],0);assert!(results[0].output["stdout"].as_str().unwrap().contains("git version"));
        assert_eq!(second.status,"awaiting_confirm");assert_ne!(first.id,second.id);
        let id=second.run_id.as_ref().unwrap();agent.cancel_run(id).unwrap();
        assert!(agent.confirm_plan_explicit(&second.id,true).await.is_err());
        let events=agent.db.lock().unwrap().run_events(id).unwrap();
        assert_eq!(events.last().unwrap().status,RunStatus::Cancelled);
        assert!(events.iter().any(|event|event.detail["result"]["exit_code"]==0));
    }
    #[tokio::test]
    async fn daily_routine_failure_retains_completed_steps_and_stops() {
        let agent=agent();
        routine(&agent,"r",json!([{"kind":"tool","tool":"text.process","args":{"action":"json_pretty","input":"{\"ready\":true}"}},{"kind":"tool","tool":"fs.read","args":{"path":"C:/friday-intentionally-missing-test-file.txt"}},{"kind":"tool","tool":"text.process","args":{"action":"uuid"}}]));
        assert!(agent.execute_request("Run failing routine","command",RequestContext {routine_id:Some("r".into()),..Default::default()}).await.is_err());
        let db=agent.db.lock().unwrap();let run=&db.run_history(None,None).unwrap()[0];
        assert_eq!(run.status,"failed");
        let events=db.run_events(&run.id).unwrap();assert_eq!(events.last().unwrap().detail["completed_steps"].as_array().unwrap().len(),1);
        assert!(!events.iter().any(|event|event.step.as_deref()==Some("routine-2")));
    }
    #[tokio::test]
    async fn daily_coding_diff_confirm_check_and_undo_on_scratch_repository() {
        let agent=agent();
        let root=std::env::temp_dir().join(format!("friday-coding-{}",uuid::Uuid::now_v7()));std::fs::create_dir(&root).unwrap();
        assert!(std::process::Command::new("git").args(["init","--quiet"]).arg(&root).output().unwrap().status.success());
        let path=root.join("sample.txt");std::fs::write(&path,"before\n").unwrap();
        agent.db.lock().unwrap().workspace_save("project",&json!({"id":"p","name":"Scratch","rootPath":root.to_string_lossy()})).unwrap();
        let request=RequestContext {project_id:Some("p".into()),tool_call:Some(json!({"name":"fs.write","args":{"path":"sample.txt","content":"after\n"}})),..Default::default()};
        let preview=agent.execute_request("Propose an edit","command",request).await.unwrap().pending_plan.unwrap();
        assert!(preview.diff.as_ref().unwrap().contains("-before"));assert!(preview.diff.as_ref().unwrap().contains("+after"));assert_eq!(std::fs::read_to_string(&path).unwrap(),"before\n");
        std::fs::write(&path,"changed since preview\n").unwrap();assert!(agent.confirm_plan_explicit(&preview.id,true).await.is_err());
        std::fs::write(&path,"before\n").unwrap();
        agent.confirm_plan_explicit(&preview.id,true).await.unwrap();assert_eq!(std::fs::read_to_string(&path).unwrap(),"after\n");
        let check=agent.execute_request("Run project check","command",RequestContext {project_id:Some("p".into()),tool_call:Some(json!({"name":"shell.run","args":{"binary":"git","args":["status","--porcelain"]}})),..Default::default()}).await.unwrap().pending_plan.unwrap();
        let (_,output)=agent.confirm_plan_explicit(&check.id,true).await.unwrap();assert_eq!(output[0].output["exit_code"],0);assert!(output[0].output["stdout"].as_str().unwrap().contains("sample.txt"));
        let receipt=agent.db.lock().unwrap().valid_inverse(preview.run_id.as_ref().unwrap()).unwrap().unwrap();agent.db.lock().unwrap().undo_receipt(Some(&receipt)).unwrap();assert_eq!(std::fs::read_to_string(&path).unwrap(),"before\n");
        // Leave the isolated repository for inspection; never touch the user's checkout.
    }
}
