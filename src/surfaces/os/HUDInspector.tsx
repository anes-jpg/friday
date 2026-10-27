/** FRIDAY HUD Inspector Component (§01, §04 & Blueprint §4)
 *
 * Cohesive Pro HUD Right Inspector Sidebar:
 * - Live Hardware Vitals (CPU, RAM, GeForce MX250 dGPU cold/hot, VRAM headroom)
 * - Active Model Performance card (TTFT p90, latency, tokens/sec)
 * - Overwatch proactive companion alerts with dismiss
 * - Compact God's Eye mini-radar & telemetry overview
 * - Iron Legion 4-node swarm status
 *
 * Strictly adheres to Surface Law (8px grid, acrylic plates), One-Signal Law,
 * and Sub-Frame Law (<220ms transitions).
 */

import React, { useMemo } from "react"
import {
  Cpu,
  Layers,
  Shield,
  Activity,
  Globe,
  Radio,
  Zap,
  X,
  ChevronRight,
  Flame,
  Snowflake,
  Gauge,
  CheckCircle2,
} from "lucide-react"
import { useFridayStore } from "@/lib/store"
import { type OverwatchToastItem } from "./OverwatchWhisperToast"
import { cn } from "@/lib/utils"

export interface HUDInspectorProps {
  cpuPercent: number
  ramMb: number
  ramTotalMb?: number
  gpuTemp: number
  gpuName?: string
  gpuUtilization?: number
  vramUsedMb?: number
  vramTotalMb?: number
  overwatchItems: OverwatchToastItem[]
  onDismissOverwatch: (id: string) => void
  onSwitchMode: (mode: "unified" | "console" | "godseye" | "legion" | "history") => void
  telemetrySummary?: {
    socketsCount: number
    satellitesCount: number
    flightsCount: number
    cablesCount: number
  }
  className?: string
}

