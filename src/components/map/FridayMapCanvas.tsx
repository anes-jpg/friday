/** FRIDAY Map Canvas Component (§04 & Blueprint §4)
 *
 * High-performance WebGL2 MapLibre GL engine:
 * - 0% Idle CPU Law: Only renders on interaction or active frame updates
 * - Multi-Basemap Feeds: Esri Satellite World Imagery, CartoDB Dark Matter, and Tactical Terrain
 * - Native vector lines for telemetry routes & single-signal purple accents
 * - Clean RAII disposal on unmount to prevent WebGL context leaks
 * - Strict adherence to the Surface Law and One-Signal Law
 */

import React, { useEffect, useRef, useState, useCallback } from "react"
import { invokeCommand } from "@/lib/ipc"
import * as maplibregl from "maplibre-gl"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"
import "maplibre-gl/dist/maplibre-gl.css"
import { getFridayMapStyle, registerPmTilesProtocol, type FridayMapPreset } from "@/lib/map-style"
import { Compass, ZoomIn, ZoomOut, Layers, Crosshair, Satellite, Moon, Map } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALGERIA_CENTER, type MapPlace } from "@/lib/places"

// Vite bundles MapLibre into an application chunk, so its sibling-file worker
// lookup resolves beside that chunk instead of beside MapLibre. Pin the worker
// to Vite's emitted asset URL for both dev and packaged Tauri builds.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

export interface MapMarkerData {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  badge?: string
  color?: string
  active?: boolean
  showLabel?: boolean
}

export interface MapRouteData {
  id: string
  coordinates: [number, number][] // [lng, lat]
  color?: string
  width?: number
  dashed?: boolean
}

