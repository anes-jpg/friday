/**
 * Intelligent UI Typography Primitives:
 * Title, Text, Badge, List, ListItem
 * Optical polish: tabular numbers, font hierarchy, sub-frame animation transitions.
 */

import React from "react"
import { Check, Clock, Circle } from "lucide-react"

export const TitlePrimitive: React.FC<{
  title: string
  subtitle?: string
  badge?: string
}> = ({ title, subtitle, badge }) => {
  return (
    <div className="flex items-start justify-between gap-3 w-full">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-[hsl(var(--ink))]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[hsl(var(--muted))] leading-relaxed">{subtitle}</p>
        )}
      </div>
      {badge && (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-black/10 dark:bg-white/10 text-[hsl(var(--ink))] border border-black/5 dark:border-white/5 shrink-0">
          {badge}
        </span>
      )}
    </div>
  )
}

export const TextPrimitive: React.FC<{
  content: string | React.ReactNode
  variant?: "body" | "caption" | "lead"
}> = ({ content, variant = "body" }) => {
  const cls =
    variant === "caption"
      ? "text-[11px] text-[hsl(var(--muted))] leading-normal font-sans"
      : variant === "lead"
      ? "text-[14px] text-[hsl(var(--ink))] leading-relaxed font-normal"
      : "text-[13px] text-[hsl(var(--ink))]/90 leading-relaxed font-sans"

  return <p className={cls}>{content}</p>
}

export const BadgePrimitive: React.FC<{
  text: string
  variant?: "neutral" | "signal" | "amber" | "rose" | "blue" | "success"
}> = ({ text, variant = "neutral" }) => {
  const styles =
    variant === "success"
      ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
      : variant === "signal"
      ? "bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] border-[hsl(var(--signal))]/25"
      : variant === "amber"
      ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
      : variant === "rose"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
      : variant === "blue"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
      : "bg-black/10 dark:bg-white/10 text-[hsl(var(--muted))] border-black/5 dark:border-white/5"

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wider border ${styles}`}
    >
      {text}
    </span>
  )
}

export const ListPrimitive: React.FC<{
  children?: React.ReactNode
  title?: string
}> = ({ children, title }) => {
  return (
    <div className="space-y-2 w-full">
      {title && (
        <div className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--muted))] flex items-center gap-1.5 pb-1 border-b border-black/10 dark:border-white/[0.06]">
          <Clock className="size-3 text-[hsl(var(--muted))]" />
          <span>{title}</span>
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export interface ListItemProps {
  label: string
  title: string
  description?: string
  status?: "done" | "active" | "upcoming"
  tag?: string
  onToggle?: () => void
}

export const ListItemPrimitive: React.FC<ListItemProps> = ({
  label,
  title,
  description,
  status = "upcoming",
  tag,
  onToggle,
}) => {
  const isActive = status === "active"
  const isDone = status === "done"

  return (
    <div
      onClick={onToggle}
      className={`group/item flex items-start gap-3 p-3 rounded-xl border transition-all ${
        isActive
          ? "border-[hsl(var(--signal))]/40 bg-[hsl(var(--signal))]/5 shadow-sm"
          : isDone
          ? "border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 opacity-80"
          : "border-black/5 dark:border-white/5 bg-black/10 dark:bg-black/25 hover:border-black/10 dark:hover:border-white/10"
      } ${onToggle ? "cursor-pointer" : ""}`}
    >
      {/* Time or Step badge */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <span
          className={`font-mono text-[10.5px] font-medium tabular-nums ${
            isActive
              ? "text-[hsl(var(--signal))]"
              : isDone
              ? "text-[hsl(var(--success))]"
              : "text-[hsl(var(--muted))]"
          }`}
        >
          {label}
        </span>
        <div className="mt-1 flex items-center justify-center">
          {isDone ? (
            <div className="size-4 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center text-[hsl(var(--success))]">
              <Check className="size-2.5" />
            </div>
          ) : isActive ? (
            <div className="size-4 rounded-full bg-[hsl(var(--signal))]/20 flex items-center justify-center">
              <span className="size-1.5 rounded-full bg-[hsl(var(--signal))] animate-pulse" />
            </div>
          ) : (
            <Circle className="size-3 text-[hsl(var(--muted))]/50" />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs font-semibold ${
              isDone
                ? "text-[hsl(var(--muted))] line-through"
                : "text-[hsl(var(--ink))]"
            }`}
          >
            {title}
          </span>
          {tag && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/5 text-[hsl(var(--muted))] shrink-0">
              {tag}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-[11.5px] text-[hsl(var(--muted))] leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
