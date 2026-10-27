use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuVitals {
    pub name: String,
    pub temperature_c: Option<f32>,
    pub utilization_percent: Option<f32>,
    pub vram_used_mb: Option<u32>,
    pub vram_total_mb: Option<u32>,
    pub power_watts: Option<f32>,
    #[serde(default = "default_vram_budget")]
    pub vram_budget_mb: u32,
    #[serde(default = "default_thermal_status")]
    pub thermal_status: String,
}

fn default_vram_budget() -> u32 {
    2048
}

fn default_thermal_status() -> String {
    "Unavailable".to_string()
}

impl GpuVitals {
    /// Validates whether a candidate edge model fits within the 2048 MB VRAM budget
    /// leaving at least 400 MB reserved for Windows DWM and UI compositing
    pub fn is_vram_safe_for_model(&self, model_size_mb: u32) -> bool {
        let ceiling = self.vram_total_mb.unwrap_or(0).min(self.vram_budget_mb);
        let safe_limit = ceiling.saturating_sub(400);
        model_size_mb <= safe_limit
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanDevice {
    pub ip: String,
    pub mac: String,
    pub hostname: String,
    pub device_type: String, // Router, Workstation, Storage, IoT, Phone
    pub latency_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHardwareTelemetry {
    pub cpu_percent: Option<f32>,
    pub ram_used_mb: Option<u32>,
    pub ram_total_mb: Option<u32>,
    pub gpu: GpuVitals,
    pub lan_devices: Vec<LanDevice>,
}

pub struct HardwareTelemetryEngine;

impl Default for HardwareTelemetryEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl HardwareTelemetryEngine {
    pub fn new() -> Self {
        Self
    }

    /// Only observed Windows memory/CPU values; GPU sensors are unavailable.
    pub fn get_telemetry(&self) -> SystemHardwareTelemetry {
        let sample=crate::health::resources();
        SystemHardwareTelemetry {cpu_percent:sample.system_cpu_percent,ram_used_mb:sample.ram_used_mb,ram_total_mb:sample.ram_total_mb,
            gpu:GpuVitals {name:"Unavailable".into(),temperature_c:None,utilization_percent:None,vram_used_mb:None,vram_total_mb:None,power_watts:None,vram_budget_mb:2048,thermal_status:"Unavailable".into()},lan_devices:vec![]}
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn unknown_gpu_does_not_claim_sensor_readings_or_model_capacity() {
        let telemetry=HardwareTelemetryEngine::new().get_telemetry();
        assert!(telemetry.gpu.temperature_c.is_none());assert!(telemetry.lan_devices.is_empty());
        assert!(!telemetry.gpu.is_vram_safe_for_model(410));
        let mut measured=telemetry.gpu;measured.vram_total_mb=Some(2048);
        assert!(measured.is_vram_safe_for_model(1050));assert!(!measured.is_vram_safe_for_model(4200));
    }
}
