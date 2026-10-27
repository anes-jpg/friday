import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
export type OSSurfaceMode = "console" | "godseye" | "legion" | "history"
export interface OSDockProps {
  activeMode: OSSurfaceMode; onModeChange: (mode: OSSurfaceMode) => void; onOpenSettings?: () => void
  isFullscreen: boolean; onToggleFullscreen: () => void; className?: string
}
export function OSDock({ activeMode, className }: OSDockProps) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), 30000)
    return () => clearInterval(timer)
  }, [])
  return <footer className={cn("control-room-footer", className)}><div><span>Esc · Exit</span><span>Ctrl+1–4 · Views</span><span>Ctrl+K · Commands</span></div><span className="control-room-current">{activeMode === "console" ? "Talk" : activeMode === "godseye" ? "Map" : activeMode === "legion" ? "Tasks" : "History"}</span><time>{time}</time></footer>
}
