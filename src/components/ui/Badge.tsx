import * as React from "react";
import { cn } from "@/lib/utils";

export type RiskTier = "Green" | "Amber" | "Red";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier?: RiskTier;
  variant?: "neutral" | "acid" | "warn" | "fail";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  tier,
  variant,
  size = "md",
  children,
  ...props
}) => {
  let resolvedVariant = variant || "neutral";

  if (tier === "Green") resolvedVariant = "acid";
  if (tier === "Amber") resolvedVariant = "warn";
  if (tier === "Red") resolvedVariant = "fail";

  const styles = {
    neutral: "bg-[var(--color-plate)] text-[var(--color-text)] border border-[var(--color-edge)]",
    acid: "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border border-[oklch(78%_0.19_152_/_0.3)]",
    warn: "bg-[oklch(72%_0.17_62_/_0.15)] text-[var(--color-warn)] border border-[oklch(72%_0.17_62_/_0.3)]",
    fail: "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)] border border-[oklch(63%_0.21_25_/_0.3)]",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px] font-mono tracking-wider uppercase",
    md: "px-2 py-0.5 text-[var(--text-micro)] font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-control)] select-none",
        styles[resolvedVariant],
        sizes[size],
        className
      )}
      {...props}
    >
      {tier && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tier === "Green" && "bg-[var(--color-acid)]",
            tier === "Amber" && "bg-[var(--color-warn)]",
            tier === "Red" && "bg-[var(--color-fail)]"
          )}
        />
      )}
      {children || tier}
    </span>
  );
};
