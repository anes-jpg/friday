import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-acid)] disabled:opacity-50 disabled:pointer-events-none rounded-[var(--radius-control)] cursor-pointer select-none";

    const variants = {
      primary: "bg-[var(--color-acid)] text-[var(--color-void)] hover:brightness-110 active:brightness-95 font-semibold",
      secondary: "bg-[var(--color-plate)] text-[var(--color-text)] hover:bg-[var(--color-edge)] active:bg-[var(--color-hull)] border border-[var(--color-edge)]",
      ghost: "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-plate)] active:bg-[var(--color-edge)]",
      danger: "bg-[var(--color-fail)] text-white hover:brightness-110 active:brightness-95",
      outline: "bg-transparent border border-[var(--color-edge)] text-[var(--color-text)] hover:bg-[var(--color-plate)]",
    };

    const sizes = {
      sm: "h-7 px-2.5 text-[var(--text-micro)] gap-1.5",
      md: "h-8 px-3 text-[var(--text-body)] gap-2",
      lg: "h-10 px-4 text-[var(--text-input)] gap-2.5",
      icon: "h-8 w-8 p-0 shrink-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
