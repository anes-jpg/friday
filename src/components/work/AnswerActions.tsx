import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useDailyWork, newCapture } from "@/lib/daily-work"
import { saveDurableItem, useProjects } from "@/lib/projects"
import { useFriday } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { copySharedText } from "@/lib/capture-input"
import type { Message } from "@/lib/types"

export function AnswerActions({ message, threadId }: { message: Message; threadId: string }) {
  const [action, setAction] = useState<"note" | "task" | "preference" | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [projectId, setProjectId] = useState(message.projectId || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [draftId, setDraftId] = useState(() => crypto.randomUUID())
  const projects = useProjects(state => state.projects)
  const runId = message.runId || (message.id.startsWith("msg-") && message.id.endsWith("-assistant") ? message.id.slice(4, -10) : undefined)
  const receipt = useQuery({ queryKey: ["answer-receipt", runId, message.pendingPlan?.id], enabled: isDesktop && Boolean(runId), queryFn: () => invokeCommand<string | null>("get_run_receipt", { runId }) })
  const begin = (kind: NonNullable<typeof action>) => { setDraftId(crypto.randomUUID()); setAction(kind); setText(kind === "preference" ? "" : message.show || message.content || message.say || ""); setTitle(""); setError(null); setSaved(false) }
  const save = async () => {
    if (!action) return
    setBusy(true); setError(null)
    try {
      const context = isDesktop ? await invokeCommand<{ sourceIds: string[]; projectId?: string | null }>("get_message_context", { messageId: message.id }) : { sourceIds: message.sourceIds || [], projectId: message.projectId }
      const origin = { threadId, messageId: message.id }
      if (action === "preference") {
        if (!isDesktop) {
          await saveDurableItem({ id: draftId, type: "note", projectId, title: `Preference: ${title || text.slice(0, 80)}`, description: text, status: "todo", origin, sourceIds: [] })
        } else { await invokeCommand("save_explicit_preference", { text, origin }); await useFriday.getState().loadFactsFromBackend() }
      } else await saveDurableItem({ id: draftId, type: action, projectId, title: title || text.split("\n")[0].replace(/^#+\s*/, "").slice(0, 120) || "Saved answer", description: text, status: "todo", origin, sourceIds: context.sourceIds, sourceLinks: context.sourceIds.flatMap(id => { const source = useDailyWork.getState().captures.find(record => record.id === id); return source?.url ? [source.url] : [] }) })
      setAction(null); setSaved(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  return <><div className="work-actions work-answer-actions"><Button variant="ghost" size="sm" onClick={() => begin("note")}>Save as note</Button><Button variant="ghost" size="sm" onClick={() => begin("task")}>Create task</Button><Button variant="ghost" size="sm" onClick={() => begin("preference")}>Remember preference</Button><Button variant="ghost" size="sm" onClick={() => void copySharedText(message.show || message.content || message.say || "").catch(failure => setError(String(failure)))}>Copy answer</Button>{receipt.data && <Button variant="outline" size="sm" onClick={() => { void invokeCommand("undo_action", { receiptId: receipt.data }).then(() => receipt.refetch()).catch(failure => setError(String(failure))) }}>Undo file action</Button>}{saved && <span role="status">Saved</span>}</div>{error && !action && <p role="alert">{error}</p>}<Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !busy) setAction(null) }}><DialogContent><DialogHeader><DialogTitle>{action === "preference" ? "Remember an explicit preference" : `Save answer as ${action}`}</DialogTitle><DialogDescription>{action === "preference" ? "Write the preference you want FRIDAY to remember." : "Review the answer before saving. Its sources and originating message stay linked."}</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor={`answer-title-${message.id}`}>Title</FieldLabel><Input id={`answer-title-${message.id}`} value={title} onChange={event => setTitle(event.target.value)} /></Field><Field><FieldLabel htmlFor={`answer-text-${message.id}`}>{action === "preference" ? "Your preference" : "Content"}</FieldLabel><Textarea id={`answer-text-${message.id}`} rows={6} value={text} onChange={event => setText(event.target.value)} /></Field><Field><FieldLabel htmlFor={`answer-project-${message.id}`}>Project (optional)</FieldLabel><select id={`answer-project-${message.id}`} className="work-select" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field></FieldGroup>{error && <p role="alert">{error}</p>}<DialogFooter><Button variant="ghost" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button variant="outline" disabled={busy || !text.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog></>
}
