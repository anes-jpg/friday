import React, { type ComponentPropsWithoutRef, type CSSProperties, type FC } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "inline-flex items-center text-[var(--color-text)]",
        "animate-shiny-text bg-[length:var(--shiny-width)_100%] bg-clip-text bg-[0_0] bg-no-repeat",
        "bg-gradient-to-r from-transparent via-[var(--color-acid)] via-50% to-transparent",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
