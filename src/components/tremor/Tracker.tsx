import React from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"

export type SegmentTone = "idle" | "active" | "success" | "warning" | "danger"

export type TrackerSegment = {
  id: string
  label: string
  tone: SegmentTone
}

const toneClass: Record<SegmentTone, string> = {
  idle: "bg-white/15",
  active: "bg-[hsl(var(--signal))]",
  success: "bg-[hsl(var(--signal))]",
  warning: "bg-[hsl(var(--warning))]",
  danger: "bg-[hsl(var(--danger))]",
}

export function SegmentedTracker({
  segments,
  label,
  className,
}: {
  segments: TrackerSegment[]
  label: string
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="img"
        aria-label={label}
        className={cn("flex h-5 w-full items-center gap-[3px]", className)}
      >
        {segments.map((segment) => (
          <Tooltip key={segment.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "h-[10px] min-w-1 flex-1 rounded-[1px] transition-opacity duration-150 hover:opacity-65",
                  toneClass[segment.tone],
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {segment.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

// Backward-compatible Tracker wrapper for StatusMonitoring
export interface TrackerBlockProps {
  key?: string | number
  color?: string
  tooltip?: string
  hoverEffect?: boolean
  defaultBackgroundColor?: string
}

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[]
}

export const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data, className, ...props }, ref) => {
    const segments: TrackerSegment[] = data.map((d, i) => {
      let tone: SegmentTone = "idle"
      if (d.color?.includes("acid") || d.color?.includes("cyan") || d.color?.includes("signal")) {
        tone = "active"
      } else if (d.color?.includes("emerald") || d.color?.includes("green")) {
        tone = "success"
      } else if (d.color?.includes("warn") || d.color?.includes("amber")) {
        tone = "warning"
      } else if (d.color?.includes("fail") || d.color?.includes("red")) {
        tone = "danger"
      }
      return {
        id: String(d.key ?? i),
        label: d.tooltip || `Segment ${i + 1}`,
        tone,
      }
    })

    return (
      <div ref={ref} {...props}>
        <SegmentedTracker segments={segments} label="Status Tracker" className={className} />
      </div>
    )
  }
)
Tracker.displayName = "Tracker"