export const HUDInspector: React.FC<HUDInspectorProps> = ({
  cpuPercent,
  ramMb,
  ramTotalMb = 16384,
  gpuTemp,
  gpuName = "NVIDIA GeForce MX250",
  gpuUtilization = 18,
  vramUsedMb = 640,
  vramTotalMb = 2048,
  overwatchItems,
  onDismissOverwatch,
  onSwitchMode,
  telemetrySummary = {
    socketsCount: 12,
    satellitesCount: 8,
    flightsCount: 16,
    cablesCount: 4,
  },
  className,
}) => {
  const aiModels = useFridayStore((s) => s.aiModels)
  const activeModelId = useFridayStore((s) => s.activeModelId)
  const latency = useFridayStore((s) => s.latency)

  const activeModel = useMemo(() => {
    return aiModels.find((m) => m.id === activeModelId) || {
      id: "friday-1b",
      name: "FRIDAY-1B (Llama-3.2-1B)",
      provider: "Local On-Device GGML",
      capabilities: ["Local Operator", "Zero Latency", "Offline"],
      telemetry: {
        availability_pct: 99.9,
        ttft_p90_ms: 85,
        avg_latency_ms: 142,
        tracker_history: [],
      },
    }
  }, [aiModels, activeModelId])

  const ttftMs = activeModel.telemetry?.ttft_p90_ms ?? 85
  const avgLatencyMs = activeModel.telemetry?.avg_latency_ms ?? 142

  const ramPercent = Math.min(100, Math.round((ramMb / (ramTotalMb || 16384)) * 100))
  const vramPercent = Math.min(100, Math.round((vramUsedMb / (vramTotalMb || 2048)) * 100))
  const isGpuCold = gpuTemp < 48

  return (
    <aside
      className={cn(
        "w-[340px] shrink-0 h-full border-l border-white/[0.08] bg-[#0c0e12]/95 backdrop-blur-xl flex flex-col select-none",
        className
      )}
    >
      {/* Top Inspector Header */}
      <div className="h-[42px] px-3.5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-white/60" />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-white/90 uppercase">
            HUD Inspector
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-white/40">
          <span className="size-1.5 rounded-full bg-[hsl(var(--signal))]" />
          <span>LIVE 30FPS</span>
        </div>
      </div>

      {/* Scrollable Telemetry Cards Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* Section 1: Hardware Vitals Card */}
        <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Cpu className="size-3.5 text-white/60" />
              <span className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                Hardware Vitals
              </span>
            </div>
            <span className="font-mono text-[9px] text-white/40 uppercase">
              Win32 Perfmon
            </span>
          </div>

          {/* CPU Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-white/60">Host CPU (8C / 16T)</span>
              <span className="text-white/90 tabular-nums font-semibold">{cpuPercent}%</span>
            </div>
            <svg className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" preserveAspectRatio="none">
              <rect
                x="0"
                y="0"
                width={`${Math.min(100, Math.max(2, cpuPercent))}%`}
                height="100%"
                className="fill-white/70 transition-all duration-300"
              />
            </svg>
          </div>

          {/* RAM Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-white/60">System Memory</span>
              <span className="text-white/90 tabular-nums">
                {(ramMb / 1024).toFixed(1)} / {(ramTotalMb / 1024).toFixed(1)} GB
              </span>
            </div>
            <svg className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" preserveAspectRatio="none">
              <rect
                x="0"
                y="0"
                width={`${ramPercent}%`}
                height="100%"
                className="fill-white/50 transition-all duration-300"
              />
            </svg>
          </div>

          {/* Dedicated GPU (GeForce MX250) */}
          <div className="pt-1.5 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                {isGpuCold ? (
                  <Snowflake className="size-3 text-sky-400 shrink-0" />
                ) : (
                  <Flame className="size-3 text-amber-400 shrink-0" />
                )}
                <span className="text-white/90 truncate font-semibold">
                  {gpuName}
                </span>
              </div>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono font-medium",
                  isGpuCold
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                )}
              >
                {isGpuCold ? "COLD // IDLE" : "ACTIVE // WARM"}
              </span>
            </div>

            {/* GPU Thermals & Utilization */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/20 p-2 rounded-[var(--radius-control)] border border-white/[0.04]">
              <div>
                <span className="text-white/40 block text-[9px]">TEMPERATURE</span>
                <span className="text-white/90 font-semibold tabular-nums">{gpuTemp}°C</span>
              </div>
              <div>
                <span className="text-white/40 block text-[9px]">UTILIZATION</span>
                <span className="text-white/90 font-semibold tabular-nums">{gpuUtilization}%</span>
              </div>
            </div>

            {/* VRAM Headroom */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/60">VRAM Headroom</span>
                <span className="text-white/90 tabular-nums">
                  {vramUsedMb} / {vramTotalMb} MB
                </span>
              </div>
              <svg className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" preserveAspectRatio="none">
                <rect
                  x="0"
                  y="0"
                  width={`${vramPercent}%`}
                  height="100%"
                  className="fill-white/40 transition-all duration-300"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* Section 2: Active Model Performance Card */}
        <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-white/60" />
              <span className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                Active Reasoning Model
              </span>
            </div>
            <span className="font-mono text-[9px] text-[hsl(var(--signal))] uppercase">
              READY
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-white/95 flex items-center gap-1.5">
              <span>⚡</span>
              <span className="truncate">{activeModel.name}</span>
            </div>
            <p className="text-[10px] font-mono text-white/50 truncate">
              {activeModel.provider}
            </p>
          </div>

          {/* Model Latency Metrics Bento */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/20 p-2 rounded-[var(--radius-control)] border border-white/[0.04]">
            <div>
              <span className="text-white/40 block text-[9px]">TTFT (p90)</span>
              <span className="text-white/90 font-semibold tabular-nums">{ttftMs}ms</span>
            </div>
            <div>
              <span className="text-white/40 block text-[9px]">TOTAL LATENCY</span>
              <span className="text-white/90 font-semibold tabular-nums">{avgLatencyMs}ms</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-white/50">
            <span>Availability: {activeModel.telemetry?.availability_pct ?? 99.9}%</span>
            <span>Zero GPU OOM</span>
          </div>
        </section>

        {/* Section 3: Overwatch Proactive Companion Card */}
        <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Shield className="size-3.5 text-white/60" />
              <span className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                Overwatch Companion
              </span>
            </div>
            <span className="font-mono text-[9px] text-white/40 tabular-nums">
              {overwatchItems.length} ALERTS
            </span>
          </div>

          {overwatchItems.length === 0 ? (
            <div className="p-3 text-center rounded-[var(--radius-control)] border border-white/[0.04] bg-black/10">
              <CheckCircle2 className="size-4 text-white/40 mx-auto mb-1" />
              <p className="text-[10px] font-mono text-white/60">Desktop channels nominal</p>
              <p className="text-[9px] text-white/40 mt-0.5">Monitoring panics, compile breaks & clipboard</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overwatchItems.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/5 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase text-amber-400">
                      {item.category.replace("_", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDismissOverwatch(item.id)}
                      className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-white/90 line-clamp-1">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-white/60 line-clamp-2">
                    {item.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Compact God's Eye Mini-Radar & Activity Card */}
        <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Globe className="size-3.5 text-white/60" />
              <span className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                God's Eye Telemetry
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchMode("godseye")}
              className="text-[10px] font-mono text-white/60 hover:text-white flex items-center gap-0.5 cursor-pointer"
            >
              <span>Full View</span>
              <ChevronRight className="size-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/20 p-2 rounded-[var(--radius-control)] border border-white/[0.04]">
            <div>
              <span className="text-white/40 block text-[9px]">SOCKET ARCS</span>
              <span className="text-white/90 font-semibold tabular-nums">
                {telemetrySummary.socketsCount} Active
              </span>
            </div>
            <div>
              <span className="text-white/40 block text-[9px]">SATELLITES</span>
              <span className="text-white/90 font-semibold tabular-nums">
                {telemetrySummary.satellitesCount} Tracks
              </span>
            </div>
            <div>
              <span className="text-white/40 block text-[9px]">ADS-B AIRSPACE</span>
              <span className="text-white/90 font-semibold tabular-nums">
                {telemetrySummary.flightsCount} Flights
              </span>
            </div>
            <div>
              <span className="text-white/40 block text-[9px]">SUBSEA CABLES</span>
              <span className="text-white/90 font-semibold tabular-nums">
                {telemetrySummary.cablesCount} Landings
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSwitchMode("godseye")}
            className="w-full py-1.5 rounded-[var(--radius-control)] border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-[10px] font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Radio className="size-3" />
            <span>Open 9-Layer Planetary Map (Ctrl+3)</span>
          </button>
        </section>

        {/* Section 5: Iron Legion Swarm Mini-Card */}
        <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-white/60" />
              <span className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                Iron Legion Protocol
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchMode("legion")}
              className="text-[10px] font-mono text-white/60 hover:text-white flex items-center gap-0.5 cursor-pointer"
            >
              <span>DAG View</span>
              <ChevronRight className="size-3" />
            </button>
          </div>

          <div className="space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[hsl(var(--success))]" />
                Scout & Architect
              </span>
              <span className="text-white/40">Verified</span>
            </div>
            <div className="flex items-center justify-between text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[hsl(var(--success))]" />
                Sentinel & Operator
              </span>
              <span className="text-white/40">Ready</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  )
}
