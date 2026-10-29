import { useMemo, useState } from "react"
import type { Fact } from "@/lib/types"
import { memoryLinks } from "@/lib/memory-graph"
import { cn } from "@/lib/utils"

const tiers: Fact["tier"][] = ["semantic", "episodic", "procedural", "document"]

export function MemoryGraph({ facts, selectedId, onSelect }: { facts: Fact[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [zoom, setZoom] = useState(1)
  const pageCount = Math.max(1, Math.ceil(facts.length / 64))
  const currentPage = Math.floor(Math.max(0, facts.findIndex(fact => fact.id === selectedId)) / 64)
  const visible = useMemo(() => facts.slice(currentPage * 64, (currentPage + 1) * 64), [facts, currentPage])
  const links = useMemo(() => memoryLinks(visible), [visible])
  const nodes = useMemo(() => {
    const buckets = tiers.map(tier => visible.filter(fact => fact.tier === tier))
    return buckets.flatMap((bucket, group) => bucket.map((fact, index) => {
      const angle = group * Math.PI / 2 - Math.PI * .75 + ((index + 1) / (bucket.length + 1)) * Math.PI / 2
      const radius = 132 + (index % 3) * 24
      return { fact, x: 260 + Math.cos(angle) * radius, y: 224 + Math.sin(angle) * radius }
    }))
  }, [visible])
  const byId = new Map(nodes.map(node => [node.fact.id, node]))
  return <div className="memory-network">
    <header><span className="instrument-label">Context constellation</span><span>{facts.length} memories · {links.length} links in view</span></header>
    <svg viewBox="0 0 520 448" className="memory-network-map" aria-label="Memory graph. Links indicate a shared subject or source.">
      <g transform={`translate(260 224) scale(${zoom}) translate(-260 -224)`}>
        {[88, 136, 184].map(radius => <circle key={radius} cx="260" cy="224" r={radius} className="memory-orbit" />)}
        {tiers.map((tier, index) => <text key={tier} x={[260, 480, 260, 40][index]} y={[24, 224, 432, 224][index]} textAnchor="middle" className="memory-tier-label">{tier}</text>)}
        {nodes.map(node => <line key={node.fact.id} x1="260" y1="224" x2={node.x} y2={node.y} className="memory-spoke" />)}
        {links.map(link => { const from = byId.get(link.from); const to = byId.get(link.to); return from && to ? <line key={`${link.from}-${link.to}-${link.kind}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={cn("memory-relation", (selectedId === link.from || selectedId === link.to) && "is-selected")}><title>{`Shared ${link.kind}`}</title></line> : null })}
        <circle cx="260" cy="224" r="32" className="memory-center" /><text x="260" y="222" textAnchor="middle" className="memory-center-label">FRIDAY</text><text x="260" y="237" textAnchor="middle" className="memory-tier-label">CONTEXT</text>
        {nodes.map(({ fact, x, y }) => <g key={fact.id} role="button" tabIndex={0} aria-label={`${fact.subject}: ${fact.value}`} aria-pressed={selectedId === fact.id} className={cn("memory-node", selectedId === fact.id && "is-selected")} onClick={() => onSelect(fact.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(fact.id) } }}>
          <title>{`${fact.subject}: ${fact.value}`}</title><circle cx={x} cy={y} r="16" className="memory-node-target" /><circle cx={x} cy={y} r={fact.pinned ? 6 : 4} /><text x={x + 10} y={y + 3}>{fact.subject.length > 16 ? `${fact.subject.slice(0, 15)}…` : fact.subject}</text>
        </g>)}
      </g>
    </svg>
    <footer><span>Links: shared subject or source · sectors: memory tiers</span><div><button type="button" aria-label="Zoom out memory graph" disabled={zoom <= .75} onClick={() => setZoom(value => Math.max(.75, value - .25))}>−</button><button type="button" aria-label="Reset memory graph zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button type="button" aria-label="Zoom in memory graph" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .25))}>+</button></div></footer>
    {pageCount > 1 && <footer><span>Page {currentPage + 1} of {pageCount} · 64 records per view</span><div><button type="button" disabled={!currentPage} onClick={() => onSelect(facts[(currentPage - 1) * 64].id)}>Previous</button><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => onSelect(facts[(currentPage + 1) * 64].id)}>Next</button></div></footer>}
  </div>
}
