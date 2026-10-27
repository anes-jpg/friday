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
}

#[derive(Clone)]
pub struct StagedAction { pub id: String, pub definition: ToolDefinition, pub args: Value }
pub struct RunContext {
    pub run: RunRecord,
    pub db: Arc<Mutex<Database>>,
    pub provider: GlmProvider,
    pub router: AiRouter,
    pub project_root: Option<std::path::PathBuf>,
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
        context.event(None,RunStatus::Completed,json!({"plan":plan,"results":results}))?;
        self.runs.lock().map_err(|e|e.to_string())?.remove(&run_id);
        Ok((plan,results))
    }

    pub async fn execute_request(&self,utterance:&str,mode:&str,request:RequestContext) -> Result<TurnResult,String> {
        let started=std::time::Instant::now();
        let confirmation=utterance.trim().to_lowercase();
        if ["go ahead","confirm"].contains(&confirmation.as_str()) {
            let thread={let db=self.db.lock().map_err(|e|e.to_string())?;request.thread_id.clone().unwrap_or_else(||captured_thread(&db))};
            let plan=self.pending_plans.lock().map_err(|e|e.to_string())?.iter().rev().find(|plan|plan.status=="awaiting_confirm" && plan.run_id.as_ref().is_some_and(|id|self.runs.lock().is_ok_and(|runs|runs.get(id).is_some_and(|run|run.run.thread_id==thread)))).cloned().ok_or("No active plan awaits confirmation in this conversation")?;
            let (plan,results)=self.confirm_plan_explicit(&plan.id,confirmation=="confirm").await?;
            let (say,show)=super::synthesize_operator_turn(&plan.heard,&results);
            return Ok(TurnResult {run_id:plan.run_id.clone(),say:crate::voice::normalize_for_speech(&say),show,pending_plan:None,tool_calls:results,latency_ms:started.elapsed().as_millis() as u64,ttft_ms:0,tokens:0});
        }
        let provider=self.glm.lock().map_err(|e|e.to_string())?.clone();
        let mut router=self.router.lock().map_err(|e|e.to_string())?.clone();
        if let Some(id)=request.provider_profile_id.as_deref() {
            router.set_active_model(id)?;
            // Explicit selection is pinned for this run; unrelated profiles cannot
            // silently replace it on a disconnect.
            router.models.retain(|model|model.id==id);
        }
        let provider_profile_id=request.provider_profile_id.clone().or_else(||router.get_active_model().map(|m|m.id.clone()));
        let (run,root)={
            let db=self.db.lock().map_err(|e|e.to_string())?;
            let thread=request.thread_id.clone().unwrap_or_else(||captured_thread(&db));
            db.ensure_thread_exists(&thread,"New conversation").map_err(|e|e.to_string())?;
            let snapshot=db.workspace_snapshot().map_err(|e|e.to_string())?;
            let root=if let Some(id)=&request.project_id {
                let project=snapshot.projects.iter().find(|p|p["id"].as_str()==Some(id)).ok_or("Project no longer exists")?;
                project["rootPath"].as_str().filter(|p|!p.is_empty()).map(std::path::PathBuf::from)
            } else {None};
            let run=RunRecord { id:uuid::Uuid::now_v7().to_string(),request_id:request.request_id,thread_id:thread,project_id:request.project_id,provider_profile_id,utterance:utterance.into(),status:"queued".into(),created_at:now_ms(),updated_at:now_ms() };
            db.create_run(&run).map_err(|e|e.to_string())?;
            (run,root)
        };
        let context=Arc::new(RunContext {run,db:self.db.clone(),provider,router,project_root:root,cancelled:AtomicBool::new(false),cancel_signal:Notify::new(),approval_signal:Notify::new(),staged:Mutex::new(vec![]),authorized:Mutex::new(vec![]),app:self.app.lock().map_err(|e|e.to_string())?.clone()});
        self.runs.lock().map_err(|e|e.to_string())?.insert(context.run.id.clone(),context.clone());
        context.event(None,RunStatus::Queued,json!({"heard":utterance,"request_id":context.run.request_id,"thread_id":context.run.thread_id,"project_id":context.run.project_id,"provider_profile_id":context.run.provider_profile_id}))?;
        context.event(None,RunStatus::Running,json!({"message":"Understanding request"}))?;
        let result=CURRENT_RUN.scope(context.clone(),async {
            tokio::select! {
                biased;
                _=context.cancel_signal.notified()=>Err("Run cancelled".into()),
                _=context.approval_signal.notified()=>Ok(TurnResult {run_id:None,say:String::new(),show:String::new(),pending_plan:None,tool_calls:vec![],latency_ms:started.elapsed().as_millis() as u64,ttft_ms:0,tokens:0}),
                result=self.execute_turn_inner(utterance,mode)=>result,
            }
        }).await;
        context.check()?;
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
                if let Some(plan)=&mut result.pending_plan {
                    plan.run_id=Some(context.run.id.clone());plan.undoable=false;
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
            Err(error)=>{context.event(None,RunStatus::Failed,json!({"error":error}))?;self.runs.lock().map_err(|e|e.to_string())?.remove(&context.run.id);Err(error)}
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
