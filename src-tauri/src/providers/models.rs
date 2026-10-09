use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModelStatus {
    #[serde(rename = "Normal")]
    Normal,
    #[serde(rename = "Demote")]
    Demote,
    #[serde(rename = "No traffic")]
    NoTraffic,
}

impl ModelStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Normal => "Normal",
            Self::Demote => "Demote",
            Self::NoTraffic => "No traffic",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "Normal" => Self::Normal,
            "Demote" => Self::Demote,
            _ => Self::NoTraffic,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TrackerBlock {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    pub color: String,
    pub tooltip: String,
    pub latency_ms: u64,
    pub status: String,
    pub timestamp: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelTelemetry {
    pub availability_pct: f64,
    pub ttft_p90_ms: u64,
    pub avg_latency_ms: u64,
    pub tracker_history: Vec<TrackerBlock>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AiModel {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub capabilities: Vec<String>,
    pub status: ModelStatus,
    pub priority: u32,
    pub is_active: bool,
    pub telemetry: ModelTelemetry,
}

impl AiModel {
    pub fn update_with_test_result(
        &mut self,
        success: bool,
        ttft_ms: u64,
        latency_ms: u64,
        _msg: &str,
    ) {
        let duration = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let timestamp = duration.as_secs() as i64;
        let hours = (timestamp / 3600) % 24;
        let mins = (timestamp / 60) % 60;
        let secs = timestamp % 60;
        let time_str = format!("{:02}:{:02}:{:02}", hours, mins, secs);

        let (color, status_text) = if success {
            if latency_ms > 10000 {
                ("bg-amber-500", "200 Slow")
            } else {
                ("bg-emerald-500", "200 OK")
            }
        } else {
            ("bg-rose-500", "500 Error")
        };

        let tooltip = format!(
            "{} · {}ms (TTFT: {}ms) · {}",
            time_str, latency_ms, ttft_ms, status_text
        );

        let new_block = TrackerBlock {
            key: Some(format!("{}-{}", self.id, timestamp)),
            color: color.to_string(),
            tooltip,
            latency_ms,
            status: status_text.to_string(),
            timestamp,
        };

        let mut history = self.telemetry.tracker_history.clone();
        if history.len() >= 50 {
            history.remove(0);
        }
        history.push(new_block);

        // Recalculate metrics
        let total = history.len();
        let success_count = history.iter().filter(|b| !b.color.contains("rose")).count();
        let avail = if total > 0 {
            (success_count as f64 / total as f64) * 100.0
        } else {
            100.0
        };

        let mut latencies: Vec<u64> = history
            .iter()
            .map(|b| b.latency_ms)
            .filter(|&l| l > 0)
            .collect();
        latencies.sort_unstable();

        let avg = if !latencies.is_empty() {
            latencies.iter().sum::<u64>() / latencies.len() as u64
        } else {
            latency_ms
        };

        let p90_idx = if !latencies.is_empty() {
            ((latencies.len() as f64) * 0.9).min(latencies.len() as f64 - 1.0) as usize
        } else {
            0
        };
        let p90 = latencies.get(p90_idx).copied().unwrap_or(ttft_ms);

        self.telemetry.availability_pct = (avail * 100.0).round() / 100.0;
        self.telemetry.avg_latency_ms = avg;
        self.telemetry.ttft_p90_ms = p90;
        self.telemetry.tracker_history = history;

        if !success && self.status == ModelStatus::Normal {
            self.status = ModelStatus::Demote;
        }
    }
}

/// Helper to build synthetic tracker history matching the user's dashboard
fn build_synthetic_tracker(
    pattern: &str, // 'G': green, 'Y': yellow, 'O': orange, 'R': red, '.': edge/gray
    base_latency: u64,
) -> Vec<TrackerBlock> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let chars: Vec<char> = pattern.chars().collect();
    let total = chars.len();

    chars
        .into_iter()
        .enumerate()
        .map(|(i, c)| {
            let offset_sec = ((total - 1 - i) * 60) as i64;
            let ts = now - offset_sec;
            let hours = (ts.max(0) / 3600) % 24;
            let mins = (ts.max(0) / 60) % 60;
            let time_str = format!("{:02}:{:02}", hours, mins);

            let (color, status, mult) = match c {
                'G' => ("bg-emerald-500", "200 OK", 1.0),
                'Y' => ("bg-amber-500", "200 High TTFT", 1.8),
                'O' => ("bg-orange-500", "200 Degraded", 2.6),
                'R' => ("bg-rose-500", "502 Gateway Timeout", 5.0),
                _ => ("bg-[var(--color-edge)]/60", "No Traffic", 0.0),
            };

            let lat = (base_latency as f64 * mult) as u64;
            let tooltip = if c == '.' {
                format!("{} · Idle", time_str)
            } else {
                format!("{} · {}ms · {}", time_str, lat, status)
            };

            TrackerBlock {
                key: Some(format!("b-{}", i)),
                color: color.to_string(),
                tooltip,
                latency_ms: lat,
                status: status.to_string(),
                timestamp: ts,
            }
        })
        .collect()
}

/// Default fleet seed matching user's Agent Router dashboard
pub fn get_default_models_fleet() -> Vec<AiModel> {
    vec![
        AiModel {
            id: "gpt-6-astra".to_string(),
            name: "gpt-6-astra".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec!["chat".to_string(), "responses".to_string()],
            status: ModelStatus::Normal,
            priority: 0,
            is_active: true,
            telemetry: ModelTelemetry {
                availability_pct: 98.45,
                ttft_p90_ms: 31983,
                avg_latency_ms: 13388,
                tracker_history: build_synthetic_tracker(
                    "..................................GGGGGGGG..................",
                    13388,
                ),
            },
        },
        AiModel {
            id: "deepseek-v4-flash".to_string(),
            name: "deepseek-v4-flash".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec![
                "chat".to_string(),
                "responses".to_string(),
                "claude_native".to_string(),
            ],
            status: ModelStatus::Demote,
            priority: 1,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 95.44,
                ttft_p90_ms: 1862,
                avg_latency_ms: 5410,
                tracker_history: build_synthetic_tracker(
                    "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO",
                    5410,
                ),
            },
        },
        AiModel {
            id: "claude-opus-5".to_string(),
            name: "claude-opus-5".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec!["claude_native".to_string()],
            status: ModelStatus::Demote,
            priority: 2,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 95.01,
                ttft_p90_ms: 22500,
                avg_latency_ms: 23778,
                tracker_history: build_synthetic_tracker(
                    "..................................OOOOOOOO..................",
                    23778,
                ),
            },
        },
        AiModel {
            id: "claude-opus-4-8".to_string(),
            name: "claude-opus-4-8".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec!["claude_native".to_string()],
            status: ModelStatus::Demote,
            priority: 3,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 98.03,
                ttft_p90_ms: 9276,
                avg_latency_ms: 14008,
                tracker_history: build_synthetic_tracker(
                    "..................................GGGGGGOO..................",
                    14008,
                ),
            },
        },
        AiModel {
            id: "claude-fable-5".to_string(),
            name: "claude-fable-5".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec!["claude_native".to_string()],
            status: ModelStatus::NoTraffic,
            priority: 4,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 0.0,
                ttft_p90_ms: 0,
                avg_latency_ms: 0,
                tracker_history: build_synthetic_tracker(
                    "............................................................",
                    0,
                ),
            },
        },
        AiModel {
            id: "glm-5.3".to_string(),
            name: "glm-5.3".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec![
                "chat".to_string(),
                "claude_native".to_string(),
                "responses".to_string(),
            ],
            status: ModelStatus::NoTraffic,
            priority: 5,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 0.0,
                ttft_p90_ms: 0,
                avg_latency_ms: 0,
                tracker_history: build_synthetic_tracker(
                    "............................................................",
                    0,
                ),
            },
        },
        AiModel {
            id: "gpt-5.6-sol".to_string(),
            name: "gpt-5.6-sol".to_string(),
            provider: "agentrouter".to_string(),
            base_url: "https://agentrouter.org/v1".to_string(),
            api_key: None,
            capabilities: vec!["chat".to_string(), "responses".to_string()],
            status: ModelStatus::NoTraffic,
            priority: 6,
            is_active: false,
            telemetry: ModelTelemetry {
                availability_pct: 0.0,
                ttft_p90_ms: 0,
                avg_latency_ms: 0,
                tracker_history: build_synthetic_tracker(
                    "............................................................",
                    0,
                ),
            },
        },
    ]
}

