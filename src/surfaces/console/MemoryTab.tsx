import React, { useState } from "react"
import { useFridayStore } from "@/lib/store"
import { MemoryGlobe } from "@/components/memory/MemoryGlobe"
import { BrainCircuit, Search, Trash2, Pin, List, Globe2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Fact } from "@/lib/types"

export const MemoryTab: React.FC = () => {
  const { facts, deleteFact, loadFactsFromBackend } = useFridayStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"split" | "list">("split")

  React.useEffect(() => {
    loadFactsFromBackend?.()
  }, [loadFactsFromBackend])

  const filteredFacts = facts.filter((f) =>
    f.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.subject.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedFact = facts.find((f) => f.id === selectedFactId) || filteredFacts[0]

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteFact(id)
    toast.success("Fact deleted from associative memory")
    if (selectedFactId === id) setSelectedFactId(null)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-hidden select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Associative Memory Map
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              SQLCIPHER · BGE-SMALL
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Auditable memory facts recalled through dense embedding vector space.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              aria-label="Globe view"
              className={cn(
                "p-1.5 rounded-[calc(var(--radius-control)-2px)] transition-colors cursor-pointer",
                viewMode === "split"
                  ? "bg-black/10 dark:bg-white/15 text-[hsl(var(--ink))]"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
              )}
            >
              <Globe2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "p-1.5 rounded-[calc(var(--radius-control)-2px)] transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-black/10 dark:bg-white/15 text-[hsl(var(--ink))]"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>

          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-[hsl(var(--muted))]" />
            <input
              type="text"
              placeholder="Search facts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] pl-8 pr-3 py-1.5 text-xs text-[hsl(var(--ink))] placeholder-[hsl(var(--muted))] focus:outline-none focus:border-[hsl(var(--signal))] font-instrument"
            />
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left: Singular Hero Object (MemoryGlobe) */}
        {viewMode === "split" && (
          <div className="flex-1 relative flex flex-col rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden min-h-0">
            <div className="absolute top-3 left-3 z-10 font-instrument text-[10px] uppercase tracking-wider text-[hsl(var(--muted))] pointer-events-none">
              3D Knowledge Topology
            </div>
            <div className="flex-1 w-full h-full min-h-[300px]">
              <MemoryGlobe
                facts={filteredFacts}
                selectedFactId={selectedFactId}
                onSelectFact={(f: Fact) => setSelectedFactId(f.id)}
                searchQuery={searchTerm}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Right / Secondary: Searchable Facts List & Detail Inspector */}
        <div
          className={cn(
            "flex flex-col gap-3 min-h-0",
            viewMode === "split" ? "w-[380px] shrink-0" : "flex-1"
          )}
        >
          {/* Selected Fact Inspector Detail Card */}
          {selectedFact && (
            <div className="p-3.5 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] font-instrument text-xs space-y-2 shrink-0">
              <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted))]">
                <span className="font-semibold uppercase tracking-wider text-[hsl(var(--signal))]">
                  ACTIVE FACT RECORD
                </span>
                <span>{(selectedFact.confidence * 100).toFixed(0)}% CONFIDENCE</span>
              </div>
              <p className="font-sans text-sm text-[hsl(var(--ink))] font-medium leading-snug">
                {selectedFact.value}
              </p>
              <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted))] pt-1 border-t border-black/5 dark:border-white/5">
                <span>Subject: {selectedFact.subject}</span>
                <span>Tier: {selectedFact.tier}</span>
              </div>
            </div>
          )}

          {/* Searchable Facts List */}
          <div className="flex-1 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredFacts.length === 0 ? (
              <div className="py-12 text-center text-xs font-instrument text-[hsl(var(--muted))]">
                No matching memory facts found.
              </div>
            ) : (
              filteredFacts.map((fact) => {
                const isSelected = selectedFact?.id === fact.id
                return (
                  <div
                    key={fact.id}
                    onClick={() => setSelectedFactId(fact.id)}
                    className={cn(
                      "p-3 rounded-[var(--radius-control)] border transition-all cursor-pointer flex items-start justify-between gap-2",
                      isSelected
                        ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/5 shadow-xs"
                        : "border-black/5 dark:border-white/5 bg-[hsl(var(--surface))] hover:border-black/20"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 font-instrument text-[10px] text-[hsl(var(--muted))]">
                        {fact.pinned && <Pin className="size-2.5 text-[hsl(var(--signal))] shrink-0" />}
                        <span className="truncate">{fact.subject}</span>
                        <span>·</span>
                        <span className="text-[hsl(var(--signal))]">
                          {(fact.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-[hsl(var(--ink))] line-clamp-2 leading-relaxed font-sans">
                        {fact.value}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(fact.id, e)}
                      title="Delete fact"
                      aria-label="Delete fact"
                      className="p-1 rounded text-[hsl(var(--muted))] hover:text-[hsl(var(--danger))] hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemoryTab
