import { useEffect, useState } from "react"
import { useFriday } from "@/lib/store"
import { isDesktop } from "@/lib/ipc"
import { Plus, Play, X, RefreshCw, Trash2 } from "lucide-react"
import { ReminderEditor, ReminderHistory } from "./ReminderEditor"
import type { Automation } from "@/lib/types"

export function AutomationsTab() {
  const automations = useFriday((state) => state.automations)
  const [loading, setLoading] = useState(isDesktop)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Automation | null>(null)
  const [name, setName] = useState("")
  const [expr, setExpr] = useState("0 9 * * 1-5")
  const [tool, setTool] = useState("notify.toast")
  const [message, setMessage] = useState("")
  const reload = async () => {
    setLoading(true); setError(null)
    try { await useFriday.getState().loadAutomationsFromBackend() }
    catch (reason) { setError(String(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!isDesktop) return
    let disposed = false
    const refresh = () => useFriday.getState().loadAutomationsFromBackend().catch((reason: unknown) => {
      if (!disposed) setError(String(reason))
    }).finally(() => { if (!disposed) setLoading(false) })
    void refresh()
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, 15000)
    return () => { disposed = true; clearInterval(timer) }
  }, [])
  const action = async (id: string, operation: () => Promise<unknown>) => {
    setBusy(id); setError(null)
    try { await operation(); await useFriday.getState().loadAutomationsFromBackend() }
    catch (reason) { setError(String(reason)); await useFriday.getState().loadAutomationsFromBackend().catch(() => {}) }
    finally { setBusy(null) }
  }
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy("create"); setError(null)
    try {
      await useFriday.getState().addAutomation({
        name: name.trim(), trigger: { type: "cron", expr: expr.trim(), tz: "UTC" },
        actionTool: tool, actionArgs: JSON.stringify(tool === "notify.toast" ? { message: message.trim() } : {}), enabled: true,
      })
      setAdding(false); setName(""); setMessage("")
    } catch (reason) { setError(String(reason)) }
    finally { setBusy(null) }
  }
  return (
    <section className="records-workspace">
      <header className="records-heading"><div><span className="instrument-label">Recurring work</span><h1 className="page-heading">Automations</h1><p>Reminders and checks that run while FRIDAY is open.</p></div><div className="flex gap-2"><button type="button" className="quiet-action" aria-label="Refresh automations" disabled={!isDesktop || loading} onClick={() => void reload()}><RefreshCw size={16} /></button><button type="button" className="primary-action" disabled={!isDesktop} onClick={() => { setError(null); setEditingId(undefined); setAdding(true) }}><Plus size={16} />New automation</button></div></header>
      <div className="automation-summary"><span>{automations.filter((auto) => auto.enabled).length} enabled</span><span>{automations.length} saved</span><span>New schedules: Africa/Algiers · existing UTC schedules retained</span></div>
      {!isDesktop && <p className="records-note">Scheduled actions are available in the Windows app.</p>}
      {error && !adding && !deleting && <p role="alert" className="settings-notice is-error">{error}</p>}
      {loading && automations.length === 0 ? <p className="records-note" role="status">Reading schedules…</p> : automations.length === 0 ? <div className="records-empty"><span className="instrument-label">No schedules yet</span><h2>Make room for routine.</h2><p>Create a reminder, check your system, or capture a list of open windows on a recurring schedule.</p></div> : <div className="automation-list">
        <div className="automation-columns instrument-label"><span>Action</span><span>Schedule / next run</span><span>Last attempt</span><span>Controls</span></div>
        {automations.map((auto) => <article key={auto.id} className="automation-row">
          <div className="automation-name"><strong>{auto.name}</strong><small>{auto.actionSummary}</small><span className="instrument-label">{auto.enabled ? "Enabled" : "Paused"}</span></div>
          <div className="automation-schedule"><code>{auto.triggerExpr}</code><small>{auto.trigger.type === "cron" ? auto.trigger.tz : "Event"}</small><small>{auto.enabled && auto.next_run ? new Date(auto.next_run).toLocaleString() : auto.enabled ? "Schedule unavailable" : "No upcoming run"}</small></div>
          <div className="automation-result"><span>{auto.last_run ? new Date(auto.last_run).toLocaleString() : "No attempts yet"}</span>{auto.lastResult && <details><summary>{auto.lastResult.startsWith("Failed:") ? "Failed · view error" : auto.lastResult === "Running" ? "Running" : "Completed · view result"}</summary><pre>{auto.lastResult}</pre></details>}</div>
          <div className="automation-controls"><button type="button" className="quiet-action" disabled={busy !== null || auto.lastResult === "Running"} onClick={() => { setEditingId(auto.id); setAdding(true) }}>Edit</button><button type="button" className="quiet-action" onClick={() => setHistoryId(auto.id)}>History</button><button type="button" role="switch" aria-label={`Enable ${auto.name}`} aria-checked={auto.enabled} disabled={busy !== null || !isDesktop} className={`settings-switch ${auto.enabled ? "is-on" : ""}`} onClick={() => void action(auto.id, () => useFriday.getState().toggleAutomation(auto.id))}><span /></button><button type="button" className="quiet-action" aria-label={`Run ${auto.name} now`} disabled={busy !== null || !isDesktop || auto.lastResult === "Running"} onClick={() => void action(auto.id, () => useFriday.getState().runAutomationNow(auto.id))}><Play size={14} />{busy === auto.id ? "Working…" : "Run"}</button><button type="button" className="quiet-action" aria-label={`Delete ${auto.name}`} disabled={busy !== null || auto.lastResult === "Running"} onClick={() => { setError(null); setDeleting(auto) }}><Trash2 size={14} /></button></div>
        </article>)}
      </div>}
      <p className="records-note mt-6">Missed schedules run once when FRIDAY reopens. Actions that need confirmation belong in a conversation.</p>
      {adding && <ReminderEditor id={editingId} onClose={() => setAdding(false)} onSaved={reload} />}
      {historyId && <ReminderHistory id={historyId} onClose={() => setHistoryId(null)} />}
      {deleting && <div className="monitor-modal" role="dialog" aria-modal="true" aria-labelledby="automation-delete-title"><div className="records-dialog"><h2 id="automation-delete-title" className="page-heading">Delete automation?</h2><p>“{deleting.name}” will stop running. This cannot be undone.</p>{error && <p className="settings-notice is-error" role="alert">{error}</p>}<div className="records-modal-actions"><button type="button" className="quiet-action" disabled={busy !== null} onClick={() => setDeleting(null)} autoFocus>Keep automation</button><button type="button" className="primary-action" disabled={busy !== null} onClick={() => void action(deleting.id, async () => { await useFriday.getState().deleteAutomation(deleting.id); setDeleting(null) })}>Delete automation</button></div></div></div>}
    </section>
  )
}
export default AutomationsTab
