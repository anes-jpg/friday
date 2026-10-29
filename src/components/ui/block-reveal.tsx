import { useEffect, useState, type ReactNode } from "react"
import { AsciiReveal } from "ascii-reveal"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { useSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

/** Decode the block that arrived, keeping already loaded blocks usable on refresh. */
export function BlockReveal({ children, loading = false, label = "Loading content", className }: {
  children?: ReactNode; loading?: boolean; label?: string; className?: string; lines?: number
}) {
  const reduced = useSettings(state => state.saved.appearance.reducedMotion)
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setSystemReduced(media.matches)
    update(); media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  const content = loading ? <><AsciiLoader label={label} active={!reduced && !systemReduced} className="block-pending" />{children}</> : children
  return loading || reduced || systemReduced
    ? <div className={cn("block-reveal", className)} aria-busy={loading}>{content}</div>
    : <AsciiReveal className={cn("block-reveal", className)} preset="decode" speed={3.25} duration="fast" origin="top-left" shimmer={false} lazy={false} fallback aria-busy={false}>{content}</AsciiReveal>
}
