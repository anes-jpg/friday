import { useEffect, useState } from "react"
import { useFriday } from "@/lib/store"
import { isDesktop } from "@/lib/ipc"
import { Search, Plus, Trash2, X, List, Globe2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MemoryGraph } from "@/components/memory/MemoryGraph"
import { BlockReveal } from "@/components/ui/block-reveal"
import { memoryLabel } from "@/lib/memory-graph"

export function MemoryTab() {
  const facts = useFriday((state) => state.facts)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "globe">("globe")
  const [loading, setLoading] = useState(isDesktop)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState("")
  const [value, setValue] = useState("")
  useEffect(() => {
    const select = (id: string) => { setQuery(""); setSelectedId(id); sessionStorage.removeItem("friday-open-memory") }
    const pending = sessionStorage.getItem("friday-open-memory")
    if (pending) select(pending)
    const open = (event: Event) => { if (event instanceof CustomEvent && typeof event.detail === "string") select(event.detail) }
    window.addEventListener("friday:open-memory", open)
    return () => window.removeEventListener("friday:open-memory", open)
  }, [])
  useEffect(() => {
    if (!isDesktop) return
    let disposed = false
    useFriday.getState().loadFactsFromBackend().catch((reason: unknown) => {
      if (!disposed) setError(String(reason))
    }).finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true }
  }, [])
  const filtered = facts.filter((fact) => (fact.subject + " " + fact.value).toLowerCase().includes(query.toLowerCase()))
  const selected = filtered.find((fact) => fact.id === selectedId) ?? filtered[0]
  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const fact = await useFriday.getState().addFactToBackend(subject.trim(), value.trim())
      setSelectedId(fact.id); setSubject(""); setValue(""); setAdding(false)
    } catch (reason) { setError(String(reason)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!selected) return
    setBusy(true); setError(null)
    try { await useFriday.getState().deleteFact(selected.id); setDeleting(false); setSelectedId(null) }
    catch (reason) { setError(String(reason)) }
    finally { setBusy(false) }
  }
  return (
    <section className="records-workspace memory-workspace">
      <header className="records-heading"><div><span className="instrument-label">Saved context</span><h1 className="page-heading">Memory</h1><p>What FRIDAY remembers about your work.</p></div><button type="button" className="primary-action" disabled={!isDesktop} onClick={() => { setError(null); setAdding(true) }}><Plus size={16} />Add memory</button></header>
      <div className="records-toolbar"><label className="records-search"><Search size={16} /><input aria-label="Search memory" placeholder="Find a fact or preference" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="records-view"><button type="button" aria-label="List view" aria-pressed={view === "list"} className={cn(view === "list" && "is-selected")} onClick={() => setView("list")}><List size={16} /></button><button type="button" aria-label="Graph view" aria-pressed={view === "globe"} className={cn(view === "globe" && "is-selected")} onClick={() => setView("globe")}><Globe2 size={16} /></button></div><span className="instrument-label">{filtered.length} {filtered.length === 1 ? "record" : "records"}</span></div>
      {error && !adding && !deleting && <p className="settings-notice is-error" role="alert">{error}</p>}
      {!isDesktop && <p className="records-note">Saved memory is available in the Windows app.</p>}
      {!loading && filtered.length === 0 ? <div className="records-empty"><span className="instrument-label">{query ? "No matches" : "A clean slate"}</span><h2>{query ? "Try another search." : "Keep the useful details."}</h2><p>{query ? "Search by subject or by the saved text." : "Save a preference here, or ask FRIDAY to remember it during a conversation."}</p></div> : <div className={cn("memory-composition", view === "globe" && "has-globe")}>
        {view === "globe" && <BlockReveal loading={loading && !facts.length} label="Reading memory graph" className="memory-stage"><MemoryGraph facts={filtered} selectedId={selected?.id} onSelect={setSelectedId} /></BlockReveal>}
        <BlockReveal loading={loading && !facts.length} label="Reading saved records" className="memory-list" lines={6}><div role="list" aria-label="Memory records">{filtered.map((fact) => <div role="listitem" key={fact.id}><button type="button" className={cn("memory-row", selected?.id === fact.id && "is-selected")} onClick={() => setSelectedId(fact.id)}><span>{memoryLabel(fact)}</span><p>{fact.value}</p><small>{new Date(fact.created_at).toLocaleDateString()}</small></button></div>)}</div></BlockReveal>
        {selected && <aside className="memory-detail"><span className="instrument-label">Selected record</span><h2>{memoryLabel(selected)}</h2><p>{selected.value}</p><dl><div><dt>Saved</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div><div><dt>Source</dt><dd>{selected.source_message_id === "user-direct" ? "Added by you" : selected.source_message_id || "Saved context"}</dd></div><div><dt>Confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div></dl><button type="button" className="quiet-action" disabled={!isDesktop} onClick={() => { setError(null); setDeleting(true) }}><Trash2 size={14} />Delete memory</button></aside>}
      </div>}
      {adding && <div className="monitor-modal" role="dialog" aria-modal="true" aria-labelledby="memory-add-title"><form onSubmit={(event) => void add(event)}><header><h2 id="memory-add-title" className="page-heading">Add memory</h2><button type="button" aria-label="Close" disabled={busy} onClick={() => setAdding(false)} autoFocus><X size={20} /></button></header><label className="settings-field">Subject<input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Writing preferences" /></label><label className="settings-field">Remember<textarea className="records-textarea" required maxLength={8000} rows={4} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Use short paragraphs and plain language." /></label>{error && <p className="settings-notice is-error" role="alert">{error}</p>}<div className="records-modal-actions"><button type="button" className="quiet-action" disabled={busy} onClick={() => setAdding(false)}>Cancel</button><button type="submit" className="primary-action" disabled={busy || !subject.trim() || !value.trim()}>{busy ? "Saving…" : "Save memory"}</button></div></form></div>}
      {deleting && selected && <div className="monitor-modal" role="dialog" aria-modal="true" aria-labelledby="memory-delete-title"><div className="records-dialog"><h2 id="memory-delete-title" className="page-heading">Delete this memory?</h2><p>{selected.value}</p><p className="records-note">This removes the saved fact. It cannot be undone.</p>{error && <p className="settings-notice is-error" role="alert">{error}</p>}<div className="records-modal-actions"><button type="button" className="quiet-action" disabled={busy} onClick={() => setDeleting(false)} autoFocus>Keep memory</button><button type="button" className="primary-action" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete memory"}</button></div></div></div>}
    </section>
  )
}
export default MemoryTab
