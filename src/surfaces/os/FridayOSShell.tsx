/** FRIDAY OS Shell Root Component (§01 & Blueprint §1)
 *
 * Fullscreen 100vw × 100vh spatial operating environment:
 * - OSStatusBar (Top 36px bar + Dynamic Island Orb)
 * - GodsEyeSurface (9-layer planetary-to-process WebGL2 canvas)
 * - LegionSwarmOverlay (Parallel 4-worker DAG swarm)
 * - OverwatchWhisperToast (Proactive companion interjections)
 * - OSDock (Magnifying bottom dock + live Win32 task switcher)
 * - Instant hotkeys: Ctrl+1 (God's Eye), Ctrl+2 (Console), Ctrl+3 (Legion), Ctrl+4 (Recall)
 */

import React, { useState, useEffect } from "react"
import { OSStatusBar } from "./OSStatusBar"
import { OSDock } from "./OSDock"
import { GodsEyeSurface } from "./GodsEyeSurface"
import { LegionSwarmOverlay, type LegionSwarmPlan } from "./LegionSwarmOverlay"
import { OverwatchWhisperToast, type OverwatchToastItem } from "./OverwatchWhisperToast"
import { Console } from "@/surfaces/console/Console"
import { ipcToggleOsFullscreen, ipcGetHardwareVitals } from "@/lib/telemetry"
import {
  ipcGetOverwatchInterjections,
  ipcDismissOverwatchInterjection,
  ipcInspectClipboardForOverwatch,
  ipcDispatchLegionSwarm,
  ipcGetLegionStatus,
  ipcGetEpisodicTimeline,
} from "@/lib/ipc"
import { useFridayStore } from "@/lib/store"
import { History, Clock, FileCode, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type OSSurfaceMode = "console" | "godseye" | "legion" | "history"

export const FridayOSShell: React.FC = () => {
  const [activeMode, setActiveMode] = useState<OSSurfaceMode>("console")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [overwatchEnabled, setOverwatchEnabled] = useState(true)
  const [overwatchItems, setOverwatchItems] = useState<OverwatchToastItem[]>([])
  const [legionPlan, setLegionPlan] = useState<LegionSwarmPlan | null>(null)
  const [episodicEvents, setEpisodicEvents] = useState<any[]>([])
  const [vitals, setVitals] = useState({ cpu: 14, ram: 8420, gpu: 48 })

  const { setActiveConsoleTab } = useFridayStore()

  // Fullscreen toggle handler
  const handleToggleFullscreen = async () => {
    try {
      const next = await ipcToggleOsFullscreen()
      setIsFullscreen(next)
    } catch (e) {
      console.warn("Fullscreen toggle error:", e)
    }
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.altKey && e.key === "Enter")) {
        e.preventDefault()
        handleToggleFullscreen()
      } else if (e.ctrlKey && e.key === "1") {
        e.preventDefault()
        setActiveMode("godseye")
      } else if (e.ctrlKey && e.key === "2") {
        e.preventDefault()
        setActiveMode("console")
      } else if (e.ctrlKey && e.key === "3") {
        e.preventDefault()
        setActiveMode("legion")
      } else if (e.ctrlKey && e.key === "4") {
        e.preventDefault()
        setActiveMode("history")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Poll hardware vitals & overwatch notifications
  useEffect(() => {
    let mounted = true

    const syncState = async () => {
      try {
        const hw = await ipcGetHardwareVitals()
        if (mounted) {
          setVitals({
            cpu: Math.round(hw.cpu_percent),
            ram: hw.ram_used_mb,
            gpu: Math.round(hw.gpu.temperature_c),
          })
        }
      } catch {}

      if (overwatchEnabled) {
        try {
          const items = await ipcGetOverwatchInterjections()
          if (mounted && items.length > 0) {
            setOverwatchItems(
              items.map((i) => ({
                id: i.id,
                category: i.category.toLowerCase() as any,
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
        if (mounted && plan) setLegionPlan(plan as any)
      } catch {}
    }

    syncState()
    const timer = setInterval(syncState, 6000)
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090A0C] text-[hsl(var(--ink))] flex flex-col select-none">
      {/* Top 36px Instrument Status Bar */}
      <OSStatusBar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        overwatchEnabled={overwatchEnabled}
        onToggleOverwatch={() => setOverwatchEnabled(!overwatchEnabled)}
        cpuPercent={vitals.cpu}
        ramMb={vitals.ram}
        gpuTemp={vitals.gpu}
      />

      {/* Main Workspace Stage */}
      <main className="relative flex-1 w-full overflow-hidden">
        {activeMode === "console" && (
          <div className="w-full h-full">
            <Console />
          </div>
        )}

        {activeMode === "godseye" && (
          <div className="w-full h-full">
            <GodsEyeSurface />
          </div>
        )}

        {activeMode === "legion" && (
          <div className="w-full h-full p-6 flex flex-col justify-center items-center max-w-6xl mx-auto">
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg tracking-tight">
                  Iron Legion Swarm Sub-Agent Protocol
                </h3>
                <button
                  type="button"
                  onClick={async () => {
                    const plan = await ipcDispatchLegionSwarm("Audit codebase security and build release binary")
                    setLegionPlan(plan as any)
                  }}
                  className="px-3.5 py-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--signal))] text-white text-xs font-semibold hover:brightness-110 shadow-xs cursor-pointer"
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
        )}

        {activeMode === "history" && (
          <div className="w-full h-full p-6 max-w-4xl mx-auto overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="size-5 text-[hsl(var(--signal))]" />
                <h3 className="font-semibold text-base">Workday Episodic Context Recall</h3>
              </div>
              <span className="font-mono text-xs text-[hsl(var(--muted))] tabular-nums">
                {episodicEvents.length} Recorded Breadcrumbs
              </span>
            </div>

            <div className="space-y-2.5">
              {episodicEvents.length === 0 ? (
                <div className="p-8 text-center text-xs text-[hsl(var(--muted))] border border-dashed border-white/10 rounded-[var(--radius-panel)]">
                  Episodic context recording active. As you work in VS Code, terminals, and browsers, FRIDAY will log your workday timeline.
                </div>
              ) : (
                episodicEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-[var(--radius-panel)] border border-white/10 bg-[#12151B]/80 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[hsl(var(--ink))]">
                          {ev.app_name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-[hsl(var(--muted))]">
                          {ev.window_title}
                        </span>
                        {ev.git_branch && (
                          <span className="text-[10px] font-mono text-[hsl(var(--signal))]">
                            branch:{ev.git_branch}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[hsl(var(--muted))]">{ev.summary}</p>
                    </div>

                    <span className="font-mono text-[10px] text-[hsl(var(--muted))] shrink-0 tabular-nums">
                      {new Date(ev.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Proactive Overwatch Companion Whisper Toast */}
      <OverwatchWhisperToast
        items={overwatchItems}
        onDismiss={handleDismissOverwatch}
      />

      {/* Magnifying Bottom OS Dock */}
      <OSDock
        activeMode={activeMode}
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
