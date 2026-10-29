import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useDailyWork } from "@/lib/daily-work"
import { useFriday } from "@/lib/store"
import { useProjects, type WorkspaceProject } from "@/lib/projects"

export function CheckpointEditor({ project, onClose }: { project: WorkspaceProject; onClose: () => void }) {
  const saved = useDailyWork.getState().resumes.find(record => record.projectId === project.id)
  const [note, setNote] = useState(saved?.checkpoint || "")
  const [next, setNext] = useState(saved?.nextStep || "")
  const [links, setLinks] = useState(saved?.links.join("\n") || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setBusy(true); setError(null)
    try {
      const daily = useDailyWork.getState()
      const task = useProjects.getState().items.find(item => item.id === daily.selectedTaskId && item.type === "task" && item.projectId === project.id)
      await daily.saveResume({ id: project.id, name: project.name, projectId: project.id, threadId: project.threadId || (daily.contextProjectId === project.id ? useFriday.getState().activeThreadId || undefined : undefined), taskId: task?.id, sourceIds: [...daily.selectedSourceIds], checkpoint: note, nextStep: next, links: links.split("\n").map(value => value.trim()).filter(Boolean), updatedAt: new Date().toISOString() })
      onClose()
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent><DialogHeader><DialogTitle>Save checkpoint</DialogTitle><DialogDescription>Write where you left off. The selected task and sources will be pinned for resuming.</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="checkpoint-note">What you were doing</FieldLabel><Textarea id="checkpoint-note" rows={4} value={note} onChange={event => setNote(event.target.value)} autoFocus /></Field><Field><FieldLabel htmlFor="checkpoint-next">Next step</FieldLabel><Input id="checkpoint-next" value={next} onChange={event => setNext(event.target.value)} /></Field><Field><FieldLabel htmlFor="checkpoint-links">Relevant links (one per line)</FieldLabel><Textarea id="checkpoint-links" value={links} onChange={event => setLinks(event.target.value)} /></Field></FieldGroup>{error && <p role="alert">{error}</p>}<DialogFooter><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="outline" disabled={busy || !note.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save checkpoint"}</Button></DialogFooter></DialogContent></Dialog>
}
