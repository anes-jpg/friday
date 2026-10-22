import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Cpu, ShieldCheck, Activity, Terminal, Sparkles } from "lucide-react"

export interface HudBootSequenceProps {
  onComplete: () => void
  onSkip?: () => void
}

function playHudBootSound() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // 1. Sub-bass power surge
    const oscLow = ctx.createOscillator()
    const gainLow = ctx.createGain()
    oscLow.type = "sine"
    oscLow.frequency.setValueAtTime(65, now)
    oscLow.frequency.exponentialRampToValueAtTime(140, now + 0.35)
    gainLow.gain.setValueAtTime(0.18, now)
    gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    oscLow.connect(gainLow)
    gainLow.connect(ctx.destination)
    oscLow.start(now)
    oscLow.stop(now + 0.55)

    // 2. High frequency holographic chirp
    const oscHigh = ctx.createOscillator()
    const gainHigh = ctx.createGain()
    oscHigh.type = "triangle"
    oscHigh.frequency.setValueAtTime(440, now + 0.15)
    oscHigh.frequency.exponentialRampToValueAtTime(1320, now + 0.45)
    gainHigh.gain.setValueAtTime(0.001, now + 0.15)
    gainHigh.gain.linearRampToValueAtTime(0.1, now + 0.25)
    gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    oscHigh.connect(gainHigh)
    gainHigh.connect(ctx.destination)
    oscHigh.start(now + 0.15)
    oscHigh.stop(now + 0.55)

    // 3. Final affirmative chord
    const freqs = [587.33, 880, 1174.66] // D5, A5, D6
    freqs.forEach((f) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(f, now + 0.65)
      g.gain.setValueAtTime(0.08, now + 0.65)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.25)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now + 0.65)
      osc.stop(now + 1.3)
    })
  } catch {
    // Non-blocking fallback
  }
}

export const HudBootSequence: React.FC<HudBootSequenceProps> = ({ onComplete, onSkip }) => {
  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)

  const STAGES = [
    { label: "INITIALIZING SPATIAL OS KERNEL v2.0", sub: "Allocating 100vw × 100vh canvas matrix" },
    { label: "LOCKING FULLSCREEN RESOLUTION PROTOCOL", sub: "Hardware DWM bypass & GPU compositing ready" },
    { label: "CALIBRATING GOD'S EYE TELEMETRY (9 LAYERS)", sub: "Orbital, Maritime, ADS-B, Subsea Arcs online" },
    { label: "SYNCHRONIZING IRON LEGION SUB-AGENTS", sub: "4-Worker parallel DAG topology verified" },
    { label: "HUD CALIBRATION COMPLETE · ALL SYSTEMS NOMINAL", sub: "FRIDAY Operator ready for deployment" },
  ]

  useEffect(() => {
    playHudBootSound()

    // Smooth, rapid progress increment (total 1.25 seconds)
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 4
        if (next >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            onComplete()
          }, 180)
          return 100
        }
        return next
      })
    }, 45)

    return () => clearInterval(interval)
  }, [onComplete])

  useEffect(() => {
    const idx = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length))
    setStageIndex(idx)
  }, [progress, STAGES.length])

  // Allow clicking or pressing any key to skip immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      onSkip ? onSkip() : onComplete()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onComplete, onSkip])

  return (
    <div
      onClick={onSkip || onComplete}
      className="fixed inset-0 z-50 bg-[#040507] text-white flex flex-col items-center justify-center select-none cursor-pointer overflow-hidden font-mono"
    >
      {/* Background Matrix Grid */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Sweeping Laser Scanline */}
      <motion.div
        initial={{ top: "-10%" }}
        animate={{ top: "110%" }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[hsl(var(--signal))] to-transparent opacity-75 shadow-[0_0_20px_hsl(var(--signal))] pointer-events-none"
      />

      {/* Radial vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#040507]/60 to-[#040507] pointer-events-none" />

      {/* Central Aperture & Reticles */}
      <div className="relative size-72 sm:size-88 flex items-center justify-center">
        {/* Outer Rotating Dash Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-white/20"
        />

        {/* Mid Ring with Segment Markers */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-6 rounded-full border border-white/10"
          style={{
            borderTopColor: "hsl(var(--signal))",
            borderBottomColor: "hsl(var(--signal))",
          }}
        />

        {/* Inner Pulsing Radar Sweep */}
        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-16 rounded-full border-2 border-[hsl(var(--signal))]/40 bg-[hsl(var(--signal))]/5"
        />

        {/* Crosshair Center Reticle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-px bg-[hsl(var(--signal))]/80" />
          <div className="h-16 w-px bg-[hsl(var(--signal))]/80 absolute" />
          <div className="size-4 rounded-full border border-[hsl(var(--signal))] absolute" />
        </div>

        {/* Corner Brackets */}
        <div className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-white/40" />
        <div className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-white/40" />
        <div className="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-white/40" />
        <div className="absolute bottom-2 right-2 size-4 border-b-2 border-r-2 border-white/40" />

        {/* Center Live Percentage */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tighter text-white tabular-nums drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]">
            {progress}%
          </span>
          <span className="text-[10px] tracking-widest text-[hsl(var(--signal))] uppercase mt-0.5">
            BOOT SEQUENCE
          </span>
        </div>
      </div>

      {/* Diagnostics Readout Card */}
      <div className="relative z-10 mt-8 max-w-md w-full px-6 flex flex-col items-center text-center space-y-3">
        <div className="h-12 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stageIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
              className="space-y-0.5"
            >
              <div className="text-xs font-semibold text-white tracking-wider flex items-center justify-center gap-1.5">
                <Sparkles className="size-3 text-[hsl(var(--signal))]" />
                <span>{STAGES[stageIndex].label}</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                {STAGES[stageIndex].sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* High-Tech Progress Bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
          <motion.div
            style={{ width: `${progress}%` }}
            className="h-full bg-[hsl(var(--signal))] rounded-full shadow-[0_0_10px_hsl(var(--signal))]"
          />
        </div>

        <div className="flex items-center justify-between w-full text-[9px] text-zinc-500 tracking-wider">
          <span>FRIDAY OS 2.0 // SPATIAL HUD</span>
          <span>CLICK TO SKIP</span>
        </div>
      </div>
    </div>
  )
}
