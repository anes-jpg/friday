/** FRIDAY Map Canvas Component (§04 & Blueprint §4)
 *
 * High-performance WebGL2 MapLibre GL engine:
 * - 0% Idle CPU Law: Only renders on interaction or active frame updates
 * - Editorial Carbon aesthetic matching FRIDAY OS Obsidian / Slate design tokens
 * - Native vector lines for telemetry routes & single-signal purple accents
 * - Clean RAII disposal on unmount to prevent WebGL context leaks
 */

import React, { useEffect, useRef, useState } from "react"
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { getFridayMapStyle, registerPmTilesProtocol } from "@/lib/map-style"
import { Compass, ZoomIn, ZoomOut, Layers, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MapMarkerData {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  badge?: string
  color?: string
  active?: boolean
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
  stylePreset?: "carbon" | "vector"
  markers?: MapMarkerData[]
  routes?: MapRouteData[]
  onViewportChange?: (viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => void
  onMarkerClick?: (marker: MapMarkerData) => void
  className?: string
  height?: number | string
}

export const FridayMapCanvas: React.FC<FridayMapCanvasProps> = ({
  center = [-122.4194, 37.7749], // San Francisco default
  zoom = 12,
  pitch = 0,
  bearing = 0,
  interactive = true,
  stylePreset = "carbon",
  markers = [],
  routes = [],
  onViewportChange,
  onMarkerClick,
  className,
  height = "100%",
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerInstancesRef = useRef<maplibregl.Marker[]>([])
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current) return

    registerPmTilesProtocol()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getFridayMapStyle(stylePreset),
      center,
      zoom,
      pitch,
      bearing,
      interactive,
      attributionControl: false,
      fadeDuration: 0, // Instant layer transitions to ensure 0% idle GPU overhead
      trackResize: true,
    })

    mapRef.current = map

    map.on("load", () => {
      setMapLoaded(true)
    })

    map.on("moveend", () => {
      const c = map.getCenter()
      const z = map.getZoom()
      const p = map.getPitch()
      const b = map.getBearing()
      setCurrentZoom(Math.round(z * 10) / 10)
      onViewportChange?.({
        center: [c.lng, c.lat],
        zoom: z,
        pitch: p,
        bearing: b,
      })
    })

    return () => {
      // Clear markers
      markerInstancesRef.current.forEach((m) => m.remove())
      markerInstancesRef.current = []
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [stylePreset])

  // Center / Zoom updates from props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const currentCenter = map.getCenter()
    const dist = Math.hypot(currentCenter.lng - center[0], currentCenter.lat - center[1])
    if (dist > 0.001 || Math.abs(map.getZoom() - zoom) > 0.1) {
      map.flyTo({
        center,
        zoom,
        pitch,
        bearing,
        duration: 900,
        essential: true,
      })
    }
  }, [center[0], center[1], zoom, pitch, bearing])

  // Render Routes (GeoJSON layers)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    routes.forEach((route) => {
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
    const activeRouteIds = new Set(routes.map((r) => `route-layer-${r.id}`))
    map.getStyle()?.layers?.forEach((layer) => {
      if (layer.id.startsWith("route-layer-") && !activeRouteIds.has(layer.id)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id)
        const sourceId = layer.id.replace("layer-", "source-")
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      }
    })
  }, [routes, mapLoaded])

  // Render HTML / SVG Markers adhering to the Surface Law
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clean up previous markers
    markerInstancesRef.current.forEach((m) => m.remove())
    markerInstancesRef.current = []

    markers.forEach((m) => {
      const el = document.createElement("div")
      el.className = "group relative flex items-center justify-center cursor-pointer select-none"
      
      // Marker HTML structure with subtle obsidian pill & signal ring
      const isSignal = m.active !== false
      const accentColor = m.color || (isSignal ? "hsl(var(--signal))" : "#6E7681")
      
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-control)] bg-[hsl(var(--surface-raised))] border border-white/10 shadow-lg text-[hsl(var(--ink))] transition-transform group-hover:scale-105">
            <span class="w-1.5 h-1.5 rounded-full ${isSignal ? "bg-[hsl(var(--signal))] animate-pulse" : "bg-neutral-500"}"></span>
            <span class="text-[11px] font-semibold tracking-tight whitespace-nowrap">${m.title}</span>
            ${m.badge ? `<span class="text-[9px] px-1 rounded bg-black/40 text-[hsl(var(--muted))]">${m.badge}</span>` : ""}
          </div>
          <div class="w-1.5 h-1.5 rotate-45 bg-[hsl(var(--surface-raised))] border-r border-b border-white/10 -mt-1"></div>
        </div>
      `

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        onMarkerClick?.(m)
        map.flyTo({
          center: [m.lng, m.lat],
          zoom: Math.max(map.getZoom(), 14),
          duration: 700,
        })
      })

      const markerInstance = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(map)

      markerInstancesRef.current.push(markerInstance)
    })
  }, [markers, onMarkerClick])

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 })
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 })
  const handleResetNorth = () => mapRef.current?.resetNorthPitch({ duration: 400 })

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[#090A0C]",
        className
      )}
      style={{ height }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Spatial Controls */}
      {interactive && (
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface-raised))]/90 hover:bg-[hsl(var(--surface-raised))] border border-white/10 text-[hsl(var(--ink))] shadow-md transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface-raised))]/90 hover:bg-[hsl(var(--surface-raised))] border border-white/10 text-[hsl(var(--ink))] shadow-md transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetNorth}
            className="p-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface-raised))]/90 hover:bg-[hsl(var(--surface-raised))] border border-white/10 text-[hsl(var(--ink))] shadow-md transition-colors"
            title="Reset Bearing"
          >
            <Compass className="size-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Telemetry HUD Ribbon */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-control)] bg-[#090A0C]/85 backdrop-blur-xs border border-white/10 text-[10px] text-[hsl(var(--muted))] tabular-nums">
        <span className="flex items-center gap-1 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--signal))] animate-pulse"></span>
          <span>{center[1].toFixed(4)}°N</span>
          <span>{center[0].toFixed(4)}°W</span>
        </span>
        <span className="text-white/20">|</span>
        <span className="font-mono">Z:{currentZoom}</span>
      </div>
    </div>
  )
}
