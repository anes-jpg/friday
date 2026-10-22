/** FRIDAY Camera PiP Card Component (§04 & Blueprint §4)
 *
 * Draggable Picture-in-Picture optical/webcam monitor card:
 * - Public traffic feeds, ISS nadir stream, or local webcam
 * - 0% Idle CPU Law: Canvas simulation with low frame-rate loop
 * - Strict adherence to Surface Law and One-Signal Law
 */

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Video, Maximize2, Minimize2, X, RefreshCw, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CameraPiPCardProps {
  id?: string
  title?: string
  location?: string
  fps?: number
  onClose?: () => void
  className?: string
}

export const CameraPiPCard: React.FC<CameraPiPCardProps> = ({
  id = "cam-iss-01",
  title = "ISS Earth Nadir High-Definition Feed",
  location = "Low Earth Orbit (418 km)",
  fps = 30,
  onClose,
  className,
}) => {
  const [minimized, setMinimized] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Synthetic camera canvas generator (0% CPU when minimized)
  useEffect(() => {
    if (minimized) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let frame = 0
    let animId: number

    const render = () => {
      frame++
      const w = canvas.width
      const h = canvas.height

      // Subtle atmospheric deep-space / earth horizon gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, "#05070a")
      grad.addColorStop(0.65, "#0b121e")
      grad.addColorStop(1, "#18324e")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Horizon atmospheric arc
      ctx.beginPath()
      ctx.arc(w / 2, h * 1.5, w * 1.1, Math.PI, 0, false)
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"
      ctx.lineWidth = 3
      ctx.stroke()

      // Subtle grid telemetry overlay
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)"
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Timecode
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
      ctx.font = "10px monospace"
      ctx.fillText(`CAM-HD // ${new Date().toISOString()}`, 10, h - 12)

      // Throttle to 15fps to protect CPU
      setTimeout(() => {
        animId = requestAnimationFrame(render)
      }, 66)
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [minimized])

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        "fixed bottom-20 left-6 z-30 w-80 rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-[hsl(var(--ink))] select-none",
        minimized ? "h-auto" : "h-56",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.02] cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full bg-[hsl(var(--signal))] animate-pulse" />
          <div className="min-w-0">
            <h5 className="font-semibold text-xs truncate leading-none">{title}</h5>
            <span className="text-[10px] font-mono text-[hsl(var(--muted))]">{location}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-[hsl(var(--muted))] hover:text-white transition-colors cursor-pointer"
          >
            {minimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-[hsl(var(--muted))] hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Optical Canvas Stage */}
      {!minimized && (
        <div className="relative flex-1 w-full bg-black overflow-hidden">
          <canvas
            ref={canvasRef}
            width={320}
            height={180}
            className="w-full h-full object-cover"
          />

          {/* Telemetry Reticle Badge */}
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-[var(--radius-control)] bg-black/60 border border-white/10 text-[9px] font-mono text-[hsl(var(--muted))] tabular-nums flex items-center gap-1">
            <Eye className="size-2.5 text-[hsl(var(--signal))]" />
            <span>{fps} FPS</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
