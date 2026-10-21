/**
 * Intelligent UI Controls Primitives:
 * Slider, Button, SegmentedControl, Checkbox, Timer
 * Strict compliance with Surface Law, One-Signal Law, Tabular Numerals, zero inline styles.
 */

import React, { useState, useEffect } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"

export interface SliderProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (val: number) => void
}

export const SliderPrimitive: React.FC<SliderProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}) => {
  const safeMin = typeof min === "number" ? min : 0
  const safeMax = typeof max === "number" && max > safeMin ? max : safeMin + 100
  const safeVal = typeof value === "number" ? Math.min(Math.max(value, safeMin), safeMax) : safeMin

  const percent = Math.round(((safeVal - safeMin) / (safeMax - safeMin)) * 100)

  return (
    <div className="w-full rounded-xl bg-black/20 dark:bg-black/30 border border-black/10 dark:border-white/5 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--muted))]">
          {label}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-[hsl(var(--ink))]">
          {safeVal.toLocaleString()} {unit}
        </span>
      </div>

      <div className="relative flex items-center h-6">
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={safeVal}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-full h-1.5 bg-black/40 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[hsl(var(--signal))]"
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-[hsl(var(--muted))] tabular-nums">
        <span>{safeMin.toLocaleString()} {unit}</span>
        <span>{percent}%</span>
        <span>{safeMax.toLocaleString()} {unit}</span>
      </div>
    </div>
  )
}

export const ButtonPrimitive: React.FC<{
  label: string
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: React.ReactNode
}> = ({ label, onClick, variant = "primary", icon }) => {
  const cls =
    variant === "secondary"
      ? "bg-black/20 dark:bg-white/10 text-[hsl(var(--ink))] border-black/10 dark:border-white/10 hover:bg-black/30 dark:hover:bg-white/15"
      : variant === "danger"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
      : variant === "ghost"
      ? "bg-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/5 border-transparent"
      : "bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm border-transparent"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export const SegmentedControlPrimitive: React.FC<{
  label?: string
  options: string[]
  value: string
  onChange: (val: string) => void
}> = ({ label, options, value, onChange }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <span className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
          {label}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/20 dark:bg-black/40 border border-black/10 dark:border-white/5">
        {options.map((opt) => {
          const isSelected = opt === value
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 min-w-[70px] py-1 px-2.5 rounded-lg text-xs font-mono transition-all text-center cursor-pointer select-none ${
                isSelected
                  ? "bg-white text-black dark:bg-white/90 dark:text-black font-semibold shadow-xs"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/5"
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const CheckboxPrimitive: React.FC<{
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}> = ({ label, checked, onChange }) => {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-black/20 dark:border-white/20 bg-black/20 text-[hsl(var(--signal))] focus:ring-0 cursor-pointer accent-[hsl(var(--signal))]"
      />
      <span className="text-xs text-[hsl(var(--ink))] font-sans">{label}</span>
    </label>
  )
}

export const TimerPrimitive: React.FC<{
  seconds: number
  label?: string
}> = ({ seconds: initialSeconds, label = "Countdown Timer" }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, timeLeft])

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

  return (
    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/20 dark:bg-black/30">
      <div className="space-y-0.5">
        <span className="text-[10.5px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
          {label}
        </span>
        <div className="font-mono text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--ink))]">
          {formattedTime}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          aria-label={isRunning ? "Pause timer" : "Start timer"}
          className={`p-2 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
            isRunning
              ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
              : "bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] border-[hsl(var(--signal))]/20 hover:bg-[hsl(var(--signal))]/20"
          }`}
        >
          {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsRunning(false)
            setTimeLeft(initialSeconds)
          }}
          aria-label="Reset timer"
          className="p-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] cursor-pointer"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  )
}
