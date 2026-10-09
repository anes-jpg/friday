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
        "inline-block bg-clip-text text-transparent bg-gradient-to-r from-neutral-500 via-white via-50% to-neutral-500 bg-[length:200%_100%] animate-pulse",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