/// Tests a specific model connection with a lightweight prompt, measuring TTFT and latency
pub async fn test_model_ping(
    http: &reqwest::Client,
    model: &AiModel,
    api_key: &str,
) -> Result<(u64, u64, String), String> {
    if api_key.trim().is_empty() {
        return Err("No API key configured for model test".to_string());
    }

    let url = crate::providers::glm::normalize_api_url(&model.base_url);
    let is_reasoner = model.name.contains("reasoner") || model.name.contains("r1");

    let mut map = serde_json::Map::new();
    map.insert("model".to_string(), json!(model.name));
    map.insert(
        "messages".to_string(),
        json!([
            { "role": "user", "content": "ping" }
        ]),
    );
    map.insert("max_tokens".to_string(), json!(16));
    if !is_reasoner {
        map.insert("temperature".to_string(), json!(0.0));
    }
    map.insert("stream".to_string(), json!(false));
    let payload = Value::Object(map);

    let start = Instant::now();
    let res = http
        .post(&url)
        .bearer_auth(api_key.trim())
        .json(&payload)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Request error: {}", e))?;

    let ttft = start.elapsed().as_millis() as u64;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    let body: Value = res
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;
    let total_latency = start.elapsed().as_millis() as u64;

    let content = body
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .and_then(|f| f.get("message"))
        .and_then(|m| m.get("content").or_else(|| m.get("reasoning_content")))
        .and_then(|c| c.as_str())
        .unwrap_or("OK")
        .to_string();

    Ok((ttft, total_latency, content))
}
