/** FRIDAY Iron Legion Swarm DAG Overlay (§07 & Blueprint §7)
 *
 * Visualizes parallel 4-worker Tokio sub-agent orchestration:
 * - Scout (Web & Docs Intelligence)
 * - Architect (Beast AST & Call-Graph)
 * - Sentinel (Security & Constitutional Integrity)
 * - Operator (Windows UIA Actuation)
 *
 * Strict Surface Law, One-Signal Law, Tabular Numerals, and Framer Motion spring physics.
 */

import React from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Compass,
  Code2,
  ShieldCheck,
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type LegionRole = "Scout" | "Architect" | "Sentinel" | "Operator"
export type LegionTaskStatus = "Pending" | "Running" | "Completed" | "Failed"

export interface LegionNode {
  id: string
  role: LegionRole
  status: LegionTaskStatus
  task: string
  output?: string
  latency_ms: number
  dependencies: string[]
}

export interface LegionSwarmPlan {
  id: string
  goal: string
  nodes: LegionNode[]
  start_time: number
  total_duration_ms: number
  completed: boolean
}

export interface LegionSwarmOverlayProps {
  plan: LegionSwarmPlan | null
  onDismiss?: () => void
  className?: string
}

const ROLE_ICONS: Record<LegionRole, React.ComponentType<{ className?: string }>> = {
  Scout: Compass,
  Architect: Code2,
  Sentinel: ShieldCheck,
  Operator: Bot,
}

const ROLE_COLORS: Record<LegionRole, string> = {
  Scout: "text-blue-400 border-blue-500/20 bg-blue-500/10",
  Architect: "text-[hsl(var(--ink))] border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))]",
  Sentinel: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
  Operator: "text-[hsl(var(--signal))] border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10",
}

export const LegionSwarmOverlay: React.FC<LegionSwarmOverlayProps> = ({
  plan,
  onDismiss,
  className,
}) => {
  if (!plan) return null

  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[#090A0C]/90 backdrop-blur-md p-4 text-[hsl(var(--ink))] shadow-2xl select-none",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--signal))]/15 border border-[hsl(var(--signal))]/30 text-[hsl(var(--signal))]">
            <Layers className="size-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-xs tracking-tight text-[hsl(var(--ink))]">
                Iron Legion Swarm Protocol
              </h4>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase px-1.5 py-0.5 rounded",
                  plan.completed
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-[hsl(var(--signal))]/20 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 animate-pulse"
                )}
              >
                {plan.completed ? "Consensus Landed" : "Active DAG"}
              </span>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted))] line-clamp-1 mt-0.5">
              {plan.goal}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[hsl(var(--muted))] tabular-nums">
            <Clock className="size-3.5" />
            <span>{plan.total_duration_ms}ms</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] px-2 py-1 rounded-[var(--radius-control)] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* DAG Worker Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 relative">
        <AnimatePresence mode="popLayout">
          {plan.nodes.map((node, index) => {
            const Icon = ROLE_ICONS[node.role] || Bot
            const isRunning = node.status === "Running"
            const isDone = node.status === "Completed"
            const isFailed = node.status === "Failed"

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 480,
                  damping: 32,
                  delay: index * 0.05,
                }}
                className={cn(
                  "relative p-3.5 rounded-[var(--radius-panel)] border transition-all flex flex-col justify-between h-44",
                  isRunning
                    ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/5 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    : isDone
                    ? "border-white/10 bg-[#12151B]/80"
                    : "border-white/5 bg-[#0D1016]/50 opacity-60"
                )}
              >
                <div>
                  {/* Top node badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "p-1 rounded-[var(--radius-control)] border",
                          ROLE_COLORS[node.role]
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-[hsl(var(--ink))]">
                        {node.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isRunning && (
                        <Loader2 className="size-3 text-[hsl(var(--signal))] animate-spin" />
                      )}
                      {isDone && (
                        <CheckCircle2 className="size-3.5 text-white" />
                      )}
                      {isFailed && (
                        <AlertCircle className="size-3.5 text-rose-400" />
                      )}
                      <span className="font-mono text-[9px] uppercase text-[hsl(var(--muted))]">
                        {node.status}
                      </span>
                    </div>
                  </div>

                  {/* Task narrative */}
                  <p className="text-[11px] text-[hsl(var(--muted))] line-clamp-3 leading-relaxed">
                    {node.task}
                  </p>
                </div>

                {/* Bottom Node Output / Metrics */}
                <div className="pt-2 border-t border-white/5 mt-2">
                  {node.output ? (
                    <p className="font-mono text-[10px] text-[hsl(var(--ink))] line-clamp-2 leading-tight">
                      {node.output}
                    </p>
                  ) : (
                    <span className="font-mono text-[10px] text-white/30 italic">
                      Awaiting Tokio stream...
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-[hsl(var(--muted))] tabular-nums">
                    <span>DAG ID: {node.id.replace("node-", "")}</span>
                    <span>{node.latency_ms}ms</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
