import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "hull" | "plate" | "void";
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "hull", hoverable = false, children, ...props }, ref) => {
    const variants = {
      hull: "bg-[var(--color-hull)] border border-[var(--color-edge)]",
      plate: "bg-[var(--color-plate)] border border-[var(--color-edge)]",
      void: "bg-[var(--color-void)] border border-[var(--color-edge)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-surface)] p-4 text-[var(--color-text)] transition-colors",
          variants[variant],
          hoverable && "hover:border-[var(--color-mute)] cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
