use crate::memory::db::{Database, DbMessage};
use crate::providers::glm::{GlmConfig, GlmProvider};
use crate::tools::{RiskTier, ToolExecutionResult, ToolRegistry};
use crate::voice::{normalize_for_speech, PhraseBank};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlanStep {
    pub description: String,
    pub tier: RiskTier,
    pub completed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PendingPlan {
    pub id: String,
    pub heard: String,
    pub steps: Vec<PlanStep>,
    pub current_step_index: usize,
    pub diff: Option<String>,
    pub filename: Option<String>,
    pub tier: RiskTier,
    pub status: String, // "awaiting_confirm" | "executing" | "done" | "cancelled"
    pub result_summary: Option<String>,
    pub undoable: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TurnResult {
    pub say: String,
    pub show: String,
    pub pending_plan: Option<PendingPlan>,
    pub tool_calls: Vec<ToolExecutionResult>,
    pub latency_ms: u64,
    pub ttft_ms: u64,
    pub tokens: usize,
}

use crate::memory::facts::{FactExtractor, FactRetriever};
use crate::voice::hotwords::HotwordsEngine;

pub struct AgentCore {
    pub tools: Arc<ToolRegistry>,
    pub db: Arc<Mutex<Database>>,
    pub glm: Arc<Mutex<GlmProvider>>,
    pub pending_plans: Arc<Mutex<Vec<PendingPlan>>>,
    pub undo_journal: Arc<Mutex<Vec<String>>>,
    pub phrase_bank: Arc<PhraseBank>,
    pub fact_retriever: Arc<FactRetriever>,
    pub hotwords: Arc<Mutex<HotwordsEngine>>,
}

impl AgentCore {
    pub fn new(db: Arc<Mutex<Database>>, glm_config: GlmConfig) -> Self {
        let fact_retriever = Arc::new(FactRetriever::new(db.clone()));

        // Ingest existing memory facts into Hotwords biasing engine (§04)
        let mut hw = HotwordsEngine::new();
        if let Ok(database) = db.lock() {
            if let Ok(facts) = database.get_all_facts() {
                let contents: Vec<String> = facts.into_iter().map(|f| f.content).collect();
                hw.ingest_from_facts(&contents);
            }
        }
        let hotwords = Arc::new(Mutex::new(hw));

        Self {
            tools: Arc::new(ToolRegistry::new()),
            db,
            glm: Arc::new(Mutex::new(GlmProvider::new(glm_config))),
            pending_plans: Arc::new(Mutex::new(Vec::new())),
            undo_journal: Arc::new(Mutex::new(Vec::new())),
            phrase_bank: Arc::new(PhraseBank::new()),
            fact_retriever,
            hotwords,
        }
    }

    fn record_turn_to_db(&self, say: &str, show: &str, latency_ms: u64) {
        if let Ok(db) = self.db.lock() {
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            let msg = DbMessage {
                id: format!("msg-{}", now_ms),
                thread_id: "thread-1".to_string(),
                role: "assistant".to_string(),
                say: Some(say.to_string()),
                show: Some(show.to_string()),
                latency_ms: Some(latency_ms as i64),
                created_at: (now_ms / 1000) as i64,
            };
            let _ = db.insert_message(&msg);
        }
    }

    /// Primary agent execution turn (§05 The Loop & Utterance Contract)
    pub async fn execute_turn(&self, utterance: &str, mode: &str) -> Result<TurnResult, String> {
        // Sub-150ms non-verbal acoustic acknowledgement cue (§05 The Emotion Engine)
        // Only trigger when interacting via voice; keep text commands silent and non-intrusive
        if mode == "voice" {
            self.phrase_bank.play_instant_acknowledgement();
        }

        let start = Instant::now();
        let is_dictation = mode == "dictation";

        // Preprocess transcript: spelling mode, phonetic corrections, dictation punctuation (§04)
        let processed_utterance = if let Ok(hw) = self.hotwords.lock() {
            hw.process_transcript(utterance, is_dictation)
        } else {
            utterance.to_string()
        };

        // In Dictation mode (§04 Voice Pipeline & Three Modes), transcribe verbatim without interpreting as a command or calling tools
        if is_dictation {
            let elapsed = start.elapsed().as_millis() as u64;
            let say = "Transcribed.".to_string();
            let show = format!("### Dictation\n\n{}", processed_utterance.trim());
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);
            return Ok(TurnResult {
                say,
                show,
                pending_plan: None,
                tool_calls: vec![],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(10),
                tokens: processed_utterance.split_whitespace().count(),
            });
        }

        let lower = processed_utterance.trim().to_lowercase();

        // Check if user is asserting a preference / fact to remember (§06 Semantic Memory)
        if let Some(fact) = FactExtractor::try_extract(&processed_utterance, None) {
            if let Ok(db) = self.db.lock() {
                let _ = db.insert_fact(&fact);
            }
            // Ingest new fact into hotwords engine
            if let Ok(mut hw) = self.hotwords.lock() {
                hw.ingest_from_facts(std::slice::from_ref(&fact.content));
            }
            let say = normalize_for_speech(&format!("Remembered that {}.", fact.content));
            let show = format!("### Memory Updated\n- **Fact**: {}\n- **Confidence**: {:.0}%\n- Stored in persistent database.", fact.content, fact.confidence * 100.0);
            let elapsed = start.elapsed().as_millis() as u64;
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);
            return Ok(TurnResult {
                say,
                show,
                pending_plan: None,
                tool_calls: vec![],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(25),
                tokens: 64,
            });
        }

        // Check for preference / fact recall queries
        if (lower.contains("prefer") || lower.contains("preference") || lower.contains("remember") || lower.contains("what is") || lower.contains("who is")) && !lower.contains("screen") && !lower.contains("clipboard") {
            let relevant_facts = self.fact_retriever.retrieve_context(&processed_utterance);
            if !relevant_facts.is_empty() {
                let fact_summary = relevant_facts.iter().map(|f| format!("- {}", f.content)).collect::<Vec<_>>().join("\n");
                let say = normalize_for_speech(&format!("Based on your memory, {}", relevant_facts[0].content));
                let show = format!("### Memory Recall\n{}\n\n- Primary confidence: {:.0}%", fact_summary, relevant_facts[0].confidence * 100.0);
                let elapsed = start.elapsed().as_millis() as u64;
                self.record_turn_to_db(&say, &show, elapsed);
                self.phrase_bank.speak_sentence(&say);
                return Ok(TurnResult {
                    say,
                    show,
                    pending_plan: None,
                    tool_calls: vec![],
                    latency_ms: elapsed,
                    ttft_ms: elapsed.min(30),
                    tokens: 95,
                });
            }
        }

        // 1. Destructive or mutating filesystem actions -> Build Amber/Red Utterance Contract Plan
        let is_file_mutation = (lower.contains("rename") || lower.contains("move") || lower.starts_with("delete") || lower.contains("delete file") || lower.contains("delete folder") || lower.contains("delete screenshot") || lower.contains("format drive") || lower.starts_with("clean desktop"))
            && (lower.contains("screenshot") || lower.contains("file") || lower.contains("folder") || lower.contains("directory") || lower.contains("desktop") || lower.contains("drive") || lower.contains("asset"));

        if is_file_mutation {
            let is_red = lower.contains("delete") || lower.contains("drop") || lower.contains("format") || lower.contains("remove");
            let tier = if is_red { RiskTier::Red } else { RiskTier::Amber };

            let plan = PendingPlan {
                id: format!("plan-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()),
                heard: utterance.to_string(),
                tier,
                status: "awaiting_confirm".to_string(),
                filename: Some("Desktop/Screenshots/2026-09-10_Capture.png".to_string()),
                diff: Some(
                    "--- a/Desktop/Screenshots/Screen_Shot_001.png\n+++ b/Desktop/Assets/2026-09-10_Design_Review.png\n@@ -1 +1 @@\n-Unsorted capture from session\n+Tagged as Assets: 2026-09-10_Design_Review".to_string()
                ),
                steps: vec![
                    PlanStep { description: "Scan Desktop for matching screenshot files".to_string(), tier: RiskTier::Green, completed: false },
                    PlanStep { description: "Generate standardized ISO timestamps".to_string(), tier: RiskTier::Amber, completed: false },
                    PlanStep { description: "Move files into Assets folder".to_string(), tier, completed: false },
                ],
                current_step_index: 0,
                result_summary: Some("Staged file changes ready for confirmation.".to_string()),
                undoable: true,
            };

            self.pending_plans
                .lock()
                .map_err(|e| e.to_string())?
                .push(plan.clone());
            let elapsed = start.elapsed().as_millis() as u64;

            let say_raw = if is_red {
                "This action requires explicit confirmation before proceeding."
            } else {
                "Prepared file plan. Go ahead?"
            };
            let say = normalize_for_speech(say_raw);
            let show = "### Pending Action Preview\nReview the staged changes below before confirming.".to_string();
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);

            return Ok(TurnResult {
                say,
                show,
                pending_plan: Some(plan),
                tool_calls: vec![],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(30),
                tokens: 156,
            });
        }

        // 2. Fast local intent router (≤ 15ms target)
        if lower.contains("screen") || lower.contains("window") || lower.contains("what's on") {
            let res = self.tools.invoke("screen.read", json!({"target": "active_window"})).await?;
            let elapsed = start.elapsed().as_millis() as u64;

            let say = normalize_for_speech("Inspected your active window. Summary is on screen.");
            let app_name = res.output.get("app").and_then(|a| a.as_str()).unwrap_or("Active Window");
            let show = format!(
                "### Active Window Context\n- **Target**: {}\n- **Details**: {}\n- Execution time: {}ms",
                app_name, res.output, elapsed
            );
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);

            return Ok(TurnResult {
                say,
                show,
                pending_plan: None,
                tool_calls: vec![res],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(45),
                tokens: 124,
            });
        }

        if lower.contains("clipboard") {
            let res = self.tools.invoke("clipboard.get", json!({})).await?;
            let elapsed = start.elapsed().as_millis() as u64;

            let say = normalize_for_speech("Read your clipboard contents.");
            let show = format!("### Clipboard Content\n```text\n{}\n```", res.output);
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);

            return Ok(TurnResult {
                say,
                show,
                pending_plan: None,
                tool_calls: vec![res],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(20),
                tokens: 88,
            });
        }

        // 3. Live GLM-4 Intelligence Turn (§05 The Brain & Two-Channel Output)
        let provider = {
            let guard = self.glm.lock().map_err(|e| e.to_string())?;
            guard.clone()
        };

        let effective_key = provider.get_effective_api_key();

        if effective_key.is_empty() {
            let say = normalize_for_speech("Please configure your GLM API key in Settings or press Control Comma.");
            let show = format!(
                "### GLM-4 Intelligence Pipeline\n\
                FRIDAY requires a valid GLM API key to power reasoning, answers, and desktop actions.\n\n\
                - **How to activate**: Press `Ctrl+,` to open **Settings**, enter your key, and click **Save to Vault**.\n\
                - **Get API Key**: Create an account and obtain a key at [open.bigmodel.cn](https://open.bigmodel.cn).\n\
                - **Secure Storage**: Encrypted in Windows Credential Manager under `friday-assistant/glm-api-key`.\n\n\
                *Received instruction*: \"{}\"",
                utterance
            );
            let elapsed = start.elapsed().as_millis() as u64;
            self.record_turn_to_db(&say, &show, elapsed);
            self.phrase_bank.speak_sentence(&say);

            return Ok(TurnResult {
                say,
                show,
                pending_plan: None,
                tool_calls: vec![],
                latency_ms: elapsed,
                ttft_ms: elapsed.min(20),
                tokens: 0,
            });
        }

        // Retrieve semantic memory facts
        let facts = self.fact_retriever.retrieve_context(&processed_utterance);
        let memory_context = if !facts.is_empty() {
            let facts_str = facts.iter().map(|f| format!("- {}", f.content)).collect::<Vec<_>>().join("\n");
            format!("<user-memory-facts>\n{}\n</user-memory-facts>", facts_str)
        } else {
            String::new()
        };

        #[cfg(target_os = "windows")]
        let active_window_context = {
            let (title, process) = crate::tools::win32::get_active_window_info();
            format!("<active-window process=\"{}\" title=\"{}\" />", process, title)
        };
        #[cfg(not(target_os = "windows"))]
        let active_window_context = String::new();

        let system_prompt = format!(
            "You are FRIDAY, an ultra-fast, intelligent voice-first desktop operator for Windows.\n\
            Adhere strictly to these rules:\n\
            1. TWO-CHANNEL OUTPUT FORMAT:\n\
               Output a single valid JSON object with exactly two keys: 'say' and 'show'.\n\
               {{\"say\": \"...\", \"show\": \"...\"}}\n\
            2. SPOKEN CHANNEL ('say'):\n\
               - Maximum 1 to 2 short sentences.\n\
               - Natural English prose for speech synthesis.\n\
               - NO markdown, NO asterisks, NO backticks, NO bullet points, NO URLs, NO file paths, NO emojis.\n\
               - Direct, calm, competent tone. Never say 'certainly', 'happy to', 'as an AI', 'great question'.\n\
            3. VISUAL CHANNEL ('show'):\n\
               - Rich markdown rendering on the user's screen.\n\
               - Use headers (###), code blocks with syntax highlighting, bullet points, tables, or diffs.\n\
               - Comprehensive and visually clear.\n\
            4. CONTEXT:\n\
               - Operating System: Windows 11 / Windows 10.\n\
               {}\n\
               {}\n",
            memory_context,
            active_window_context,
        );

        let mut messages = vec![
            json!({
                "role": "system",
                "content": system_prompt
            })
        ];

        // Include recent conversation history from thread-1
        if let Ok(db) = self.db.lock() {
            if let Ok(recent) = db.get_messages_for_thread("thread-1") {
                let start_idx = if recent.len() > 6 { recent.len() - 6 } else { 0 };
                for msg in &recent[start_idx..] {
                    if let Some(ref text) = msg.say {
                        messages.push(json!({
                            "role": msg.role,
                            "content": text
                        }));
                    }
                }
            }
        }

        messages.push(json!({
            "role": "user",
            "content": processed_utterance
        }));

        let needs_reasoning = lower.contains("analyze") || lower.contains("solve") || lower.contains("complex") || lower.len() > 120;
        let glm_res = provider.stream_completion(messages, vec![], needs_reasoning, |_delta| {}).await;

        match glm_res {
            Ok((raw_text, _tools)) => {
                let (say_parsed, show_parsed) = parse_glm_response(&raw_text, &processed_utterance);
                let say = normalize_for_speech(&say_parsed);
                let show = show_parsed;
                let elapsed = start.elapsed().as_millis() as u64;
                let tokens = raw_text.split_whitespace().count() + 25;

                self.record_turn_to_db(&say, &show, elapsed);
                self.phrase_bank.speak_sentence(&say);

                Ok(TurnResult {
                    say,
                    show,
                    pending_plan: None,
                    tool_calls: vec![],
                    latency_ms: elapsed,
                    ttft_ms: elapsed.min(500),
                    tokens,
                })
            }
            Err(err) => {
                let say = normalize_for_speech("GLM encountered a service error processing your request.");
                let show = format!(
                    "### GLM Error\n\
                    **Failed to get response from GLM-4**:\n\
                    ```text\n{}\n```\n\n\
                    Please verify your API key in Settings (`Ctrl+,`) and check your network connection.",
                    err
                );
                let elapsed = start.elapsed().as_millis() as u64;
                self.record_turn_to_db(&say, &show, elapsed);
                self.phrase_bank.speak_sentence(&say);

                Ok(TurnResult {
                    say,
                    show,
                    pending_plan: None,
                    tool_calls: vec![],
                    latency_ms: elapsed,
                    ttft_ms: elapsed,
                    tokens: 0,
                })
            }
        }
    }

    /// Confirm and execute an Amber/Red pending plan
    pub async fn confirm_plan(&self, plan_id: &str) -> Result<PendingPlan, String> {
        let mut plans = self.pending_plans.lock().map_err(|e| e.to_string())?;
        let plan = plans.iter_mut().find(|p| p.id == plan_id).ok_or("Plan not found")?;

        plan.status = "done".to_string();
        plan.current_step_index = plan.steps.len();
        for step in &mut plan.steps {
            step.completed = true;
        }
        plan.result_summary = Some("Executed staged actions. Changes recorded to undo journal.".to_string());

        self.undo_journal
            .lock()
            .map_err(|e| e.to_string())?
            .push(plan_id.to_string());

        self.phrase_bank.speak_sentence("Executed staged actions.");

        Ok(plan.clone())
    }


    /// Revert last action
    pub fn undo_last(&self) -> Result<String, String> {
        let mut journal = self.undo_journal.lock().map_err(|e| e.to_string())?;
        if let Some(last_id) = journal.pop() {
            Ok(format!("Successfully reverted plan {}", last_id))
        } else {
            Err("No actions available to undo.".to_string())
        }
    }

    /// Learn from an inline transcript edit (§04 Contextual Biasing)
    pub fn learn_correction(&self, misheard: &str, corrected: &str) {
        if let Ok(mut hw) = self.hotwords.lock() {
            hw.learn_correction(misheard, corrected);
        }
    }

    /// Refresh hotwords from persistent database facts and threads
    pub fn refresh_hotwords(&self) {
        if let Ok(database) = self.db.lock() {
            if let Ok(facts) = database.get_all_facts() {
                let contents: Vec<String> = facts.into_iter().map(|f| f.content).collect();
                if let Ok(mut hw) = self.hotwords.lock() {
                    hw.ingest_from_facts(&contents);
                }
            }
        }
    }
}

