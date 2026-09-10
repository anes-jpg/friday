import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "neutral" | "acid" | "warn" | "fail";
  progress?: number; // 0 to 100
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  badge,
  badgeVariant = "neutral",
  progress,
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-control)] bg-[var(--color-hull)] border border-[var(--color-edge)] p-3.5 flex flex-col justify-between transition-colors hover:border-[var(--color-mute)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--text-micro)] text-[var(--color-mute)] font-medium uppercase tracking-wider">
          {title}
        </span>
        {badge && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-mono",
              badgeVariant === "acid" && "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)]",
              badgeVariant === "warn" && "bg-[oklch(72%_0.17_62_/_0.15)] text-[var(--color-warn)]",
              badgeVariant === "fail" && "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)]",
              badgeVariant === "neutral" && "bg-[var(--color-plate)] text-[var(--color-mute)]"
            )}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-xl font-semibold text-[var(--color-text)]">
          {value}
        </span>
        {unit && (
          <span className="text-[var(--text-micro)] font-mono text-[var(--color-mute)]">
            {unit}
          </span>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-2.5 h-1 w-full rounded-full bg-[var(--color-plate)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-acid)] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}

      {subtitle && (
        <p className="mt-1.5 text-[11px] text-[var(--color-mute)] truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
