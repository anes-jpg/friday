import React, { type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function MetricInstrument({
  label,
  value,
  detail,
  meter,
  className,
}: {
  label: string
  value: string
  detail?: ReactNode
  meter?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-black/10 bg-[hsl(var(--surface-raised))] p-4 select-none",
        "dark:border-white/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-instrument text-[10px] font-semibold uppercase tracking-[.11em] text-[hsl(var(--muted))]">
          {label}
        </p>
        {detail && <div className="text-xs text-[hsl(var(--muted))]">{detail}</div>}
      </div>
      <p className="font-instrument mt-2 text-[26px] leading-none tracking-[-.04em] text-[hsl(var(--ink))]">
        {value}
      </p>
      {meter && <div className="mt-4">{meter}</div>}
    </section>
  )
}

export interface TremorKpiProps {
  title: string
  metric: string | number
  unit?: string
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  progressValue?: number
  subtitle?: string
  className?: string
}

export const KpiCard: React.FC<TremorKpiProps> = ({
  title,
  metric,
  unit,
  change,
  subtitle,
  className,
}) => {
  return (
    <MetricInstrument
      label={title}
      value={unit ? `${metric} ${unit}` : String(metric)}
      detail={change ? <span>{change}</span> : subtitle ? <span>{subtitle}</span> : undefined}
      className={className}
    />
  )
}
