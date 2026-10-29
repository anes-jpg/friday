import { useFriday } from "@/lib/store"
import { cn } from "@/lib/utils"
import terrainCore from "@/assets/images/terrain-core.svg"

/** A static terrain instrument. Activity changes opacity, never spins an idle loop. */
export function ContourCore({ large = false, staticMark = false, className }: { large?: boolean; staticMark?: boolean; className?: string }) {
  const state = useFriday((s) => s.orb)
  return <span className={cn("contour-core", large && "contour-core-large", !staticMark && state !== "idle" && "contour-core-active", className)} data-state={staticMark ? "idle" : state}>
    <img key={staticMark ? "idle" : state} src={terrainCore} alt={staticMark ? "FRIDAY terrain core" : `FRIDAY ${state}`} draggable={false} />
    {!staticMark && <span className="contour-state-ring" aria-hidden="true" />}
  </span>
}
