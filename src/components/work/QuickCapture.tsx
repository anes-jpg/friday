import { useEffect, useState } from "react"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDailyWork, newCapture } from "@/lib/daily-work"
import { useProjects, saveDurableItem } from "@/lib/projects"
import { useFriday, sendChatMessage } from "@/lib/store"
import { readSharedClipboard, captureFile, captureWebpage, captureScreenText } from "@/lib/capture-input"
import { ReminderEditor } from "@/surfaces/console/ReminderEditor"

export function QuickCapture() {
  const { captureOpen, draft, ready, error: loadError } = useDailyWork()
  const projects = useProjects(state => state.projects)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reminder, setReminder] = useState(false)
  useEffect(() => {
    if (!isDesktop || !captureOpen) return
    let disposed = false; let stop: (() => void) | undefined
    void import("@tauri-apps/api/webviewWindow").then(async ({ getCurrentWebviewWindow }) => {
      const unlisten = await getCurrentWebviewWindow().onDragDropEvent(event => {
        if (event.payload.type !== "drop") return
        if (event.payload.paths.length !== 1) { setError("Drop one file at a time to review it."); return }
        setBusy(true)
        void invokeCommand<Partial<import("@/lib/daily-work").Capture>>("capture_text_file", { path: event.payload.paths[0] }).then(record => update(record)).catch(failure => setError(String(failure))).finally(() => setBusy(false))
      })
      if (disposed) unlisten(); else stop = unlisten
    }).catch(failure => setError(String(failure)))
    return () => { disposed = true; stop?.() }
  }, [captureOpen])
  const update = (patch: typeof draft) => { useDailyWork.setState({ draft: { ...useDailyWork.getState().draft, ...patch } }); setError(null) }
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await action() } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const persist = async () => {
    const record = newCapture({ ...useDailyWork.getState().draft, id: useDailyWork.getState().draft.id || crypto.randomUUID() })
    update(record)
    await useDailyWork.getState().saveCapture(record)
    return record
  }
  const close = () => { useDailyWork.setState({ captureOpen: false }); setError(null) }
  const save = (kind: "inbox" | "task" | "note") => run(async () => {
    const record = await persist()
    if (kind !== "inbox") await saveDurableItem({ id: `capture-${record.id}-${kind}`, projectId: record.projectId || "", type: kind, title: record.title, description: record.text, status: "todo", sourceIds: [record.id], sourceLinks: record.url ? [record.url] : [] })
    useDailyWork.setState({ draft: {}, captureOpen: false })
  })
  const ask = (instruction?: string) => run(async () => {
    const record = await persist()
    const project = projects.find(value => value.id === record.projectId)
    const store = useFriday.getState()
    const activeProject = projects.find(value => value.threadId === store.activeThreadId)
    const threadId = project?.threadId || (activeProject?.id !== record.projectId ? store.createThread(project?.name || record.title) : store.activeThreadId || store.createThread())
    store.setActiveThread(threadId)
    useDailyWork.setState({ selectedSourceIds: [record.id], selectedTaskId: undefined, contextProjectId: record.projectId, captureOpen: false })
    useFriday.getState().setTab("chat")
    if (instruction) await sendChatMessage(instruction, false, { projectId: record.projectId, threadId, sourceIds: [record.id] })
  })
  const importFiles = (files: FileList | null) => run(async () => {
    if (!files?.length) return
    if (files.length !== 1) throw new Error("Drop one file at a time so you can review its contents.")
    update(await captureFile(files[0], draft.projectId))
  })
  return <>
    <Dialog open={captureOpen && !reminder} onOpenChange={open => { if (!open && !busy) close() }}><DialogContent className="work-dialog" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void importFiles(event.dataTransfer.files) }}><DialogHeader><DialogTitle>Quick capture</DialogTitle><DialogDescription>Review material before asking FRIDAY or saving it. A project is optional.</DialogDescription></DialogHeader>
      <div className="work-actions"><Button variant="outline" disabled={busy} onClick={() => void run(async () => { update({ text: await readSharedClipboard(), sourceKind: "clipboard", extractionError: undefined }) })}>Use clipboard</Button><Button variant="outline" disabled={busy} onClick={() => void run(async () => update(await captureScreenText()))}>Capture screen once</Button><Button variant="outline" disabled={busy} onClick={() => void run(async () => { if (!isDesktop) throw new Error("Local dictation requires the Windows app."); await useFriday.getState().startVoiceCapture() })}>Dictate</Button><label className="work-file-input">Attach text/code file<input type="file" aria-label="Attach text or code file" disabled={busy} onChange={event => { void importFiles(event.target.files); event.target.value = "" }} /></label></div>
      <FieldGroup><Field><FieldLabel htmlFor="capture-title">Title</FieldLabel><Input id="capture-title" value={draft.title || ""} placeholder="Optional title" onChange={event => update({ title: event.target.value || undefined })} /></Field><Field><FieldLabel htmlFor="capture-text">Editable preview</FieldLabel><Textarea id="capture-text" rows={7} value={draft.text || ""} onChange={event => update({ text: event.target.value, extractionError: undefined })} placeholder="An idea, error message, URL, or instruction…" autoFocus /></Field>
      <Field><FieldLabel htmlFor="capture-url">Source URL (optional)</FieldLabel><Input id="capture-url" value={draft.url || ""} onChange={event => update({ url: event.target.value || undefined })} placeholder="https://…" /><Button variant="outline" disabled={busy || !(draft.url || draft.text?.startsWith("http"))} onClick={() => void run(async () => update(await captureWebpage(draft.url || draft.text || "")))}>Read webpage</Button></Field>
      <Field><FieldLabel>Project</FieldLabel><Select value={draft.projectId || "inbox"} onValueChange={value => update({ projectId: value === "inbox" ? undefined : value })}><SelectTrigger aria-label="Capture project"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="inbox">No project</SelectItem>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field></FieldGroup>
      {draft.path && <p className="work-meta">{draft.path}</p>}{draft.extractionError && <p role="alert">{draft.extractionError}</p>}{(error || loadError) && <p role="alert" className="project-error">{error || loadError}</p>}
      <div className="work-actions" aria-label="Shared text actions">{["Explain", "Summarize", "Rewrite", "Translate", "Extract tasks"].map(action => <Button key={action} variant="ghost" disabled={busy || !draft.text?.trim() || Boolean(draft.extractionError)} onClick={() => void ask(`${action} the selected source.${action === "Translate" ? " Ask which language if it is not specified." : ""}`)}>{action}</Button>)}</div>
      <DialogFooter className="work-actions"><Button variant="outline" disabled={busy || !ready || !draft.text?.trim() || Boolean(draft.extractionError)} onClick={() => void ask()}>Ask FRIDAY</Button><Button variant="outline" disabled={busy || !ready || !(draft.text?.trim() || draft.extractionError)} onClick={() => void save("inbox")}>Save to inbox</Button><Button variant="outline" disabled={busy || !draft.text?.trim()} onClick={() => void save("task")}>Create task</Button><Button variant="outline" disabled={busy || !draft.projectId || !draft.text?.trim()} onClick={() => void save("note")}>Save project note</Button><Button variant="outline" disabled={busy || !draft.text?.trim()} onClick={() => void run(async () => { await persist(); setReminder(true) })}>Set reminder</Button></DialogFooter>
    </DialogContent></Dialog>
    {reminder && <ReminderEditor initial={{ name: draft.title || "Review capture", message: draft.text || "", sourceIds: draft.id ? [draft.id] : [], projectId: draft.projectId }} onClose={() => setReminder(false)} onSaved={async () => { setReminder(false); useDailyWork.setState({ captureOpen: false, draft: {} }) }} />}
  </>
}
