use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};
use crate::agent::{loop_legacy::AgentCore, machine::HarnessKernel};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpeechStatus {
    pub status: String,
    pub error: Option<String>,
    pub rms: f32,
    pub partial_available: bool,
    pub startup_ms: Option<f64>,
    pub metrics: Option<Value>,
    pub generation: u64,
}
impl Default for SpeechStatus {
    fn default() -> Self { Self { status:"disabled".into(), error:None, rms:0.0, partial_available:false, startup_ms:None, metrics:None, generation:0 } }
}

pub struct AudioCaptureManager {
    app: Arc<RwLock<Option<tauri::AppHandle>>>,
    child: Arc<Mutex<Option<(u64, Child)>>>,
    state: Arc<(Mutex<SpeechStatus>, Condvar)>,
    start_lock: Mutex<()>,
    phrase_bank: Mutex<Option<Arc<crate::voice::phrasebank::PhraseBank>>>,
    pub wake_word: WakeWordUnavailable,
}
impl AudioCaptureManager {
    pub fn new(_kernel: Arc<HarnessKernel>, _agent: Arc<AgentCore>) -> Self {
        Self { app:Arc::new(RwLock::new(None)), child:Arc::new(Mutex::new(None)), state:Arc::new((Mutex::new(SpeechStatus::default()), Condvar::new())), start_lock:Mutex::new(()), phrase_bank:Mutex::new(None), wake_word:WakeWordUnavailable }
    }
    pub fn status(&self) -> Result<SpeechStatus,String> { self.state.0.lock().map(|s|s.clone()).map_err(|e|e.to_string()) }
    fn emit_status(&self) { if let (Ok(Some(app)),Ok(status))=(self.app.read().map(|a|a.clone()),self.status()) {let _=app.emit("friday://voice-state",status);} }
    pub fn start_capture(&self) -> Result<(),String> {
        let _start=self.start_lock.lock().map_err(|e|e.to_string())?;
        if self.status()?.status=="ready" { return Ok(()); }
        self.stop_capture();
        let started=Instant::now();
        let generation={
            let mut state=self.state.0.lock().map_err(|e|e.to_string())?;
            state.status="starting".into();state.error=None;state.startup_ms=None;state.generation+=1;state.generation
        };
        self.emit_status();
        let resource=self.app.read().map_err(|e|e.to_string())?.as_ref().and_then(|app|app.path().resource_dir().ok());
        let setup=(|| {
            let runtime=super::discovery::python_runtime()?;
            let script=super::discovery::speech_script(resource)?;
            let mut command=Command::new(runtime);
            command.arg("-u").arg(&script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
            if let Some(root)=script.parent() {command.current_dir(root);}
            #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
            command.spawn().map_err(|e|format!("Could not start Whistle: {e}. Check FRIDAY_PYTHON and the speech installation."))
        })();
        let mut process=match setup {
            Ok(child)=>child,
            Err(error)=>{self.fail(generation,&error);return Err(error);}
        };
        let stdout=process.stdout.take().ok_or("Speech stdout unavailable")?;
        let stderr=process.stderr.take().ok_or("Speech stderr unavailable")?;
        *self.child.lock().map_err(|e|e.to_string())?=Some((generation,process));
        // Drain bounded diagnostics so library output cannot fill the process pipe.
        let diagnostics=Arc::new(Mutex::new(String::new()));
        let diagnostic_tail=diagnostics.clone();
        std::thread::spawn(move || {for line in BufReader::new(stderr).lines().map_while(Result::ok) {if let Ok(mut tail)=diagnostic_tail.lock() {let bounded:String=line.chars().take(1000).collect();*tail=bounded;}}});
        let state=self.state.clone();let app=self.app.clone();let child=self.child.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if line.len()>65536 {continue;}
                let Ok(event)=serde_json::from_str::<Value>(&line) else {continue};
                let Ok(mut status)=state.0.lock() else {break};
                if status.generation!=generation {break;}
                match event["type"].as_str() {
                    Some("status") if event["status"]=="ready"=>{status.status="ready".into();status.startup_ms=Some(started.elapsed().as_secs_f64()*1000.0);status.partial_available=event["partial_available"].as_bool().unwrap_or(false);state.1.notify_all();},
                    Some("status") if event["status"]=="finished"=>{status.status="disabled".into();status.rms=0.0;state.1.notify_all();},
                    Some("level")=>{status.rms=event["rms"].as_f64().unwrap_or(0.0) as f32;},
                    Some("metrics")=>{status.metrics=Some(event.clone());},
                    Some("error")=>{status.status="failed".into();status.error=event["error"].as_str().map(str::to_string);state.1.notify_all();},
                    Some("partial")|Some("final") if status.status=="ready"=>{
                        if let Some(text)=event["text"].as_str().filter(|text|!text.trim().is_empty()) {
                            if let Ok(guard)=app.read() {if let Some(app)=&*guard {let name=if event["type"]=="partial" {"friday://voice-partial"} else {"friday://voice-command"};let _=app.emit(name,text.trim());}}
                        }
                    },
                    _=>{},
                }
                if let Ok(guard)=app.read() {if let Some(app)=&*guard {let _=app.emit("friday://voice-state",status.clone());}}
            }
            if let Ok(mut status)=state.0.lock() {
                if status.generation==generation {
                    if !["failed","disabled"].contains(&status.status.as_str()) {status.status="failed".into();status.error=Some(format!("Whistle stopped unexpectedly. Restart capture and check the Python speech installation. {}",diagnostics.lock().map(|s|s.clone()).unwrap_or_default()));}
                    status.rms=0.0;state.1.notify_all();
                    if let Ok(guard)=app.read() {if let Some(app)=&*guard {let _=app.emit("friday://voice-state",status.clone());}}
                }
            }
            if let Ok(mut active)=child.lock() {if active.as_ref().is_some_and(|(id,_)|*id==generation) {if let Some((_,mut process))=active.take() {let _=process.kill();let _=process.wait();}}}
        });
        let status=self.state.0.lock().map_err(|e|e.to_string())?;
        let (status,timeout)=self.state.1.wait_timeout_while(status,Duration::from_secs(30),|status|status.generation==generation && status.status=="starting").map_err(|e|e.to_string())?;
        if status.generation==generation && status.status=="ready" {return Ok(());}
        let error=if timeout.timed_out() {"Whistle startup timed out after 30 seconds. Check the installed model and Python runtime.".into()} else {status.error.clone().unwrap_or_else(||"Capture startup was interrupted".into())};
        drop(status);self.stop_capture();self.fail(generation+1,&error);Err(error)
    }
    fn fail(&self,generation:u64,error:&str) {if let Ok(mut state)=self.state.0.lock() {if state.generation==generation {state.status="failed".into();state.error=Some(error.into());self.state.1.notify_all();}}self.emit_status();}
    pub fn stop_capture(&self) {
        if let Ok(mut status)=self.state.0.lock() {status.generation+=1;status.status="disabled".into();status.rms=0.0;self.state.1.notify_all();}
        if let Ok(mut child)=self.child.lock() {if let Some((_,mut process))=child.take() {let _=process.kill();let _=process.wait();}}
        self.emit_status();
    }
    pub fn finish_capture(&self)->Result<(),String> {
        if self.status()?.status!="ready" {self.stop_capture();return Ok(());}
        let mut child=self.child.lock().map_err(|e|e.to_string())?;
        let (_,process)=child.as_mut().ok_or("Microphone capture is no longer running")?;
        let input=process.stdin.as_mut().ok_or("Speech control pipe unavailable")?;
        input.write_all(b"finish\n").and_then(|_|input.flush()).map_err(|e|e.to_string())
    }
    pub fn get_current_rms(&self)->f32 {self.status().map(|s|s.rms).unwrap_or(0.0)}
    pub fn ensure_stream_running(&self)->Result<(),String> {self.start_capture()}
    pub fn shutdown(&self) {self.stop_capture();}
    pub fn set_stt_cadence(&self,_frames:usize) {}
    pub fn set_app_handle(&self,app:tauri::AppHandle) {if let Ok(mut state)=self.app.write() {*state=Some(app);}}
    pub fn set_phrase_bank(&self,bank:Arc<crate::voice::phrasebank::PhraseBank>) {if let Ok(mut state)=self.phrase_bank.lock() {*state=Some(bank);}}
}
pub struct WakeWordUnavailable;
impl WakeWordUnavailable {
    pub fn enable(&self,_sensitivity:Option<f32>) {}
    pub fn disable(&self) {}
    pub fn set_sensitivity(&self,_sensitivity:f32) {}
    pub fn get_status(&self)->crate::voice::wakeword::WakeWordStatus {crate::voice::wakeword::WakeWordStatus {enabled:false,sensitivity:0.5,last_detected_ms:None,trigger_word:"Unavailable — use push to talk".into()}}
}
