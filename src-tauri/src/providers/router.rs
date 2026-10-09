use crate::providers::glm::{GlmConfig, GlmProvider, StreamDelta};
use crate::providers::models::{test_model_ping, AiModel, ModelStatus};
use serde_json::Value;
use std::time::Instant;

#[derive(Clone)]
pub struct AiRouter {
    pub models: Vec<AiModel>,
    pub http: reqwest::Client,
}

impl AiRouter {
    pub fn new(initial_models: Vec<AiModel>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .user_agent("Cline/1.0.0")
            .build()
            .unwrap_or_default();

        Self {
            models: initial_models,
            http,
        }
    }

    pub fn get_models(&self) -> &[AiModel] {
        &self.models
    }

    pub fn get_active_model(&self) -> Option<&AiModel> {
        self.models
            .iter()
            .find(|m| m.is_active)
            .or_else(|| self.models.first())
    }

    pub fn set_active_model(&mut self, id: &str) -> Result<(), String> {
        let exists = self.models.iter().any(|m| m.id == id);
        if !exists {
            return Err(format!("Model '{}' not found in fleet", id));
        }
        for m in &mut self.models {
            m.is_active = m.id == id;
        }
        Ok(())
    }

    pub fn toggle_status(&mut self, id: &str, new_status: ModelStatus) -> Result<(), String> {
        if let Some(m) = self.models.iter_mut().find(|m| m.id == id) {
            m.status = new_status;
            Ok(())
        } else {
            Err(format!("Model '{}' not found", id))
        }
    }

    pub fn update_model(&mut self, updated: AiModel) {
        if let Some(pos) = self.models.iter().position(|m| m.id == updated.id) {
            self.models[pos] = updated;
        } else {
            self.models.push(updated);
        }
    }

    pub fn add_model(&mut self, new_model: AiModel) {
        self.models.retain(|m| m.id != new_model.id);
        self.models.push(new_model);
    }

    pub fn delete_model(&mut self, id: &str) -> Result<(), String> {
        let initial_len = self.models.len();
        self.models.retain(|m| m.id != id);
        if self.models.len() == initial_len {
            return Err(format!("Model '{}' not found", id));
        }
        // Ensure at least one model is active
        if !self.models.iter().any(|m| m.is_active) {
            if let Some(first) = self.models.first_mut() {
                first.is_active = true;
            }
        }
        Ok(())
    }

    /// Selects the best candidate model for reasoning turns, respecting status and fallback
    pub fn select_execution_candidates(&self) -> Vec<AiModel> {
        let mut candidates = Vec::new();

        // 1. Primary active model (skip if marked NoTraffic)
        if let Some(active) = self.get_active_model() {
            if active.status != ModelStatus::NoTraffic {
                candidates.push(active.clone());
            }
        }

        // 2. Normal status models as fallback
        for m in &self.models {
            if candidates.iter().all(|c| c.id != m.id) && m.status == ModelStatus::Normal {
                candidates.push(m.clone());
            }
        }

        // 3. Demoted models if no Normal model exists
        for m in &self.models {
            if candidates.iter().all(|c| c.id != m.id) && m.status == ModelStatus::Demote {
                candidates.push(m.clone());
            }
        }

        candidates
    }

    /// Tests a model connection with real ping, updating its tracker bar and metrics
    pub async fn test_model(
        &mut self,
        id: &str,
        effective_key: &str,
    ) -> Result<(u64, u64, String), String> {
        let model = self
            .models
            .iter()
            .find(|m| m.id == id)
            .cloned()
            .ok_or_else(|| format!("Model '{}' not found", id))?;

        let key = model
            .api_key
            .as_deref()
            .filter(|k| !k.trim().is_empty())
            .unwrap_or(effective_key);

        let res = test_model_ping(&self.http, &model, key).await;

        if let Some(m) = self.models.iter_mut().find(|m| m.id == id) {
            match &res {
                Ok((ttft, lat, msg)) => {
                    m.update_with_test_result(true, *ttft, *lat, msg);
                }
                Err(err) => {
                    m.update_with_test_result(false, 0, 0, err);
                }
            }
        }

        res
    }

    /// Executes completion with automatic fallback across models in candidate priority
    pub async fn execute_routed_turn<F>(
        &self,
        messages: Vec<Value>,
        tools: Vec<Value>,
        needs_reasoning: bool,
        global_key: &str,
        on_delta: F,
    ) -> Result<(String, Vec<Value>, String, u64, u64), String>
    where
        F: FnMut(StreamDelta) + Clone,
    {
        let candidates = self.select_execution_candidates();
        if candidates.is_empty() {
            return Err("No AI models available in fleet".to_string());
        }

        let mut primary_err = String::new();
        let mut last_err = String::new();

        for (i, candidate) in candidates.into_iter().enumerate() {
            let key = candidate
                .api_key
                .as_deref()
                .filter(|k| !k.trim().is_empty())
                .unwrap_or(global_key);

            let config = GlmConfig {
                base_url: candidate.base_url.clone(),
                api_key: key.to_string(),
                heavy_model: candidate.name.clone(),
                light_model: candidate.name.clone(),
            };

            let provider = GlmProvider::new(config);
            let start = Instant::now();

            match provider
                .stream_completion(
                    messages.clone(),
                    tools.clone(),
                    needs_reasoning,
                    on_delta.clone(),
                )
                .await
            {
                Ok((text, tools_res)) => {
                    let total_ms = start.elapsed().as_millis() as u64;
                    let ttft_ms = (total_ms / 3).max(50);
                    return Ok((text, tools_res, candidate.id, ttft_ms, total_ms));
                }
                Err(e) => {
                    tracing::warn!(
                        "Model '{}' failed turn: {}. Attempting fallback...",
                        candidate.id,
                        e
                    );
                    if i == 0 {
                        primary_err = format!("Configured model '{}' error: {}", candidate.name, e);
                    }
                    last_err = format!("Model '{}': {}", candidate.name, e);
                }
            }
        }

        let summary_err = if !primary_err.is_empty() {
            primary_err
        } else {
            last_err
        };
        Err(summary_err)
    }
}
