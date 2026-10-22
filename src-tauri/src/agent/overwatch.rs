use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OverwatchCategory {
    PanicStacktrace,
    BuildFailure,
    ThermalSpike,
    SocketAnomaly,
    TaskRecommendation,
}

impl OverwatchCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PanicStacktrace => "panic",
            Self::BuildFailure => "build_error",
            Self::ThermalSpike => "thermal_alert",
            Self::SocketAnomaly => "socket_anomaly",
            Self::TaskRecommendation => "recommendation",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverwatchInterjection {
    pub id: String,
    pub category: OverwatchCategory,
    pub title: String,
    pub summary: String,
    pub suggestion: String,
    pub code_snippet: Option<String>,
    pub timestamp: u64,
    pub dismissed: bool,
}

#[derive(Clone)]
pub struct OverwatchManager {
    enabled: Arc<AtomicBool>,
    interjections: Arc<Mutex<VecDeque<OverwatchInterjection>>>,
    last_processed_text: Arc<Mutex<Option<String>>>,
}

impl Default for OverwatchManager {
    fn default() -> Self {
        Self::new()
    }
}

impl OverwatchManager {
    pub fn new() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(true)),
            interjections: Arc::new(Mutex::new(VecDeque::with_capacity(32))),
            last_processed_text: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, val: bool) {
        self.enabled.store(val, Ordering::SeqCst);
    }

    /// Evaluates copied clipboard text for panics, tracebacks, or compile errors
    pub fn inspect_clipboard_text(&self, text: &str) -> Option<OverwatchInterjection> {
        if !self.is_enabled() {
            return None;
        }

        let trimmed = text.trim();
        if trimmed.len() < 16 {
            return None;
        }

        // Deduplicate rapid identical clipboard inspections
        if let Ok(mut last) = self.last_processed_text.lock() {
            if let Some(ref prev) = *last {
                if prev == trimmed {
                    return None;
                }
            }
            *last = Some(trimmed.to_string());
        }

        // 1. Rust Panic Detection
        if trimmed.contains("panicked at") || trimmed.contains("RUST_BACKTRACE") {
            let error_line = trimmed
                .lines()
                .find(|l| l.contains("panicked at"))
                .unwrap_or("Rust process thread panic");

            let interjection = OverwatchInterjection {
                id: format!("ow-{}", now_timestamp_ms()),
                category: OverwatchCategory::PanicStacktrace,
                title: "Rust Panic Intercepted".to_string(),
                summary: format!("Detected thread panic in your copied buffer: {}", error_line),
                suggestion: "Would you like me to inspect the caller line and prepare an unwrap fix?"
                    .to_string(),
                code_snippet: Some(trimmed.lines().take(6).collect::<Vec<_>>().join("\n")),
                timestamp: now_timestamp_ms(),
                dismissed: false,
            };
            self.push_interjection(interjection.clone());
            return Some(interjection);
        }

        // 2. Python Traceback Detection
        if trimmed.contains("Traceback (most recent call last):") {
            let last_line = trimmed
                .lines()
                .rev()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("Exception encountered");

            let interjection = OverwatchInterjection {
                id: format!("ow-{}", now_timestamp_ms()),
                category: OverwatchCategory::PanicStacktrace,
                title: "Python Traceback Intercepted".to_string(),
                summary: format!("Exception caught in copied traceback: {}", last_line),
                suggestion: "I can trace the failing module and verify argument types for you."
                    .to_string(),
                code_snippet: Some(trimmed.lines().take(8).collect::<Vec<_>>().join("\n")),
                timestamp: now_timestamp_ms(),
                dismissed: false,
            };
            self.push_interjection(interjection.clone());
            return Some(interjection);
        }

        // 3. TypeScript / JavaScript Runtime Error
        if trimmed.contains("TypeError:")
            || trimmed.contains("ReferenceError:")
            || trimmed.contains("SyntaxError:")
        {
            let err_line = trimmed
                .lines()
                .find(|l| l.contains("Error:"))
                .unwrap_or("JavaScript Runtime Error");

            let interjection = OverwatchInterjection {
                id: format!("ow-{}", now_timestamp_ms()),
                category: OverwatchCategory::PanicStacktrace,
                title: "JavaScript Exception Intercepted".to_string(),
                summary: err_line.to_string(),
                suggestion: "Shall I inspect the null assertion or missing property contract?"
                    .to_string(),
                code_snippet: Some(trimmed.lines().take(5).collect::<Vec<_>>().join("\n")),
                timestamp: now_timestamp_ms(),
                dismissed: false,
            };
            self.push_interjection(interjection.clone());
            return Some(interjection);
        }

        // 4. Git Conflict / Push Rejection
        if trimmed.contains("CONFLICT (content): Merge conflict")
            || trimmed.contains("[rejected]") && trimmed.contains("non-fast-forward")
        {
            let interjection = OverwatchInterjection {
                id: format!("ow-{}", now_timestamp_ms()),
                category: OverwatchCategory::TaskRecommendation,
                title: "Git Synchronization Conflict".to_string(),
                summary: "Your branch has diverged with unmerged conflicts.".to_string(),
                suggestion: "I can inspect both conflicting diff chunks and propose a clean merge."
                    .to_string(),
                code_snippet: None,
                timestamp: now_timestamp_ms(),
                dismissed: false,
            };
            self.push_interjection(interjection.clone());
            return Some(interjection);
        }

        None
    }

    /// Evaluates terminal command outputs or compilation failures
    pub fn inspect_command_output(
        &self,
        cmd: &str,
        output: &str,
        exit_code: i32,
    ) -> Option<OverwatchInterjection> {
        if !self.is_enabled() || exit_code == 0 {
            return None;
        }

        if output.contains("error[E") || output.contains("could not compile `") {
            let error_summary = output
                .lines()
                .find(|l| l.contains("error[E") || l.contains("error:"))
                .unwrap_or("Rust compilation error");

            let interjection = OverwatchInterjection {
                id: format!("ow-{}", now_timestamp_ms()),
                category: OverwatchCategory::BuildFailure,
                title: format!("Build Failure: {}", cmd),
                summary: error_summary.to_string(),
                suggestion: "I have localized the compiler diagnostic. Would you like me to resolve the type mismatch?"
                    .to_string(),
                code_snippet: Some(output.lines().take(6).collect::<Vec<_>>().join("\n")),
                timestamp: now_timestamp_ms(),
                dismissed: false,
            };
            self.push_interjection(interjection.clone());
            return Some(interjection);
        }

        None
    }

    fn push_interjection(&self, item: OverwatchInterjection) {
        if let Ok(mut lock) = self.interjections.lock() {
            if lock.len() >= 32 {
                lock.pop_back();
            }
            lock.push_front(item);
        }
    }

    pub fn get_active_interjections(&self) -> Vec<OverwatchInterjection> {
        if let Ok(lock) = self.interjections.lock() {
            lock.iter().filter(|i| !i.dismissed).cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub fn dismiss(&self, id: &str) -> bool {
        if let Ok(mut lock) = self.interjections.lock() {
            for item in lock.iter_mut() {
                if item.id == id {
                    item.dismissed = true;
                    return true;
                }
            }
        }
        false
    }
}

fn now_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_overwatch_rust_panic_detection() {
        let manager = OverwatchManager::new();
        let panic_text = "thread 'main' panicked at src/lib.rs:42:10:\nexplicit panic\nnote: run with `RUST_BACKTRACE=1`";
        let interjection = manager.inspect_clipboard_text(panic_text);

        assert!(interjection.is_some());
        let item = interjection.unwrap();
        assert_eq!(item.category, OverwatchCategory::PanicStacktrace);
        assert!(item.summary.contains("panicked at"));
        assert_eq!(manager.get_active_interjections().len(), 1);

        assert!(manager.dismiss(&item.id));
        assert_eq!(manager.get_active_interjections().len(), 0);
    }

    #[test]
    fn test_overwatch_python_traceback_detection() {
        let manager = OverwatchManager::new();
        let py_trace = "Traceback (most recent call last):\n  File \"app.py\", line 12, in <module>\nKeyError: 'api_key'";
        let interjection = manager.inspect_clipboard_text(py_trace);

        assert!(interjection.is_some());
        let item = interjection.unwrap();
        assert_eq!(item.category, OverwatchCategory::PanicStacktrace);
        assert!(item.summary.contains("KeyError"));
    }
}
