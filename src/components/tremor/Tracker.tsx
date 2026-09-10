// Tremor Tracker [v0.1.3] adapted for FRIDAY latency & telemetry monitoring
import React from "react";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";
import { cx } from "@/lib/utils";

export interface TrackerBlockProps {
  key?: string | number;
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  defaultBackgroundColor?: string;
}

const Block = ({
  color,
  tooltip,
  defaultBackgroundColor = "bg-[var(--color-edge)]",
  hoverEffect = true,
}: TrackerBlockProps) => {
  const [open, setOpen] = React.useState(false);
  return (
    <HoverCardPrimitives.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={0}
      closeDelay={0}
    >
      <HoverCardPrimitives.Trigger onClick={() => setOpen(true)} asChild>
        <div className="size-full overflow-hidden px-[1px] transition first:rounded-l-[4px] first:pl-0 last:rounded-r-[4px] last:pr-0 cursor-pointer">
          <div
            className={cx(
              "h-3.5 w-full rounded-[2px]",
              color || defaultBackgroundColor,
              hoverEffect ? "hover:brightness-125 hover:scale-105 transition-all" : ""
            )}
          />
        </div>
      </HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={8}
          side="top"
          align="center"
          avoidCollisions
          className={cx(
            "w-auto rounded-[var(--radius-control)] px-2.5 py-1 text-xs shadow-xl font-mono",
            "text-[var(--color-text)] bg-[var(--color-plate)] border border-[var(--color-edge)] z-50 animate-in fade-in zoom-in-95"
          )}
        >
          {tooltip}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
};

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
}

export const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data = [], className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cx("flex h-6 items-center justify-between w-full select-none", className)}
        {...props}
      >
        {data.map((props, index) => (
          <Block key={props.key ?? index} {...props} />
        ))}
      </div>
    );
  }
);

Tracker.displayName = "TremorTracker";
