import React, { useEffect, useRef, useCallback, useMemo, useState } from "react"
import type { Fact } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useFriday } from "@/lib/store"
import { RotateCcw, Play, Pause, ZoomIn, ZoomOut } from "lucide-react"

interface MemoryGlobeProps {
  facts: Fact[]
  selectedFactId: string | null
  onSelectFact: (fact: Fact) => void
  searchQuery?: string
  className?: string
}

interface UnitVertex {
  id: number
  x: number
  y: number
  z: number
  neighbors: number[]
}

interface ProjectedVertex {
  id: number
  x3d: number
  y3d: number
  z3d: number
  screenX: number
  screenY: number
  scale: number
  alpha: number
  fact: Fact | null
  isHovered: boolean
  isSelected: boolean
  isFocused: boolean
  isMatch: boolean
  proximity: number
}

interface PointerTrailPoint {
  x: number
  y: number
  time: number
}

// ── FRIDAY Strict Monochrome & One-Signal Tokens ──────────────────────────────
// Surfaces & lines are strictly monochrome derived from theme.css
const COLOR_VOID = "oklch(14% 0 0)"
const COLOR_HULL = "oklch(17% 0 0)"
const COLOR_PLATE = "oklch(21% 0 0)"
const COLOR_EDGE = "rgba(255, 255, 255, 0.12)"
const COLOR_EDGE_FAINT = "rgba(255, 255, 255, 0.035)"
const COLOR_MUTE = "oklch(60% 0 0)"
const COLOR_TEXT = "oklch(95% 0 0)"

// Single Accent (One-Signal Law) — used exclusively for the single active/hovered node
const COLOR_ACID = "oklch(75% 0.15 220)"

const TOTAL_LATTICE_VERTICES = 64
const REVOLUTION_SECONDS = 50 // Constant steady rotation (~50s per revolution)
const TARGET_ANGULAR_VELOCITY = (2 * Math.PI) / REVOLUTION_SECONDS

