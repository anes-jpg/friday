/** FRIDAY God's Eye Surface Component (§04 & Blueprint §4)
 *
 * Fullscreen 9-layer planetary-to-process command canvas:
 * - Interleaves WebGL2 vector cartography with real-time OS telemetry
 * - 0% Idle CPU Law: Static render until live frame or camera event
 * - Sockets, Subsea Cables, ADS-B Flights, Satellites, AIS Vessels, Earthquakes, LAN
 * - Single-Signal purple highlighting for selected telemetry locks
 */

import React, { useState, useEffect, useMemo } from "react"
import { FridayMapCanvas, type MapMarkerData, type MapRouteData } from "@/components/map/FridayMapCanvas"
import { GodsEyeLayerBar, type GodsEyeLayerId } from "./GodsEyeLayerBar"
import { EntityDossierDrawer, type DossierEntity } from "./EntityDossierDrawer"
import { MapTimelineScrubber } from "@/components/map/MapTimelineScrubber"
import { CameraPiPCard } from "./CameraPiPCard"
import {
  ipcGetNetworkTelemetry,
  ipcGetOrbitalTelemetry,
  ipcGetMaritimeTelemetry,
  ipcGetGeospatialTelemetry,
  ipcGetHardwareVitals,
} from "@/lib/telemetry"
import { Shield, Eye, Layers, Compass, Video } from "lucide-react"
import { cn } from "@/lib/utils"

export interface GodsEyeSurfaceProps {
  className?: string
  onSelectEntity?: (entity: { type: string; id: string; name: string; details: Record<string, unknown> }) => void
}

