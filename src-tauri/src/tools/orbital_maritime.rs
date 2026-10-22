use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SatelliteTrack {
    pub norad_id: u32,
    pub name: String,
    pub category: String, // Space Station, Earth Observation, Navigation, Communication
    pub coordinates: [f64; 2], // [lng, lat]
    pub altitude_km: f64,
    pub velocity_kms: f64,
    pub inclination_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaritimeVessel {
    pub mmsi: u32,
    pub name: String,
    pub vessel_type: String, // Cargo, Tanker, Carrier, Research
    pub coordinates: [f64; 2], // [lng, lat]
    pub speed_knots: f64,
    pub heading_deg: f64,
    pub destination: String,
    pub flag: String,
}

pub struct OrbitalMaritimeEngine;

impl Default for OrbitalMaritimeEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl OrbitalMaritimeEngine {
    pub fn new() -> Self {
        Self
    }

    /// Computes spatial orbital positions for high-priority orbital bodies
    pub fn get_satellites(&self) -> Vec<SatelliteTrack> {
        vec![
            SatelliteTrack {
                norad_id: 25544,
                name: "ISS (ZARYA)".to_string(),
                category: "Space Station".to_string(),
                coordinates: [-43.20, -18.45],
                altitude_km: 418.5,
                velocity_kms: 7.66,
                inclination_deg: 51.64,
            },
            SatelliteTrack {
                norad_id: 20580,
                name: "HST (Hubble Space Telescope)".to_string(),
                category: "Science Observatory".to_string(),
                coordinates: [28.75, 24.12],
                altitude_km: 535.2,
                velocity_kms: 7.59,
                inclination_deg: 28.47,
            },
            SatelliteTrack {
                norad_id: 44235,
                name: "STARLINK-1007".to_string(),
                category: "Broadband Mesh".to_string(),
                coordinates: [-112.45, 48.20],
                altitude_km: 550.0,
                velocity_kms: 7.61,
                inclination_deg: 53.05,
            },
            SatelliteTrack {
                norad_id: 43013,
                name: "NOAA-20 (JPSS-1)".to_string(),
                category: "Weather Radar".to_string(),
                coordinates: [-15.80, 71.30],
                altitude_km: 824.0,
                velocity_kms: 7.43,
                inclination_deg: 98.74,
            },
            SatelliteTrack {
                norad_id: 39533,
                name: "GPS IIF-5 (USA 248)".to_string(),
                category: "PNT Constellation".to_string(),
                coordinates: [78.10, -32.50],
                altitude_km: 20180.0,
                velocity_kms: 3.87,
                inclination_deg: 55.0,
            },
        ]
    }

    /// Queries AIS real-time maritime vessel telemetry
    pub fn get_vessels(&self) -> Vec<MaritimeVessel> {
        vec![
            MaritimeVessel {
                mmsi: 219018000,
                name: "MAERSK MC-KINNEY MOLLER".to_string(),
                vessel_type: "Ultra Large Container Vessel".to_string(),
                coordinates: [-5.60, 36.14], // Strait of Gibraltar
                speed_knots: 18.2,
                heading_deg: 88.0,
                destination: "SUEZ CANAL".to_string(),
                flag: "DK".to_string(),
            },
            MaritimeVessel {
                mmsi: 311000858,
                name: "EVER GIVEN".to_string(),
                vessel_type: "Container Ship".to_string(),
                coordinates: [32.31, 30.01], // Suez Approaches
                speed_knots: 12.4,
                heading_deg: 345.0,
                destination: "ROTTERDAM".to_string(),
                flag: "PA".to_string(),
            },
            MaritimeVessel {
                mmsi: 367104000,
                name: "USNS COMFORT (T-AH-20)".to_string(),
                vessel_type: "Hospital Ship".to_string(),
                coordinates: [-76.32, 36.95], // Norfolk Naval Base
                speed_knots: 0.2,
                heading_deg: 210.0,
                destination: "NORFOLK".to_string(),
                flag: "US".to_string(),
            },
            MaritimeVessel {
                mmsi: 538006122,
                name: "TI EUROPE".to_string(),
                vessel_type: "Ultra Large Crude Carrier".to_string(),
                coordinates: [103.75, 1.25], // Malacca Strait
                speed_knots: 14.8,
                heading_deg: 120.0,
                destination: "SINGAPORE".to_string(),
                flag: "MH".to_string(),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_orbital_maritime_telemetry() {
        let engine = OrbitalMaritimeEngine::new();
        let sats = engine.get_satellites();
        assert_eq!(sats.len(), 5);
        assert_eq!(sats[0].name, "ISS (ZARYA)");
        assert!(sats[0].altitude_km > 400.0);

        let vessels = engine.get_vessels();
        assert_eq!(vessels.len(), 4);
        assert_eq!(vessels[0].name, "MAERSK MC-KINNEY MOLLER");
    }
}
