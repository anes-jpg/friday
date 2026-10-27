/** FRIDAY Entity Dossier Drawer Component (§04 & Blueprint §4)
 *
 * Right-hand slide-over inspection drawer:
 * - Surfaces deep telemetry for selected geospatial & process entities
 * - Supports Red-Tier "Slide to Terminate Process" for active network sockets
 * - Strict adherence to Surface Law, One-Signal Law, and Sub-Frame Law
 */

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  X,
  Radio,
  Plane,
  Anchor,
  Globe,
  Activity,
  Terminal,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react"
import { ipcTerminateProcessSocket } from "@/lib/ipc"
import { cn } from "@/lib/utils"

export interface DossierEntity {
  id: string
  name: string
  type: string
  details: Record<string, unknown>
}

export interface EntityDossierDrawerProps {
  entity: DossierEntity | null
  onClose: () => void
  onActionComplete?: () => void
}

export const EntityDossierDrawer: React.FC<EntityDossierDrawerProps> = ({
  entity,
  onClose,
  onActionComplete,
}) => {
  const [slideProgress, setSlideProgress] = useState(0)
  const [isTerminating, setIsTerminating] = useState(false)
  const [isTerminated, setIsTerminated] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  if (!entity) return null

  const details = entity.details || {}
  const isProcessSocket =
    entity.type === "socket" ||
    entity.id.startsWith("sock-") ||
    Boolean(details.pid)

  const pid = typeof details.pid === "number" ? details.pid : 0
  const processName =
    typeof details.process_name === "string"
      ? details.process_name
      : typeof details.title === "string"
        ? details.title
        : "Unknown"

  // Handle slide termination
  const handleSlideChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setSlideProgress(val)

    if (val >= 98 && !isTerminating && !isTerminated) {
      setIsTerminating(true)
      setStatusMessage("Terminating process via Win32 signal...")
      try {
        await ipcTerminateProcessSocket(pid, processName)
        setIsTerminated(true)
        setStatusMessage(`PID ${pid} (${processName}) successfully terminated`)
        onActionComplete?.()
      } catch (err: unknown) {
        setIsTerminated(false)
        setStatusMessage(
          typeof err === "string" ? err : "Termination error"
        )
      } finally {
        setIsTerminating(false)
      }
    }
  }

  const getEntityIcon = () => {
    if (entity.id.startsWith("sat-")) return <Radio className="size-4 text-[hsl(var(--signal))]" />
    if (entity.id.startsWith("flight-")) return <Plane className="size-4 text-[#fbbf24]" />
    if (entity.id.startsWith("vessel-")) return <Anchor className="size-4 text-[#34d399]" />
    if (entity.id.startsWith("cable-")) return <Globe className="size-4 text-[#38bdf8]" />
    if (entity.id.startsWith("quake-")) return <Activity className="size-4 text-[#f87171]" />
    return <Terminal className="size-4 text-[hsl(var(--signal))]" />
  }

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-12 right-3 bottom-18 z-40 w-96 rounded-[var(--radius-panel)] border border-white/10 bg-[#111318]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden text-[hsl(var(--ink))] select-none"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-[var(--radius-control)] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {getEntityIcon()}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{entity.name}</h4>
              <p className="text-[11px] font-mono text-[hsl(var(--muted))] uppercase tracking-wider">
                {entity.type || "TELEMETRY NODE"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-[var(--radius-control)] border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-[hsl(var(--muted))] hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Spatial Coordinates Pill */}
          {(typeof details.lat === "number" || typeof details.coordinates === "object") && (
            <div className="p-3 rounded-[var(--radius-panel)] border border-white/10 bg-black/40 flex items-center justify-between font-mono text-xs tabular-nums">
              <span className="text-[hsl(var(--muted))]">POSITION</span>
              <span className="text-[hsl(var(--signal))] font-semibold">
                {typeof details.lat === "number"
                  ? `${details.lat.toFixed(4)}°N, ${Number(details.lng).toFixed(4)}°W`
                  : "CALIBRATED"}
              </span>
            </div>
          )}

          {/* Properties Grid */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
              Telemetry Parameters
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(details).map(([key, val]) => {
                if (typeof val === "object" || key === "active") return null
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-[var(--radius-control)] border border-white/5 bg-white/[0.02]"
                  >
                    <div className="text-[10px] font-mono text-[hsl(var(--muted))] uppercase truncate">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs font-mono font-medium truncate tabular-nums text-[hsl(var(--ink))]">
                      {String(val)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Destructive Process Actions for Windows Network Sockets */}
          {isProcessSocket && (
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-400" />
                <span className="text-xs font-semibold text-rose-300">
                  Red-Tier Actuation: Terminate Socket Process
                </span>
              </div>

              <p className="text-[11px] text-[hsl(var(--muted))] leading-relaxed">
                Terminating PID <span className="font-mono text-white tabular-nums">{pid}</span> will forcibly close all TCP/UDP streams owned by <span className="font-semibold text-white">{processName}</span>.
              </p>

              {/* Bencho-style Slide to Confirm Bar */}
              <div className="relative p-1 rounded-[var(--radius-panel)] border border-rose-500/30 bg-rose-950/20 overflow-hidden">
                <svg className="absolute inset-y-0 left-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                  <rect x="0" y="0" width={`${slideProgress}%`} height="100%" className="fill-rose-600/30 transition-all duration-75" />
                </svg>

                <div className="relative flex items-center justify-between px-3 py-2 text-xs font-mono">
                  <span className="text-rose-300 flex items-center gap-1.5">
                    {isTerminated ? (
                      <CheckCircle2 className="size-3.5 text-white" />
                    ) : (
                      <Lock className="size-3.5 text-rose-400" />
                    )}
                    {isTerminated
                      ? "TERMINATED"
                      : slideProgress >= 95
                        ? "RELEASE TO KILL"
                        : "SLIDE TO TERMINATE"}
                  </span>
                  <ArrowRight className="size-3.5 text-rose-400/60 animate-pulse" />
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isTerminated ? 100 : slideProgress}
                  disabled={isTerminated || isTerminating}
                  onChange={handleSlideChange}
                  onMouseUp={() => !isTerminated && setSlideProgress(0)}
                  onTouchEnd={() => !isTerminated && setSlideProgress(0)}
                  className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
                />
              </div>

              {statusMessage && (
                <p className={cn("text-[11px] font-mono", isTerminated ? "text-white" : "text-rose-300")}>
                  {statusMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
