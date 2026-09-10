// Tremor Card [v0.0.2] adapted for FRIDAY OKLCH design system
import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cx } from "@/lib/utils";

interface CardProps extends React.ComponentPropsWithoutRef<"div"> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild, ...props }, forwardedRef) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={forwardedRef}
        className={cx(
          "relative w-full rounded-[var(--radius-surface)] border p-5 text-left transition-colors",
          "bg-[var(--color-hull)] border-[var(--color-edge)] text-[var(--color-text)]",
          "hover:border-[var(--color-mute)] shadow-sm",
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "TremorCard";

export { Card, type CardProps };
