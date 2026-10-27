//! Measured Windows resource samples and local capability readiness.
use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{State, Manager};

#[derive(Clone, Default, Serialize)]
pub struct Resources {pub cpu_percent:Option<f64>,pub rss_mb:Option<f64>,pub peak_rss_mb:Option<f64>,pub ram_used_mb:Option<u32>,pub ram_total_mb:Option<u32>,pub system_cpu_percent:Option<f32>}

#[cfg(windows)]
mod platform {
    use super::*;
    #[repr(C)] #[derive(Default,Copy,Clone)] struct FileTime {low:u32,high:u32}
    impl FileTime {fn ticks(self)->u64 {(u64::from(self.high)<<32)|u64::from(self.low)}}
    #[repr(C)] #[derive(Default)] struct MemoryStatus {length:u32,load:u32,total_physical:u64,available_physical:u64,total_page:u64,available_page:u64,total_virtual:u64,available_virtual:u64,available_extended:u64}
    #[repr(C)] #[derive(Default)] struct ProcessMemory {cb:u32,page_faults:u32,peak_working_set:usize,working_set:usize,peak_paged:usize,paged:usize,peak_nonpaged:usize,nonpaged:usize,pagefile:usize,peak_pagefile:usize}
    #[link(name="kernel32")] extern "system" {
        fn GetCurrentProcess()->isize;
        fn GetProcessTimes(process:isize,creation:*mut FileTime,exit:*mut FileTime,kernel:*mut FileTime,user:*mut FileTime)->i32;
        fn GetSystemTimes(idle:*mut FileTime,kernel:*mut FileTime,user:*mut FileTime)->i32;
        fn GlobalMemoryStatusEx(status:*mut MemoryStatus)->i32;
    }
    #[link(name="psapi")] extern "system" {fn GetProcessMemoryInfo(process:isize,counters:*mut ProcessMemory,size:u32)->i32;}
    static PREVIOUS:Mutex<Option<(Instant,u64)>>=Mutex::new(None);
    static SYSTEM_PREVIOUS:Mutex<Option<(u64,u64)>>=Mutex::new(None);
    pub fn sample()->Resources {
        let mut sample=Resources::default();
        let mut memory=MemoryStatus {length:std::mem::size_of::<MemoryStatus>() as u32,..Default::default()};
        let mut counters=ProcessMemory {cb:std::mem::size_of::<ProcessMemory>() as u32,..Default::default()};
        let (mut creation,mut exit,mut kernel,mut user,mut idle)=(FileTime::default(),FileTime::default(),FileTime::default(),FileTime::default(),FileTime::default());
        // FFI writes only to repr(C) buffers of the documented size.
        unsafe {
            let process=GetCurrentProcess();
            if GlobalMemoryStatusEx(&mut memory)!=0 {sample.ram_total_mb=Some((memory.total_physical/1_048_576) as u32);sample.ram_used_mb=Some(((memory.total_physical-memory.available_physical)/1_048_576) as u32);}
            if GetProcessMemoryInfo(process,&mut counters,std::mem::size_of::<ProcessMemory>() as u32)!=0 {sample.rss_mb=Some(counters.working_set as f64/1_048_576.0);sample.peak_rss_mb=Some(counters.peak_working_set as f64/1_048_576.0);}
            if GetProcessTimes(process,&mut creation,&mut exit,&mut kernel,&mut user)!=0 {
                let ticks=kernel.ticks()+user.ticks();let now=Instant::now();
                if let Ok(mut previous)=PREVIOUS.lock() {if let Some((at,old))=*previous {let elapsed=now.duration_since(at).as_secs_f64();if elapsed>0.0 && ticks>=old {let cores=std::thread::available_parallelism().map(|value|value.get()).unwrap_or(1);sample.cpu_percent=Some((ticks-old) as f64/10_000_000.0/elapsed/cores as f64*100.0);}}*previous=Some((now,ticks));}
            }
            if GetSystemTimes(&mut idle,&mut kernel,&mut user)!=0 {
                let total=kernel.ticks()+user.ticks();let idle=idle.ticks();
                if let Ok(mut previous)=SYSTEM_PREVIOUS.lock() {if let Some((old_total,old_idle))=*previous {let span=total.saturating_sub(old_total);if span>0 {sample.system_cpu_percent=Some((1.0-idle.saturating_sub(old_idle) as f64/span as f64) as f32*100.0);}}*previous=Some((total,idle));}
            }
        }
        sample
    }
}
pub fn resources()->Resources {#[cfg(windows)] {platform::sample()} #[cfg(not(windows))] {Resources::default()}}

#[tauri::command]
pub fn get_resource_sample()->Resources {resources()}

#[tauri::command]
pub fn get_settings_health(state:State<'_,crate::AppState>,app:tauri::AppHandle)->Result<serde_json::Value,String> {
    let db=state.agent.db.lock().map_err(|e|e.to_string())?;
    let integrity:String=db.conn.query_row("PRAGMA quick_check",[],|row|row.get(0)).map_err(|e|e.to_string())?;
    let version:i64=db.conn.query_row("SELECT COALESCE(MAX(version),0) FROM workspace_migrations",[],|row|row.get(0)).map_err(|e|e.to_string())?;
    let paths:Vec<String>={let mut stmt=db.conn.prepare("PRAGMA database_list").map_err(|e|e.to_string())?;let rows=stmt.query_map([],|row|row.get::<_,String>(2)).map_err(|e|e.to_string())?;rows.collect::<rusqlite::Result<_>>().map_err(|e|e.to_string())?};
    let durable=paths.iter().any(|path|!path.is_empty());
    drop(db);
    let profiles=state.agent.router.lock().map_err(|e|e.to_string())?.models.iter().map(|profile|serde_json::json!({"id":profile.id,"name":profile.name,"configured":crate::providers::glm::validate_provider_config(&profile.base_url,&profile.name).is_ok(),"active":profile.is_active,"tested":!profile.telemetry.tracker_history.is_empty()})).collect::<Vec<_>>();
    Ok(serde_json::json!({"providers":profiles,"speech":state.audio_capture.status()?,"python":crate::voice::discovery::python_runtime().map(|path|path.to_string_lossy().to_string()).map_err(|e|e.to_string()),"speech_resource":crate::voice::discovery::speech_script(app.path().resource_dir().ok()).map(|path|path.to_string_lossy().to_string()).map_err(|e|e.to_string()),"storage":{"status":if integrity=="ok" && durable {"ready"} else {"unavailable"},"integrity":integrity,"schema_version":version,"durable":durable},"scheduler":{"running":state.scheduler.is_running(),"unattended":"Reviewed reminders and read-only checks"},"resources":resources(),"camera":{"capture":"Check camera access in Monitoring","recording":"WebView capability must be checked","rtsp":"unavailable"},"wake_word":"unavailable","capabilities":{"ui_automation_actuation":"unavailable","iron_legion":"simulated","browser_native_adapter":"unavailable","direct_desktop_mutations":"restricted_to_reviewed_tools","process_control":"unavailable","remote_execution":"unavailable","mobile_companion":"unavailable","rtsp_camera":"unavailable","local_speech":"available"}}))
}
