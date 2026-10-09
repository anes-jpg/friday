import { useId } from "react"
import skyPixel from "@/assets/images/sky-pixel.jpg"
import { cn } from "@/lib/utils"

type AtmosphericFieldProps = {
  className?: string
  density?: number
  imageOpacity?: number
}

export function AtmosphericField({
  className,
  density = 12,
  imageOpacity = 0.22,
}: AtmosphericFieldProps) {
  const patternId = useId()
  const maskId = useId()

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <img
        src={skyPixel}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover grayscale contrast-[.86] saturate-0"
        style={{ opacity: imageOpacity }}
      />

      <svg className="absolute inset-0 size-full text-black/55 dark:text-white/35">
        <defs>
          <pattern
            id={patternId}
            width={density}
            height={density}
            patternUnits="userSpaceOnUse"
          >
            <rect width="3" height="3" rx="0.5" fill="currentColor" />
          </pattern>
          <linearGradient id={maskId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.9" />
            <stop offset="0.44" stopColor="white" stopOpacity="0.18" />
            <stop offset="0.72" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${maskId}-mask`}>
            <rect width="100%" height="100%" fill={`url(#${maskId})`} />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId}-mask)`}
        />
      </svg>

      <div className="friday-noise absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_38%,transparent_0,transparent_28%,hsl(var(--canvas)/.28)_72%)]" />
    </div>
  )
}
