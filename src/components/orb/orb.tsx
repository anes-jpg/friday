"use client"

import React, { useEffect, useRef } from "react"
import {
  mountOrb,
  type OrbLook,
  type OrbOptions,
  type OrbRender,
  type OrbShape,
  type OrbState,
  type OrbVariant,
} from "./orb-core"

export type { OrbLook, OrbOptions, OrbRender, OrbShape, OrbState, OrbVariant }

/**
 * An animated status indicator for what an AI agent is doing: a `state`, and optionally one of that
 * state's `variant`s. It draws in the text color, so `text-*` classes tint it, and every orb is
 * tuned to read at 20px. `shape`, `render`, `density`, `dotSize` and `tilt` change how it's drawn.
 * `paused` holds it on its frame. With reduced motion it holds still.
 */
export function Orb({
  state,
  variant,
  size = 20,
  speed = 1,
  paused = false,
  label,
  shape,
  render,
  density,
  dotSize,
  tilt,
  className,
}: OrbOptions & { paused?: boolean; className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const orb = useRef<ReturnType<typeof mountOrb> | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const o = mountOrb(ref.current, {
      state,
      variant,
      size,
      speed,
      label,
      shape,
      render,
      density,
      dotSize,
      tilt,
      paused: paused || state === "base",
    } as OrbOptions)
    orb.current = o
    return () => {
      o.destroy()
      orb.current = null
    }
  }, [state, variant, size, speed, label, shape, render, density, dotSize, tilt])

  useEffect(() => {
    if (!orb.current) return
    if (paused || state === "base") orb.current.pause()
    else orb.current.play()
  }, [paused, state])

  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true }

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="currentColor"
      className={className}
      {...a11y}
    />
  )
}
