/** FRIDAY OS Shell Root Component (§01 & Blueprint §1)
 *
 * Fullscreen 100vw × 100vh spatial operating environment:
 * - OSStatusBar (Top 42px bar + Reactive Orb + Model Tag + Vitals + Inspector Toggle + Exit HUD)
 * - GodsEyeSurface (Full-stage 9-layer planetary command canvas with real satellite map & CCTV matrix)
 * - Console embedded (Full-stage, un-crammed distraction-free Operator Chat)
 * - LegionSwarmOverlay (Parallel 4-worker DAG swarm)
 * - OverwatchWhisperToast (Proactive companion interjections)
 * - OSDock (Flush-docked bottom instrument toolbar with keyboard hints)
 * - Instant hotkeys: Esc/F11 (Exit), Ctrl+1 (Console), Ctrl+2 (God's Eye), Ctrl+3 (Legion), Ctrl+4 (Recall), Ctrl+I (Inspector)
 */

import React, { useState, useEffect, useMemo } from "react"
import { OSStatusBar, type OSSurfaceMode } from "./OSStatusBar"
import { OSDock } from "./OSDock"
import { HUDInspector } from "./HUDInspector"
import { GodsEyeSurface } from "./GodsEyeSurface"
import { LegionSwarmOverlay, type LegionSwarmPlan } from "./LegionSwarmOverlay"
import { OverwatchWhisperToast, type OverwatchToastItem, type OverwatchCategory } from "./OverwatchWhisperToast"
import { OSWindowManager } from "./OSWindowManager"
import { Console } from "@/surfaces/console/Console"
import {
  ipcGetHardwareVitals,
  ipcGetNetworkTelemetry,
  ipcGetOrbitalTelemetry,
  ipcGetGeospatialTelemetry,
} from "@/lib/telemetry"
import {
  isDesktop,
  ipcGetOverwatchInterjections,
  ipcDismissOverwatchInterjection,
  ipcDispatchLegionSwarm,
  ipcGetLegionStatus,
  ipcGetEpisodicTimeline,
} from "@/lib/ipc"
import type { DbEpisodicEvent } from "@/lib/bindings"
import { useFridayStore } from "@/lib/store"
import { History, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

export { type OSSurfaceMode }

export interface FridayOSShellProps {
  onExitFullscreen?: () => void
}

export const FridayOSShell: React.FC<FridayOSShellProps> = ({ onExitFullscreen }) => {
  // Default to God's Eye so the complete surveillance & planetary intelligence center is immediately visible
  const [activeMode, setActiveMode] = useState<OSSurfaceMode>("godseye")
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [overwatchEnabled, setOverwatchEnabled] = useState(true)
  const [overwatchItems, setOverwatchItems] = useState<OverwatchToastItem[]>([])
  const [legionPlan, setLegionPlan] = useState<LegionSwarmPlan | null>(null)
  const [episodicEvents, setEpisodicEvents] = useState<DbEpisodicEvent[]>([])
  const [vitalsAvailable, setVitalsAvailable] = useState(false)
  const [vitals, setVitals] = useState({
    cpu: 0,
    ram: 0,
    ramTotal: 0,
    gpu: 0,
    gpuName: "Unavailable",
    gpuUtilization: 0,
    vramUsed: 0,
    vramTotal: 0,
  })
  const [telemetryCounts, setTelemetryCounts] = useState({
    sockets: 0,
    satellites: 0,
    flights: 0,
    cables: 0,
  })

  const setActiveConsoleTab = useFridayStore((s) => s.setTab)
  const aiModels = useFridayStore((s) => s.aiModels)
  const activeModelId = useFridayStore((s) => s.activeModelId)

  const activeModelName = useMemo(() => {
    const found = aiModels.find((m) => m.id === activeModelId)
    return found?.name ?? "Select a provider"
  }, [aiModels, activeModelId])

  // Fullscreen toggle / exit handler
  const handleToggleFullscreen = async () => {
    onExitFullscreen?.()
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.altKey && e.key === "Enter")) {
        e.preventDefault()
        handleToggleFullscreen()
      } else if (e.ctrlKey && e.key === "1") {
        e.preventDefault()
        setActiveMode("console")
      } else if (e.ctrlKey && e.key === "2") {
        e.preventDefault()
        setActiveMode("godseye")
      } else if (e.ctrlKey && e.key === "3") {
        e.preventDefault()
        setActiveMode("legion")
      } else if (e.ctrlKey && e.key === "4") {
        e.preventDefault()
        setActiveMode("history")
      } else if (e.ctrlKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault()
        setIsInspectorOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    const handleOsMode = (e: Event) => {
      const custom = e as CustomEvent<OSSurfaceMode>
      if (custom.detail) {
        setActiveMode(custom.detail)
      }
    }
    window.addEventListener("friday:os-mode", handleOsMode)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("friday:os-mode", handleOsMode)
    }
  }, [])

  // Poll hardware vitals, telemetry counts & overwatch notifications
  useEffect(() => {
    let mounted = true

    const syncState = async () => {
      try {
        const hw = await ipcGetHardwareVitals()
        if (mounted && hw && isDesktop && hw.cpu_percent!=null && hw.ram_used_mb!=null && hw.ram_total_mb!=null && hw.gpu.temperature_c!=null && hw.gpu.utilization_percent!=null && hw.gpu.vram_used_mb!=null && hw.gpu.vram_total_mb!=null) {
          setVitalsAvailable(true)
          setVitals({
            cpu: Math.round(hw.cpu_percent),
            ram: hw.ram_used_mb,
            ramTotal: hw.ram_total_mb,
            gpu: Math.round(hw.gpu.temperature_c),
            gpuName: hw.gpu.name || "Unavailable",
            gpuUtilization: hw.gpu.utilization_percent,
            vramUsed: hw.gpu.vram_used_mb,
            vramTotal: hw.gpu.vram_total_mb,
          })
        }
      } catch {}

      try {
        const [net, sats, geo] = await Promise.all([
          ipcGetNetworkTelemetry().catch(() => null),
          ipcGetOrbitalTelemetry().catch(() => null),
          ipcGetGeospatialTelemetry().catch(() => null),
        ])
        if (mounted) {
          setTelemetryCounts({
            sockets: net?.arcs?.length ?? 0,
            satellites: sats?.length ?? 0,
            flights: geo?.flights?.length ?? 0,
            cables: net?.cables?.length ?? 0,
          })
        }
      } catch {}

      if (overwatchEnabled) {
        try {
          const items = await ipcGetOverwatchInterjections()
          if (mounted && items && items.length > 0) {
            setOverwatchItems(
              items.map((i) => ({
                id: i.id,
                category: i.category.toLowerCase() as OverwatchCategory,
                title: i.title,
                summary: i.summary,
                suggestion: i.suggestion,
                codeSnippet: i.code_snippet,
                timestamp: i.timestamp,
              }))
            )
          }
        } catch {}
      }

      try {
        const plan = await ipcGetLegionStatus()
        if (mounted && plan) setLegionPlan(plan)
      } catch {}
    }

    syncState()
    const timer = setInterval(syncState, 5000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [overwatchEnabled])

  // Fetch episodic events when Workday Recall tab is activated
  useEffect(() => {
    if (activeMode === "history") {
      ipcGetEpisodicTimeline(30).then((events) => {
        setEpisodicEvents(events || [])
      }).catch(() => {})
    }
  }, [activeMode])

  const handleDismissOverwatch = async (id: string) => {
    setOverwatchItems((prev) => prev.filter((i) => i.id !== id))
    try {
      await ipcDismissOverwatchInterjection(id)
    } catch {}
  }

  // Normalized mode for window manager preset
  const windowPreset = activeMode === "unified" ? "console" : activeMode

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090A0C] text-[hsl(var(--ink))] flex flex-col select-none">
      {/* Top 42px Instrument Status Bar */}
      <OSStatusBar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        overwatchEnabled={overwatchEnabled}
        onToggleOverwatch={() => setOverwatchEnabled(!overwatchEnabled)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        cpuPercent={vitalsAvailable ? vitals.cpu : undefined}
        ramMb={vitalsAvailable ? vitals.ram : undefined}
        gpuTemp={vitals.gpu}
        gpuName={vitals.gpuName}
        activeModelName={activeModelName}
      />

      {/* Main Workspace Stage via Spatial Window Manager */}
      <main className="relative flex-1 w-full min-h-0 overflow-hidden">
        <OSWindowManager
          preset={windowPreset}
          onPresetChange={(preset) => {
            if (preset === "console" || preset === "godseye" || preset === "legion" || preset === "history") {
              setActiveMode(preset)
            }
          }}
          panes={{
            console: <Console embedded={true} />,
            godseye: <GodsEyeSurface />,
            legion: (
              <div className="w-full h-full flex flex-col justify-center items-center max-w-5xl mx-auto p-6">
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg tracking-tight text-white">
                        Iron Legion Swarm Sub-Agent Protocol
                      </h3>
                      <p className="text-xs text-white/50 font-mono">
                        Tokio-orchestrated autonomous multi-agent DAG
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const plan = await ipcDispatchLegionSwarm("Audit codebase security and build release binary")
                        setLegionPlan(plan)
                      }}
                      className="px-3.5 py-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--signal))] text-white text-xs font-semibold hover:brightness-110 shadow-xs cursor-pointer transition-all"
                    >
                      Dispatch Swarm Run
                    </button>
                  </div>

                  <LegionSwarmOverlay
                    plan={
                      legionPlan || {
                        id: "legion-default",
                        goal: "Autonomous Multi-Worker Orchestration",
                        nodes: [
                          { id: "node-scout", role: "Scout", status: "Completed", task: "Web intelligence & API specs", output: "Context verified", latency_ms: 45, dependencies: [] },
                          { id: "node-architect", role: "Architect", status: "Completed", task: "AST call graph & IPC contracts", output: "Clean architecture verified", latency_ms: 60, dependencies: ["node-scout"] },
                          { id: "node-sentinel", role: "Sentinel", status: "Completed", task: "OWASP & FRIDAY Constitution audit", output: "0 unwraps, strict One-Signal preserved", latency_ms: 30, dependencies: ["node-architect"] },
                          { id: "node-operator", role: "Operator", status: "Completed", task: "Desktop UIA element actuation", output: "Ready for live execution", latency_ms: 50, dependencies: ["node-sentinel"] },
                        ],
                        start_time: Date.now() - 185,
                        total_duration_ms: 185,
                        completed: true,
                      }
                    }
                  />
                </div>
              </div>
            ),
            history: (
              <div className="w-full h-full p-6 max-w-4xl mx-auto overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-[hsl(var(--signal))]" />
                    <h4 className="font-semibold text-sm text-white">Workday Episodic Recall</h4>
                  </div>
                  <span className="font-mono text-[10px] text-white/50 tabular-nums">
                    {episodicEvents.length} Recorded Events
                  </span>
                </div>

                <div className="space-y-2">
                  {episodicEvents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-[var(--radius-panel)]">
                      No saved activity yet. Window and project activity appears here when the desktop recorder is running.
                    </div>
                  ) : (
                    episodicEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-[var(--radius-control)] border border-white/5 bg-white/[0.02] flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-xs text-white">
                              {ev.app_name}
                            </span>
                            <span className="text-[10px] font-mono text-white/50 truncate">
                              {ev.window_title}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/60 truncate">{ev.summary}</p>
                        </div>
                        <span className="font-mono text-[10px] text-white/40 shrink-0 tabular-nums">
                          {new Date(ev.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ),
          }}
        />

        {/* Floating Slide-over HUD Inspector Panel (never squishes chat!) */}
        <AnimatePresence>
          {isInspectorOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 right-0 bottom-0 z-30 shadow-2xl"
            >
              <div className="relative h-full">
                {vitalsAvailable ? <HUDInspector
                  cpuPercent={vitals.cpu}
                  ramMb={vitals.ram}
                  ramTotalMb={vitals.ramTotal}
                  gpuTemp={vitals.gpu}
                  gpuName={vitals.gpuName}
                  gpuUtilization={vitals.gpuUtilization}
                  vramUsedMb={vitals.vramUsed}
                  vramTotalMb={vitals.vramTotal}
                  overwatchItems={overwatchItems}
                  onDismissOverwatch={handleDismissOverwatch}
                  onSwitchMode={(mode) => {
                    if (mode === "console" || mode === "godseye" || mode === "legion" || mode === "history") {
                      setActiveMode(mode)
                    }
                  }}
                  telemetrySummary={{
                    socketsCount: telemetryCounts.sockets,
                    satellitesCount: telemetryCounts.satellites,
                    flightsCount: telemetryCounts.flights,
                    cablesCount: telemetryCounts.cables,
                  }}
                /> : <div className="control-room-unavailable">Hardware diagnostics require the Windows app.</div>}
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="absolute top-2.5 right-2.5 size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Proactive Overwatch Companion Whisper Toast */}
      <OverwatchWhisperToast
        items={overwatchItems}
        onDismiss={handleDismissOverwatch}
      />

      {/* Flush-docked Bottom Instrument Toolbar */}
      <OSDock
        activeMode={activeMode === "unified" ? "console" : activeMode}
        onModeChange={setActiveMode}
        onOpenSettings={() => {
          setActiveMode("console")
          setActiveConsoleTab?.("settings")
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  )
}
