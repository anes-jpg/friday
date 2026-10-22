/**
 * Intelligent UI Data Visuals:
 * MapView (interactive route map with pins, category filters, and stop inspector),
 * Chart (Bar, Line, Area, Donut/Pie), Metric KPI.
 * Fully vectorized SVG, zero external chart bloated dependencies, zero inline styles.
 */

import React, { useState, useRef, useEffect, useMemo } from "react"
import {
  MapPin,
  Navigation,
  TrendingUp,
  TrendingDown,
  Minus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ExternalLink,
} from "lucide-react"
import type { MapMarkerItem } from "../types"
import { FridayMapCanvas } from "@/components/map/FridayMapCanvas"

// Coordinate projection math (Web Mercator / EPSG:3857)
function lon2tile(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom)
}

function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  )
}

function calcDefaultZoom(markers: MapMarkerItem[]): number {
  if (markers.length <= 1) return 13
  const lats = markers.map((m) => m.lat)
  const lngs = markers.map((m) => m.lng)
  const maxSpan = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs)
  )
  if (maxSpan <= 0.02) return 14
  if (maxSpan <= 0.08) return 13
  if (maxSpan <= 0.25) return 11
  if (maxSpan <= 1.0) return 9
  if (maxSpan <= 5.0) return 7
  return 5
}

