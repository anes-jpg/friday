/**
 * Intelligent UI Layout Primitives:
 * Col, Row, Box, Grid, Card, Carousel, Divider, Spacer
 * Strict Surface Law (16px outer, 8px controls, dark plates, no inline styles, no any).
 */

import React, { useState, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface LayoutChildProps {
  children?: React.ReactNode
  className?: string
}

export const ColPrimitive: React.FC<LayoutChildProps> = ({ children, className = "" }) => {
  return <div className={`flex flex-col gap-3.5 w-full ${className}`}>{children}</div>
}

export const RowPrimitive: React.FC<LayoutChildProps> = ({ children, className = "" }) => {
  return (
    <div className={`flex flex-wrap items-center gap-3 w-full ${className}`}>
      {children}
    </div>
  )
}

export const BoxPrimitive: React.FC<LayoutChildProps> = ({ children, className = "" }) => {
  return (
    <div
      className={`rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  )
}

export const GridPrimitive: React.FC<LayoutChildProps & { columns?: number }> = ({
  children,
  columns = 2,
  className = "",
}) => {
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-1 md:grid-cols-3"
      : columns === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 md:grid-cols-2"

  return <div className={`grid ${colClass} gap-3.5 w-full ${className}`}>{children}</div>
}

export const CardPrimitive: React.FC<
  LayoutChildProps & {
    title?: string
    subtitle?: string
    badge?: string
  }
> = ({ children, title, subtitle, badge, className = "" }) => {
  const displayTitle = typeof title === "string" && title.trim() ? title : undefined
  const displaySubtitle = typeof subtitle === "string" && subtitle.trim() ? subtitle : undefined
  const displayBadge = typeof badge === "string" && badge.trim() ? badge : undefined

  return (
    <div
      className={`rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] space-y-3.5 ${className}`}
    >
      {(displayTitle || displaySubtitle || displayBadge) && (
        <div className="flex items-start justify-between border-b border-black/10 dark:border-white/[0.08] pb-3">
          <div className="space-y-0.5">
            {displayTitle && (
              <h3 className="text-sm font-semibold tracking-[-0.02em] text-[hsl(var(--ink))]">
                {displayTitle}
              </h3>
            )}
            {displaySubtitle && (
              <p className="text-xs text-[hsl(var(--muted))]">{displaySubtitle}</p>
            )}
          </div>
          {displayBadge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-black/10 dark:bg-white/10 text-[hsl(var(--ink))]">
              {displayBadge}
            </span>
          )}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export const CarouselPrimitive: React.FC<LayoutChildProps> = ({ children, className = "" }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }

  const scrollBy = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" })
      setTimeout(checkScroll, 200)
    }
  }

  return (
    <div className={`relative w-full group/carousel ${className}`}>
      {/* Scroll controls */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--muted))]">
          Gallery & Highlights
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-240)}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="p-1 rounded-lg border border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(240)}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="p-1 rounded-lg border border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none"
      >
        {children}
      </div>
    </div>
  )
}

export const DividerPrimitive: React.FC<{ className?: string }> = ({ className = "" }) => {
  return <hr className={`my-2 border-t border-black/10 dark:border-white/[0.08] ${className}`} />
}

export const SpacerPrimitive: React.FC<{ height?: number }> = ({ height = 12 }) => {
  // Respecting no inline style law via standard Tailwind spacing tokens
  const heightClass =
    height <= 4
      ? "h-1"
      : height <= 8
      ? "h-2"
      : height <= 16
      ? "h-4"
      : height <= 24
      ? "h-6"
      : "h-8"
  return <div className={`w-full ${heightClass}`} />
}