export const GodsEyeSurface: React.FC<GodsEyeSurfaceProps> = ({
  className,
  onSelectEntity,
}) => {
  const [activeLayers, setActiveLayers] = useState<Set<GodsEyeLayerId>>(
    new Set(["sockets", "cables", "air", "orbit"])
  )

  const [sockets, setSockets] = useState<any[]>([])
  const [cables, setCables] = useState<any[]>([])
  const [satellites, setSatellites] = useState<any[]>([])
  const [vessels, setVessels] = useState<any[]>([])
  const [flights, setFlights] = useState<any[]>([])
  const [seismic, setSeismic] = useState<any[]>([])
  const [lanDevices, setLanDevices] = useState<any[]>([])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<DossierEntity | null>(null)
  const [showPiP, setShowPiP] = useState(false)
  const [timelinePlaying, setTimelinePlaying] = useState(false)

  // Fetch telemetry from native Rust tools
  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const net = await ipcGetNetworkTelemetry()
        if (mounted) {
          setSockets(net.arcs || [])
          setCables(net.cables || [])
        }
      } catch {}

      try {
        const sats = await ipcGetOrbitalTelemetry()
        if (mounted) setSatellites(sats || [])
      } catch {}

      try {
        const ves = await ipcGetMaritimeTelemetry()
        if (mounted) setVessels(ves || [])
      } catch {}

      try {
        const geo = await ipcGetGeospatialTelemetry()
        if (mounted) {
          setFlights(geo.flights || [])
          setSeismic(geo.seismic || [])
        }
      } catch {}

      try {
        const hw = await ipcGetHardwareVitals()
        if (mounted) setLanDevices(hw.lan_devices || [])
      } catch {}
    }

    loadData()
    // Poll telemetry on a slow 10-second cadence to guarantee 0% idle CPU
    const interval = setInterval(loadData, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const handleToggleLayer = (layer: GodsEyeLayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  // Aggregate active markers according to layer filters
  const markers = useMemo(() => {
    const list: MapMarkerData[] = []

    if (activeLayers.has("cables")) {
      cables.forEach((c) => {
        list.push({
          id: `cable-${c.id}`,
          lat: c.coordinates[1],
          lng: c.coordinates[0],
          title: c.name,
          subtitle: c.landing_point,
          badge: `${c.capacity_tbps} Tbps`,
          color: "#38bdf8",
          active: selectedMarkerId === `cable-${c.id}`,
        })
      })
    }

    if (activeLayers.has("orbit")) {
      satellites.forEach((s) => {
        list.push({
          id: `sat-${s.norad_id}`,
          lat: s.coordinates[1],
          lng: s.coordinates[0],
          title: s.name,
          subtitle: `${s.altitude_km} km alt · ${s.velocity_kms} km/s`,
          badge: s.category,
          color: "#c084fc",
          active: selectedMarkerId === `sat-${s.norad_id}`,
        })
      })
    }

    if (activeLayers.has("sea")) {
      vessels.forEach((v) => {
        list.push({
          id: `vessel-${v.mmsi}`,
          lat: v.coordinates[1],
          lng: v.coordinates[0],
          title: v.name,
          subtitle: `${v.speed_knots} kts · Dest: ${v.destination}`,
          badge: v.flag,
          color: "#34d399",
          active: selectedMarkerId === `vessel-${v.mmsi}`,
        })
      })
    }

    if (activeLayers.has("air")) {
      flights.forEach((f) => {
        list.push({
          id: `flight-${f.icao24}`,
          lat: f.coordinates[1],
          lng: f.coordinates[0],
          title: f.callsign,
          subtitle: `${Math.round(f.altitude_m)}m · ${f.velocity_kts} kts`,
          badge: f.origin_country,
          color: "#fbbf24",
          active: selectedMarkerId === `flight-${f.icao24}`,
        })
      })
    }

    if (activeLayers.has("seismic")) {
      seismic.forEach((q) => {
        list.push({
          id: `quake-${q.id}`,
          lat: q.coordinates[1],
          lng: q.coordinates[0],
          title: `M${q.magnitude} - ${q.place}`,
          subtitle: `Depth: ${q.depth_km} km`,
          badge: "USGS",
          color: "#f87171",
          active: selectedMarkerId === `quake-${q.id}`,
        })
      })
    }

    return list
  }, [activeLayers, cables, satellites, vessels, flights, seismic, selectedMarkerId])

  // Aggregate active route arcs (Sockets and Submarine Cables)
  const routes = useMemo(() => {
    const list: MapRouteData[] = []

    if (activeLayers.has("sockets")) {
      sockets.forEach((s) => {
        list.push({
          id: s.id,
          coordinates: [s.origin_coords, s.remote_coords],
          color: "#9333ea", // One-Signal Purple Accent
          width: 2.5,
          dashed: true,
        })
      })
    }

    return list
  }, [activeLayers, sockets])

  const layerCounts: Partial<Record<GodsEyeLayerId, number>> = {
    sockets: sockets.length,
    cables: cables.length,
    orbit: satellites.length,
    sea: vessels.length,
    air: flights.length,
    seismic: seismic.length,
    lan: lanDevices.length,
  }

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-[#090A0C]", className)}>
      <FridayMapCanvas
        center={[-122.4194, 37.7749]}
        zoom={2.5}
        interactive={true}
        markers={markers}
        routes={routes}
        onMarkerClick={(m) => {
          setSelectedMarkerId(m.id)
          const entityData: DossierEntity = {
            type: m.id.startsWith("sock-") ? "socket" : "telemetry",
            id: m.id,
            name: m.title,
            details: { ...m },
          }
          setSelectedEntity(entityData)
          onSelectEntity?.(entityData)
        }}
        height="100%"
      />

      {/* Top Floating Layer Switcher Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <GodsEyeLayerBar
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          layerCounts={layerCounts}
        />
      </div>

      {/* Bottom Floating Timeline Scrubber */}
      <div className="absolute bottom-3 left-3 z-20">
        <MapTimelineScrubber
          mode="telemetry"
          isPlaying={timelinePlaying}
          onTogglePlay={() => setTimelinePlaying(!timelinePlaying)}
        />
      </div>

      {/* Bottom Telemetry Ledger Pill & PiP Switcher */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPiP(!showPiP)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-panel)] border text-[11px] font-mono transition-colors cursor-pointer backdrop-blur-md shadow-xl",
            showPiP
              ? "bg-[hsl(var(--signal))]/20 border-[hsl(var(--signal))]/50 text-white"
              : "bg-[#090A0C]/90 border-white/10 text-[hsl(var(--muted))] hover:text-white"
          )}
        >
          <Video className="size-3.5 text-[hsl(var(--signal))]" />
          <span>OPTICAL PiP</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-panel)] border border-white/10 bg-[#090A0C]/90 backdrop-blur-md shadow-xl text-[11px] font-mono text-[hsl(var(--muted))] tabular-nums">
          <span className="flex items-center gap-1.5 text-[hsl(var(--ink))]">
            <Eye className="size-3.5 text-[hsl(var(--signal))] animate-pulse" />
            <span>GOD'S EYE</span>
          </span>
          <span className="text-white/20">|</span>
          <span>{markers.length} Entities</span>
          <span className="text-white/20">|</span>
          <span>{routes.length} Arcs</span>
        </div>
      </div>

      {/* Draggable Optical PiP Card */}
      {showPiP && (
        <CameraPiPCard onClose={() => setShowPiP(false)} />
      )}

      {/* Right Inspection Dossier Drawer */}
      <EntityDossierDrawer
        entity={selectedEntity}
        onClose={() => {
          setSelectedEntity(null)
          setSelectedMarkerId(null)
        }}
      />
    </div>
  )
}
