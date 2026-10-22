/** FRIDAY OS Magnifying Bottom Dock (§01 & Blueprint §2)
 *
 * Mode navigation and quick system actuation:
 * - Magnifying spring physics on hover
 * - Fast switching between Console, God's Eye, Legion Swarm, and Episodic Workday Recall
 * - Fullscreen toggle
 * - Tabular clock
 */

import React, { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
  MessageSquare,
  Globe,
  Layers,
  History,
  Settings,
  Maximize2,
  Minimize2,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface OSDockProps {
  activeMode: "console" | "godseye" | "legion" | "history"
  onModeChange: (mode: "console" | "godseye" | "legion" | "history") => void
  onOpenSettings: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  className?: string
}

export const OSDock: React.FC<OSDockProps> = ({
  activeMode,
  onModeChange,
  onOpenSettings,
  isFullscreen,
  onToggleFullscreen,
  className,
}) => {
  const [timeStr, setTimeStr] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const items = [
    { id: "console", label: "Console", icon: MessageSquare },
    { id: "godseye", label: "God's Eye", icon: Globe },
    { id: "legion", label: "Iron Legion", icon: Layers },
    { id: "history", label: "Workday Recall", icon: History },
  ] as const

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-white/10 bg-[#090A0C]/90 backdrop-blur-md shadow-2xl select-none",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeMode === item.id

        return (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => onModeChange(item.id)}
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={cn(
              "relative p-2.5 rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center",
              isActive
                ? "bg-[hsl(var(--signal))]/20 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 shadow-xs"
                : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/10 border border-transparent"
            )}
            title={item.label}
          >
            <Icon className="size-4.5" />
            {isActive && (
              <motion.span
                layoutId="activeDockDot"
                className="absolute -bottom-1 w-1 h-1 rounded-full bg-[hsl(var(--signal))]"
              />
            )}
          </motion.button>
        )
      })}

      <div className="h-5 w-px bg-white/10 mx-1" />

      {/* Settings Action */}
      <motion.button
        type="button"
        onClick={onOpenSettings}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="p-2.5 rounded-xl text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/10 transition-colors cursor-pointer"
        title="Settings & Reasoning Models"
      >
        <Settings className="size-4.5" />
      </motion.button>

      {/* Fullscreen F11 / Alt+Enter */}
      <motion.button
        type="button"
        onClick={onToggleFullscreen}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="p-2.5 rounded-xl text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/10 transition-colors cursor-pointer"
        title={isFullscreen ? "Restore Viewport" : "Fullscreen FridayOS"}
      >
        {isFullscreen ? <Minimize2 className="size-4.5" /> : <Maximize2 className="size-4.5" />}
      </motion.button>

      <div className="h-5 w-px bg-white/10 mx-1" />

      {/* Real-time Clock */}
      <div className="px-2 font-mono text-[11px] text-[hsl(var(--muted))] tabular-nums">
        {timeStr}
      </div>
    </div>
  )
}
