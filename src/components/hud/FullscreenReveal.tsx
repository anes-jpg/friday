import { useEffect, useRef } from "react"
import { ContourCore } from "@/components/orb/ContourCore"

export function FullscreenReveal({ onComplete }: { onComplete: () => void }) {
  const complete = useRef(onComplete)
  complete.current = onComplete
  useEffect(() => {
    const timer = setTimeout(() => complete.current(), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800)
    return () => clearTimeout(timer)
  }, [])
  return <div className="fullscreen-reveal" role="status" aria-label="Fullscreen boot animation">
    <div className="fullscreen-gate gate-left" /><div className="fullscreen-gate gate-right" />
    <div className="fullscreen-mark">
      <pre className="boot-ascii" aria-hidden="true">{`          · : + # + : ·\n       · + # ░ ░ ░ # + ·\n     : # ░  ┌─────┐  ░ # :\n    + ░     │  F  │     ░ +\n     : # ░  └─────┘  ░ # :\n       · + # ░ ░ ░ # + ·\n          · : + # + : ·`}</pre>
      <ContourCore staticMark /><span>FRIDAY.</span><small>Workspace expanded</small>
      <div className="boot-register" aria-hidden="true"><span>01 / CONTEXT</span><span>02 / WORKSPACE</span><span>03 / READY</span></div>
    </div>
  </div>
}