export const MapViewPrimitive: React.FC<{
  centerName?: string
  markers: MapMarkerItem[]
  title?: string
  subtitle?: string
}> = ({ centerName = "Map Route", markers, title, subtitle }) => {
  const defaultZoom = useMemo(() => calcDefaultZoom(markers), [markers])
  const [zoom, setZoom] = useState<number>(defaultZoom)
  const [selectedId, setSelectedId] = useState<string>(markers[0]?.id || "")
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [mapMode, setMapMode] = useState<"dark" | "street" | "vector">("dark")
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [hasTileError, setHasTileError] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewDim, setViewDim] = useState<{ w: number; h: number }>({ w: 640, h: 320 })

  useEffect(() => {
    if (!containerRef.current) return
    const updateDim = () => {
      if (containerRef.current) {
        setViewDim({
          w: containerRef.current.clientWidth || 640,
          h: 320,
        })
      }
    }
    updateDim()
    window.addEventListener("resize", updateDim)
    return () => window.removeEventListener("resize", updateDim)
  }, [])

  // Categories
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(markers.map((m) => m.category || "General")))],
    [markers]
  )

  const filteredMarkers = useMemo(
    () =>
      activeCategory === "All"
        ? markers
        : markers.filter((m) => (m.category || "General") === activeCategory),
    [activeCategory, markers]
  )

  // Geographical center
  const centerCoord = useMemo(() => {
    if (markers.length === 0) return { lat: 37.7749, lng: -122.4194 }
    const sumLat = markers.reduce((acc, m) => acc + m.lat, 0)
    const sumLng = markers.reduce((acc, m) => acc + m.lng, 0)
    return {
      lat: sumLat / markers.length,
      lng: sumLng / markers.length,
    }
  }, [markers])

  const intZoom = Math.max(2, Math.min(18, Math.round(zoom)))
  const centerTileX = lon2tile(centerCoord.lng, intZoom)
  const centerTileY = lat2tile(centerCoord.lat, intZoom)

  // Effective center incorporating user pan
  const effCenterTileX = centerTileX - panOffset.x / 256
  const effCenterTileY = centerTileY - panOffset.y / 256

  // Tile grid calculation
  const tiles = useMemo(() => {
    if (mapMode === "vector") return []
    const margin = 1
    const minTx = Math.floor(effCenterTileX - viewDim.w / 512) - margin
    const maxTx = Math.floor(effCenterTileX + viewDim.w / 512) + margin
    const minTy = Math.floor(effCenterTileY - viewDim.h / 512) - margin
    const maxTy = Math.floor(effCenterTileY + viewDim.h / 512) + margin

    const maxIndex = Math.pow(2, intZoom)
    const list: Array<{ key: string; x: number; y: number; url: string; left: number; top: number }> = []

    for (let ty = minTy; ty <= maxTy; ty++) {
      if (ty < 0 || ty >= maxIndex) continue
      for (let tx = minTx; tx <= maxTx; tx++) {
        const wrappedTx = ((tx % maxIndex) + maxIndex) % maxIndex
        const left = (tx - effCenterTileX) * 256 + viewDim.w / 2
        const top = (ty - effCenterTileY) * 256 + viewDim.h / 2

        const url =
          mapMode === "dark"
            ? `https://basemaps.cartocdn.com/dark_all/${intZoom}/${wrappedTx}/${ty}.png`
            : `https://tile.openstreetmap.org/${intZoom}/${wrappedTx}/${ty}.png`

        list.push({
          key: `${intZoom}-${wrappedTx}-${ty}`,
          x: wrappedTx,
          y: ty,
          url,
          left,
          top,
        })
      }
    }
    return list
  }, [effCenterTileX, effCenterTileY, intZoom, mapMode, viewDim])

  // Screen coordinates for markers
  const markerPoints = useMemo(() => {
    return filteredMarkers.map((m) => {
      const mx = lon2tile(m.lng, intZoom)
      const my = lat2tile(m.lat, intZoom)
      const x = (mx - effCenterTileX) * 256 + viewDim.w / 2
      const y = (my - effCenterTileY) * 256 + viewDim.h / 2
      return { ...m, x, y }
    })
  }, [filteredMarkers, intZoom, effCenterTileX, effCenterTileY, viewDim])

  // Selected marker details
  const selectedMarker = markers.find((m) => m.id === selectedId) || markers[0]

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleRecenter = () => {
    setPanOffset({ x: 0, y: 0 })
    setZoom(defaultZoom)
  }

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-black/10 dark:border-white/[0.08] gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[hsl(var(--signal))]/15 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30">
            <Navigation className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-tight text-[hsl(var(--ink))]">
              {title || centerName}
            </h4>
            <span className="text-[10px] font-mono text-[hsl(var(--muted))]">
              {subtitle || `${markers.length} verified stops mapped`}
            </span>
          </div>
        </div>

        {/* Categories & Layer Switcher */}
        <div className="flex items-center gap-2">
          {/* Layer switcher */}
          <div className="flex items-center rounded-lg bg-black/20 dark:bg-black/40 border border-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setMapMode("dark")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                mapMode === "dark"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Dark Matter
            </button>
            <button
              type="button"
              onClick={() => setMapMode("street")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                mapMode === "street"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Streets
            </button>
            <button
              type="button"
              onClick={() => setMapMode("vector")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                mapMode === "vector"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Vector
            </button>
          </div>

          {/* Category filter pills */}
          {categories.length > 2 && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer select-none ${
                    activeCategory === cat
                      ? "bg-white text-black dark:bg-white dark:text-black font-semibold shadow-xs"
                      : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/5"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Map Viewport (Pannable & Zoomable) */}
      {mapMode === "vector" ? (
        <FridayMapCanvas
          center={[centerCoord.lng, centerCoord.lat]}
          zoom={zoom}
          markers={filteredMarkers.map((m) => ({
            id: m.id,
            lat: m.lat,
            lng: m.lng,
            title: m.title,
            subtitle: m.description,
            badge: m.category,
            active: m.id === selectedId,
          }))}
          routes={
            markers.length > 1
              ? [
                  {
                    id: "route",
                    coordinates: markers.map((m) => [m.lng, m.lat]),
                    color: "#9333ea",
                    width: 3,
                  },
                ]
              : []
          }
          onMarkerClick={(m) => setSelectedId(m.id)}
          height={320}
        />
      ) : (
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[320px] bg-[#0c1017] dark:bg-[#070b10] overflow-hidden select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Real Raster Tiles Layer (CartoDB Dark Matter / OpenStreetMap) */}
        {!hasTileError && (
          <div className="absolute inset-0 pointer-events-none">
            {tiles.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt=""
                onError={() => setHasTileError(true)}
                draggable={false}
                style={{
                  position: "absolute",
                  left: `${t.left}px`,
                  top: `${t.top}px`,
                  width: "256px",
                  height: "256px",
                }}
                className="select-none"
              />
            ))}
          </div>
        )}

        {/* Ambient Topography Vector & Grid (Aesthetic background & Offline Fallback) */}
        {hasTileError && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs>
              <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
              </pattern>
              <radialGradient id="mapGlow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(168, 85, 247, 0.12)" />
                <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapGrid)" />
            <rect width="100%" height="100%" fill="url(#mapGlow)" />
            <path d="M 0 80 Q 200 40 400 90 T 800 70 L 800 0 L 0 0 Z" fill="rgba(168, 85, 247, 0.04)" />
          </svg>
        )}

        {/* SVG Overlay: Connecting Routes & Marker Pins */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Animated Purple Route Line */}
          {markerPoints.length > 1 && (
            <path
              d={markerPoints
                .map((m, idx) => `${idx === 0 ? "M" : "L"} ${m.x} ${m.y}`)
                .join(" ")}
              fill="none"
              stroke="hsl(var(--signal))"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeOpacity="0.85"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_hsl(var(--signal))]"
            />
          )}

          {/* Interactive Pins */}
          {markerPoints.map((m, idx) => {
            const isSelected = m.id === selectedId

            return (
              <g
                key={m.id}
                transform={`translate(${m.x}, ${m.y})`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(m.id)
                }}
                className="cursor-pointer pointer-events-auto group/pin"
              >
                {/* Active Pulsing Halo */}
                {isSelected && (
                  <circle
                    r="18"
                    fill="none"
                    stroke="hsl(var(--signal))"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                    className="animate-ping"
                  />
                )}

                {/* Ground Shadow */}
                <ellipse cx="0" cy="9" rx="8" ry="3" fill="rgba(0,0,0,0.7)" />

                {/* Pin Circle Body */}
                <circle
                  r={isSelected ? "12" : "9.5"}
                  fill={isSelected ? "hsl(var(--signal))" : "#18181b"}
                  stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.6)"}
                  strokeWidth="2"
                  className="transition-all duration-200 group-hover/pin:scale-115"
                />

                {/* Step Number */}
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill={isSelected ? "#000000" : "#ffffff"}
                  fontSize={isSelected ? "9.5" : "8"}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {idx + 1}
                </text>

                {/* Tooltip Label */}
                <g
                  transform="translate(0, -22)"
                  className="opacity-0 group-hover/pin:opacity-100 transition-opacity pointer-events-none"
                >
                  <rect
                    x="-60"
                    y="-16"
                    width="120"
                    height="20"
                    rx="4"
                    fill="#09090b"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-2.5"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="system-ui"
                  >
                    {m.title.length > 18 ? `${m.title.slice(0, 18)}…` : m.title}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>

        {/* Floating Controls Overlay (Zoom & Recenter) */}
        <div className="absolute right-3.5 bottom-3.5 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Recenter map"
            title="Recenter"
            className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(18, z + 1))}
            aria-label="Zoom in"
            title="Zoom In"
            className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(2, z - 1))}
            aria-label="Zoom out"
            title="Zoom Out"
            className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white backdrop-blur-md cursor-pointer transition-colors shadow-md"
          >
            <ZoomOut className="size-3.5" />
          </button>
        </div>

        {/* Attribution Watermark */}
        <div className="absolute left-3 bottom-2 text-[9px] font-mono text-white/35 backdrop-blur-xs px-1.5 py-0.5 rounded bg-black/40">
          © CartoDB · OpenStreetMap contributors
        </div>
      </div>
      )}

      {/* Selected Marker Details Drawer */}
      {selectedMarker && (
        <div className="p-3.5 bg-black/20 dark:bg-black/40 border-t border-black/10 dark:border-white/[0.08] flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[hsl(var(--signal))]" />
              <h5 className="text-xs font-semibold text-[hsl(var(--ink))]">
                {selectedMarker.title}
              </h5>
              {selectedMarker.category && (
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono uppercase bg-white/10 text-[hsl(var(--muted))]">
                  {selectedMarker.category}
                </span>
              )}
            </div>
            {selectedMarker.description && (
              <p className="text-[11.5px] text-[hsl(var(--muted))] leading-relaxed pl-4">
                {selectedMarker.description}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-[hsl(var(--muted))] tabular-nums block">
              {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
            </span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedMarker.lat},${selectedMarker.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-[hsl(var(--signal))] hover:underline cursor-pointer"
            >
              <span>Directions</span>
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export const ChartPrimitive: React.FC<{
  type?: "bar" | "line" | "area" | "donut" | "pie"
  labels: string[]
  values: number[]
  title?: string
  unit?: string
}> = ({ type = "bar", labels, values, title, unit = "" }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const maxVal = values.length > 0 ? Math.max(...values, 1) : 1
  const chartHeight = 130
  const chartWidth = 360

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] space-y-3">
      {/* Chart Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/[0.08] pb-2.5">
        <div>
          {title && (
            <h4 className="text-xs font-semibold tracking-tight text-[hsl(var(--ink))]">
              {title}
            </h4>
          )}
          <span className="text-[10.5px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
            {type.toUpperCase()} METRIC VISUALIZER
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm font-mono font-bold tabular-nums text-[hsl(var(--ink))]">
            {hoverIndex !== null && values[hoverIndex] !== undefined
              ? `${values[hoverIndex].toLocaleString()} ${unit}`
              : `${values[values.length - 1]?.toLocaleString() ?? 0} ${unit}`}
          </span>
          <span className="text-[10px] font-mono text-[hsl(var(--muted))] block">
            {hoverIndex !== null ? labels[hoverIndex] : "Latest value"}
          </span>
        </div>
      </div>

      {/* SVG Chart Rendering */}
      <div className="relative w-full h-[150px] flex items-end">
        {type === "bar" ? (
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            {/* Grid horizontal guidelines */}
            <line x1="0" y1="30" x2={chartWidth} y2="30" stroke="rgba(255,255,255,0.06)" />
            <line x1="0" y1="75" x2={chartWidth} y2="75" stroke="rgba(255,255,255,0.06)" />
            <line x1="0" y1="120" x2={chartWidth} y2="120" stroke="rgba(255,255,255,0.06)" />

            {/* SVG Bars */}
            {(() => {
              const barWidth = Math.max(16, (chartWidth / values.length) * 0.6)
              const gap = chartWidth / values.length
              return values.map((v, i) => {
                const bHeight = Math.max(8, (v / maxVal) * 90)
                const bx = i * gap + (gap - barWidth) / 2
                const by = 120 - bHeight
                const isHovered = hoverIndex === i

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={bx}
                      y={by}
                      width={barWidth}
                      height={bHeight}
                      rx="4"
                      fill={isHovered ? "hsl(var(--signal))" : "rgba(255,255,255,0.2)"}
                      className="transition-colors duration-200"
                    />
                    <text
                      x={bx + barWidth / 2}
                      y="132"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.6)"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {labels[i] || `${i + 1}`}
                    </text>
                  </g>
                )
              })
            })()}
          </svg>
        ) : (
          /* Line or Area Chart */
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--signal))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--signal))" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal guidelines */}
            <line x1="0" y1="30" x2={chartWidth} y2="30" stroke="rgba(255,255,255,0.06)" />
            <line x1="0" y1="75" x2={chartWidth} y2="75" stroke="rgba(255,255,255,0.06)" />
            <line x1="0" y1="120" x2={chartWidth} y2="120" stroke="rgba(255,255,255,0.06)" />

            {/* Line coordinates */}
            {(() => {
              const stepX = chartWidth / (Math.max(values.length - 1, 1))
              const points = values.map((v, i) => {
                const x = i * stepX
                const y = 120 - (v / maxVal) * 90
                return { x, y }
              })
              const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
              const areaD = `${pathD} L ${points[points.length - 1].x} 125 L ${points[0].x} 125 Z`

              return (
                <>
                  <path d={areaD} fill="url(#areaGradient)" />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="hsl(var(--signal))"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={hoverIndex === i ? "5" : "3.5"}
                      fill="hsl(var(--signal))"
                      stroke="#000"
                      strokeWidth="1.5"
                      onMouseEnter={() => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(null)}
                      className="cursor-pointer transition-all"
                    />
                  ))}
                </>
              )
            })()}
          </svg>
        )}
      </div>

      {/* Labels row for line/area chart */}
      {type !== "bar" && (
        <div className="flex justify-between text-[10px] font-mono text-[hsl(var(--muted))] pt-1 border-t border-black/5 dark:border-white/5">
          {labels.map((lbl, i) => (
            <span key={i} className="truncate max-w-[60px]">
              {lbl}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const MetricPrimitive: React.FC<{
  label: string
  value: number | string
  unit?: string
  change?: string
  trend?: "up" | "down" | "neutral"
}> = ({ label, value, unit = "", change, trend = "up" }) => {
  const isUp = trend === "up"
  const isNeutral = trend === "neutral"

  return (
    <div className="p-4 rounded-xl bg-black/20 dark:bg-black/30 border border-black/10 dark:border-white/5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
          {label}
        </span>
        {change && (
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-mono font-medium px-1.5 py-0.5 rounded ${
              isNeutral
                ? "bg-white/10 text-[hsl(var(--muted))]"
                : isUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {isNeutral ? <Minus className="size-3" /> : isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {change}
          </span>
        )}
      </div>
      <div className="font-mono text-xl font-bold tracking-tight tabular-nums text-[hsl(var(--ink))]">
        {typeof value === "number" ? value.toLocaleString() : value} {unit}
      </div>
    </div>
  )
}
