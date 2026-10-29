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
  /** True when the socket record comes from a sample/simulated feed (audit F01). */
  simulated?: boolean
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
  temperature_c: number | null
  utilization_percent: number | null
  vram_used_mb: number | null
  vram_total_mb: number | null
  power_watts: number | null
}

export interface LanDevice {
  ip: string
  mac: string
  hostname: string
  device_type: string
  latency_ms: number
}

export interface SystemHardwareTelemetry {
  cpu_percent: number | null
  ram_used_mb: number | null
  ram_total_mb: number | null
  gpu: GpuVitals
  lan_devices: LanDevice[]
}

export async function ipcGetNetworkTelemetry(): Promise<NetworkTelemetryResponse> {
  if (isDesktop) {
    return await invokeCommand<NetworkTelemetryResponse>("get_network_telemetry")
  }
  return { arcs: [], cables: [] }
}

export async function ipcGetOrbitalTelemetry(): Promise<SatelliteTrack[]> {
  if (isDesktop) {
    return await invokeCommand<SatelliteTrack[]>("get_orbital_telemetry")
  }
  return []
}

export async function ipcGetMaritimeTelemetry(): Promise<MaritimeVessel[]> {
  if (isDesktop) {
    return await invokeCommand<MaritimeVessel[]>("get_maritime_telemetry")
  }
  return []
}

export async function ipcGetGeospatialTelemetry(): Promise<GeospatialResponse> {
  if (isDesktop) {
    return await invokeCommand<GeospatialResponse>("get_geospatial_telemetry")
  }
  return { flights: [], seismic: [], weather: { station_name: "Not connected", coordinates: [0, 0], temperature_c: 0, wind_speed_kmh: 0, precipitation_mm: 0, radar_tile_url: "" } }
}

export async function ipcGetHardwareVitals(): Promise<SystemHardwareTelemetry> {
  if (isDesktop) {
    return await invokeCommand<SystemHardwareTelemetry>("get_hardware_vitals")
  }
  return { cpu_percent: null, ram_used_mb: null, ram_total_mb: null, gpu: { name: "Unavailable", temperature_c: null, utilization_percent: null, vram_used_mb: null, vram_total_mb: null, power_watts: null }, lan_devices: [] }
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
