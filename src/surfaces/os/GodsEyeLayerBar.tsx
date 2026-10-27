/** FRIDAY God's Eye 9-Layer Bar (§04 & Blueprint §4)
 *
 * Tactile layer switchers for planetary-to-process telemetry:
 * - Sockets (Windows PID network connections)
 * - Cables (Submarine fiber optics)
 * - Air (ADS-B flights)
 * - Orbit (Satellites)
 * - Sea (AIS vessels)
 * - Seismic (Earthquakes)
 * - Radar (Weather)
 * - LAN (Local subnet ARP)
 *
 * Strict Surface Law & One-Signal Law.
 */

import React from "react"
import {
  Network,
  Cable,
  Plane,
  Satellite,
  Ship,
  Activity,
  CloudRain,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type GodsEyeLayerId =
  | "sockets"
  | "cables"
  | "air"
  | "orbit"
  | "sea"
  | "seismic"
  | "radar"
  | "lan"

export interface LayerConfig {
  id: GodsEyeLayerId
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

export const GODS_EYE_LAYERS: LayerConfig[] = [
  { id: "sockets", label: "Sockets", icon: Network },
  { id: "cables", label: "Subsea Cables", icon: Cable },
  { id: "air", label: "ADS-B Air", icon: Plane },
  { id: "orbit", label: "Orbital", icon: Satellite },
  { id: "sea", label: "AIS Sea", icon: Ship },
  { id: "seismic", label: "Seismic", icon: Activity },
  { id: "radar", label: "Radar", icon: CloudRain },
  { id: "lan", label: "Local LAN", icon: Wifi },
]

export interface GodsEyeLayerBarProps {
  activeLayers: Set<GodsEyeLayerId>
  onToggleLayer: (layer: GodsEyeLayerId) => void
  layerCounts?: Partial<Record<GodsEyeLayerId, number>>
  className?: string
}

export const GodsEyeLayerBar: React.FC<GodsEyeLayerBarProps> = ({
  activeLayers,
  onToggleLayer,
  layerCounts = {},
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 p-1.5 rounded-2xl border border-white/10 bg-[#141416]/90 backdrop-blur-2xl shadow-2xl select-none",
        className
      )}
    >
      {GODS_EYE_LAYERS.map((layer) => {
        const Icon = layer.icon
        const isActive = activeLayers.has(layer.id)
        const count = layerCounts[layer.id]

        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => onToggleLayer(layer.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
              isActive
                ? "bg-white/20 border border-white/25 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent"
            )}
            title={`Toggle ${layer.label}`}
          >
            <Icon className={cn("size-3.5", isActive ? "text-white" : "text-zinc-400")} />
            <span>{layer.label}</span>
            {count !== undefined && count > 0 && (
              <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/60 text-zinc-300 tabular-nums">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
