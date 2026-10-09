import { useState, type ReactNode } from "react"
import { Check, ChevronDown, CircleAlert, LoaderCircle, Wrench, Undo2 } from "lucide-react"
import { cn, ms } from "@/lib/utils"
import { SegmentedTracker, type TrackerSegment } from "@/components/tremor/Tracker"
import type { ToolCall } from "@/lib/types"

export type ToolPhase = "queued" | "running" | "verifying" | "complete" | "failed"

const phaseMeta = {
  queued: { label: "Queued", icon: Wrench },
  running: { label: "Running", icon: LoaderCircle },
  verifying: { label: "Verifying", icon: LoaderCircle },
  complete: { label: "Complete", icon: Check },
  failed: { label: "Failed", icon: CircleAlert },
} satisfies Record<ToolPhase, { label: string; icon: typeof Wrench }>

function lifecycleSegments(phase: ToolPhase): TrackerSegment[] {
  const steps = ["Queued", "Running", "Verifying", "Complete"]
  const position = phase === "failed" ? 1 : ["queued", "running", "verifying", "complete"].indexOf(phase)
  return Array.from({ length: 24 }, (_, index) => {
    const step = Math.min(3, Math.floor(index / 6))
    const passed = step < position
    const current = step === position
    return {
      id: String(index),
      label: steps[step],
      tone: phase === "failed" && current ? "danger" : passed ? "success" : current ? "active" : "idle",
    }
  })
}

export type ToolCallCardProps =
  | {
      name: string
      target?: string
      phase: ToolPhase
      summary: string
      expanded: boolean
      onExpandedChange: (value: boolean) => void
      children?: ReactNode
      call?: never
    }
  | {
      call: ToolCall
      name?: never
      target?: never
      phase?: never
      summary?: never
      expanded?: never
      onExpandedChange?: never
      children?: never
    }

export function ToolCallCard(props: ToolCallCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)

  // Map from legacy or direct call if provided
  let name: string
  let target: string | undefined
  let phase: ToolPhase
  let summary: string
  let expanded: boolean
  let onExpandedChange: (value: boolean) => void
  let children: ReactNode = null
  let reversible: boolean | undefined
  let undone: boolean | undefined
  let durationMs: number | undefined

  if ("call" in props && props.call) {
    const call = props.call
    name = call.name
    target = call.args ? JSON.stringify(call.args).slice(0, 48) : undefined
    phase =
      call.status === "pending"
        ? "queued"
        : call.status === "running"
        ? "running"
        : call.status === "failed" || call.status === "refused"
        ? "failed"
        : "complete"
    summary =
      typeof call.output === "string"
        ? call.output
        : call.args
        ? JSON.stringify(call.args)
        : "Tool executed"
    expanded = internalExpanded
    onExpandedChange = setInternalExpanded
    durationMs = call.duration_ms
    children = (
      <div className="space-y-2 text-xs font-mono">
        <div>
          <span className="text-white/50">ARGS: </span>
          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-white/90">
            {JSON.stringify(call.args, null, 2)}
          </pre>
        </div>
        {call.output && (
          <div>
            <span className="text-white/50">OUTPUT: </span>
            <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-white/90">
              {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  } else {
    name = props.name
    target = props.target
    phase = props.phase
    summary = props.summary
    expanded = props.expanded
    onExpandedChange = props.onExpandedChange
    children = props.children
  }

  const meta = phaseMeta[phase]
  const Icon = meta.icon
  const busy = phase === "running" || phase === "verifying"

  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] bg-black text-white shadow-sm border border-white/10 my-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white transition-colors hover:bg-white/[.03]"
      >
        <span className={cn(
          "grid size-8 place-items-center rounded-full shrink-0 transition-colors",
          phase === "complete" ? "bg-[hsl(var(--signal))]/15 text-[hsl(var(--signal))]" : "bg-white/10 text-white"
        )}>
          <Icon aria-hidden className={cn("size-4", busy && "animate-spin motion-reduce:animate-none")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          {target && (
            <span className="font-instrument block truncate text-[10px] uppercase tracking-[.1em] text-white/50">
              {target}
            </span>
          )}
        </span>
        {durationMs !== undefined && (
          <span className="font-instrument text-[10px] text-white/40">{ms(durationMs)}</span>
        )}
        <span className={cn(
          "font-instrument text-[10px] uppercase tracking-[.11em] transition-colors",
          phase === "complete" ? "text-[hsl(var(--signal))]" : "text-white/65"
        )}>
          {meta.label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-white/50 transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>

      <div className="px-4 pb-3">
        <SegmentedTracker segments={lifecycleSegments(phase)} label={`${name}: ${meta.label}`} />
        <p className="mt-2.5 max-w-[70ch] text-xs leading-relaxed text-white/80 line-clamp-2">{summary}</p>
      </div>

      {reversible && (
        <div className="px-4 pb-3 flex items-center gap-2 text-[10px] font-mono text-white/50">
          <Undo2 className="size-3" />
          <span>{undone ? "Action undone" : "Reversible action"}</span>
        </div>
      )}

      {expanded && children && (
        <div className="border-t border-white/10 bg-white/[.04] p-4 text-white/90">
          {children}
        </div>
      )}
    </article>
  )
}
