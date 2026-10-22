/** FRIDAY God's Eye Telemetry IPC Client (§04 & Blueprint §4)
 *
 * Connects frontend telemetry surfaces to Rust tools:
 * - Network sockets & subsea cables
 * - Orbital satellites & AIS maritime vessels
 * - OpenSky flights & USGS seismic feeds
 * - Hardware GPU thermals & local LAN ARP table
 * - Fullscreen toggle with Mica vibrancy coordination
 */

import { invokeCommand, isDesktop } from "./ipc"

export interface SubmarineCableNode {
  id: string
  name: string
  landing_point: string
  coordinates: [number, number]
  capacity_tbps: number
}

export interface NetworkSocketArc {
  id: string
  pid: number
  process_name: string
  local_addr: string
  remote_addr: string
  remote_ip: string
  remote_port: number
  protocol: string
  state: string
  remote_city?: string
  remote_country?: string
  origin_coords: [number, number]
  remote_coords: [number, number]
  cable_landing_ref?: string
}

export interface NetworkTelemetryResponse {
  arcs: NetworkSocketArc[]
  cables: SubmarineCableNode[]
}

export interface SatelliteTrack {
  norad_id: number
  name: string
  category: string
  coordinates: [number, number]
  altitude_km: number
  velocity_kms: number
  inclination_deg: number
}

export interface MaritimeVessel {
  mmsi: number
  name: string
  vessel_type: string
  coordinates: [number, number]
  speed_knots: number
  heading_deg: number
  destination: string
  flag: string
}

export interface FlightTrack {
  icao24: string
  callsign: string
  origin_country: string
  coordinates: [number, number]
  altitude_m: number
  velocity_kts: number
  heading_deg: number
  on_ground: boolean
}

export interface SeismicEvent {
  id: string
  place: string
  magnitude: number
  coordinates: [number, number]
  depth_km: number
  alert_level?: string
  timestamp: number
}

export interface WeatherSnapshot {
  station_name: string
  coordinates: [number, number]
  temperature_c: number
  wind_speed_kmh: number
  precipitation_mm: number
  radar_tile_url: string
}

export interface GeospatialResponse {
  flights: FlightTrack[]
  seismic: SeismicEvent[]
  weather: WeatherSnapshot
}

export interface GpuVitals {
  name: string
  temperature_c: number
  utilization_percent: number
  vram_used_mb: number
  vram_total_mb: number
  power_watts: number
}

export interface LanDevice {
  ip: string
  mac: string
  hostname: string
  device_type: string
  latency_ms: number
}

export interface SystemHardwareTelemetry {
  cpu_percent: number
  ram_used_mb: number
  ram_total_mb: number
  gpu: GpuVitals
  lan_devices: LanDevice[]
}

export async function ipcGetNetworkTelemetry(): Promise<NetworkTelemetryResponse> {
  if (isDesktop) {
    return await invokeCommand<NetworkTelemetryResponse>("get_network_telemetry")
  }
  return {
    arcs: [
      {
        id: "mock-arc-1",
        pid: 1420,
        process_name: "Code.exe",
        local_addr: "127.0.0.1:51240",
        remote_addr: "140.82.121.4:443",
        remote_ip: "140.82.121.4",
        remote_port: 443,
        protocol: "TCP",
        state: "ESTABLISHED",
        remote_city: "San Francisco",
        remote_country: "US",
        origin_coords: [-122.4194, 37.7749],
        remote_coords: [-74.006, 40.7128],
      },
    ],
    cables: [
      {
        id: "cable-marea",
        name: "MAREA Transatlantic Cable",
        landing_point: "Virginia Beach, USA -> Bilbao, Spain",
        coordinates: [-75.97, 36.85],
        capacity_tbps: 200,
      },
    ],
  }
}

export async function ipcGetOrbitalTelemetry(): Promise<SatelliteTrack[]> {
  if (isDesktop) {
    return await invokeCommand<SatelliteTrack[]>("get_orbital_telemetry")
  }
  return [
    {
      norad_id: 25544,
      name: "ISS (ZARYA)",
      category: "Space Station",
      coordinates: [-43.2, -18.45],
      altitude_km: 418.5,
      velocity_kms: 7.66,
      inclination_deg: 51.64,
    },
  ]
}

export async function ipcGetMaritimeTelemetry(): Promise<MaritimeVessel[]> {
  if (isDesktop) {
    return await invokeCommand<MaritimeVessel[]>("get_maritime_telemetry")
  }
  return [
    {
      mmsi: 219018000,
      name: "MAERSK MC-KINNEY MOLLER",
      vessel_type: "Container Vessel",
      coordinates: [-5.6, 36.14],
      speed_knots: 18.2,
      heading_deg: 88,
      destination: "SUEZ CANAL",
      flag: "DK",
    },
  ]
}

export async function ipcGetGeospatialTelemetry(): Promise<GeospatialResponse> {
  if (isDesktop) {
    return await invokeCommand<GeospatialResponse>("get_geospatial_telemetry")
  }
  return {
    flights: [
      {
        icao24: "a12bc4",
        callsign: "UAL857",
        origin_country: "United States",
        coordinates: [-124.5, 39.8],
        altitude_m: 10668,
        velocity_kts: 495,
        heading_deg: 285,
        on_ground: false,
      },
    ],
    seismic: [
      {
        id: "us7000m1a2",
        place: "14 km SSE of Ridgecrest, CA",
        magnitude: 3.4,
        coordinates: [-117.62, 35.51],
        depth_km: 8.2,
        alert_level: "green",
        timestamp: Date.now() - 60000,
      },
    ],
    weather: {
      station_name: "San Francisco Bay",
      coordinates: [-122.4194, 37.7749],
      temperature_c: 16.4,
      wind_speed_kmh: 18.2,
      precipitation_mm: 0,
      radar_tile_url: "",
    },
  }
}

export async function ipcGetHardwareVitals(): Promise<SystemHardwareTelemetry> {
  if (isDesktop) {
    return await invokeCommand<SystemHardwareTelemetry>("get_hardware_vitals")
  }
  return {
    cpu_percent: 14.5,
    ram_used_mb: 8420,
    ram_total_mb: 32768,
    gpu: {
      name: "NVIDIA GeForce RTX 4090",
      temperature_c: 48.5,
      utilization_percent: 24,
      vram_used_mb: 4820,
      vram_total_mb: 24576,
      power_watts: 115,
    },
    lan_devices: [
      {
        ip: "192.168.1.1",
        mac: "00:11:32:4A:8F:12",
        hostname: "gateway.lan",
        device_type: "Router",
        latency_ms: 1,
      },
    ],
  }
}

export async function ipcToggleOsFullscreen(exclusive = false): Promise<boolean> {
  if (isDesktop) {
    return await invokeCommand<boolean>("toggle_os_fullscreen", { exclusive })
  }
  if (typeof document !== "undefined") {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {})
      return true
    } else {
      await document.exitFullscreen().catch(() => {})
      return false
    }
  }
  return false
}
