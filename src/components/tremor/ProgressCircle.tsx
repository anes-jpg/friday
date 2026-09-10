// Tremor ProgressCircle [v0.0.2] adapted for FRIDAY
import React from "react";
import { tv, VariantProps } from "tailwind-variants";
import { cx } from "@/lib/utils";

const progressCircleVariants = tv({
  slots: {
    background: "",
    circle: "",
  },
  variants: {
    variant: {
      default: {
        background: "stroke-[var(--color-edge)]",
        circle: "stroke-[var(--color-acid)]",
      },
      neutral: {
        background: "stroke-[var(--color-edge)]",
        circle: "stroke-[var(--color-mute)]",
      },
      warning: {
        background: "stroke-[var(--color-edge)]",
        circle: "stroke-[var(--color-warn)]",
      },
      error: {
        background: "stroke-[var(--color-edge)]",
        circle: "stroke-[var(--color-fail)]",
      },
      success: {
        background: "stroke-[var(--color-edge)]",
        circle: "stroke-[var(--color-acid)]",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface ProgressCircleProps
  extends Omit<React.SVGProps<SVGSVGElement>, "value">,
    VariantProps<typeof progressCircleVariants> {
  value?: number;
  max?: number;
  showAnimation?: boolean;
  radius?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export const ProgressCircle = React.forwardRef<SVGSVGElement, ProgressCircleProps>(
  (
    {
      value = 0,
      max = 100,
      radius = 28,
      strokeWidth = 5,
      showAnimation = true,
      variant,
      className,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const safeValue = Math.min(max, Math.max(value, 0));
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = ((max - safeValue) / max) * circumference;

    const { background, circle } = progressCircleVariants({ variant });

    return (
      <div
        className={cx("relative flex items-center justify-center shrink-0", className)}
      >
        <svg
          ref={forwardedRef}
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="-rotate-90 transform"
          {...props}
        >
          <circle
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeWidth={strokeWidth}
            fill="transparent"
            stroke=""
            strokeLinecap="round"
            className={cx(background())}
          />
          <circle
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            fill="transparent"
            stroke=""
            strokeLinecap="round"
            className={cx(
              circle(),
              showAnimation && "transition-all duration-300 ease-in-out"
            )}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center font-mono">
          {children}
        </div>
      </div>
    );
  }
);

ProgressCircle.displayName = "TremorProgressCircle";
