import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, suffix, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-[var(--color-mute)]">
            {icon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full h-8 px-3 rounded-[var(--radius-control)] bg-[var(--color-plate)] border border-[var(--color-edge)] text-[var(--text-body)] text-[var(--color-text)] placeholder:text-[var(--color-mute)] transition-colors focus-visible:outline-none focus-visible:border-[var(--color-acid)] focus-visible:ring-1 focus-visible:ring-[var(--color-acid)] disabled:opacity-50 disabled:cursor-not-allowed",
            icon && "pl-8",
            suffix && "pr-8",
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-2.5 flex items-center pointer-events-none text-[var(--color-mute)]">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
