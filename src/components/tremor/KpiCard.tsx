import React from "react";
import { RiArrowDownSFill, RiArrowUpSFill } from "@remixicon/react";
import { cx } from "@/lib/utils";
import { Card } from "./Card";
import { ProgressCircle } from "./ProgressCircle";

export interface TremorKpiProps {
  title: string;
  metric: string | number;
  unit?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  progressValue?: number;
  subtitle?: string;
  className?: string;
}

export const KpiCard: React.FC<TremorKpiProps> = ({
  title,
  metric,
  unit,
  change,
  changeType = "positive",
  progressValue,
  subtitle,
  className,
}) => {
  return (
    <Card className={cx("p-4 flex flex-col justify-between select-none", className)}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[var(--text-micro)] font-mono uppercase tracking-wider text-[var(--color-mute)]">
            {title}
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {metric}
            </span>
            {unit && (
              <span className="font-mono text-xs text-[var(--color-mute)]">
                {unit}
              </span>
            )}
          </div>
        </div>

        {progressValue !== undefined ? (
          <ProgressCircle
            value={progressValue}
            radius={22}
            strokeWidth={4}
            variant={changeType === "negative" ? "error" : "success"}
          >
            <span className="text-[9px] text-[var(--color-mute)]">
              {progressValue}%
            </span>
          </ProgressCircle>
        ) : change ? (
          <span
            className={cx(
              changeType === "positive"
                ? "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border border-[oklch(78%_0.19_152_/_0.3)]"
                : "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)] border border-[oklch(63%_0.21_25_/_0.3)]",
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium"
            )}
          >
            {changeType === "positive" ? (
              <RiArrowUpSFill className="size-3.5 shrink-0 -ml-0.5" />
            ) : (
              <RiArrowDownSFill className="size-3.5 shrink-0 -ml-0.5" />
            )}
            {change}
          </span>
        ) : null}
      </div>

      {subtitle && (
        <p className="mt-2.5 text-[11px] text-[var(--color-mute)] font-sans truncate">
          {subtitle}
        </p>
      )}
    </Card>
  );
};
