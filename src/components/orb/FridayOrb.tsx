import React from "react"
import { useFriday } from "@/lib/store"
import { Orb } from "./orb"
import { halftone } from "./renders"
import type { OrbState, OrbVariant, OrbShape, OrbRender } from "./orb-core"
import { cn } from "@/lib/utils"

export interface FridayOrbProps {
  /** Override the automatic Zustand store state */
  state?: OrbState
  /** Specific visual variant of the state */
  variant?: OrbVariant
  /** Diameter in pixels (default: 28) */
  size?: number
  /** Speed multiplier (default: 1) */
  speed?: number
  /** Whether to use the Atmospheric Halftone print screen render (default: false for crisp 3D dots) */
  halftoneMode?: boolean
  /** Custom 3D shape (cube, octahedron, etc.) */
  shape?: OrbShape
  /** Custom render style */
  render?: OrbRender
  /** Pause animation */
  paused?: boolean
  /** Extra Tailwind classes */
  className?: string
  /** Screen reader label */
  label?: string
  /** Click handler (e.g. toggle mic) */
  onClick?: () => void
  /** Dot size multiplier (default: 1.15) */
  dotSize?: number
  /** Dot density multiplier (default: 1) */
  density?: number
}

/**
 * FRIDAY Reactive Thinking Orb.
 *
 * Sourced from thinkingorbs.com (MIT License).
 * Adapts agent states:
 * - base: Idle calm 3D spin
 * - waiting: Listening / comet scanning
 * - reasoning: Thinking / wandering sparks
 * - working: Tool calling / speaking / gyro
 */
export function FridayOrb({
  state: explicitState,
  variant: explicitVariant,
  size = 28,
  speed = 1.25,
  halftoneMode = false,
  dotSize = 1.2,
  density = 1,
  shape,
  render,
  paused = false,
  className,
  label,
  onClick,
}: FridayOrbProps) {
  const storeOrb = useFriday((s) => s.orb)

  // Map FRIDAY's agent store state to Thinking Orbs state & variant
  let targetState: OrbState = "base"
  let targetVariant: OrbVariant | undefined = undefined
  let isIdle = false

  if (explicitState) {
    targetState = explicitState
    targetVariant = explicitVariant
    isIdle = targetState === "base"
  } else {
    switch (storeOrb) {
      case "listening":
        targetState = "waiting"
        targetVariant = "default"
        break
      case "thinking":
        targetState = "reasoning"
        targetVariant = "twins"
        break
      case "speaking":
        targetState = "working"
        targetVariant = "gyro"
        break
      case "idle":
      default:
        targetState = "base"
        targetVariant = "default"
        isIdle = true
        break
    }
  }

  // Active signal styling when busy
  const activeColor = isIdle
    ? "text-zinc-200 dark:text-zinc-100 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
    : "text-[hsl(var(--signal))] drop-shadow-[0_0_16px_hsl(var(--signal)/0.65)]"

  const orbProps = {
    state: targetState,
    variant: targetVariant,
    size,
    speed,
    dotSize,
    density,
    paused: paused || isIdle,
    render: render ?? (halftoneMode ? halftone : undefined),
    shape,
    label: label ?? `FRIDAY agent state: ${targetState}`,
    className: cn("transition-all duration-200 shrink-0 select-none", activeColor, className),
  } as unknown as React.ComponentProps<typeof Orb>

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? `FRIDAY Orb: ${targetState}`}
        className="cursor-pointer inline-flex items-center justify-center p-1 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal))]"
      >
        <Orb {...orbProps} />
      </button>
    )
  }

  return <Orb {...orbProps} />
}
