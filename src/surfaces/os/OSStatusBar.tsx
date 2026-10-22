/** FRIDAY OS 36px Status Bar Component (§01 & Blueprint §2)
 *
 * Instrument bar spanning 100vw:
 * - Dynamic Island center housing the 40px reactive Orb
 * - Hardware vitals telemetry (GPU °C, CPU %, RAM MB)
 * - Overwatch consciousness switch
 * - Fullscreen F11 expand / restore button
 * - Strict adherence to Surface Law and One-Signal Law
 */

import React from "react"
import { Orb } from "@/components/orb/orb"
import {
  Shield,
  Activity,
  Maximize2,
  Minimize2,
  Globe,
  Layers,
  MessageSquare,
  Cpu,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface OSStatusBarProps {
  activeMode: "console" | "godseye" | "legion" | "history"
  onModeChange: (mode: "console" | "godseye" | "legion" | "history") => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  overwatchEnabled: boolean
  onToggleOverwatch: () => void
  cpuPercent?: number
  ramMb?: number
  gpuTemp?: number
  className?: string
}

export const OSStatusBar: React.FC<OSStatusBarProps> = ({
  activeMode,
  onModeChange,
  isFullscreen,
  onToggleFullscreen,
  overwatchEnabled,
  onToggleOverwatch,
  cpuPercent = 14,
  ramMb = 8420,
  gpuTemp = 48,
  className,
}) => {
  return (
    <header
      className={cn(
        "h-9 w-full px-3 flex items-center justify-between border-b border-white/10 bg-[#090A0C]/90 backdrop-blur-md z-40 select-none text-[hsl(var(--ink))]",
        className
      )}
    >
      {/* Left: Branding & Surface Mode Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-wider text-[hsl(var(--ink))]">
            FRIDAY<span className="text-[hsl(var(--signal))] font-mono ml-0.5">OS</span>
          </span>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/10 text-[hsl(var(--muted))]">
            v2.0
          </span>
        </div>

        <div className="h-3.5 w-px bg-white/10" />

        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange("console")}
            className={cn(
              "px-2 py-0.5 rounded-[var(--radius-control)] text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeMode === "console"
                ? "bg-white/15 text-[hsl(var(--ink))]"
                : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
            )}
          >
            <MessageSquare className="size-3" />
            <span>Console</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("godseye")}
            className={cn(
              "px-2 py-0.5 rounded-[var(--radius-control)] text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeMode === "godseye"
                ? "bg-[hsl(var(--signal))]/20 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 font-semibold"
                : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
            )}
          >
            <Globe className="size-3" />
            <span>God's Eye</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("legion")}
            className={cn(
              "px-2 py-0.5 rounded-[var(--radius-control)] text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeMode === "legion"
                ? "bg-[hsl(var(--signal))]/20 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 font-semibold"
                : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
            )}
          >
            <Layers className="size-3" />
            <span>Iron Legion</span>
          </button>
        </nav>
      </div>

      {/* Center: Dynamic Island Housing Reactive Orb */}
      <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/40 border border-white/10 shadow-inner">
        <div className="scale-75 origin-center">
          <Orb />
        </div>
        <span className="font-mono text-[10px] text-[hsl(var(--muted))] tracking-tight">
          OPERATIONAL
        </span>
      </div>

      {/* Right: Telemetry Vitals, Overwatch & Fullscreen */}
      <div className="flex items-center gap-3">
        {/* Hardware Vitals Ribbon */}
        <div className="flex items-center gap-2.5 font-mono text-[10px] text-[hsl(var(--muted))] tabular-nums">
          <span className="flex items-center gap-1">
            <Cpu className="size-3 text-white/40" />
            <span>{cpuPercent}%</span>
          </span>
          <span className="text-white/20">/</span>
          <span>{gpuTemp}°C</span>
          <span className="text-white/20">/</span>
          <span>{(ramMb / 1024).toFixed(1)}GB</span>
        </div>

        <div className="h-3.5 w-px bg-white/10" />

        {/* Overwatch Toggle Pill */}
        <button
          type="button"
          onClick={onToggleOverwatch}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-control)] border text-[10px] font-mono transition-colors cursor-pointer",
            overwatchEnabled
              ? "border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))]"
              : "border-white/10 bg-white/5 text-[hsl(var(--muted))]"
          )}
          title="Toggle Overwatch Proactive Companion"
        >
          <Shield className="size-3" />
          <span>{overwatchEnabled ? "OVERWATCH: ON" : "OVERWATCH: OFF"}</span>
        </button>

        {/* Fullscreen F11 Button */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1 rounded-[var(--radius-control)] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/10 transition-colors cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen (F11 / Alt+Enter)" : "Fullscreen OS Mode (F11 / Alt+Enter)"}
        >
          {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>
    </header>
  )
}
