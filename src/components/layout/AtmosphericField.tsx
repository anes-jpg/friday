import mountainHalftone from "@/assets/images/mountain-halftone.png"
import { cn } from "@/lib/utils"
type AtmosphericFieldProps = { className?: string; density?: number; imageOpacity?: number }
/** Bitmap halftone scenery; no animated grain or continuous render work. */
export function AtmosphericField({ className }: AtmosphericFieldProps) {
  return <div aria-hidden="true" className={cn("atmospheric-field pointer-events-none absolute inset-0 overflow-hidden", className)}>
    <img src={mountainHalftone} alt="" draggable={false} />
  </div>
}
