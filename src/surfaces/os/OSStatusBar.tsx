import { ContourCore } from "@/components/orb/ContourCore"
import { MessageSquare, Globe, Share2, History, Minimize2, Activity, Shield, Mic, MicOff } from "lucide-react"
import { useFriday } from "@/lib/store"
import { cn } from "@/lib/utils"

export type OSSurfaceMode = "console" | "godseye" | "legion" | "history" | "unified"
export interface OSStatusBarProps {
  activeMode: OSSurfaceMode; onModeChange: (mode: OSSurfaceMode) => void
  isFullscreen: boolean; onToggleFullscreen: () => void; overwatchEnabled: boolean; onToggleOverwatch: () => void
  isInspectorOpen?: boolean; onToggleInspector?: () => void; cpuPercent?: number; ramMb?: number
  gpuTemp?: number; gpuName?: string; activeModelName?: string; className?: string
}
const modes = [
  { id: "console", label: "Talk", icon: MessageSquare }, { id: "godseye", label: "Map", icon: Globe },
  { id: "legion", label: "Tasks", icon: Share2 }, { id: "history", label: "History", icon: History },
] as const
export function OSStatusBar({ activeMode, onModeChange, onToggleFullscreen, overwatchEnabled, onToggleOverwatch,
  isInspectorOpen, onToggleInspector, cpuPercent, ramMb, activeModelName, className }: OSStatusBarProps) {
  const muted = useFriday((state) => state.micMuted)
  return <header className={cn("control-room-header", className)}>
    <div className="control-room-identity"><ContourCore /><span className="wordmark">FRIDAY.</span><span className="instrument-label">Control room</span><span className="control-room-model">{activeModelName ?? "Select a provider"}</span></div>
    <nav aria-label="Control room views">{modes.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={activeMode === id ? "page" : undefined} onClick={() => onModeChange(id)} className={cn((activeMode === id || (activeMode === "unified" && id === "console")) && "is-selected")}><Icon size={16} /><span>{label}</span></button>)}</nav>
    <div className="control-room-actions">
      <span className="control-room-vitals instrument-label">{cpuPercent === undefined || ramMb === undefined ? "Hardware unavailable" : `${cpuPercent}% CPU · ${(ramMb / 1024).toFixed(1)} GB RAM`}</span>
      <button type="button" aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} onClick={() => useFriday.getState().toggleMic()}>{muted ? <MicOff size={16} /> : <Mic size={16} />}</button>
      <button type="button" aria-label="Toggle proactive companion" aria-pressed={overwatchEnabled} onClick={onToggleOverwatch} title="Proactive companion"><Shield size={16} /></button>
      {onToggleInspector && <button type="button" aria-label="Toggle inspector" aria-pressed={isInspectorOpen} onClick={onToggleInspector}><Activity size={16} /></button>}
      <button type="button" aria-label="Exit control room" onClick={onToggleFullscreen} title="Exit control room (Esc / Ctrl+Shift+F11)"><Minimize2 size={16} /><span>Exit</span></button>
    </div>
  </header>
}
