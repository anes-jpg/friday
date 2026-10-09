use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum RiskTier {
    Green, // Runs silently, narrates in past tense
    Amber, // Spoken 1-sentence preview, "go ahead?"
    Red,   // Distinguishing detail + requires typed/spoken "confirm"
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub enum Resource {
    FileSystem { path: String },
    ShellCommand { binary: String },
    Network { url: String },
    Window { hwnd: isize },
    System,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CapabilityToken {
    pub id: Uuid,
    pub scope: Resource,
    pub tier: RiskTier,
    pub expires: SystemTime,
}

impl CapabilityToken {
    pub fn new(scope: Resource, tier: RiskTier, ttl_secs: u64) -> Self {
        Self {
            id: Uuid::now_v7(),
            scope,
            tier,
            expires: SystemTime::now() + std::time::Duration::from_secs(ttl_secs),
        }
    }

    pub fn is_valid(&self) -> bool {
        SystemTime::now() <= self.expires
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolReceipt {
    pub execution_id: Uuid,
    pub tool_name: String,
    pub token: Option<CapabilityToken>,
    pub result: serde_json::Value,
    pub duration_ms: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ToolError {
    Unauthorized(String),
    ValidationError(String),
    ExecutionFailed(String),
}

impl std::fmt::Display for ToolError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ToolError::Unauthorized(m) => write!(f, "Unauthorized: {}", m),
            ToolError::ValidationError(m) => write!(f, "Validation Error: {}", m),
            ToolError::ExecutionFailed(m) => write!(f, "Execution Failed: {}", m),
        }
    }
}

pub fn validate_tool_args(
    schema: &serde_json::Value,
    args: &serde_json::Value,
) -> Result<(), ToolError> {
    let compiled_schema = jsonschema::validator_for(schema)
        .map_err(|e| ToolError::ValidationError(format!("Invalid schema: {}", e)))?;

    compiled_schema.validate(args).map_err(|err| {
        ToolError::ValidationError(format!("Arguments do not match schema: {}", err))
    })
}
