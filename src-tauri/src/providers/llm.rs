use async_openai::{
    config::OpenAIConfig,
    types::{ChatCompletionRequestMessage, CreateChatCompletionRequestArgs},
    Client,
};
use std::time::Duration;
use tokio::time::timeout;
use tracing::{error, instrument, warn};

#[derive(Clone)]
pub struct DeepSeekProvider {
    client: Client<OpenAIConfig>,
    model_id: String,
}

impl DeepSeekProvider {
    pub fn new(api_key: &str) -> Self {
        // DeepSeek is fully OpenAI-compatible
        let config = OpenAIConfig::new()
            .with_api_key(api_key)
            .with_api_base("https://api.deepseek.com"); // V4.1 Flash endpoint

        Self {
            client: Client::with_config(config),
            model_id: "deepseek-flash".to_string(), // Explicitly V4.1 Flash
        }
    }

    #[instrument(skip(self, messages))]
    pub async fn execute_turn(
        &self,
        messages: Vec<ChatCompletionRequestMessage>,
        tools: Option<Vec<async_openai::types::ChatCompletionTool>>,
    ) -> Result<async_openai::types::CreateChatCompletionResponse, String> {
        let mut request_builder = CreateChatCompletionRequestArgs::default();
        request_builder
            .model(&self.model_id)
            .messages(messages)
            .max_tokens(4096_u16);

        if let Some(t) = tools {
            if !t.is_empty() {
                request_builder.tools(t);
            }
        }

        let request = request_builder.build().map_err(|e| e.to_string())?;

        // Circuit breaker / timeout implementation (20s max for interactive voice)
        let response =
            match timeout(Duration::from_secs(20), self.client.chat().create(request)).await {
                Ok(Ok(res)) => res,
                Ok(Err(e)) => {
                    error!("DeepSeek API Error: {}", e);
                    return Err(format!("API Error: {}", e));
                }
                Err(_) => {
                    warn!("DeepSeek request timed out after 20s");
                    return Err("Request timed out".to_string());
                }
            };

        Ok(response)
    }
}
