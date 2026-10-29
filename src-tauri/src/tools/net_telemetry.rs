use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmarineCableNode {
    pub id: String,
    pub name: String,
    pub landing_point: String,
    pub coordinates: [f64; 2], // [lng, lat]
    pub capacity_tbps: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSocketArc {
    pub id: String,
    pub pid: u32,
    pub process_name: String,
    pub local_addr: String,
    pub remote_addr: String,
    pub remote_ip: String,
    pub remote_port: u16,
    pub protocol: String,
    pub state: String,
    pub remote_city: Option<String>,
    pub remote_country: Option<String>,
    pub origin_coords: [f64; 2], // local [lng, lat]
    pub remote_coords: [f64; 2], // destination [lng, lat]
    pub cable_landing_ref: Option<String>,
    /// True while the arc comes from a sample/simulated feed (audit F01:
    /// sample records must never be able to drive real process termination).
    #[serde(default)]
    pub simulated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSocketArcResponse {
    pub arcs: Vec<NetworkSocketArc>,
    pub cables: Vec<SubmarineCableNode>,
}

pub struct NetTelemetryEngine {
    cables: Vec<SubmarineCableNode>,
}

impl Default for NetTelemetryEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl NetTelemetryEngine {
    pub fn new() -> Self {
        let cables = vec![
            SubmarineCableNode {
                id: "cable-marea".to_string(),
                name: "MAREA Transatlantic Cable".to_string(),
                landing_point: "Virginia Beach, USA -> Bilbao, Spain".to_string(),
                coordinates: [-75.97, 36.85],
                capacity_tbps: 200.0,
            },
            SubmarineCableNode {
                id: "cable-dunant".to_string(),
                name: "Dunant Transatlantic".to_string(),
                landing_point: "Virginia Beach, USA -> Saint-Hilaire-de-Riez, France".to_string(),
                coordinates: [-1.94, 46.72],
                capacity_tbps: 250.0,
            },
            SubmarineCableNode {
                id: "cable-grace-hopper".to_string(),
                name: "Grace Hopper Submarine Cable".to_string(),
                landing_point: "New York, USA -> Bude, UK -> Bilbao, Spain".to_string(),
                coordinates: [-4.54, 50.83],
                capacity_tbps: 340.0,
            },
            SubmarineCableNode {
                id: "cable-peace".to_string(),
                name: "PEACE Cable System".to_string(),
                landing_point: "Gwadar, Pakistan -> Marseille, France".to_string(),
                coordinates: [5.37, 43.30],
                capacity_tbps: 96.0,
            },
            SubmarineCableNode {
                id: "cable-sea-me-we-6".to_string(),
                name: "SEA-ME-WE 6".to_string(),
                landing_point: "Singapore -> Marseille, France".to_string(),
                coordinates: [103.82, 1.35],
                capacity_tbps: 126.0,
            },
        ];
        Self { cables }
    }

    /// Queries active TCP/UDP connections mapped to processes with spatial GeoIP projection
    pub fn get_socket_arcs(&self) -> Vec<NetworkSocketArc> {
        // Enumerate realistic active network sockets across common developer processes
        let dev_processes = [
            (1420, "Code.exe", "140.82.121.4", 443, "GitHub Copilot / Telemetry", "San Francisco", "US", [-122.4194, 37.7749]),
            (3290, "cargo.exe", "151.101.1.228", 443, "crates.io / Fastly CDN", "New York", "US", [-74.0060, 40.7128]),
            (8840, "friday.exe", "104.18.26.120", 443, "Cloudflare Workers / OpenFreeMap", "London", "UK", [-0.1278, 51.5074]),
            (4512, "chrome.exe", "142.250.180.206", 443, "Google Cloud Platform", "Dublin", "IE", [-6.2603, 53.3498]),
            (2110, "postgres.exe", "127.0.0.1", 5432, "Local Database Server", "Localhost", "Local", [-122.4194, 37.7749]),
        ];

        let local_coords = [-122.4194, 37.7749]; // San Francisco base or local host

        dev_processes
            .iter()
            .enumerate()
            .map(|(idx, &(pid, proc, ip, port, _desc, city, country, remote_coords))| {
                let cable_ref = self
                    .cables
                    .first()
                    .map(|c| c.name.clone());

                NetworkSocketArc {
                    id: format!("sock-arc-{}", idx),
                    pid,
                    process_name: proc.to_string(),
                    local_addr: format!("127.0.0.1:{}", 50000 + idx),
                    remote_addr: format!("{}:{}", ip, port),
                    remote_ip: ip.to_string(),
                    remote_port: port,
                    protocol: "TCP".to_string(),
                    state: "ESTABLISHED".to_string(),
                    remote_city: Some(city.to_string()),
                    remote_country: Some(country.to_string()),
                    origin_coords: local_coords,
                    remote_coords,
                    cable_landing_ref: cable_ref,
                    simulated: true,
                }
            })
            .collect()
    }

    pub fn get_cables(&self) -> Vec<SubmarineCableNode> {
        self.cables.clone()
    }

    /// Terminates a process by PID (Red Tier).
    /// Sample/simulated telemetry records are refused outright (audit F01), and
    /// every accepted request is first validated against a fresh OS enumeration
    /// so a mismatched or recycled PID can never be terminated under a fake name.
    pub fn terminate_process(pid: u32, process_name: &str, simulated: bool) -> Result<bool, String> {
        if pid == 0 || pid == 4 {
            return Err("Cannot terminate protected system critical process".to_string());
        }
        if simulated {
            return Err(format!(
                "Sample telemetry for PID {} ({}) cannot terminate real processes",
                pid, process_name
            ));
        }

        #[cfg(target_os = "windows")]
        {
            let declared = process_name.trim_end_matches(".exe").to_ascii_lowercase();
            let actual = Self::real_process_image(pid)
                .map_err(|e| format!("Process identity check failed for PID {}: {}", pid, e))?;
            if actual != declared {
                return Err(format!(
                    "Refusing termination: PID {} is running '{}', not '{}' (identity validation failed)",
                    pid, actual, process_name
                ));
            }

            use std::os::windows::process::CommandExt;
            use std::process::Command;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let output = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("Failed to invoke taskkill for PID {}: {}", pid, e))?;

            if output.status.success() {
                Ok(true)
            } else {
                let err = String::from_utf8_lossy(&output.stderr);
                Err(format!("Process termination failed: {}", err.trim()))
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err(format!(
                "Process termination is a Windows capability; no action was performed for PID {}",
                pid
            ))
        }
    }

    /// Fresh OS enumeration for identity validation (audit F01): reads the real
    /// image name for `pid` so a mismatched or recycled PID is refused even when
    /// the caller supplies a plausible process name.
    #[cfg(target_os = "windows")]
    fn real_process_image(pid: u32) -> Result<String, String> {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to enumerate PID {}: {}", pid, e))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let line = text.lines().next().unwrap_or("").trim().to_string();
        if line.is_empty() || line.starts_with("INFO:") {
            return Err(format!("No process is running with PID {}", pid));
        }
        let image = line
            .split(',')
            .next()
            .map(|field| field.trim_matches('"'))
            .unwrap_or("");
        if image.is_empty() {
            return Err(format!("Could not read the image name for PID {}", pid));
        }
        Ok(image.trim_end_matches(".exe").to_ascii_lowercase())
    }

    #[cfg(not(target_os = "windows"))]
    fn real_process_image(pid: u32) -> Result<String, String> {
        Err(format!(
            "Process enumeration is unavailable on this platform (PID {})",
            pid
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_telemetry_arcs() {
        let engine = NetTelemetryEngine::new();
        let arcs = engine.get_socket_arcs();
        assert!(!arcs.is_empty());
        assert_eq!(arcs[0].protocol, "TCP");
        assert_eq!(arcs[0].origin_coords.len(), 2);
        assert_eq!(arcs[0].remote_coords.len(), 2);

        let cables = engine.get_cables();
        assert_eq!(cables.len(), 5);
    }

    #[test]
    fn test_sample_socket_arcs_are_marked_simulated() {
        let engine = NetTelemetryEngine::new();
        for arc in engine.get_socket_arcs() {
            assert!(arc.simulated, "sample arc {} must be marked simulated", arc.id);
        }
    }

    #[test]
    fn test_sample_pid_cannot_terminate_real_process() {
        let result = NetTelemetryEngine::terminate_process(4512, "chrome.exe", true);
        assert!(result.is_err());
        let message = result.err().unwrap_or_default();
        assert!(message.contains("Sample telemetry"), "{}", message);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_identity_mismatch_pid_is_refused() {
        // A PID no real process owns, declared under an unrelated name: the
        // fresh-enumeration identity check must refuse the termination.
        let result = NetTelemetryEngine::terminate_process(u32::MAX - 1, "chrome.exe", false);
        assert!(result.is_err());
        let message = result.err().unwrap_or_default();
        assert!(
            message.contains("identity check failed") || message.contains("Refusing termination"),
            "{}",
            message
        );
    }
}
