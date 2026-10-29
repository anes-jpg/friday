import { useEffect, useState, type ReactNode } from "react"
import { AsciiReveal, AsciiSkeleton } from "ascii-reveal"
import { useSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

/** Decode the block that arrived, keeping already loaded blocks usable on refresh. */
export function BlockReveal({ children, loading = false, label = "Loading content", className, lines = 4 }: {
  children?: ReactNode; loading?: boolean; label?: string; className?: string; lines?: number
}) {
  const reduced = useSettings(state => state.saved.appearance.reducedMotion)
  const [systemReduced, setSystemReduced] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setSystemReduced(media.matches)
    update(); media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  const content = loading ? <div className="block-pending" role="status"><span className="instrument-label">{label}</span><AsciiSkeleton variant="scan" lines={lines} animate={false} /></div> : children
  return loading || reduced || systemReduced
    ? <div className={cn("block-reveal", className)} aria-busy={loading}>{content}</div>
    : <AsciiReveal className={cn("block-reveal", className)} preset="decode" speed={3.25} duration="fast" origin="top-left" shimmer={false} lazy={false} fallback aria-busy={false}>{content}</AsciiReveal>
}
