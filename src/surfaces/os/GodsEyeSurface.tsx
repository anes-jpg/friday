/** FRIDAY God's Eye Surface Component (§04 & Blueprint §4)
 *
 * Fullscreen 9-layer planetary-to-process command canvas:
 * - Real Satellite Imagery (Esri World Imagery) and Midnight Obsidian (CartoDB Dark Matter)
 * - Live Optical CCTV Surveillance Matrix (WebRTC Local Operator Webcam, ISS Earth Nadir, Tokyo Shibuya, Metro Transit)
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
import { CameraSurveillanceMatrix } from "./CameraSurveillanceMatrix"
import {
  ipcGetNetworkTelemetry,
  ipcGetOrbitalTelemetry,
  ipcGetMaritimeTelemetry,
  ipcGetGeospatialTelemetry,
  ipcGetHardwareVitals,
  type NetworkSocketArc,
  type SubmarineCableNode,
  type SatelliteTrack,
  type MaritimeVessel,
  type FlightTrack,
  type SeismicEvent,
  type LanDevice,
} from "@/lib/telemetry"
import type { FridayMapPreset } from "@/lib/map-style"
import {
  Shield,
  Eye,
  Layers,
  Compass,
  Video,
  Grid2X2,
  MapPin,
  Satellite,
  Crosshair,
  Plus,
  Minus,
  AlertTriangle,
  Radio,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Wifi,
  Headphones,
  Bell,
  Bus,
  ArrowUpRight,
  Maximize2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PlacesPanel } from "@/components/map/PlacesPanel"
import { ALGERIA_CENTER, ALGERIA_CITIES, type MapPlace } from "@/lib/places"

export interface GodsEyeSurfaceProps {
  className?: string
  onSelectEntity?: (entity: { type: string; id: string; name: string; details: Record<string, unknown> }) => void
}

const HISTOGRAM_BARS = [
  { val: 40, label: "55k", delta: "-0%", amber: false },
  { val: 65, label: "57k", delta: "-8%", amber: true },
  { val: 80, label: "56k", delta: "+6%", amber: false },
  { val: 50, label: "55k", delta: "-0%", amber: false },
  { val: 35, label: "52k", delta: "-12%", amber: true },
  { val: 55, label: "55k", delta: "-0%", amber: false },
]

export const GodsEyeSurface: React.FC<GodsEyeSurfaceProps> = ({
  className,
  onSelectEntity,
}) => {
  const [activeLayers, setActiveLayers] = useState<Set<GodsEyeLayerId>>(
    new Set(["sockets", "cables", "air", "orbit"])
  )
  const [mapStyle, setMapStyle] = useState<FridayMapPreset>("carbon")
  const [mapCenter, setMapCenter] = useState<[number, number]>(ALGERIA_CENTER)
  const [viewCenter, setViewCenter] = useState<[number, number]>(ALGERIA_CENTER)
  const [mapZoom, setMapZoom] = useState<number>(13)
  const [mapPitch, setMapPitch] = useState(0)
  const [mapBearing, setMapBearing] = useState(0)
  useEffect(() => { setMapPitch(mapStyle === "terrain" ? 56 : 0); if (mapStyle === "terrain") setMapZoom(current => Math.max(current, 15)) }, [mapStyle])
  const [placesOpen, setPlacesOpen] = useState(true)
  const [visiblePlaces, setVisiblePlaces] = useState<MapPlace[]>([])
  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const selectPlace = (place: MapPlace | null) => {
    setSelectedPlace(place)
    if (place) { setPlacesOpen(true); if (place.locationPrecision !== "area") { setMapCenter([place.lng, place.lat]); setMapZoom(16) } }
  }
  const locate = () => {
    setLocationError(null)
    if (!navigator.geolocation) { setLocationError("Location is unavailable. Search for your city instead."); return }
    navigator.geolocation.getCurrentPosition(position => { setMapCenter([position.coords.longitude, position.coords.latitude]); setMapZoom(15) }, () => setLocationError("Location could not be read. Search for your city or check location permission."), { timeout: 10_000 })
  }

  const [sockets, setSockets] = useState<NetworkSocketArc[]>([])
  const [cables, setCables] = useState<SubmarineCableNode[]>([])
  const [satellites, setSatellites] = useState<SatelliteTrack[]>([])
  const [vessels, setVessels] = useState<MaritimeVessel[]>([])
  const [flights, setFlights] = useState<FlightTrack[]>([])
  const [seismic, setSeismic] = useState<SeismicEvent[]>([])
  const [lanDevices, setLanDevices] = useState<LanDevice[]>([])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<DossierEntity | null>(null)
  const [cameraMode, setCameraMode] = useState<"off" | "pip" | "matrix">("off")
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [warningExpanded, setWarningExpanded] = useState(true)
  const [showTelemetryDeck, setShowTelemetryDeck] = useState(false)

  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date()
    return (
      d.toLocaleDateString("fr-DZ", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Algiers" }) +
      " · " +
      d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Algiers" })
    )
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setCurrentTime(
        d.toLocaleDateString("fr-DZ", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Algiers" }) +
          " · " +
          d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Algiers" })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch telemetry from native Rust tools
  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const net = await ipcGetNetworkTelemetry()
        if (mounted && net) {
          setSockets(net.arcs || [])
          setCables(net.cables || [])
        }
      } catch {}

      try {
        const sats = await ipcGetOrbitalTelemetry()
        if (mounted && sats) setSatellites(sats || [])
      } catch {}

      try {
        const ves = await ipcGetMaritimeTelemetry()
        if (mounted && ves) setVessels(ves || [])
      } catch {}

      try {
        const geo = await ipcGetGeospatialTelemetry()
        if (mounted && geo) {
          setFlights(geo.flights || [])
          setSeismic(geo.seismic || [])
        }
      } catch {}

      try {
        const hw = await ipcGetHardwareVitals()
        if (mounted && hw) setLanDevices(hw.lan_devices || [])
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

  // Quick surveillance hotspot navigator
  const handleFlyToHotspot = (coords: [number, number], zoomLevel: number) => {
    setMapCenter(coords)
    setMapZoom(zoomLevel)
  }

  // Aggregate active markers according to layer filters (Stark White & Monochrome Tokens)
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
          color: "#ffffff",
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
          color: "#e2e8f0",
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
          color: "#ffffff",
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
          color: "#ffffff",
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
          color: "#e02e24",
          active: selectedMarkerId === `quake-${q.id}`,
        })
      })
    }

    return list
  }, [activeLayers, cables, satellites, vessels, flights, seismic, selectedMarkerId])

  // Aggregate active route arcs (Glowing Stark White Paths matching Reference 5)
  const routes = useMemo(() => {
    const list: MapRouteData[] = []

    if (activeLayers.has("sockets")) {
      sockets.forEach((s) => {
        list.push({
          id: s.id,
          coordinates: [s.origin_coords, s.remote_coords],
          color: "#ffffff", // Pure glowing stark white vector path
          width: 3.0,
          dashed: false,
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

  const handleZoomIn = () => setMapZoom((z) => Math.min(Math.round((z + 1) * 10) / 10, 18))
  const handleZoomOut = () => setMapZoom((z) => Math.max(Math.round((z - 1) * 10) / 10, 1))
  const handleResetNorth = () => {
    setMapZoom(13)
    setMapCenter(ALGERIA_CENTER)
  }

  const mapMarkers = useMemo<MapMarkerData[]>(() => [...markers, ...visiblePlaces.filter(place => place.locationPrecision !== "area").slice(0, 200).map((place, index) => ({ id: `place:${place.id}`, lat: place.lat, lng: place.lng, title: place.name, active: selectedPlace?.id === place.id, showLabel: selectedPlace?.id === place.id || (index < 20 && place.name !== "Unnamed place") })), ...(selectedPlace && selectedPlace.locationPrecision !== "area" && !visiblePlaces.slice(0, 200).some(place => place.id === selectedPlace.id) ? [{ id: `place:${selectedPlace.id}`, lat: selectedPlace.lat, lng: selectedPlace.lng, title: selectedPlace.name, active: true }] : [])], [markers, visiblePlaces, selectedPlace])

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-[#000000]", className)}>
      {/* High-Performance MapLibre Cartography Engine */}
      <FridayMapCanvas
        center={mapCenter}
        zoom={mapZoom}
        pitch={mapPitch}
        bearing={mapBearing}
        interactive={true}
        stylePreset={mapStyle}
        onStylePresetChange={setMapStyle}
        markers={mapMarkers}
        routes={routes}
        hideBuiltinControls={true}
        onPlaceClick={selectPlace}
        onPlacesAvailable={setMapPlaces}
        onViewportChange={viewport => { setViewCenter(viewport.center); setMapCenter(viewport.center); setMapZoom(viewport.zoom); setMapPitch(viewport.pitch); setMapBearing(viewport.bearing) }}
        onMarkerClick={(m) => {
          if (m.id.startsWith("place:")) { selectPlace(visiblePlaces.find(place => `place:${place.id}` === m.id) || selectedPlace); return }
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
      />

      {/* TOP FLOATING CAPSULES (Exact Match: RON Design Ref 2 & Aura Ref 5) */}
      <div className="map-top-controls absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-4 pointer-events-none">
        {/* Left: Aura / Brand Tag (Reference 5) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#161618]/90 border border-white/10 backdrop-blur-2xl shadow-2xl text-xs font-mono text-white">
            <span className="size-1.5 rounded-lg bg-white" />
            <span className="font-semibold tracking-wider">DZ</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 tabular-nums">{currentTime}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">ALGIERS TIME</span>
          </div>

          {/* Quick Sectors Pill (Inky Mono Ref 4) */}
          <div className="map-city-controls flex items-center gap-1 p-1 rounded-lg bg-[#161618]/90 border border-white/10 backdrop-blur-2xl shadow-2xl text-[11px] font-mono text-zinc-300">
            <button
              type="button"
              onClick={() => handleFlyToHotspot(ALGERIA_CITIES[0].center, 13)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400 font-medium"
            >
              ALGER
            </button>
            <button
              type="button"
              onClick={() => handleFlyToHotspot(ALGERIA_CITIES[1].center, 13)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400 font-medium"
            >
              ORAN
            </button>
            <button
              type="button"
              onClick={() => handleFlyToHotspot(ALGERIA_CITIES[2].center, 13)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400 font-medium"
            >
              CONSTANTINE
            </button>
            <button
              type="button"
              onClick={locate}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400 font-medium"
            >
              MY LOCATION
            </button>
          </div>
        </div>

        {/* Right: Map Presets & Matrix Toggles */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" className="map-places-toggle" aria-pressed={placesOpen} onClick={() => setPlacesOpen(open => !open)}>Places</button>
          {/* Basemap Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-[#161618]/90 border border-white/10 backdrop-blur-2xl shadow-2xl text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setMapStyle("carbon")}
              className={cn(
                "px-3 py-1 rounded-lg transition-colors cursor-pointer uppercase",
                mapStyle === "carbon"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              OBSIDIAN
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("satellite")}
              className={cn(
                "px-3 py-1 rounded-lg transition-colors cursor-pointer uppercase",
                mapStyle === "satellite"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              SATELLITE
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("terrain")}
              className={cn(
                "px-3 py-1 rounded-lg transition-colors cursor-pointer uppercase",
                mapStyle === "terrain"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              LAND USE
            </button>
          </div>

          {/* Optical CCTV Matrix Toggle */}
          <button
            type="button"
            onClick={() => setCameraMode(cameraMode === "matrix" ? "off" : "matrix")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer shadow-2xl backdrop-blur-2xl",
              cameraMode === "matrix"
                ? "bg-white/20 border-white/25 text-white font-semibold"
                : "bg-[#161618]/90 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
            )}
            title="Toggle Quad Optical Surveillance Matrix"
          >
            <Grid2X2 className={cn("size-3.5", cameraMode === "matrix" ? "text-white" : "text-zinc-400")} />
            <span>Cameras</span>
          </button>
        </div>
      </div>

      {/* REAL SURVEILLANCE CAMERA FEEDS (Draggable Framer Motion Matrix) */}
      {cameraMode === "matrix" && (
        <div className="fixed top-18 right-4 z-30 w-[620px] h-[430px] max-w-[92vw] max-h-[82vh]">
          <CameraSurveillanceMatrix
            onClose={() => setCameraMode("off")}
            onMinimize={() => setCameraMode("pip")}
            onFlyToCoordinates={(coords, zoomLevel) => {
              handleFlyToHotspot(coords, zoomLevel)
            }}
            className="w-full h-full"
          />
        </div>
      )}

      {cameraMode === "pip" && (
        <CameraPiPCard
          onClose={() => setCameraMode("off")}
          onExpandToMatrix={() => setCameraMode("matrix")}
        />
      )}

      {/* Right Inspection Dossier Drawer */}
      <EntityDossierDrawer
        key="telemetry-details"
        entity={selectedEntity}
        onClose={() => {
          setSelectedEntity(null)
          setSelectedMarkerId(null)
        }}
      />
      {mapStyle === "terrain" && <div className="map-depth-note"><span>3D land use · terrain & buildings</span><button type="button" onClick={() => setMapPitch(current => current > 0 ? 0 : 56)}>{mapPitch > 0 ? "Flatten view" : "Tilt view"}</button></div>}
      {placesOpen && cameraMode !== "matrix" && <PlacesPanel onExploreArea={radius => setMapZoom(current => Math.min(current, radius >= 1500 ? 14 : 16))} mapPlaces={mapPlaces} center={viewCenter} selected={selectedPlace} onSelect={selectPlace} onResults={setVisiblePlaces} onClose={() => setPlacesOpen(false)} onLocate={locate} />}
      {locationError && <p className="map-location-error" role="alert">{locationError}<button type="button" onClick={() => setLocationError(null)} aria-label="Dismiss location error">×</button></p>}
    </div>
  )
}
