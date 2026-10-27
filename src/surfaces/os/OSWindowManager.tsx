/** FRIDAY OS Window Manager Component (§07 & Blueprint §7)
 *
 * Workspace Layout Preset Orchestrator:
 * 1. `unified` (Ctrl+1): Central Operator Console + Right HUD Inspector (340px)
 * 2. `console` (Ctrl+2): Distraction-free Full Operator Console
 * 3. `godseye` (Ctrl+3): Fullscreen 9-layer planetary telemetry canvas
 * 4. `legion` (Ctrl+4): Iron Legion Sub-Agent DAG Swarm
 * 5. `history` (Ctrl+5): Episodic Timeline Recall
 *
 * Enforces Surface Law, Sub-Frame Law (120-220ms transitions), and 0% Idle CPU.
 */

import React from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

export type WindowLayoutPreset =
  | "unified"
  | "console"
  | "godseye"
  | "legion"
  | "history"
  | "fullscreen_godseye"
  | "operator_split"
  | "legion_ide"
  | "desktop_grid"

export interface OSWindowManagerProps {
  preset: WindowLayoutPreset
  onPresetChange?: (preset: WindowLayoutPreset) => void
  panes: {
    console: React.ReactNode
    inspector?: React.ReactNode
    godseye: React.ReactNode
    legion: React.ReactNode
    history: React.ReactNode
  }
  className?: string
}

export const OSWindowManager: React.FC<OSWindowManagerProps> = ({
  preset,
  panes,
  className,
}) => {
  const isUnified = preset === "unified" || preset === "operator_split"
  const isConsole = preset === "console"
  const isGodsEye = preset === "godseye" || preset === "fullscreen_godseye"
  const isLegion = preset === "legion" || preset === "legion_ide"
  const isHistory = preset === "history" || preset === "desktop_grid"

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-[#090A0C]", className)}>
      <AnimatePresence mode="wait">
        {/* Preset 1: Unified HUD (Primary Workspace: Console + Right Inspector) */}
        {isUnified && (
          <motion.div
            key="preset-unified"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full flex overflow-hidden"
          >
            {/* Primary Center Workspace: Operator Console */}
            <div className="flex-1 h-full min-w-0 overflow-hidden">
              {panes.console}
            </div>

            {/* Right Pro HUD Inspector Panel */}
            {panes.inspector && (
              <div className="h-full shrink-0 overflow-hidden">
                {panes.inspector}
              </div>
            )}
          </motion.div>
        )}

        {/* Preset 2: Full Distraction-Free Operator Console */}
        {isConsole && (
          <motion.div
            key="preset-console"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full overflow-hidden"
          >
            {panes.console}
          </motion.div>
        )}

        {/* Preset 3: Fullscreen God's Eye Planetary Telemetry Canvas */}
        {isGodsEye && (
          <motion.div
            key="preset-godseye"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full overflow-hidden"
          >
            {panes.godseye}
          </motion.div>
        )}

        {/* Preset 4: Iron Legion Sub-Agent Protocol DAG */}
        {isLegion && (
          <motion.div
            key="preset-legion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full p-6 flex flex-col justify-center items-center overflow-y-auto"
          >
            {panes.legion}
          </motion.div>
        )}

        {/* Preset 5: Episodic Timeline Recall */}
        {isHistory && (
          <motion.div
            key="preset-history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full overflow-hidden"
          >
            {panes.history}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