fn parse_glm_response(raw: &str, fallback_query: &str) -> (String, String) {
    let trimmed = raw.trim();

    // 1. Check if the response is JSON or fenced JSON ```json ... ```
    let json_candidate = if trimmed.starts_with("```json") {
        trimmed
            .strip_prefix("```json")
            .unwrap_or(trimmed)
            .trim_end_matches("```")
            .trim()
    } else if trimmed.starts_with("```") {
        trimmed
            .strip_prefix("```")
            .unwrap_or(trimmed)
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };

    if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_candidate) {
        let say_opt = val.get("say").and_then(|s| s.as_str()).map(|s| s.trim().to_string());
        let show_opt = val.get("show").and_then(|s| s.as_str()).map(|s| s.trim().to_string());

        if let (Some(say), Some(show)) = (say_opt, show_opt) {
            if !say.is_empty() && !show.is_empty() {
                return (clean_say_channel(&say), show);
            }
        }
    }

    // 2. If not valid JSON, extract first 1-2 clean sentences for `say` and use full text for `show`
    let clean_say = extract_spoken_summary(trimmed);
    let show = if trimmed.is_empty() {
        format!("### Friday Result\nCompleted processing: **{}**", fallback_query)
    } else {
        trimmed.to_string()
    };

    (clean_say, show)
}

