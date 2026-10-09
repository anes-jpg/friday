use crate::memory::db::{Database, DbAuditEntry};
use crate::tools::ToolRegistry;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub struct SchedulerManager {
    db: Arc<Mutex<Database>>,
    tools: Arc<ToolRegistry>,
    is_running: Arc<AtomicBool>,
}

impl SchedulerManager {
    pub fn new(db: Arc<Mutex<Database>>, tools: Arc<ToolRegistry>) -> Self {
        Self {
            db,
            tools,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Starts the background scheduler loop (runs every 30 seconds)
    pub fn start(&self) {
        if self.is_running.load(Ordering::SeqCst) {
            return;
        }

        self.is_running.store(true, Ordering::SeqCst);
        let running = self.is_running.clone();
        let db = self.db.clone();
        let tools = self.tools.clone();

        let _ = std::thread::Builder::new()
            .name("friday-scheduler".to_string())
            .spawn(move || {
                let rt = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(r) => r,
                    Err(e) => {
                        tracing::error!("Failed to initialize scheduler tokio runtime: {}", e);
                        return;
                    }
                };

                rt.block_on(async move {
                    tracing::info!("FRIDAY Automation Scheduler started.");
                    while running.load(Ordering::SeqCst) {
                        let now_sec = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs() as i64;

                        let automations = if let Ok(guard) = db.lock() {
                            guard.get_automations().unwrap_or_default()
                        } else {
                            Vec::new()
                        };

                        for mut auto in automations {
                            if !auto.enabled {
                                continue;
                            }

                            // Check schedule eligibility (e.g. at least 24 hours between runs for daily crons)
                            let should_run = match auto.trigger_type.as_str() {
                                "cron" => {
                                    if let Some(last) = auto.last_run {
                                        (now_sec - last) >= 86400
                                    } else {
                                        true
                                    }
                                }
                                "event" => false, // Event-driven automations triggered on FS/window events
                                _ => false,
                            };

                            if should_run {
                                let start_inst = Instant::now();
                                let args: Value = serde_json::from_str(&auto.action_args)
                                    .unwrap_or(serde_json::json!({}));
                                let result = tools.invoke(&auto.action_tool, args).await;
                                let duration_ms = start_inst.elapsed().as_millis() as i64;

                                let decision = match result {
                                    Ok(_) => "auto_executed",
                                    Err(_) => "auto_failed",
                                };

                                if let Ok(guard) = db.lock() {
                                    let _ = guard.insert_audit_entry(&DbAuditEntry {
                                        id: format!("audit-auto-{}", now_sec),
                                        tool_name: auto.action_tool.clone(),
                                        args_hash: format!("{:x}", md5_digest(&auto.action_args)),
                                        tier: "Green".to_string(),
                                        decision: decision.to_string(),
                                        duration_ms,
                                        created_at: now_sec,
                                    });

                                    auto.last_run = Some(now_sec);
                                    let _ = guard.insert_automation(&auto);
                                }
                            }
                        }

                        tokio::time::sleep(Duration::from_secs(30)).await;
                    }
                    tracing::info!("FRIDAY Automation Scheduler stopped.");
                });
            });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    /// Manually triggers an automation immediately (e.g. from Console UI)
    pub async fn trigger_now(&self, id: &str) -> Result<String, String> {
        let auto = {
            let guard = self.db.lock().map_err(|e| e.to_string())?;
            guard
                .get_automations()
                .map_err(|e| e.to_string())?
                .into_iter()
                .find(|a| a.id == id)
                .ok_or_else(|| format!("Automation '{}' not found", id))?
        };

        let now_sec = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let start_inst = Instant::now();
        let args: Value = serde_json::from_str(&auto.action_args).unwrap_or(serde_json::json!({}));
        let res = self.tools.invoke(&auto.action_tool, args).await?;
        let duration_ms = start_inst.elapsed().as_millis() as i64;

        if let Ok(guard) = self.db.lock() {
            let _ = guard.insert_audit_entry(&DbAuditEntry {
                id: format!("audit-manual-{}", now_sec),
                tool_name: auto.action_tool.clone(),
                args_hash: format!("{:x}", md5_digest(&auto.action_args)),
                tier: "Green".to_string(),
                decision: "manual_trigger".to_string(),
                duration_ms,
                created_at: now_sec,
            });

            let mut updated = auto;
            updated.last_run = Some(now_sec);
            let _ = guard.insert_automation(&updated);
        }

        Ok(format!("Executed '{}': {}", id, res.output))
    }
}

fn md5_digest(s: &str) -> u64 {
    // Lightweight 64-bit deterministic hash for audit logging without extra crypto crates
    let mut hash: u64 = 14695981039346656037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_scheduler_manual_trigger() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let tools = Arc::new(ToolRegistry::new());
        let scheduler = SchedulerManager::new(db.clone(), tools);

        let res = scheduler.trigger_now("auto-1").await.unwrap();
        assert!(res.contains("auto-1"));

        // Verify audit log has the run recorded
        let audit = db.lock().unwrap().get_audit_log(10).unwrap();
        assert!(audit.iter().any(|a| a.decision == "manual_trigger"));
    }
}
