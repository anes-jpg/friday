import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

export const Kbd: React.FC<KbdProps> = ({ className, children, ...props }) => {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center h-5 px-1.5 min-w-[20px] font-mono text-[10px] text-[var(--color-mute)] bg-[var(--color-plate)] border border-[var(--color-edge)] rounded-[4px] shadow-sm select-none",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
};
