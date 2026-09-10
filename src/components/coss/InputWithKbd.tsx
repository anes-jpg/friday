import React, { useId } from "react";
import { Search, Mic, ArrowRight, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CossInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  shortcut?: string;
  onEnter?: () => void;
}

export const InputWithKbd = React.forwardRef<HTMLInputElement, CossInputProps>(
  ({ className, icon, shortcut, onEnter, ...props }, ref) => {
    const id = useId();

    return (
      <div className="relative flex items-center w-full group">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-mute)] group-focus-within:text-[var(--color-acid)] transition-colors">
          {icon || <Search className="w-4 h-4" />}
        </div>
        <input
          id={id}
          ref={ref}
          className={cn(
            "w-full h-9 pl-9 pr-14 rounded-[var(--radius-control)] bg-[var(--color-plate)] border border-[var(--color-edge)] text-[var(--text-body)] text-[var(--color-text)] placeholder:text-[var(--color-mute)] transition-all outline-none",
            "focus:border-[var(--color-acid)] focus:ring-1 focus:ring-[var(--color-acid)]",
            className
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
            props.onKeyDown?.(e);
          }}
          {...props}
        />
        {shortcut && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <kbd className="inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-mute)] bg-[var(--color-void)] border border-[var(--color-edge)] rounded-[4px]">
              {shortcut}
            </kbd>
          </div>
        )}
      </div>
    );
  }
);

InputWithKbd.displayName = "CossInputWithKbd";
