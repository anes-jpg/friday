/** Console · debug drawer — §04's latency table, live.
 *
 * "You cannot hit a budget you cannot see." Each stage renders its measured p95
 * against the §04 budget, and a stage over budget renders in --danger with
 * the overage spelled out. Nothing is rounded up to look better.
 */

import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { NumberTicker } from "@/components/magic/number-ticker"
import { Progress } from "@/components/ui/progress"
import { TremorBadge } from "@/components/tremor/Badge"
import { cn, DUR, EASE } from "@/lib/utils"
import { useFriday } from "@/lib/store"
import type { LatencyStage } from "@/lib/types"

export function DebugDrawer() {
  const open = useFriday((s) => s.debugDrawerOpen)
  const toggle = useFriday((s) => s.toggleDebug)
  const latency = useFriday((s) => s.latency)
  const resources = useFriday((s) => s.resources)

  const over = latency.filter((l) => l.value!=null && l.value > l.budget).length

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: DUR.slow, ease: EASE }}
          className="shrink-0 overflow-hidden border-t border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] backdrop-blur-md select-none"
        >
          <div className="flex items-center justify-between px-8 pt-3 pb-1">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-[hsl(var(--ink))]">Pipeline Latency</h3>
              <TremorBadge
                variant={over === 0 ? "success" : "error"}
                className="text-[10px]"
              >
                {over === 0 ? "ALL STAGES WITHIN BUDGET" : `${over} STAGES OVER BUDGET`}
              </TremorBadge>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Close latency drawer"
              title="Close latency drawer"
              className="rounded-[4px] p-1 text-[hsl(var(--muted))] transition-colors hover:bg-black/5 dark:hover:bg-white/10 hover:text-[hsl(var(--ink))] cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 px-8 py-3">
            {latency.map((l) => (
              <Stage key={l.key} stage={l} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-black/10 dark:border-white/10 px-8 py-2 font-instrument text-xs text-[hsl(var(--muted))] tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--muted))]/70">CPU</span>
              <span className="text-[hsl(var(--ink))] font-medium">{resources.cpu_pct==null ? "Unavailable" : `${resources.cpu_pct.toFixed(1)}%`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--muted))]/70">RSS</span>
              <span className="text-[hsl(var(--ink))] font-medium">{resources.rss_mb==null ? "Unavailable" : `${resources.rss_mb.toFixed(1)} MB`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--muted))]/70">Thermal</span>
              <span className="text-[hsl(var(--ink))] font-medium">{resources.thermal_c==null ? "Unavailable" : `${resources.thermal_c}°C`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--muted))]/70">ASR</span>
              <TremorBadge
                variant={resources.asr_warm ? "success" : "neutral"}
                className="text-[10px] py-0 px-1.5"
              >
                {resources.asr_warm ? "WARM" : "COLD"}
              </TremorBadge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--muted))]/70">TTS</span>
              <TremorBadge
                variant={resources.tts_warm ? "success" : "neutral"}
                className="text-[10px] py-0 px-1.5"
              >
                {resources.tts_warm ? "WARM" : "COLD"}
              </TremorBadge>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Stage({ stage }: { stage: LatencyStage }) {
  const over = stage.value !=null && stage.value > stage.budget
  const pct = Math.min(100, ((stage.value ?? 0) / stage.budget) * 100)

  return (
    <div className="rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] p-2.5 transition-colors hover:border-black/20 dark:hover:border-white/20">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-instrument text-xs text-[hsl(var(--muted))]">{stage.label}</span>
        <span
          className={cn("shrink-0 font-instrument text-xs tabular-nums", over ? "text-[hsl(var(--danger))] font-medium" : "text-[hsl(var(--ink))]")}
        >
          {stage.value==null ? "Unavailable" : <NumberTicker
            value={stage.value}
            className={over ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--ink))]"}
          />}
          {stage.value!=null && <span className="text-[hsl(var(--muted))] ml-0.5">ms</span>}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          "mt-2 h-1.5 w-full bg-black/10 dark:bg-white/10",
          over ? "[&>div]:bg-[hsl(var(--danger))]" : stage.kind === "network" ? "[&>div]:bg-[hsl(var(--muted))]" : "[&>div]:bg-[hsl(var(--signal))]/70"
        )}
      />
      <div className="mt-1 flex items-center justify-between text-[10px] font-instrument text-[hsl(var(--muted))] tabular-nums">
        <span>budget {stage.budget}ms</span>
        {over ? (
          <span className="text-[hsl(var(--danger))] font-semibold">+{(stage.value ?? 0) - stage.budget}ms</span>
        ) : (
          <span className="text-[hsl(var(--muted))]/60">{stage.value==null ? "Not measured" : "Within budget"}</span>
        )}
      </div>
    </div>
  )
}
