import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { invokeCommand } from "@/lib/ipc"
import type { SavedAutomation } from "@/lib/automations"

type Schedule = NonNullable<SavedAutomation["schedule"]>
export function ReminderEditor({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [tool, setTool] = useState("notify.toast")
  const [message, setMessage] = useState("")
  const [schedule, setSchedule] = useState<Schedule>({ kind: "daily", time: "09:00", date: null })
  const [timezone, setTimezone] = useState("Africa/Algiers")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = useQuery({ queryKey: ["edit-reminder", id], enabled: Boolean(id), queryFn: () => invokeCommand<SavedAutomation[]>("get_automations") })
  const preview = useQuery({ queryKey: ["reminder-preview", schedule, timezone], enabled: schedule.kind !== "once" || Boolean(schedule.date), queryFn: () => invokeCommand<{ description: string }>("preview_reminder", { schedule, timezone }) })
  useEffect(() => {
    const record = saved.data?.find(record => record.id === id)
    if (!record) return
    setName(record.name); setTool(record.action_tool); setTimezone(record.timezone || "UTC")
    setSchedule(record.schedule || { kind: "daily", time: "09:00", date: null })
    try { setMessage(String((JSON.parse(record.action_args) as { message?: string }).message || "")) } catch { setError("Saved arguments could not be read.") }
  }, [saved.data, id])
  const save = async () => {
    setBusy(true); setError(null)
    try { await invokeCommand("save_reminder", { id, name, schedule, timezone, tool, args: JSON.stringify(tool === "notify.toast" ? { message: message.trim() } : {}) }); await onSaved(); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const choice = (label: string, value: string, change: (value: string) => void, options: Array<[string, string]>) => <Field><FieldLabel>{label}</FieldLabel><Select value={value} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{options.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent><DialogHeader><DialogTitle>{id ? "Edit schedule" : "New schedule"}</DialogTitle><DialogDescription>Review the action, timezone, and next occurrence. Saving does not run it.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); void save() }}><FieldGroup>
    <Field><FieldLabel htmlFor="reminder-name">Name</FieldLabel><Input id="reminder-name" value={name} onChange={event => setName(event.target.value)} required maxLength={160} /></Field>
    {choice("Reviewed action", tool, setTool, [["notify.toast", "Send a reminder"], ["system.info", "Check system"], ["window.list", "List open windows"]])}
    {tool === "notify.toast" && <Field><FieldLabel htmlFor="reminder-message">Reminder</FieldLabel><Input id="reminder-message" value={message} onChange={event => setMessage(event.target.value)} required maxLength={1000} /></Field>}
    {choice("Repeats", schedule.kind, value => setSchedule(current => ({ ...current, kind: value as Schedule["kind"] })), [["once", "One time"], ["daily", "Daily"], ["weekdays", "Weekdays"]])}
    {schedule.kind === "once" && <Field><FieldLabel htmlFor="reminder-date">Date</FieldLabel><Input id="reminder-date" type="date" value={schedule.date || ""} onChange={event => setSchedule(current => ({ ...current, date: event.target.value }))} required /></Field>}
    <Field><FieldLabel htmlFor="reminder-time">Local time</FieldLabel><Input id="reminder-time" type="time" value={schedule.time} onChange={event => setSchedule(current => ({ ...current, time: event.target.value }))} required /></Field>
    <Field><FieldLabel htmlFor="reminder-zone">Timezone</FieldLabel><Input id="reminder-zone" value={timezone} onChange={event => setTimezone(event.target.value)} required /><FieldDescription>{preview.isError ? preview.error.message : preview.data?.description || "Choose a time to preview its next occurrence."}</FieldDescription></Field>
    {id && saved.data?.find(record => record.id === id)?.schedule == null && <p className="records-note">This is a legacy cron schedule. Saving replaces its recurrence with the reviewed schedule above and keeps its timezone.</p>}
    {error && <p role="alert" className="settings-notice is-error">{error}</p>}
  </FieldGroup><DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="outline" disabled={busy || preview.isError || !name.trim()}>{busy ? "Saving…" : "Save schedule"}</Button></DialogFooter></form></DialogContent></Dialog>
}

interface Attempt { id: string; started_at: number; status: string; result: string | null; duration_ms: number | null }
export function ReminderHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const history = useQuery({ queryKey: ["automation-history", id], queryFn: () => invokeCommand<Attempt[]>("get_automation_history", { id }) })
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent><DialogHeader><DialogTitle>Schedule history</DialogTitle><DialogDescription>Actual attempts and measured durations.</DialogDescription></DialogHeader>{history.isError && <p role="alert">{history.error.message}</p>}{!history.data?.length && <p>No attempts recorded.</p>}<ul className="today-rows">{history.data?.map(attempt => <li key={attempt.id}><strong>{attempt.status} · {new Date(attempt.started_at * 1000).toLocaleString()}</strong><small>{attempt.duration_ms == null ? "Duration unavailable" : `${attempt.duration_ms} ms`}</small><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{attempt.result}</pre></li>)}</ul></DialogContent></Dialog>
}
