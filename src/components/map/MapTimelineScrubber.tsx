/** FRIDAY Map Timeline Scrubber Component (§04 & Blueprint §4)
 *
 * Dual-mode temporal scrubber:
 * 1. Live Telemetry: -2hr historical playback for Radar/ADS-B/Satellites
 * 2. Episodic Workday: Scrubbing through active developer context shifts
 *
 * Enforces Surface Law, Sub-Frame Law, and 0% Idle CPU when paused.
 */

import React, { useState } from "react"
import { Play, Pause, RotateCcw, FastForward, Clock, History, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TimelineBreadcrumb {
  id: string
  time: number
  label: string
  app: string
}

export interface MapTimelineScrubberProps {
  mode?: "telemetry" | "episodic"
  currentTime?: number
  minTime?: number
  maxTime?: number
  isPlaying?: boolean
  breadcrumbs?: TimelineBreadcrumb[]
  onTimeChange?: (time: number) => void
  onTogglePlay?: () => void
  onModeToggle?: () => void
  className?: string
}

export const MapTimelineScrubber: React.FC<MapTimelineScrubberProps> = ({
  mode = "telemetry",
  currentTime,
  minTime,
  maxTime,
  isPlaying = false,
  breadcrumbs = [],
  onTimeChange,
  onTogglePlay,
  onModeToggle,
  className,
}) => {
  const now = Date.now()
  const effectiveMax = maxTime ?? now
  const effectiveMin = minTime ?? now - 2 * 60 * 60 * 1000 // 2 hours back
  const [localTime, setLocalTime] = useState<number>(currentTime ?? effectiveMax)

  const isLive = localTime >= effectiveMax - 10000

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setLocalTime(val)
    onTimeChange?.(val)
  }

  const handleResetToLive = () => {
    setLocalTime(effectiveMax)
    onTimeChange?.(effectiveMax)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/90 backdrop-blur-xl shadow-xl select-none text-[hsl(var(--ink))]",
        className
      )}
    >
      {/* Mode Indicator & Switcher */}
      <button
        type="button"
        onClick={onModeToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-mono transition-colors cursor-pointer shrink-0"
      >
        {mode === "telemetry" ? (
          <>
            <Clock className="size-3.5 text-[hsl(var(--signal))]" />
            <span>TELEMETRY -2H</span>
          </>
        ) : (
          <>
            <History className="size-3.5 text-[#38bdf8]" />
            <span>EPISODIC RECALL</span>
          </>
        )}
      </button>

      {/* Play / Pause Toggle */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="size-7 rounded-[var(--radius-control)] border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-[hsl(var(--ink))] transition-colors cursor-pointer shrink-0"
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
      </button>

      {/* Timeline Slider with Breadcrumb Ticks */}
      <div className="relative flex-1 min-w-[200px] flex items-center">
        {/* Breadcrumb markers */}
        {breadcrumbs.map((b) => {
          const pct = Math.max(0, Math.min(100, ((b.time - effectiveMin) / (effectiveMax - effectiveMin)) * 100))
          return (
            <div
              key={b.id}
              style={{ left: `${pct}%` }}
              title={`${b.app}: ${b.label}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-1.5 rounded-full bg-[hsl(var(--signal))] ring-2 ring-[#111318] pointer-events-none"
            />
          )
        })}

        <input
          type="range"
          min={effectiveMin}
          max={effectiveMax}
          value={localTime}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-ew-resize accent-[hsl(var(--signal))]"
        />
      </div>

      {/* Timestamp Display */}
      <div className="flex items-center gap-2 font-mono text-xs tabular-nums shrink-0">
        <span className="text-[hsl(var(--muted))]">
          {new Date(localTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        {isLive ? (
          <span className="px-2 py-0.5 rounded-[var(--radius-control)] bg-[hsl(var(--signal))]/20 border border-[hsl(var(--signal))]/40 text-[hsl(var(--signal))] font-semibold text-[10px]">
            LIVE
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResetToLive}
            className="flex items-center gap-1 text-[10px] text-[hsl(var(--signal))] hover:underline cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>RETURN TO LIVE</span>
          </button>
        )}
      </div>
    </div>
  )
}
