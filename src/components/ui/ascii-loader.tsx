import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/lib/settings"

const bands = ["[ # : . . . : # ]", "[ : # : . : # : ]", "[ . : # : # : . ]", "[ . . : # : . . ]"]
const blockFrames = Array.from({ length: 4 }, (_, frame) => Array.from({ length: 7 }, (_, row) => {
  if (row === 0 || row === 6) return "+-----------------------------+"
  return `| ${Array.from({ length: 27 }, (_, column) => " .:+#"[(column * 7 + row * 3 + frame) % 5]).join("")} |`
}).join("\n"))
export const asciiCoreFrames = Array.from({ length: 4 }, (_, frame) =>
  Array.from({ length: 17 }, (_, row) => Array.from({ length: 37 }, (_, col) => {
    const x = (col - 18) / 2, y = row - 8
    const distance = Math.hypot(x, y)
    if (distance > 8.5 || distance < 2.3) return " "
    const density = Math.round(distance * 2 + Math.atan2(y, x) * 2 + frame)
    return ".:+#"[((density % 4) + 4) % 4]
  }).join("")).join("\n"))

/** Animate only while mounted for a pending operation. No canvas or idle RAF. */
export function AsciiLoader({ label, detail, variant = "compact", active = true, className }: {
  label: string; detail?: string; variant?: "compact" | "core" | "block"; active?: boolean; className?: string
}) {
  const [frame, setFrame] = useState(0)
  const userReduced = useSettings(state => state.saved.appearance.reducedMotion)
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    if (!active || reduced || userReduced) return
    const timer = setInterval(() => setFrame(current => (current + 1) % 4), 180)
    return () => clearInterval(timer)
  }, [active, reduced, userReduced])
  return <div className={cn("ascii-loader", `ascii-loader-${variant}`, active && "is-working", className)} role="status">
    <div className="ascii-glyphs" aria-hidden="true">{(variant === "core" ? asciiCoreFrames : variant === "block" ? blockFrames : bands).map((glyphs, index) => <pre key={index} className={index === (active ? frame : 0) ? "is-visible" : undefined}>{glyphs}</pre>)}</div>
    <div className="ascii-caption"><span>{label}</span>{detail && <small>{detail}</small>}</div>
  </div>
}
