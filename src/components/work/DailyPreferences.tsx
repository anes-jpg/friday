import { useState } from "react"
import { useDailyWork } from "@/lib/daily-work"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function DailyPreferences() {
  const saved = useDailyWork(state => state.preferences)
  const [draft, setDraft] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(false)
  return <section className="today-section"><h3>Daily workflow</h3><FieldGroup><Field><FieldLabel htmlFor="daily-shortcut">Quick capture shortcut</FieldLabel><Input id="daily-shortcut" value={draft.shortcut} onChange={event => { setDraft({ ...draft, shortcut: event.target.value }); setNotice(false) }} /></Field><Field><FieldLabel htmlFor="daily-timezone">Reminder timezone</FieldLabel><Input id="daily-timezone" value={draft.timezone} onChange={event => { setDraft({ ...draft, timezone: event.target.value }); setNotice(false) }} /></Field><Field><FieldLabel htmlFor="daily-launch">Launch view</FieldLabel><select id="daily-launch" className="work-select" value={draft.restoreView ? "restore" : "today"} onChange={event => { setDraft({ ...draft, restoreView: event.target.value === "restore" }); setNotice(false) }}><option value="today">Today</option><option value="restore">Restore previous view</option></select></Field></FieldGroup>{error && <p role="alert">{error}</p>}{notice && <p role="status">Saved daily preferences.</p>}<Button variant="outline" disabled={busy} onClick={() => { setBusy(true); setError(null); void useDailyWork.getState().savePreferences({ ...draft, previousView: saved.previousView }).then(() => setNotice(true)).catch(failure => setError(String(failure))).finally(() => setBusy(false)) }}>Save daily preferences</Button></section>
}
