/** FRIDAY OS Window Manager Component (§07 & Blueprint §7)
 *
 * Snap-tiling and floating workspace preset orchestrator:
 * - Layout Presets:
 *   1. `fullscreen_godseye` (Ctrl+1): Fullscreen 9-layer planetary telemetry canvas
 *   2. `operator_split` (Ctrl+2): Left 440px Chat Console + Right God's Eye Map
 *   3. `legion_ide` (Ctrl+3): Top Legion Swarm DAG + Bottom Sockets/Episodic Log
 *   4. `desktop_grid` (Ctrl+4): 2×2 Bento Grid combining all 4 operational surfaces
 *
 * Enforces Surface Law, Sub-Frame Law (120-220ms transitions), and 0% Idle CPU.
 */

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Maximize2, SplitSquareVertical, Grid2X2, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

export type WindowLayoutPreset =
  | "fullscreen_godseye"
  | "operator_split"
  | "legion_ide"
  | "desktop_grid"

export interface OSWindowManagerProps {
  preset: WindowLayoutPreset
  onPresetChange: (preset: WindowLayoutPreset) => void
  panes: {
    console: React.ReactNode
    godseye: React.ReactNode
    legion: React.ReactNode
    history: React.ReactNode
  }
  className?: string
}

export const OSWindowManager: React.FC<OSWindowManagerProps> = ({
  preset,
  onPresetChange,
  panes,
  className,
}) => {
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <AnimatePresence mode="wait">
        {/* Preset 1: Fullscreen God's Eye Command Canvas (Ctrl+1) */}
        {preset === "fullscreen_godseye" && (
          <motion.div
            key="godseye-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full"
          >
            {panes.godseye}
          </motion.div>
        )}

        {/* Preset 2: Operator Split (Chat Console 440px + Live God's Eye Map) (Ctrl+2) */}
        {preset === "operator_split" && (
          <motion.div
            key="operator-split"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full flex"
          >
            {/* Left Console Pane */}
            <div className="w-[450px] h-full shrink-0 border-r border-white/10 bg-[#0c0e12]/90 backdrop-blur-xl z-10 flex flex-col">
              {panes.console}
            </div>

            {/* Right Map Pane */}
            <div className="flex-1 h-full overflow-hidden">
              {panes.godseye}
            </div>
          </motion.div>
        )}

        {/* Preset 3: Iron Legion Swarm Focus (Ctrl+3) */}
        {preset === "legion_ide" && (
          <motion.div
            key="legion-ide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full p-6 flex flex-col justify-center items-center overflow-y-auto"
          >
            {panes.legion}
          </motion.div>
        )}

        {/* Preset 4: 2×2 Desktop Bento Grid (Ctrl+4) */}
        {preset === "desktop_grid" && (
          <motion.div
            key="desktop-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full p-3 grid grid-cols-2 grid-rows-2 gap-3"
          >
            {/* Top-Left: Operator Console */}
            <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/90 overflow-hidden flex flex-col shadow-xl">
              <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-[hsl(var(--muted))]">
                <span>OPERATOR CONSOLE</span>
                <span className="text-[10px] text-[hsl(var(--signal))]">ONLINE</span>
              </div>
              <div className="flex-1 overflow-hidden">{panes.console}</div>
            </div>

            {/* Top-Right: God's Eye Map */}
            <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/90 overflow-hidden flex flex-col shadow-xl">
              <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-[hsl(var(--muted))]">
                <span>GOD'S EYE 9-LAYER TELEMETRY</span>
                <span className="text-[10px] text-[#38bdf8]">60FPS WEBGL2</span>
              </div>
              <div className="flex-1 overflow-hidden">{panes.godseye}</div>
            </div>

            {/* Bottom-Left: Episodic Timeline Recall */}
            <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/90 overflow-hidden flex flex-col shadow-xl">
              <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-[hsl(var(--muted))]">
                <span>EPISODIC CONTEXT GRAPH</span>
                <span className="text-[10px] text-[hsl(var(--muted))]">WAL SQLITE</span>
              </div>
              <div className="flex-1 overflow-y-auto">{panes.history}</div>
            </div>

            {/* Bottom-Right: Iron Legion Swarm */}
            <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/90 overflow-hidden flex flex-col shadow-xl">
              <div className="px-3 py-1.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-[hsl(var(--muted))]">
                <span>IRON LEGION DAG</span>
                <span className="text-[10px] text-[hsl(var(--signal))]">TOKIO SWARM</span>
              </div>
              <div className="flex-1 overflow-hidden p-3">{panes.legion}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
