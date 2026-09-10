// Tremor Badge [v0.0.1] adapted for FRIDAY
import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx } from "@/lib/utils";

const badgeVariants = tv({
  base: cx(
    "inline-flex items-center gap-x-1 whitespace-nowrap rounded-[var(--radius-control)] px-2 py-0.5 text-xs font-mono font-medium border"
  ),
  variants: {
    variant: {
      default: "bg-[var(--color-plate)] text-[var(--color-text)] border-[var(--color-edge)]",
      neutral: "bg-[var(--color-plate)] text-[var(--color-mute)] border-[var(--color-edge)]",
      success: "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border-[oklch(78%_0.19_152_/_0.3)]",
      warning: "bg-[oklch(72%_0.17_62_/_0.15)] text-[var(--color-warn)] border-[oklch(72%_0.17_62_/_0.3)]",
      error: "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)] border-[oklch(63%_0.21_25_/_0.3)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface TremorBadgeProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof badgeVariants> {}

const TremorBadge = React.forwardRef<HTMLSpanElement, TremorBadgeProps>(
  ({ className, variant, ...props }, forwardedRef) => {
    return (
      <span
        ref={forwardedRef}
        className={cx(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

TremorBadge.displayName = "TremorBadge";

export { TremorBadge, badgeVariants, type TremorBadgeProps };
