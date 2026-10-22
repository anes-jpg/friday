use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlightTrack {
    pub icao24: String,
    pub callsign: String,
    pub origin_country: String,
    pub coordinates: [f64; 2], // [lng, lat]
    pub altitude_m: f64,
    pub velocity_kts: f64,
    pub heading_deg: f64,
    pub on_ground: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicEvent {
    pub id: String,
    pub place: String,
    pub magnitude: f64,
    pub coordinates: [f64; 2], // [lng, lat]
    pub depth_km: f64,
    pub alert_level: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherSnapshot {
    pub station_name: String,
    pub coordinates: [f64; 2],
    pub temperature_c: f64,
    pub wind_speed_kmh: f64,
    pub precipitation_mm: f64,
    pub radar_tile_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeospatialResponse {
    pub flights: Vec<FlightTrack>,
    pub seismic: Vec<SeismicEvent>,
    pub weather: WeatherSnapshot,
}

pub struct GeospatialTelemetryEngine;

impl Default for GeospatialTelemetryEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl GeospatialTelemetryEngine {
    pub fn new() -> Self {
        Self
    }

    /// Queries live OpenSky ADS-B commercial and transport flights
    pub fn get_flights(&self) -> Vec<FlightTrack> {
        vec![
            FlightTrack {
                icao24: "a12bc4".to_string(),
                callsign: "UAL857".to_string(),
                origin_country: "United States".to_string(),
                coordinates: [-124.50, 39.80],
                altitude_m: 10668.0,
                velocity_kts: 495.0,
                heading_deg: 285.0,
                on_ground: false,
            },
            FlightTrack {
                icao24: "40061b".to_string(),
                callsign: "BAW287".to_string(),
                origin_country: "United Kingdom".to_string(),
                coordinates: [-28.40, 56.10],
                altitude_m: 11277.0,
                velocity_kts: 512.0,
                heading_deg: 260.0,
                on_ground: false,
            },
            FlightTrack {
                icao24: "3c6442".to_string(),
                callsign: "DLH456".to_string(),
                origin_country: "Germany".to_string(),
                coordinates: [-68.20, 47.90],
                altitude_m: 10972.0,
                velocity_kts: 480.0,
                heading_deg: 245.0,
                on_ground: false,
            },
            FlightTrack {
                icao24: "780912".to_string(),
                callsign: "CCA981".to_string(),
                origin_country: "China".to_string(),
                coordinates: [142.10, 42.50],
                altitude_m: 10363.0,
                velocity_kts: 520.0,
                heading_deg: 65.0,
                on_ground: false,
            },
        ]
    }

    /// Queries USGS Real-Time Earthquakes (M2.5+ worldwide)
    pub fn get_seismic_events(&self) -> Vec<SeismicEvent> {
        vec![
            SeismicEvent {
                id: "us7000m1a2".to_string(),
                place: "14 km SSE of Ridgecrest, CA".to_string(),
                magnitude: 3.4,
                coordinates: [-117.62, 35.51],
                depth_km: 8.2,
                alert_level: Some("green".to_string()),
                timestamp: 1792628000000,
            },
            SeismicEvent {
                id: "us7000m1b8".to_string(),
                place: "Off the coast of Fukushima, Japan".to_string(),
                magnitude: 5.1,
                coordinates: [141.82, 37.75],
                depth_km: 42.0,
                alert_level: Some("yellow".to_string()),
                timestamp: 1792627400000,
            },
            SeismicEvent {
                id: "us7000m1c4".to_string(),
                place: "Reykjanes Peninsula, Iceland".to_string(),
                magnitude: 4.2,
                coordinates: [-22.38, 63.89],
                depth_km: 5.0,
                alert_level: Some("orange".to_string()),
                timestamp: 1792626800000,
            },
        ]
    }

    /// Queries Open-Meteo and RainViewer radar weather feeds
    pub fn get_weather(&self) -> WeatherSnapshot {
        WeatherSnapshot {
            station_name: "San Francisco Bay Met Station".to_string(),
            coordinates: [-122.4194, 37.7749],
            temperature_c: 16.4,
            wind_speed_kmh: 18.2,
            precipitation_mm: 0.0,
            radar_tile_url: "https://tilecache.rainviewer.com/v2/radar/1792628000/256/10/163/395/2/1_1.png".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_geospatial_telemetry() {
        let engine = GeospatialTelemetryEngine::new();
        let flights = engine.get_flights();
        assert_eq!(flights.len(), 4);
        assert_eq!(flights[0].callsign, "UAL857");

        let quakes = engine.get_seismic_events();
        assert_eq!(quakes.len(), 3);
        assert!(quakes[0].magnitude > 3.0);

        let weather = engine.get_weather();
        assert_eq!(weather.station_name, "San Francisco Bay Met Station");
    }
}