export interface FridayMapCanvasProps {
  center?: [number, number] // [lng, lat]
  zoom?: number
  pitch?: number
  bearing?: number
  interactive?: boolean
  hideBuiltinControls?: boolean
  stylePreset?: FridayMapPreset
  onStylePresetChange?: (preset: FridayMapPreset) => void
  markers?: MapMarkerData[]
  routes?: MapRouteData[]
  onViewportChange?: (viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => void
  onMarkerClick?: (marker: MapMarkerData) => void
  onPlaceClick?: (place: MapPlace) => void
  onPlacesAvailable?: (places: MapPlace[]) => void
  className?: string
  height?: number | string
}

export const FridayMapCanvas: React.FC<FridayMapCanvasProps> = ({
  center = ALGERIA_CENTER,
  zoom = 3,
  pitch = 0,
  bearing = 0,
  interactive = true,
  hideBuiltinControls = false,
  stylePreset = "satellite",
  onStylePresetChange,
  markers = [],
  routes = [],
  onViewportChange,
  onMarkerClick,
  onPlaceClick,
  onPlacesAvailable,
  className,
  height,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerInstancesRef = useRef<maplibregl.Marker[]>([])
  const callbacks = useRef({ onViewportChange, onPlaceClick, onPlacesAvailable, onMarkerClick })
  const placeSignature = useRef("")
  const applyingCamera = useRef(false)
  const appliedStyle = useRef(stylePreset)
  const currentRoutes = useRef(routes)
  currentRoutes.current = routes
  callbacks.current = { onViewportChange, onPlaceClick, onPlacesAvailable, onMarkerClick }
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(center)
  const [currentPitch, setCurrentPitch] = useState(pitch)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [activeStyle, setActiveStyle] = useState<FridayMapPreset>(stylePreset)

  // Keep internal style in sync with external prop
  useEffect(() => {
    setActiveStyle(stylePreset)
  }, [stylePreset])

  // Helper to re-render routes
  const syncRoutes = useCallback((map: maplibregl.Map, activeRoutes: MapRouteData[]) => {
    if (!map.isStyleLoaded()) return

    activeRoutes.forEach((route) => {
      const sourceId = `route-source-${route.id}`
      const layerId = `route-layer-${route.id}`

      const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: route.coordinates,
        },
      }

      if (map.getSource(sourceId)) {
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
        source.setData(geojsonData)
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: geojsonData,
        })

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": route.color || "#9333ea", // One-Signal Purple Accent
            "line-width": route.width || 3.5,
            "line-opacity": 0.85,
            ...(route.dashed ? { "line-dasharray": [2, 2] } : {}),
          },
        })
      }
    })

    // Clean up removed routes
    const activeRouteIds = new Set(activeRoutes.map((r) => `route-layer-${r.id}`))
    map.getStyle()?.layers?.forEach((layer) => {
      if (layer.id.startsWith("route-layer-") && !activeRouteIds.has(layer.id)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id)
        const sourceId = layer.id.replace("layer-", "source-")
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      }
    })
  }, [])

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current) return

    registerPmTilesProtocol()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getFridayMapStyle(activeStyle),
      center,
      zoom,
      pitch,
      bearing,
      interactive,
      attributionControl: { compact: true },
      fadeDuration: 0, // Instant layer transitions to ensure 0% idle GPU overhead
      trackResize: true,
    })

    mapRef.current = map

    map.on("load", () => {
      setMapLoaded(true)
      setMapError(null)
      map.resize()
      syncRoutes(map, routes)
    })

    map.on("error", (event) => {
      const message = event.error?.message || "Unable to load basemap tiles. Check network/CSP access."
      setMapError(message)
      console.error("[FridayMapCanvas] MapLibre error:", event.error)
      void invokeCommand("log_frontend_error", { source: "FridayMapCanvas", message })
    })

    map.on("moveend", () => {
      if (applyingCamera.current) return
      const c = map.getCenter()
      const z = map.getZoom()
      const p = map.getPitch()
      const b = map.getBearing()
      setCurrentZoom(Math.round(z * 10) / 10)
      setCurrentPitch(p)
      setCurrentCenter([Math.round(c.lng * 10000) / 10000, Math.round(c.lat * 10000) / 10000])
      callbacks.current.onViewportChange?.({
        center: [c.lng, c.lat],
        zoom: z,
        pitch: p,
        bearing: b,
      })
    })

    map.on("click", (event) => {
      if (!map.getLayer("poi-labels")) return
      const feature = map.queryRenderedFeatures(event.point, { layers: ["poi-labels"] })[0]
      if (!feature || feature.geometry.type !== "Point") return
      const [lng, lat] = feature.geometry.coordinates
      callbacks.current.onPlaceClick?.({ id: `map-poi-${feature.id ?? `${lng}-${lat}`}`, name: String(feature.properties?.["name:fr"] || feature.properties?.name || feature.properties?.["name:ar"] || "Place"), category: String(feature.properties?.class || "Place"), lat, lng, tags: {} })
    })
    map.on("idle", () => {
      if (!map.getSource("openfreemap") || !map.getLayer("poi-labels")) return
      const places = new globalThis.Map<string, MapPlace>()
      for (const feature of map.querySourceFeatures("openfreemap", { sourceLayer: "poi" })) {
        if (feature.geometry.type !== "Point") continue
        const [lng, lat] = feature.geometry.coordinates
        const props = feature.properties
        const name = String(props?.["name:fr"] || props?.name || props?.["name:ar"] || "")
        if (!name) continue
        const category = String(props?.subclass || props?.class || "Place")
        const id = `vector:${name}:${lng.toFixed(5)}:${lat.toFixed(5)}`
        const tags: Record<string, string> = { name }
        const type = ["shop", "office", "craft", "tourism", "leisure"].find(key => props?.class === key) || "amenity"
        tags[type] = category
        for (const key of ["wikidata", "wikimedia_commons", "image"]) if (typeof props?.[key] === "string") tags[key] = props[key]
        places.set(id, { id, name, lat, lng, category, tags })
      }
      const found = [...places.values()].sort((a, b) => a.id.localeCompare(b.id))
      const signature = found.map(place => place.id).join("|")
      if (signature !== placeSignature.current) { placeSignature.current = signature; callbacks.current.onPlacesAvailable?.(found) }
    })

    return () => {
      markerInstancesRef.current.forEach((m) => m.remove())
      markerInstancesRef.current = []
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [])

  // Update map style when activeStyle changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || appliedStyle.current === activeStyle) return

    map.setStyle(getFridayMapStyle(activeStyle), { diff: false })
    appliedStyle.current = activeStyle
    const onStyleLoad = () => {
      syncRoutes(map, currentRoutes.current)
    }
    map.once("style.load", onStyleLoad)
  }, [activeStyle, mapLoaded, syncRoutes])

  // Center / Zoom updates from props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const current = map.getCenter()
    const dist = Math.hypot(current.lng - center[0], current.lat - center[1])
    if (dist > 0.001 || Math.abs(map.getZoom() - zoom) > 0.1 || Math.abs(map.getPitch() - pitch) > 0.1 || Math.abs(map.getBearing() - bearing) > 0.1) {
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180
      // flyTo stops the previous movement synchronously. Its old moveend must not
      // feed the previous camera back into the newly requested controlled state.
      applyingCamera.current = true
      map.flyTo({
        center,
        zoom,
        pitch,
        bearing,
        duration,
      })
      applyingCamera.current = false
      if (!duration) {
        setCurrentPitch(map.getPitch())
        setCurrentZoom(map.getZoom())
        const position = map.getCenter()
        setCurrentCenter([position.lng, position.lat])
        callbacks.current.onViewportChange?.({ center: [position.lng, position.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() })
      }
    }
  }, [center[0], center[1], zoom, pitch, bearing])

  // Sync routes when routes change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    syncRoutes(map, routes)
  }, [routes, mapLoaded, syncRoutes])

  // Render HTML / SVG Markers adhering to the Surface Law
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clean up previous markers
    markerInstancesRef.current.forEach((m) => m.remove())
    markerInstancesRef.current = []

    markers.forEach((m) => {
      const el = document.createElement("button")
      el.type = "button"
      el.className = cn("map-place-marker", m.showLabel === false && "has-hover-label")
      el.setAttribute("aria-label", `View ${m.title}`)
      el.title = m.title

      const isSignal = m.active !== false
      const point = document.createElement("span")
      point.className = isSignal ? "map-place-point is-selected" : "map-place-point"
      const label = document.createElement("span")
      label.className = "map-place-label"
      label.textContent = m.title
      el.append(point, label)

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        callbacks.current.onMarkerClick?.(m)
        map.flyTo({
          center: [m.lng, m.lat],
          zoom: Math.max(map.getZoom(), 8),
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
        })
      })

      const markerInstance = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(map)

      markerInstancesRef.current.push(markerInstance)
    })
  }, [markers])

  const cameraDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: cameraDuration() })
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: cameraDuration() })
  const handleResetNorth = () => mapRef.current?.resetNorthPitch({ duration: cameraDuration() })

  const handleLocateOperator = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapRef.current?.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 13,
            duration: cameraDuration(),
          })
        },
        () => {
          // Keep the current view when location permission is denied.
          mapRef.current?.flyTo({
            center: ALGERIA_CENTER,
            zoom: 12,
            duration: cameraDuration(),
          })
        }
      )
    }
  }

  const handleSetStyle = (style: FridayMapPreset) => {
    setActiveStyle(style)
    onStylePresetChange?.(style)
  }

  return (
    <div
      data-map-style={activeStyle}
      data-map-pitch={Math.round(currentPitch)}
      className={cn(
        "relative w-full overflow-hidden bg-[#000000] select-none",
        typeof height === "number" ? "h-[320px]" : "h-full",
        className
      )}
    >
      <div ref={containerRef} className="w-full h-full" />
      {mapError && (
        <div role="alert" className="absolute left-1/2 top-3 z-30 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-lg border border-red-400/30 bg-[#05070a]/90 px-3 py-2 text-xs leading-snug text-red-100 shadow-2xl">
          <span className="truncate">{mapError}</span>
          <button type="button" onClick={() => setMapError(null)} aria-label="Dismiss map error" className="cursor-pointer text-red-200/70 transition-opacity hover:text-red-100">×</button>
        </div>
      )}
      {/* Celestial Viewport Cardinal Markings (Reference 1 Aesthetic) */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3">
        {/* Top & Corner Ticks */}
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
          <span className="size-2 border-t border-l border-white/20" />
          <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-white/[0.06] backdrop-blur-xs">
            <span className="w-1.5 h-0.5 bg-white/40" />
            <span className="font-semibold text-zinc-300">N 000°</span>
          </div>
          <span className="size-2 border-t border-r border-white/20" />
        </div>

        {/* Center Lateral Ticks */}
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
          <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.06] backdrop-blur-xs -ml-1">
            <span className="h-1.5 w-0.5 bg-white/40" />
            <span>W</span>
          </div>
          <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.06] backdrop-blur-xs -mr-1">
            <span>E</span>
            <span className="h-1.5 w-0.5 bg-white/40" />
          </div>
        </div>

        {/* Bottom & Corner Ticks */}
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
          <span className="size-2 border-b border-l border-white/20" />
          <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-white/[0.06] backdrop-blur-xs">
            <span className="w-1.5 h-0.5 bg-white/40" />
            <span className="font-semibold text-zinc-300">S 180°</span>
          </div>
          <span className="size-2 border-b border-r border-white/20" />
        </div>
      </div>

      {/* Top-Right Spatial Controls & Basemap Switcher (Only if not hidden by parent) */}
      {interactive && !hideBuiltinControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
          {/* Basemap Feed Switcher Pills */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#0c0e12]/90 border border-white/10 backdrop-blur-md shadow-xl">
            <button
              type="button"
              onClick={() => handleSetStyle("satellite")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-colors cursor-pointer",
                activeStyle === "satellite"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-white/60 hover:text-white"
              )}
              title="Orbital Satellite Feed (Esri World Imagery)"
            >
              <Satellite className="size-3 text-zinc-300" />
              <span>SATELLITE</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetStyle("carbon")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-colors cursor-pointer",
                activeStyle === "carbon"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-white/60 hover:text-white"
              )}
              title="Obsidian Dark Vector Feed"
            >
              <Moon className="size-3 text-white/70" />
              <span>OBSIDIAN</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetStyle("terrain")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-colors cursor-pointer",
                activeStyle === "terrain"
                  ? "bg-white/20 text-white font-semibold shadow-xs"
                  : "text-white/60 hover:text-white"
              )}
              title="Tactical Terrain Feed"
            >
              <Map className="size-3 text-white/70" />
              <span>TERRAIN</span>
            </button>
          </div>

          {/* Navigation Zoom / Compass Controls */}
          <div className="flex flex-col gap-1 self-end">
            <button
              type="button"
              onClick={handleZoomIn}
              className="size-7 rounded-md bg-[#0c0e12]/90 hover:bg-[#151922] border border-white/10 text-white/90 shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="size-7 rounded-md bg-[#0c0e12]/90 hover:bg-[#151922] border border-white/10 text-white/90 shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetNorth}
              className="size-7 rounded-md bg-[#0c0e12]/90 hover:bg-[#151922] border border-white/10 text-white/90 shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Reset North Pitch"
            >
              <Compass className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleLocateOperator}
              className="size-7 rounded-md bg-[#0c0e12]/90 hover:bg-[#151922] border border-white/10 text-zinc-300 shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Locate Operator Position"
            >
              <Crosshair className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Coordinates & Telemetry Ribbon (Only if not hidden by parent) */}
      {!hideBuiltinControls && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#090A0C]/90 backdrop-blur-md border border-white/10 text-[11px] text-white/80 tabular-nums shadow-xl">
          <span className="flex items-center gap-1.5 font-mono">
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            <span>{currentCenter[1] >= 0 ? `${currentCenter[1].toFixed(4)}°N` : `${Math.abs(currentCenter[1]).toFixed(4)}°S`}</span>
            <span>{currentCenter[0] >= 0 ? `${currentCenter[0].toFixed(4)}°E` : `${Math.abs(currentCenter[0]).toFixed(4)}°W`}</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="font-mono text-[10px] text-zinc-400">ZOOM {currentZoom}</span>
          <span className="text-white/20">|</span>
          <span className="font-mono text-[10px] uppercase text-zinc-300">
            {activeStyle}
          </span>
        </div>
      )}
    </div>
  )
}