/** Precomputes a uniform geodesic spherical distribution with nearest-neighbor edges */
function createGeodesicMesh(numPoints: number): { vertices: UnitVertex[]; edges: [number, number][] } {
  const vertices: UnitVertex[] = []

  // 1. Distribute points across unit sphere using Fibonacci spiral
  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (2 * (i + 0.5)) / numPoints
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = (i + 0.5) * 2.3999632 // Golden angle in radians

    const x = Math.cos(phi) * r
    const z = Math.sin(phi) * r

    vertices.push({
      id: i,
      x,
      y,
      z,
      neighbors: [],
    })
  }

  // 2. Connect each vertex to its 3–4 closest spatial neighbors on the sphere
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []

  for (let i = 0; i < numPoints; i++) {
    const v1 = vertices[i]
    const distances: { index: number; dist: number }[] = []

    for (let j = 0; j < numPoints; j++) {
      if (i === j) continue
      const v2 = vertices[j]
      const d = Math.hypot(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z)
      distances.push({ index: j, dist: d })
    }

    distances.sort((a, b) => a.dist - b.dist)

    const neighborCount = i % 2 === 0 ? 4 : 3
    for (let k = 0; k < neighborCount; k++) {
      const neighborIdx = distances[k].index
      v1.neighbors.push(neighborIdx)

      const a = Math.min(i, neighborIdx)
      const b = Math.max(i, neighborIdx)
      const key = `${a}-${b}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push([a, b])
      }
    }
  }

  return { vertices, edges }
}

/** Precomputes graticule parallels (latitudes) and meridians (longitudes) on the unit sphere */
function createGraticuleLines(): { parallels: [number, number, number][][]; meridians: [number, number, number][][] } {
  const parallels: [number, number, number][][] = []
  const meridians: [number, number, number][][] = []

  // Latitude circles at -60°, -30°, 0° (equator), +30°, +60°
  const latAngles = [-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3]
  const steps = 40
  for (const lat of latAngles) {
    const y = Math.sin(lat)
    const r = Math.cos(lat)
    const line: [number, number, number][] = []
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * Math.PI * 2
      line.push([r * Math.cos(theta), y, r * Math.sin(theta)])
    }
    parallels.push(line)
  }

  // Longitude meridians at 0°, 60°, 120°, 180°, 240°, 300°
  const lonAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3]
  for (const lon of lonAngles) {
    const line: [number, number, number][] = []
    for (let s = 0; s <= steps; s++) {
      const phi = -Math.PI / 2 + (s / steps) * Math.PI
      const y = Math.sin(phi)
      const r = Math.cos(phi)
      line.push([r * Math.sin(lon), y, r * Math.cos(lon)])
    }
    meridians.push(line)
  }

  return { parallels, meridians }
}

export const MemoryGlobe: React.FC<MemoryGlobeProps> = ({
  facts,
  selectedFactId,
  onSelectFact,
  searchQuery = "",
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useFriday((s) => s.theme)

  // Zoom state (clamped 0.65x - 1.65x)
  const [zoom, setZoom] = useState(1.0)
  const [isAutoRotating, setIsAutoRotating] = useState(true)
  const [focusedFactIndex, setFocusedFactIndex] = useState<number>(-1)

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    mediaQuery.addEventListener("change", onChange)
    return () => mediaQuery.removeEventListener("change", onChange)
  }, [])

  // 3D rotation & physics refs
  const rotXRef = useRef(0.25)
  const rotYRef = useRef(0)
  const velXRef = useRef(0)
  const velYRef = useRef(TARGET_ANGULAR_VELOCITY)
  const isDraggingRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const lastTimeRef = useRef(performance.now())

  // Target orientation for smooth focus animation (double click or keyboard)
  const targetRotationRef = useRef<{ rotX: number; rotY: number; active: boolean } | null>(null)

  // Pointer position & glow trail
  const pointerRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false })
  const trailRef = useRef<PointerTrailPoint[]>([])

  // Hover transitions ref to achieve 120-220ms smooth ease
  const hoverProgressRef = useRef<Record<number, number>>({})

  // Hit test & projection refs
  const hoveredVertexRef = useRef<ProjectedVertex | null>(null)
  const projectedVerticesRef = useRef<ProjectedVertex[]>([])

  // Geodesic mesh & graticule lines topology
  const { vertices: latticeVertices, edges: latticeEdges } = useMemo(
    () => createGeodesicMesh(TOTAL_LATTICE_VERTICES),
    []
  )

  const { parallels, meridians } = useMemo(() => createGraticuleLines(), [])

  // Map facts evenly without collisions to lattice vertices
  const factMap = useMemo(() => {
    const map = new Map<number, Fact>()
    const usedIndices = new Set<number>()
    const sortedFacts = [...facts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

    let step = 3
    for (const fact of sortedFacts) {
      let attempts = 0
      while (usedIndices.has(step % TOTAL_LATTICE_VERTICES) && attempts < TOTAL_LATTICE_VERTICES) {
        step = (step + 1) % TOTAL_LATTICE_VERTICES
        attempts++
      }
      const idx = step % TOTAL_LATTICE_VERTICES
      usedIndices.add(idx)
      map.set(idx, fact)
      step = (step + 7) % TOTAL_LATTICE_VERTICES
    }
    return map
  }, [facts])

  // Reset or focus helper
  const focusOnVertex = useCallback((vertex: ProjectedVertex) => {
    const v = latticeVertices[vertex.id]
    if (!v) return

    // Target rotation to orient this node towards viewer (z positive, x ~ 0, y ~ 0)
    const targetY = -Math.atan2(v.x, v.z)
    const targetX = Math.asin(Math.max(-0.95, Math.min(0.95, v.y)))

    targetRotationRef.current = {
      rotX: targetX,
      rotY: targetY,
      active: true,
    }
  }, [latticeVertices])

  // Pointer interactions
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    targetRotationRef.current = null
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    velXRef.current = 0
    velYRef.current = 0
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    pointerRef.current = { x: mouseX, y: mouseY, inside: true }

    // Collect trailing points for sweeping glow trail unless reduced motion
    if (!prefersReducedMotion) {
      trailRef.current.push({ x: mouseX, y: mouseY, time: performance.now() })
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x
      const dy = e.clientY - lastMousePosRef.current.y
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }

      velYRef.current = dx * 0.0055
      velXRef.current = dy * 0.0055
      rotYRef.current += velYRef.current
      rotXRef.current = Math.max(-1.3, Math.min(1.3, rotXRef.current - velXRef.current))
    } else {
      // Hit testing for hovered vertex (prioritize facts, front hemisphere)
      const hitRadius = 26
      let closest: ProjectedVertex | null = null
      let closestDist = Infinity

      for (const p of projectedVerticesRef.current) {
        if (p.z3d < -40) continue
        const dist = Math.hypot(p.screenX - mouseX, p.screenY - mouseY)
        const effectiveRadius = p.fact ? hitRadius * 1.25 : hitRadius * 0.75
        if (dist < effectiveRadius && dist < closestDist) {
          closestDist = dist
          closest = p
        }
      }

      hoveredVertexRef.current = closest
    }
  }, [prefersReducedMotion])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = false
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // Safe catch
      }

      if (hoveredVertexRef.current?.fact) {
        onSelectFact(hoveredVertexRef.current.fact)
      }
    },
    [onSelectFact]
  )

  const handlePointerLeave = useCallback(() => {
    isDraggingRef.current = false
    pointerRef.current.inside = false
    hoveredVertexRef.current = null
  }, [])

  const handleDoubleClick = useCallback(() => {
    if (hoveredVertexRef.current?.fact) {
      onSelectFact(hoveredVertexRef.current.fact)
      focusOnVertex(hoveredVertexRef.current)
    }
  }, [onSelectFact, focusOnVertex])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((prev) => {
      const delta = -e.deltaY * 0.0012
      return Math.max(0.65, Math.min(1.65, prev + delta))
    })
  }, [])

  // Keyboard navigation & controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        rotYRef.current -= 0.06
        e.preventDefault()
      } else if (e.key === "ArrowRight") {
        rotYRef.current += 0.06
        e.preventDefault()
      } else if (e.key === "ArrowUp") {
        rotXRef.current = Math.min(1.3, rotXRef.current + 0.06)
        e.preventDefault()
      } else if (e.key === "ArrowDown") {
        rotXRef.current = Math.max(-1.3, rotXRef.current - 0.06)
        e.preventDefault()
      } else if (e.key === " " || e.key === "Spacebar") {
        setIsAutoRotating((prev) => !prev)
        e.preventDefault()
      } else if (e.key === "+" || e.key === "=") {
        setZoom((prev) => Math.min(1.65, prev + 0.1))
        e.preventDefault()
      } else if (e.key === "-" || e.key === "_") {
        setZoom((prev) => Math.max(0.65, prev - 0.1))
        e.preventDefault()
      } else if (e.key === "0") {
        setZoom(1.0)
        rotXRef.current = 0.25
        rotYRef.current = 0
        targetRotationRef.current = null
        e.preventDefault()
      } else if (e.key === "Tab") {
        if (facts.length > 0) {
          e.preventDefault()
          const nextIndex = e.shiftKey
            ? (focusedFactIndex - 1 + facts.length) % facts.length
            : (focusedFactIndex + 1) % facts.length
          setFocusedFactIndex(nextIndex)

          const targetFact = facts[nextIndex]
          const targetProj = projectedVerticesRef.current.find((p) => p.fact?.id === targetFact?.id)
          if (targetProj) {
            focusOnVertex(targetProj)
          }
        }
      } else if (e.key === "Enter") {
        if (focusedFactIndex >= 0 && facts[focusedFactIndex]) {
          onSelectFact(facts[focusedFactIndex])
          e.preventDefault()
        }
      }
    },
    [facts, focusedFactIndex, onSelectFact, focusOnVertex]
  )

  // Control handlers
  const toggleAutoRotate = useCallback(() => {
    setIsAutoRotating((prev) => !prev)
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1.0)
    rotXRef.current = 0.25
    rotYRef.current = 0
    targetRotationRef.current = null
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(1.65, prev + 0.15))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.65, prev - 0.15))
  }, [])

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let isMounted = true

    lastTimeRef.current = performance.now()

    const render = () => {
      if (!isMounted) return

      const now = performance.now()
      const dt = Math.min(0.08, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      // Multi-monitor DPI handling
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render)
        return
      }

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const baseRadius = Math.min(width, height) * 0.38 * zoom

      // ── Physics & Rotation ──────────────────────────────────────────────────
      if (targetRotationRef.current?.active) {
        // Smoothly interpolate towards target node orientation
        const target = targetRotationRef.current
        const diffX = target.rotX - rotXRef.current
        const diffY = target.rotY - rotYRef.current
        rotXRef.current += diffX * 0.12
        rotYRef.current += diffY * 0.12

        if (Math.hypot(diffX, diffY) < 0.005) {
          targetRotationRef.current.active = false
        }
      } else if (!isDraggingRef.current) {
        const shouldRotate = isAutoRotating && !prefersReducedMotion
        const targetVel = shouldRotate ? TARGET_ANGULAR_VELOCITY : 0

        // Sub-frame smooth return to constant speed without bounce
        velYRef.current = velYRef.current * 0.95 + targetVel * 0.05
        velXRef.current *= 0.92

        rotYRef.current += velYRef.current * dt
        rotXRef.current = Math.max(-1.3, Math.min(1.3, rotXRef.current - velXRef.current * dt))
      }

      const rx = rotXRef.current
      const ry = rotYRef.current
      const cosX = Math.cos(rx)
      const sinX = Math.sin(rx)
      const cosY = Math.cos(ry)
      const sinY = Math.sin(ry)

      const isBright = theme === "bright"

      // ── 1. Flat Matte Globe Silhouette (Surface Law) ────────────────────────
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)

      const sphereFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius)
      if (isBright) {
        sphereFill.addColorStop(0, "rgba(240, 240, 243, 0.95)")
        sphereFill.addColorStop(0.85, "rgba(230, 230, 235, 0.98)")
        sphereFill.addColorStop(1.0, "rgba(220, 220, 226, 1.0)")
      } else {
        sphereFill.addColorStop(0, "rgba(24, 24, 27, 0.95)") // --color-hull
        sphereFill.addColorStop(0.85, "rgba(20, 20, 23, 0.98)")
        sphereFill.addColorStop(1.0, "rgba(18, 18, 20, 1.0)") // --color-void
      }

      ctx.fillStyle = sphereFill
      ctx.fill()

      // Globe rim edge line
      ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.14)" : COLOR_EDGE
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      // ── 2. Hover Glow: Sweeping Light & Trail (Step 3) ──────────────────────
      const ptr = pointerRef.current
      const isPointerOverGlobe = ptr.inside && Math.hypot(ptr.x - cx, ptr.y - cy) <= baseRadius * 1.05

      // Clean trail points older than 220ms
      trailRef.current = trailRef.current.filter((p) => now - p.time < 220)

      if (isPointerOverGlobe) {
        ctx.save()
        // Clip sweep lighting inside the globe sphere
        ctx.beginPath()
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
        ctx.clip()

        // Soft monochrome light sweeping the sphere
        const sweepRadius = baseRadius * 0.48
        const sweepGrad = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, sweepRadius)
        const sweepAlpha = isBright ? "0, 0, 0" : "255, 255, 255"
        sweepGrad.addColorStop(0, `rgba(${sweepAlpha}, 0.065)`)
        sweepGrad.addColorStop(0.5, `rgba(${sweepAlpha}, 0.02)`)
        sweepGrad.addColorStop(1, `rgba(${sweepAlpha}, 0)`)
        ctx.fillStyle = sweepGrad
        ctx.beginPath()
        ctx.arc(ptr.x, ptr.y, sweepRadius, 0, Math.PI * 2)
        ctx.fill()

        // Faint glow trail following pointer (disabled under prefers-reduced-motion)
        if (!prefersReducedMotion && trailRef.current.length > 1) {
          const trail = trailRef.current
          for (let t = 1; t < trail.length; t++) {
            const p1 = trail[t - 1]
            const p2 = trail[t]
            const age = (now - p2.time) / 220
            if (age >= 1) continue
            const trailAlpha = (1 - age) * (isBright ? 0.035 : 0.055)
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(${sweepAlpha}, ${trailAlpha})`
            ctx.lineWidth = 12 * (1 - age)
            ctx.lineCap = "round"
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      // ── 3. Graticule Lines (Sphere Lines at Low Opacity) ─────────────────────
      const dist = 520

      const project3D = (x0: number, y0: number, z0: number) => {
        const xScaled = x0 * baseRadius
        const yScaled = y0 * baseRadius
        const zScaled = z0 * baseRadius

        const y1 = yScaled * cosX - zScaled * sinX
        const z1 = yScaled * sinX + zScaled * cosX
        const x2 = xScaled * cosY + z1 * sinY
        const z2 = -xScaled * sinY + z1 * cosY

        const scale = dist / (dist + z2)
        const screenX = cx + x2 * scale
        const screenY = cy + y1 * scale
        return { x: screenX, y: screenY, z: z2, scale }
      }

      // Draw latitude parallels
      for (const line of parallels) {
        for (let s = 1; s < line.length; s++) {
          const p1 = project3D(line[s - 1][0], line[s - 1][1], line[s - 1][2])
          const p2 = project3D(line[s][0], line[s][1], line[s][2])
          const avgZ = (p1.z + p2.z) / 2

          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          if (avgZ > 0) {
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.08)" : COLOR_EDGE
            ctx.lineWidth = 0.75
          } else {
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.025)" : COLOR_EDGE_FAINT
            ctx.lineWidth = 0.5
          }
          ctx.stroke()
        }
      }

      // Draw longitude meridians
      for (const line of meridians) {
        for (let s = 1; s < line.length; s++) {
          const p1 = project3D(line[s - 1][0], line[s - 1][1], line[s - 1][2])
          const p2 = project3D(line[s][0], line[s][1], line[s][2])
          const avgZ = (p1.z + p2.z) / 2

          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          if (avgZ > 0) {
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.08)" : COLOR_EDGE
            ctx.lineWidth = 0.75
          } else {
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.025)" : COLOR_EDGE_FAINT
            ctx.lineWidth = 0.5
          }
          ctx.stroke()
        }
      }

      // ── 4. Project Geodesic Mesh Vertices ───────────────────────────────────
      const projected: ProjectedVertex[] = []

      for (let i = 0; i < latticeVertices.length; i++) {
        const v = latticeVertices[i]
        const p = project3D(v.x, v.y, v.z)

        // Depth alpha: Front vertices are crisp, back vertices are softly dimmed
        const normalizedZ = (p.z + baseRadius) / (baseRadius * 2)
        const alpha = Math.max(0.18, Math.min(1.0, normalizedZ * 1.25))

        const fact = factMap.get(i) || null
        const isHovered = hoveredVertexRef.current?.id === i
        const isSelected = selectedFactId !== null && fact?.id === selectedFactId
        const isFocused = focusedFactIndex >= 0 && fact?.id === facts[focusedFactIndex]?.id
        const isMatch =
          !searchQuery.trim() ||
          (fact ? `${fact.subject} ${fact.value}`.toLowerCase().includes(searchQuery.toLowerCase()) : false)

        // Proximity calculation for hover sweep brightening
        let proximity = 0
        if (ptr.inside && !isDraggingRef.current) {
          const d = Math.hypot(p.x - ptr.x, p.y - ptr.y)
          if (d < 85 && p.z > -30) {
            proximity = Math.max(0, 1 - d / 85)
          }
        }

        // Smooth transition tracking for 120-220ms hover response
        const targetHover = isHovered || isSelected || isFocused ? 1 : 0
        const currentHover = hoverProgressRef.current[i] || 0
        const nextHover = prefersReducedMotion ? targetHover : currentHover + (targetHover - currentHover) * 0.22
        hoverProgressRef.current[i] = nextHover

        projected.push({
          id: i,
          x3d: p.x - cx,
          y3d: p.y - cy,
          z3d: p.z,
          screenX: p.x,
          screenY: p.y,
          scale: p.scale,
          alpha,
          fact,
          isHovered,
          isSelected,
          isFocused,
          isMatch,
          proximity,
        })
      }

      projectedVerticesRef.current = projected
      if (typeof window !== "undefined") {
        ;(window as unknown as { __friday_nodes?: ProjectedVertex[] }).__friday_nodes = projected
      }

      // ── 5. Draw Geodesic Network Chords (Monochrome Only) ───────────────────
      for (const [i, j] of latticeEdges) {
        const p1 = projected[i]
        const p2 = projected[j]

        const avgZ = (p1.z3d + p2.z3d) / 2
        const normalizedEdgeZ = (avgZ + baseRadius) / (baseRadius * 2)
        const baseEdgeAlpha = Math.max(0.06, Math.min(0.8, normalizedEdgeZ * 0.85))

        const isFactEdge = p1.fact !== null || p2.fact !== null
        const isHighlighted = p1.isHovered || p2.isHovered || p1.isSelected || p2.isSelected

        ctx.beginPath()
        ctx.moveTo(p1.screenX, p1.screenY)
        ctx.lineTo(p2.screenX, p2.screenY)

        if (isHighlighted) {
          // Hovered / selected node chord lights up in crisp monochrome
          ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.45)"
          ctx.lineWidth = 1.4 * Math.max(p1.scale, p2.scale)
          ctx.globalAlpha = Math.min(1.0, baseEdgeAlpha * 1.6)
          ctx.stroke()
        } else if (isFactEdge) {
          // Fact-connected chord
          ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.18)" : "rgba(255, 255, 255, 0.18)"
          ctx.lineWidth = 1.0 * Math.max(p1.scale, p2.scale)
          ctx.globalAlpha = baseEdgeAlpha * 0.55
          ctx.stroke()
        } else {
          // Structural mesh chord
          ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.08)" : COLOR_EDGE
          ctx.lineWidth = 0.75 * Math.max(p1.scale, p2.scale)
          ctx.globalAlpha = baseEdgeAlpha * 0.35
          ctx.stroke()
        }
      }

      // ── 6. Sort Vertices Back-to-Front ─────────────────────────────────────
      const sortedRenderVertices = [...projected].sort((a, b) => a.z3d - b.z3d)

      // ── 7. Render Memory Nodes (Monochrome + One Acid Accent) ───────────────
      for (const p of sortedRenderVertices) {
        const hoverProg = hoverProgressRef.current[p.id] || 0
        const isActive = p.isHovered || p.isSelected || p.isFocused

        if (p.fact) {
          // ── Active Memory Fact Node ──
          const baseNodeRadius = 4.8 * p.scale
          // Transition node size using hover progress (120-220ms feel)
          const nodeRadius = baseNodeRadius * (1 + hoverProg * 0.4)
          const matchAlpha = p.isMatch ? 1.0 : 0.2

          // Brighten nearby nodes during hover sweep
          const effectiveAlpha = Math.min(1.0, (p.alpha + p.proximity * 0.35) * matchAlpha)
          ctx.globalAlpha = effectiveAlpha

          // Proximity halo (soft monochrome glow when pointer sweeps nearby)
          if (p.proximity > 0.05) {
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, nodeRadius * (2.0 + p.proximity), 0, Math.PI * 2)
            ctx.fillStyle = isBright
              ? `rgba(0, 0, 0, ${p.proximity * 0.08})`
              : `rgba(255, 255, 255, ${p.proximity * 0.12})`
            ctx.fill()
          }

          // ONE-SIGNAL LAW: The single active node gets COLOR_ACID + small ring
          if (isActive || hoverProg > 0.01) {
            // Acid ring around active node
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, nodeRadius * 1.85, 0, Math.PI * 2)
            ctx.strokeStyle = COLOR_ACID
            ctx.lineWidth = 1.5
            ctx.globalAlpha = effectiveAlpha * Math.max(0.6, hoverProg)
            ctx.stroke()

            // Solid acid core dot
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, nodeRadius, 0, Math.PI * 2)
            ctx.fillStyle = COLOR_ACID
            ctx.globalAlpha = effectiveAlpha
            ctx.fill()

            // Crisp starlight center
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, nodeRadius * 0.45, 0, Math.PI * 2)
            ctx.fillStyle = "#FFFFFF"
            ctx.fill()
          } else {
            // Normal Inactive Fact Node: small dot in --color-text
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, nodeRadius, 0, Math.PI * 2)
            ctx.fillStyle = isBright ? "#18181b" : COLOR_TEXT
            ctx.fill()

            // Pinned indicator (subtle 1px monochrome ring)
            if (p.fact.pinned) {
              ctx.beginPath()
              ctx.arc(p.screenX, p.screenY, nodeRadius * 1.6, 0, Math.PI * 2)
              ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.35)"
              ctx.lineWidth = 1
              ctx.stroke()
            }
          }

          // Subtle title label on front-facing nodes (hidden when node is hovered)
          if ((p.z3d > 15 || isActive) && p.isMatch && !p.isHovered) {
            ctx.font = `${Math.max(10, Math.round(11 * p.scale))}px "Inter Variable", system-ui, sans-serif`
            ctx.fillStyle = isBright ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.9)"
            ctx.textAlign = "center"
            ctx.textBaseline = "bottom"
            const labelText =
              p.fact.subject.length > 20 ? `${p.fact.subject.slice(0, 18)}…` : p.fact.subject
            ctx.fillText(labelText, p.screenX, p.screenY - nodeRadius - 5)
          }

          // ── Tooltip Card: Strict FRIDAY tokens (Step 2) ─────────────────────
          if (p.isHovered) {
            const tierText = p.fact.tier.toUpperCase()
            const confText = `CONF ${Math.round(p.fact.confidence * 100)}%`
            const subjectText =
              p.fact.subject.length > 28 ? `${p.fact.subject.slice(0, 26)}…` : p.fact.subject
            const snippetText =
              p.fact.value.length > 34 ? `${p.fact.value.slice(0, 32)}…` : p.fact.value

            ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace"
            const metaWidth = ctx.measureText(`${tierText} · ${confText}`).width
            ctx.font = "bold 11px 'Inter Variable', system-ui, sans-serif"
            const subjectWidth = ctx.measureText(subjectText).width

            const cardW = Math.max(subjectWidth + 28, metaWidth + 36, 170)
            const cardH = 50
            const cardX = Math.max(12, Math.min(width - cardW - 12, p.screenX - cardW / 2))
            const isAbove = p.screenY - nodeRadius - cardH - 14 > 10
            const cardY = isAbove
              ? p.screenY - nodeRadius - cardH - 14
              : p.screenY + nodeRadius + 14

            const stemCardX = Math.max(cardX + 16, Math.min(cardX + cardW - 16, p.screenX))

            // Connecting stem line
            ctx.beginPath()
            if (isAbove) {
              ctx.moveTo(p.screenX, p.screenY - nodeRadius - 1.85)
              ctx.lineTo(stemCardX, cardY + cardH)
            } else {
              ctx.moveTo(p.screenX, p.screenY + nodeRadius + 1.85)
              ctx.lineTo(stemCardX, cardY)
            }
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.22)"
            ctx.lineWidth = 1
            ctx.stroke()

            // Tooltip Surface: --color-plate / 1px --color-edge / radius 8px
            ctx.fillStyle = isBright ? "rgba(255, 255, 255, 0.98)" : "rgba(34, 34, 38, 0.98)"
            ctx.strokeStyle = isBright ? "rgba(0, 0, 0, 0.15)" : COLOR_EDGE
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.roundRect(cardX, cardY, cardW, cardH, 8)
            ctx.fill()
            ctx.stroke()

            // Active signal indicator dot on tooltip
            ctx.beginPath()
            ctx.arc(cardX + 12, cardY + 12, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = COLOR_ACID
            ctx.fill()

            // Meta line: tier & confidence
            ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace"
            ctx.fillStyle = isBright ? "rgba(0, 0, 0, 0.55)" : COLOR_MUTE
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.fillText(`${tierText} · ${confText}`, cardX + 20, cardY + 12)

            // Subject title
            ctx.font = "bold 12px system-ui, -apple-system, sans-serif"
            ctx.fillStyle = isBright ? "#111827" : COLOR_TEXT
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.fillText(subjectText, cardX + 12, cardY + 25)

            // Snippet text
            ctx.font = "10px system-ui, -apple-system, sans-serif"
            ctx.fillStyle = isBright ? "rgba(0, 0, 0, 0.5)" : COLOR_MUTE
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.fillText(snippetText, cardX + 12, cardY + 37)
          }
        } else {
          // ── Structural Mesh Node (Muted Geodesic Dot) ──
          const nodeRadius = (p.isHovered ? 3.6 : 2.2) * p.scale
          ctx.beginPath()
          ctx.arc(p.screenX, p.screenY, nodeRadius, 0, Math.PI * 2)
          ctx.fillStyle = isBright ? "rgba(0, 0, 0, 0.22)" : "rgba(255, 255, 255, 0.2)"
          ctx.fill()
        }
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      isMounted = false
      cancelAnimationFrame(animId)
    }
  }, [
    facts,
    selectedFactId,
    searchQuery,
    theme,
    zoom,
    isAutoRotating,
    prefersReducedMotion,
    focusedFactIndex,
    latticeVertices,
    latticeEdges,
    parallels,
    meridians,
    factMap,
  ])

  const matchingFactsCount = useMemo(() => {
    if (!searchQuery.trim()) return facts.length
    const q = searchQuery.toLowerCase()
    return facts.filter((f) => f.subject.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)).length
  }, [facts, searchQuery])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="3D Associative Memory Globe"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex h-full w-full select-none items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-edge)]",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Top-Right: Fact Counter / Filter Badge (Monochrome) */}
      <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 font-mono text-micro text-[var(--color-mute)] border border-[var(--color-edge)] bg-[var(--color-plate)]/80 px-2.5 py-1 rounded-[var(--radius-control)] backdrop-blur-sm">
        <span>{facts.length} FACTS</span>
        {searchQuery.trim() && (
          <span className="text-[var(--color-text)]">· {matchingFactsCount} MATCHED</span>
        )}
      </div>

      {/* Bottom-Left: Interactive Controls Hint Badge (Monochrome) */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-plate)]/80 px-2.5 py-1 font-mono text-micro text-[var(--color-mute)] backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-[var(--color-edge)]" />
        <span>Drag to orbit · Wheel to zoom · Double-click to focus</span>
      </div>

      {/* Bottom-Right: Orbit & Zoom HUD Controls (8px grid, Surface Law) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-plate)]/80 p-1 backdrop-blur-sm">
        <button
          type="button"
          onClick={toggleAutoRotate}
          title={isAutoRotating ? "Pause orbit (Space)" : "Resume orbit (Space)"}
          aria-label={isAutoRotating ? "Pause orbit" : "Resume orbit"}
          className="flex size-6 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)] transition-colors cursor-pointer"
        >
          {isAutoRotating ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <div className="h-3 w-px bg-[var(--color-edge)]" />
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom out (-)"
          aria-label="Zoom out"
          className="flex size-6 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)] transition-colors cursor-pointer"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset zoom & orientation (0)"
          aria-label="Reset zoom"
          className="flex h-6 px-1.5 items-center justify-center rounded-[calc(var(--radius-control)-2px)] font-mono text-[10px] text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)] transition-colors cursor-pointer"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom in (+)"
          aria-label="Zoom in"
          className="flex size-6 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)] transition-colors cursor-pointer"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset orientation"
          aria-label="Reset orientation"
          className="flex size-6 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)] transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
