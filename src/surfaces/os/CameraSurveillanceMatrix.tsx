import { X } from "lucide-react"
import { MonitorTab } from "@/surfaces/console/MonitorTab"
import { cn } from "@/lib/utils"
export type OpticalFilter = "rgb" | "mono"
export interface SurveillanceFeed {
  id: string; name: string; shortLabel: string; sector: string; locationName: string;
  coordinates: [number, number]; fps: number; type: "webrtc" | "video"; videoSrc?: string; telemetryLabels: string[]
}
export interface CameraSurveillanceMatrixProps {
  onClose?: () => void; onMinimize?: () => void;
  onFlyToCoordinates?: (coordinates: [number, number], zoom: number) => void; className?: string
}
/** Shared camera workspace in the spatial room; no bundled demo feeds. */
export function CameraSurveillanceMatrix({ onClose, className }: CameraSurveillanceMatrixProps) {
  return <section className={cn("relative h-full bg-[hsl(var(--surface))] rounded-2xl border border-white/10 overflow-hidden", className)} aria-label="Camera workspace">
    {onClose && <button type="button" className="absolute top-4 right-4 z-10 quiet-action" aria-label="Close camera workspace" onClick={onClose}><X size={16} /></button>}
    <MonitorTab view="cameras" />
  </section>
}
