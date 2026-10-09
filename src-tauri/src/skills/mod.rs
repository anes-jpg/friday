use crate::memory::db::{Database, DbAuditEntry};
use crate::tools::{ToolExecutionResult, ToolRegistry};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SkillTrigger {
    pub r#type: String, // "cron" | "phrase" | "event"
    pub expr: Option<String>,
    pub r#match: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SkillManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub triggers: Vec<SkillTrigger>,
    pub permissions: Vec<String>,
    pub entry: Option<String>,
}

pub struct SkillRegistry {
    db: Arc<Mutex<Database>>,
    skills: Arc<Mutex<HashMap<String, SkillManifest>>>,
}

impl SkillRegistry {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        let reg = Self {
            db,
            skills: Arc::new(Mutex::new(HashMap::new())),
        };
        reg.load_bundled_skills();
        let _ = reg.discover_filesystem_skills();
        reg
    }

    /// Loads core default bundled skills (§06 Skill SDK)
    pub fn load_bundled_skills(&self) {
        let bundled = vec![
            SkillManifest {
                id: "standup-digest".to_string(),
                name: "Standup Digest".to_string(),
                version: "1.0.0".to_string(),
                description:
                    "Summarize yesterday's commits and Notion task changes into a standup note."
                        .to_string(),
                triggers: vec![
                    SkillTrigger {
                        r#type: "cron".to_string(),
                        expr: Some("0 45 8 * * MON-FRI".to_string()),
                        r#match: None,
                    },
                    SkillTrigger {
                        r#type: "phrase".to_string(),
                        expr: None,
                        r#match: Some(vec![
                            "standup".to_string(),
                            "what did I do yesterday".to_string(),
                        ]),
                    },
                ],
                permissions: vec![
                    "notion.read".to_string(),
                    "web.fetch:api.github.com".to_string(),
                    "notify.toast".to_string(),
                ],
                entry: Some("run.ts".to_string()),
            },
            SkillManifest {
                id: "notion-operator".to_string(),
                name: "Notion Workspace Bridge".to_string(),
                version: "1.2.0".to_string(),
                description:
                    "Direct bi-directional search and task mutations across AN STUDIO Notion pages."
                        .to_string(),
                triggers: vec![SkillTrigger {
                    r#type: "phrase".to_string(),
                    expr: None,
                    r#match: Some(vec!["notion".to_string(), "tasks".to_string()]),
                }],
                permissions: vec!["notion.read".to_string(), "notion.write".to_string()],
                entry: Some("run.ts".to_string()),
            },
            SkillManifest {
                id: "desktop-organizer".to_string(),
                name: "Desktop Assets Organizer".to_string(),
                version: "1.1.0".to_string(),
                description:
                    "Automatically moves and organizes screenshots into project asset directories."
                        .to_string(),
                triggers: vec![SkillTrigger {
                    r#type: "phrase".to_string(),
                    expr: None,
                    r#match: Some(vec![
                        "organize screenshots".to_string(),
                        "clean desktop".to_string(),
                    ]),
                }],
                permissions: vec![
                    "fs.read".to_string(),
                    "fs.write".to_string(),
                    "fs.move".to_string(),
                ],
                entry: Some("run.ts".to_string()),
            },
        ];

        if let Ok(mut lock) = self.skills.lock() {
            for skill in bundled {
                lock.insert(skill.id.clone(), skill);
            }
        }
    }

    /// Discovers skills located in `%APPDATA%/FRIDAY/skills/` and `./skills/`
    pub fn discover_filesystem_skills(&self) -> Result<usize, String> {
        let mut count = 0;
        let mut search_paths = Vec::new();

        if let Ok(appdata) = std::env::var("APPDATA") {
            search_paths.push(PathBuf::from(appdata).join("FRIDAY").join("skills"));
        }
        search_paths.push(PathBuf::from("skills"));

        for base_dir in search_paths {
            if !base_dir.exists() || !base_dir.is_dir() {
                continue;
            }

            if let Ok(entries) = std::fs::read_dir(base_dir) {
                for entry in entries.filter_map(Result::ok) {
                    let path = entry.path();
                    if path.is_dir() {
                        let manifest_path = path.join("manifest.json");
                        if manifest_path.exists() {
                            if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                                if let Ok(manifest) =
                                    serde_json::from_str::<SkillManifest>(&content)
                                {
                                    if let Ok(mut lock) = self.skills.lock() {
                                        lock.insert(manifest.id.clone(), manifest);
                                        count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(count)
    }

    /// Checks if a skill is granted a required permission (§08 Security Model)
    pub fn check_permission(&self, skill_id: &str, required_permission: &str) -> bool {
        if let Ok(lock) = self.skills.lock() {
            if let Some(skill) = lock.get(skill_id) {
                return skill.permissions.iter().any(|p| {
                    p == required_permission || p.starts_with(&format!("{}:", required_permission))
                });
            }
        }
        false
    }

    /// Executes a tool request on behalf of a skill under sandbox permission gating
    pub async fn execute_skill_action(
        &self,
        skill_id: &str,
        tool_name: &str,
        args: Value,
        tools: &ToolRegistry,
    ) -> Result<ToolExecutionResult, String> {
        let now_sec = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // Sandboxed permission check: skill must declare the permission
        let permitted = self.check_permission(skill_id, tool_name);
        if !permitted {
            let reason = format!(
                "Permission Denied: Skill '{}' has not declared permission for tool '{}'",
                skill_id, tool_name
            );

            // Record security violation to append-only audit log
            if let Ok(db) = self.db.lock() {
                let _ = db.insert_audit_entry(&DbAuditEntry {
                    id: format!("audit-sec-{}", now_sec),
                    tool_name: tool_name.to_string(),
                    args_hash: "unauthorized".to_string(),
                    tier: "Red".to_string(),
                    decision: format!("permission_blocked: {}", skill_id),
                    duration_ms: 0,
                    created_at: now_sec,
                });
            }

            return Err(reason);
        }

        // Permitted: proceed to execution
        tools.invoke(tool_name, args).await
    }

    pub fn get_all_manifests(&self) -> Vec<SkillManifest> {
        if let Ok(lock) = self.skills.lock() {
            lock.values().cloned().collect()
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_skill_permission_enforcement() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let registry = SkillRegistry::new(db.clone());
        let tools = ToolRegistry::new();

        // 1. Permitted invocation
        assert!(registry.check_permission("desktop-organizer", "fs.read"));

        // 2. Prohibited invocation (desktop-organizer never declared shell.run)
        assert!(!registry.check_permission("desktop-organizer", "shell.run"));

        let res = registry
            .execute_skill_action(
                "desktop-organizer",
                "shell.run",
                serde_json::json!({"command": "dir"}),
                &tools,
            )
            .await;

        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Permission Denied"));

        // Verify violation logged to audit_log
        let audit = db.lock().unwrap().get_audit_log(5).unwrap();
        assert!(audit
            .iter()
            .any(|a| a.decision.contains("permission_blocked")));
    }
}
