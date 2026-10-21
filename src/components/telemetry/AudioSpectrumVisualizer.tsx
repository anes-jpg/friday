import React from "react"
import { useFridayStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface AudioSpectrumVisualizerProps {
  className?: string
  barCount?: number
  height?: number
}

export const AudioSpectrumVisualizer: React.FC<AudioSpectrumVisualizerProps> = ({
  className = "",
  barCount = 24,
  height = 20,
}) => {
  const orbState = useFridayStore((s) => s.orbState)
  const level = useFridayStore((s) => s.level)
  const safeRms = typeof level === "number" && !isNaN(level) ? Math.min(1, Math.max(0, level)) : 0
  const isIdle = orbState === "idle" || !orbState
  const isListening = orbState === "listening"
  const isSpeaking = orbState === "speaking"

  return (
    <div className={cn("flex flex-col gap-1 select-none pointer-events-none", className)}>
      <div className="flex items-center justify-between font-instrument text-[9px] text-[hsl(var(--muted))] uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block size-1.5 rounded-full transition-colors",
              isListening ? "bg-[hsl(var(--signal))]" : isSpeaking ? "bg-white" : "bg-white/20"
            )}
          />
          SPECTRUM // {String(orbState || "idle").toUpperCase()}
        </span>
        <span className="font-instrument text-[hsl(var(--muted))]">
          RMS {(safeRms * 100).toFixed(0)}%
        </span>
      </div>

      {/* Reduced motion: 3-level static segmented meter */}
      <div className="hidden motion-reduce:flex items-center gap-1 h-3">
        <span className={cn("h-2 flex-1 rounded-[1px]", safeRms > 0.05 ? "bg-[hsl(var(--signal))]" : "bg-white/10")} />
        <span className={cn("h-2 flex-1 rounded-[1px]", safeRms > 0.35 ? "bg-[hsl(var(--signal))]" : "bg-white/10")} />
        <span className={cn("h-2 flex-1 rounded-[1px]", safeRms > 0.7 ? "bg-[hsl(var(--signal))]" : "bg-white/10")} />
      </div>

      {/* 24-40 bar restrained contour (capped 30fps CSS transition) */}
      <div
        style={{ height: `${height}px` }}
        className="flex motion-reduce:hidden items-end gap-[2px] w-full px-1 py-0.5 bg-black/40 rounded-[var(--radius-control)] border border-white/5"
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const centerDist = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2)
          const weight = 1 - Math.pow(centerDist, 1.6)
          const barHeight = isIdle
            ? 2
            : Math.max(2, Math.round(weight * safeRms * (height - 4)))

          let barColor = "rgba(255, 255, 255, 0.15)"
          if (isListening) {
            barColor = "hsl(var(--signal))"
          } else if (isSpeaking) {
            barColor = "hsl(var(--ink))"
          }

          return (
            <div
              key={i}
              style={{
                height: `${barHeight}px`,
                backgroundColor: barColor,
              }}
              className="flex-1 rounded-[1px] transition-[height] duration-75 ease-out"
            />
          )
        })}
      </div>
    </div>
  )
}
