/** FRIDAY Overwatch Whisper Toast (§06 & Blueprint §6)
 *
 * Proactive companion notification pill:
 * - Surfaces unprompted insights on copied panics, build breaks, and git conflicts
 * - Editorial Kerry Condon conversational persona
 * - Tactile spring physics via Motion with <200ms dismiss
 * - Strict adherence to the Surface Law and One-Signal Law
 */

import React from "react"
import { motion, AnimatePresence } from "motion/react"
import { AlertCircle, Terminal, GitBranch, Cpu, X, ArrowRight, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export type OverwatchCategory = "panic" | "build_error" | "thermal_alert" | "socket_anomaly" | "recommendation"

export interface OverwatchToastItem {
  id: string
  category: OverwatchCategory
  title: string
  summary: string
  suggestion: string
  codeSnippet?: string
  timestamp: number
}

export interface OverwatchWhisperToastProps {
  items: OverwatchToastItem[]
  onAccept?: (item: OverwatchToastItem) => void
  onDismiss: (id: string) => void
  className?: string
}

export const OverwatchWhisperToast: React.FC<OverwatchWhisperToastProps> = ({
  items,
  onAccept,
  onDismiss,
  className,
}) => {
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none max-w-xl w-full px-4",
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const Icon =
            item.category === "panic"
              ? ShieldAlert
              : item.category === "build_error"
              ? Terminal
              : item.category === "thermal_alert"
              ? Cpu
              : AlertCircle

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{
                type: "spring",
                stiffness: 450,
                damping: 32,
                mass: 0.8,
              }}
              className="pointer-events-auto w-full rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[#090A0C]/95 backdrop-blur-md shadow-2xl p-3.5 text-[hsl(var(--ink))] select-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-[var(--radius-control)] bg-[hsl(var(--signal))]/10 border border-[hsl(var(--signal))]/20 text-[hsl(var(--signal))] shrink-0 mt-0.5">
                    <Icon className="size-4 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs tracking-tight text-[hsl(var(--ink))]">
                        {item.title}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-[hsl(var(--muted))]">
                        Overwatch Proactive
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted))] leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                    <p className="text-xs text-[hsl(var(--ink))] font-medium mt-1">
                      {item.suggestion}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  className="p-1 rounded-[var(--radius-control)] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                  title="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {item.codeSnippet && (
                <div className="mt-2.5 p-2 rounded-[var(--radius-control)] bg-black/40 border border-white/5 font-mono text-[11px] text-[hsl(var(--muted))] overflow-x-auto whitespace-pre max-h-24">
                  {item.codeSnippet}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="font-mono text-[10px] text-[hsl(var(--muted))] tabular-nums">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    className="px-2.5 py-1 rounded-[var(--radius-control)] text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] transition-colors cursor-pointer"
                  >
                    Ignore
                  </button>
                  {onAccept && (
                    <button
                      type="button"
                      onClick={() => onAccept(item)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-control)] bg-[hsl(var(--signal))] text-white text-xs font-semibold hover:brightness-110 shadow-xs transition-all cursor-pointer"
                    >
                      <span>Fix with FRIDAY</span>
                      <ArrowRight className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