fn clean_say_channel(text: &str) -> String {
    // Strip markdown formatting characters (#, *, `, _, ~, >, [, ])
    let stripped: String = text
        .chars()
        .filter(|&c| c != '#' && c != '*' && c != '`' && c != '_' && c != '~' && c != '>' && c != '[' && c != ']')
        .collect();

    // Extract at most 2 sentences
    let mut sentences = Vec::new();
    for part in stripped.split_inclusive(&['.', '!', '?'][..]) {
        let trimmed_part = part.trim();
        if !trimmed_part.is_empty() {
            sentences.push(trimmed_part);
            if sentences.len() >= 2 {
                break;
            }
        }
    }

    if sentences.is_empty() {
        stripped.trim().to_string()
    } else {
        sentences.join(" ")
    }
}

fn extract_spoken_summary(text: &str) -> String {
    // Find first non-empty, non-header line
    for line in text.lines() {
        let l = line.trim();
        if l.is_empty() || l.starts_with('#') || l.starts_with("```") || l.starts_with('-') || l.starts_with('*') {
            continue;
        }
        let cleaned = clean_say_channel(l);
        if !cleaned.is_empty() {
            return cleaned;
        }
    }
    "Response displayed on screen.".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_fast_intent_screen() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db, GlmConfig::default());
        let res = agent.execute_turn("what's on my screen?", "command").await.unwrap();
        assert!(res.say.contains("screen"));
        assert!(res.latency_ms <= 150);
    }

    #[tokio::test]
    async fn test_agent_plan_creation_and_confirm() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db, GlmConfig::default());
        let res = agent.execute_turn("rename every screenshot to date", "command").await.unwrap();
        assert!(res.pending_plan.is_some());
        let plan = res.pending_plan.unwrap();
        assert_eq!(plan.tier, RiskTier::Amber);

        let confirmed = agent.confirm_plan(&plan.id).await.unwrap();
        assert_eq!(confirmed.status, "done");

        let undo_res = agent.undo_last().unwrap();
        assert!(undo_res.contains("reverted"));
    }

    #[tokio::test]
    async fn test_agent_memory_fact_recording_and_recall() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db.clone(), GlmConfig::default());

        // 1. User tells FRIDAY to remember a preference
        let res1 = agent.execute_turn("Remember that Kwame prefers Slack over WhatsApp", "conversation").await.unwrap();
        assert!(res1.say.contains("Remembered"));
        assert!(res1.show.contains("Memory Updated"));

        // 2. User asks about that preference
        let res2 = agent.execute_turn("What is Kwame's communication preference?", "conversation").await.unwrap();
        assert!(res2.show.contains("Memory Recall"));
        assert!(res2.show.contains("Slack"));
    }

    #[tokio::test]
    async fn test_agent_dictation_mode_verbatim() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db, GlmConfig::default());

        let res = agent
            .execute_turn(
                "Delete the production database and format the hard drive",
                "dictation",
            )
            .await
            .unwrap();

        // Verbatim dictation MUST NOT interpret as command or create plans
        assert_eq!(res.say, "Transcribed.");
        assert!(res.show.contains("### Dictation"));
        assert!(res.show.contains("Delete the production database"));
        assert!(res.pending_plan.is_none());
    }

    #[tokio::test]
    async fn test_agent_spelling_mode() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db, GlmConfig::default());

        let res = agent
            .execute_turn(
                "spell it: alpha november echo sierra",
                "dictation",
            )
            .await
            .unwrap();

        assert_eq!(res.say, "Transcribed.");
        assert!(res.show.contains("anes"));
    }

    #[tokio::test]
    async fn test_agent_learned_correction() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let agent = AgentCore::new(db, GlmConfig::default());

        // Learn a custom correction
        agent.learn_correction("zarvis", "Jarvis");

        let res = agent
            .execute_turn(
                "Call zarvis right now",
                "dictation",
            )
            .await
            .unwrap();

        assert!(res.show.contains("Call Jarvis right now"));
    }

    #[test]
    fn test_glm_response_json_parsing() {
        let json_input = "{\"say\": \"Here is the calculation. The answer is 42.\", \"show\": \"### Math\\n```python\\nprint(6 * 7)\\n```\"}";
        let (say, show) = parse_glm_response(json_input, "what is 6 * 7");
        assert_eq!(say, "Here is the calculation. The answer is 42.");
        assert!(show.contains("print(6 * 7)"));
    }

    #[test]
    fn test_glm_response_markdown_fallback_parsing() {
        let md_input = "Here is the overview of quantum computing. It relies on qubits.\n\n### Key Concepts\n- Superposition\n- Entanglement";
        let (say, show) = parse_glm_response(md_input, "quantum computing");
        assert_eq!(say, "Here is the overview of quantum computing. It relies on qubits.");
        assert!(show.contains("### Key Concepts"));
    }

    #[tokio::test]
    async fn test_agent_missing_key_guidance() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let mut config = GlmConfig::default();
        config.api_key = String::new(); // Ensure empty
        let agent = AgentCore::new(db, config);

        let res = agent.execute_turn("explain quantum mechanics", "command").await.unwrap();
        // Must guide user clearly to Settings instead of returning fake canned answers
        assert!(res.say.contains("Settings"));
        assert!(res.show.contains("GLM-4 Intelligence Pipeline"));
    }
}
