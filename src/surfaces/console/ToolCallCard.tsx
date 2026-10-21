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

function sanitizeToolSummary(raw: string, args?: Record<string, unknown>): string {
  if (!raw && args) {
    if (args.task) return `Task: ${String(args.task)}`
    if (args.query) return `Query: ${String(args.query)}`
    if (args.url) return `URL: ${String(args.url)}`
  }
  let s = (raw || "").trim()
  if (s.startsWith("{") || s.includes('"error":') || s.includes('"status":') || s.includes('"task":')) {
    try {
      const parsed = JSON.parse(s)
      if (parsed.error) {
        const errStr = String(parsed.error)
        if (errStr.includes("403")) return "Access restricted (HTTP 403) — used web search fallback"
        if (errStr.includes("timeout")) return "Request timed out — used indexed cache fallback"
        return `Notice: ${errStr.slice(0, 120)}`
      }
      if (parsed.message) return String(parsed.message).slice(0, 120)
      if (parsed.task) return `Task: ${String(parsed.task)}`
      if (parsed.summary) return String(parsed.summary).slice(0, 140)
      if (parsed.result) return String(parsed.result).slice(0, 140)
    } catch {
      // not strict JSON, fall through
    }
  }
  if (s.includes("%PDF") || (s.includes("endobj") && s.includes("obj"))) {
    return "Datasheet and technical specs indexed successfully"
  }
  if (s.includes('"node":') && s.includes('"role":')) {
    return "Interactive page controls and accessibility tree indexed"
  }
  return s.length > 180 ? `${s.slice(0, 180)}…` : s
}

function lifecycleSegments(phase: ToolPhase): TrackerSegment[] {
  const steps = ["Queued", "Running", "Verifying", "Complete"]
  const position = phase === "failed" ? 1 : ["queued", "running", "verifying", "complete"].indexOf(phase)
  return steps.map((label, step) => {
    const passed = step < position
    const current = step === position
    return {
      id: String(step),
      label,
      tone: phase === "failed" && current ? "danger" : current && (phase === "running" || phase === "verifying") ? "active" : passed ? "idle" : "idle",
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
    const rawTarget = call.args ? JSON.stringify(call.args) : undefined
    target = rawTarget ? rawTarget.replace(/\[Instruction:[\s\S]*?\]/gi, "").trim().slice(0, 48) : undefined
    phase =
      call.status === "pending"
        ? "queued"
        : call.status === "running"
        ? "running"
        : call.status === "failed" || call.status === "refused"
        ? "failed"
        : "complete"
    summary = sanitizeToolSummary(
      typeof call.output === "string"
        ? call.output
        : call.args
        ? JSON.stringify(call.args)
        : "Tool executed",
      call.args as Record<string, unknown> | undefined
    )
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
            <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-white/90 max-h-48">
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
    summary = sanitizeToolSummary(props.summary)
    expanded = props.expanded
    onExpandedChange = props.onExpandedChange
    children = props.children
  }

  const meta = phaseMeta[phase]
  const Icon = meta.icon
  const busy = phase === "running" || phase === "verifying"

  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] bg-black/60 dark:bg-black/80 text-white shadow-sm border border-white/10 my-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white transition-colors hover:bg-white/[.03]"
      >
        <span className={cn(
          "grid size-7 place-items-center rounded-full shrink-0 transition-colors",
          phase === "complete" ? "bg-[hsl(var(--signal))]/15 text-[hsl(var(--signal))]" : busy ? "bg-[hsl(var(--signal))]/20 text-[hsl(var(--signal))]" : "bg-white/10 text-white"
        )}>
          <Icon aria-hidden className={cn("size-3.5", busy && "animate-spin motion-reduce:animate-none")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium font-mono">{name}</span>
          {target && (
            <span className="font-mono block truncate text-[10px] text-white/50">
              {target}
            </span>
          )}
        </span>
        {durationMs !== undefined && (
          <span className="font-mono text-[10px] text-white/40 tabular-nums">{ms(durationMs)}</span>
        )}
        <span className={cn(
          "font-mono text-[10px] uppercase tracking-wider transition-colors font-semibold",
          phase === "complete" ? "text-[hsl(var(--signal))]" : busy ? "text-[hsl(var(--signal))]" : "text-white/65"
        )}>
          {meta.label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 text-white/50 transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>

      <div className="px-4 pb-2.5">
        <SegmentedTracker segments={lifecycleSegments(phase)} label={`${name}: ${meta.label}`} />
        <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-white/80 line-clamp-2">{summary}</p>
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
