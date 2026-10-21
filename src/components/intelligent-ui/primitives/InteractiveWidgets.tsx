/**
 * Intelligent UI Interactive Widgets:
 * Flashcard (3D flip card with question & answer),
 * Celebration (completion card),
 * Table (tabular data with sorting).
 * Strictly zero inline styles, no any.
 */

import React, { useState } from "react"
import { Sparkles, ArrowUpDown, RotateCw, CheckCircle2 } from "lucide-react"

export const FlashcardPrimitive: React.FC<{
  question: string
  answer: string
  category?: string
}> = ({ question, answer, category = "Knowledge Review" }) => {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div
      onClick={() => setIsFlipped(!isFlipped)}
      className="group/flashcard w-full h-[180px] [perspective:1000px] cursor-pointer select-none"
    >
      <div
        className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* FRONT SIDE (Question) */}
        <div className="absolute inset-0 w-full h-full rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] flex flex-col justify-between [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/20">
              {category}
            </span>
            <span className="text-[11px] font-mono text-[hsl(var(--muted))] flex items-center gap-1">
              <RotateCw className="size-3" />
              <span>Flip card</span>
            </span>
          </div>

          <div className="my-auto">
            <h4 className="text-sm font-semibold text-[hsl(var(--ink))] leading-relaxed">
              {question}
            </h4>
          </div>

          <div className="text-[10.5px] font-mono text-[hsl(var(--muted))] text-right">
            Click to reveal answer →
          </div>
        </div>

        {/* BACK SIDE (Answer) */}
        <div className="absolute inset-0 w-full h-full rounded-2xl border border-[hsl(var(--signal))]/30 bg-black/40 dark:bg-black/60 p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] flex flex-col justify-between [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Answer & Insight
            </span>
            <span className="text-[11px] font-mono text-[hsl(var(--signal))] flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              <span>Verified</span>
            </span>
          </div>

          <div className="my-auto">
            <p className="text-xs text-[hsl(var(--ink))] leading-relaxed font-sans">
              {answer}
            </p>
          </div>

          <div className="text-[10.5px] font-mono text-[hsl(var(--muted))] text-right">
            ← Click to flip back
          </div>
        </div>
      </div>
    </div>
  )
}

export const CelebrationPrimitive: React.FC<{
  title: string
  message?: string
}> = ({ title, message }) => {
  return (
    <div className="w-full p-4 rounded-2xl border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/5 flex items-center gap-3.5 shadow-sm">
      <div className="p-2 rounded-xl bg-[hsl(var(--signal))]/15 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 shrink-0">
        <Sparkles className="size-5 animate-spin" />
      </div>
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold text-[hsl(var(--ink))] tracking-tight">
          {title}
        </h4>
        {message && (
          <p className="text-[11.5px] text-[hsl(var(--muted))] leading-relaxed font-sans">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export const TablePrimitive: React.FC<{
  headers: string[]
  rows: Array<string | number>[]
  title?: string
}> = ({ headers, rows, title }) => {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState<boolean>(true)

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(colIndex)
      setSortAsc(true)
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (sortCol === null) return 0
    const valA = a[sortCol]
    const valB = b[sortCol]
    if (typeof valA === "number" && typeof valB === "number") {
      return sortAsc ? valA - valB : valB - valA
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden shadow-sm space-y-0">
      {title && (
        <div className="p-3 border-b border-black/10 dark:border-white/[0.08] text-xs font-semibold text-[hsl(var(--ink))]">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 bg-black/10 dark:bg-white/5 font-mono text-[10.5px] uppercase tracking-wider text-[hsl(var(--muted))]">
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3.5 py-2.5 font-semibold text-[hsl(var(--ink))] cursor-pointer hover:bg-white/5 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{h}</span>
                    <ArrowUpDown className="size-3 text-[hsl(var(--muted))]" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/[0.03] transition-colors last:border-0"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3.5 py-2 text-[12px] text-[hsl(var(--ink))]/90 font-mono tabular-nums whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
