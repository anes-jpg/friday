use crate::agent::mcp_client::AgentMcpClient;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info};

#[derive(Clone, Debug, PartialEq)]
pub enum AgentState {
    Idle,
    Processing,
}

pub struct HarnessKernel {
    pub state: Arc<Mutex<AgentState>>,
    pub mcp_client: Arc<Mutex<Option<AgentMcpClient>>>,
}

impl Default for HarnessKernel {
    fn default() -> Self {
        Self::new()
    }
}

impl HarnessKernel {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(AgentState::Idle)),
            mcp_client: Arc::new(Mutex::new(None)),
        }
    }

    pub fn with_mcp_client(mcp_client: Arc<Mutex<Option<AgentMcpClient>>>) -> Self {
        Self {
            state: Arc::new(Mutex::new(AgentState::Idle)),
            mcp_client,
        }
    }


    pub async fn boot(&self) -> Result<(), String> {
        info!("Booting Harness Kernel and connecting to Python MCP Server...");
        let client = AgentMcpClient::spawn().await?;
        *self.mcp_client.lock().await = Some(client);
        Ok(())
    }

    /// Triggered when the local Sherpa VAD endpoints a spoken utterance
    pub async fn on_utterance_end(&self, raw_text: &str) -> Result<String, String> {
        *self.state.lock().await = AgentState::Processing;
        info!(
            "Sending utterance to Python LangGraph MCP backend: {}",
            raw_text
        );

        let mut client_guard = self.mcp_client.lock().await;
        if let Some(client) = client_guard.as_mut() {
            match client.process_utterance(raw_text).await {
                Ok(resp) => {
                    info!("MCP Backend responded: {}", resp);
                    *self.state.lock().await = AgentState::Idle;
                    Ok(resp)
                }
                Err(e) => {
                    error!("MCP Error: {}", e);
                    *self.state.lock().await = AgentState::Idle;
                    Err(e)
                }
            }
        } else {
            Err("MCP Client not initialized. Call boot() first.".into())
        }
    }
}
