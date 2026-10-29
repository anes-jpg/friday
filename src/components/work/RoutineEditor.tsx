import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useDailyWork, routineSchema, type Routine } from "@/lib/daily-work"
import { useProjects } from "@/lib/projects"
import { useFriday, sendChatMessage } from "@/lib/store"
import { isDesktop } from "@/lib/ipc"

type EditorStep = { kind: "prompt" | "tool"; text: string; tool: string; args: string }
const blankStep = (): EditorStep => ({ kind: "prompt", text: "", tool: "app.launch", args: '{"target":"notepad"}' })
export function RoutineEditor() {
  const { routineOpen, routines, selectedSourceIds, captures } = useDailyWork()
  const projects = useProjects(state => state.projects)
  const items = useProjects(state => state.items)
  const notes = items.filter(item => item.type === "note")
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [projectId, setProjectId] = useState("")
  const [pinned, setPinned] = useState(false)
  const [steps, setSteps] = useState<EditorStep[]>([blankStep()])
  const [inputs, setInputs] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sourceIds, setSourceIds] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const edit = (routine?: Routine) => {
    setSelected(routine?.id || null); setName(routine?.name || ""); setProjectId(routine?.projectId || ""); setPinned(routine?.pinned || false)
    setSteps(routine?.steps.map(step => step.kind === "prompt" ? { ...blankStep(), text: step.text } : { ...blankStep(), kind: "tool", tool: step.tool, args: JSON.stringify(step.args, null, 2) }) || [blankStep()]); setError(null)
    setSourceIds(routine?.sourceIds || [...selectedSourceIds]); setDirty(false); setNotice(null); setInputs("")
  }
  useEffect(() => {
    if (!routineOpen) return
    const id = sessionStorage.getItem("friday-open-routine")
    if (id) { edit(useDailyWork.getState().routines.find(record => record.id === id)); sessionStorage.removeItem("friday-open-routine") }
  }, [routineOpen])
  const patchStep = (index: number, patch: Partial<EditorStep>) => { setDirty(true); setSteps(current => current.map((step, i) => i === index ? { ...step, ...patch } : step)) }
  const save = async () => {
    setBusy(true); setError(null)
    try { const record = routineSchema.parse({ id: selected || crypto.randomUUID(), name, projectId: projectId || undefined, pinned, sourceIds, updatedAt: new Date().toISOString(), steps: steps.map(step => step.kind === "prompt" ? { kind: "prompt", text: step.text } : { kind: "tool", tool: step.tool, args: JSON.parse(step.args) as unknown }) }); setSelected(record.id); await useDailyWork.getState().saveRoutine(record); setDirty(false); setNotice("Routine saved. Review current inputs before running.") }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const invoke = async () => {
    const routine = routines.find(record => record.id === selected)
    if (!routine || dirty) return
    if (!isDesktop) { setError("Routine execution requires the Windows app. Your routine remains saved for later."); return }
    useDailyWork.setState({ routineOpen: false, contextProjectId: routine.projectId })
    useFriday.getState().setTab("chat")
    const project = projects.find(record => record.id === routine.projectId)
    const threadId = useFriday.getState().createThread(routine.name)
    await sendChatMessage(`Run routine “${routine.name}”.\nCurrent inputs:\n${inputs}`, false, { projectId: routine.projectId, providerProfileId: project?.providerId || undefined, threadId, routineId: routine.id, sourceIds: [...new Set([...routine.sourceIds, ...selectedSourceIds])] })
  }
  return <Dialog open={routineOpen} onOpenChange={open => { if (!busy) useDailyWork.setState({ routineOpen: open }) }}><DialogContent className="work-dialog"><DialogHeader><DialogTitle>Desktop routines</DialogTitle><DialogDescription>Save a named sequence. Every invocation starts a fresh run and requests the required confirmations.</DialogDescription></DialogHeader><div className="work-actions"><Button variant="outline" onClick={() => edit()}>New routine</Button>{routines.map(routine => <Button key={routine.id} variant="ghost" onClick={() => edit(routine)}>{routine.name}</Button>)}</div><FieldGroup><Field><FieldLabel htmlFor="routine-name">Name</FieldLabel><Input id="routine-name" value={name} onChange={event => { setDirty(true); setName(event.target.value) }} /></Field><Field><FieldLabel htmlFor="routine-project">Project (optional)</FieldLabel><select id="routine-project" className="work-select" value={projectId} onChange={event => { setDirty(true); setProjectId(event.target.value) }}><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field><FieldLabel htmlFor="routine-pinned">Pin to Today</FieldLabel><input id="routine-pinned" type="checkbox" checked={pinned} onChange={event => { setDirty(true); setPinned(event.target.checked) }} /></Field></FieldGroup>
    {steps.map((step, index) => <div className="work-routine-step" key={index}><Field><FieldLabel htmlFor={`routine-kind-${index}`}>Step {index + 1}</FieldLabel><select id={`routine-kind-${index}`} className="work-select" value={step.kind} onChange={event => patchStep(index, { kind: event.target.value as EditorStep["kind"] })}><option value="prompt">Work with FRIDAY</option><option value="tool">Native action</option></select></Field>{step.kind === "prompt" ? <Field><FieldLabel htmlFor={`routine-text-${index}`}>Prompt</FieldLabel><Textarea id={`routine-text-${index}`} value={step.text} onChange={event => patchStep(index, { text: event.target.value })} placeholder="Summarize the selected notes and suggest a next step" /></Field> : <><Field><FieldLabel htmlFor={`routine-tool-${index}`}>Action</FieldLabel><select id={`routine-tool-${index}`} className="work-select" value={step.tool} onChange={event => patchStep(index, { tool: event.target.value, args: event.target.value === "app.launch" ? '{"target":"notepad"}' : event.target.value === "fs.read" ? '{"path":"README.md"}' : event.target.value === "fs.write" ? '{"path":"notes.txt","content":""}' : event.target.value === "shell.run" ? '{"binary":"git","args":["status"]}' : "{}" })}><option value="app.launch">Open folder, file, or app</option><option value="fs.read">Read a selected file</option><option value="fs.write">Propose a file edit</option><option value="shell.run">Run a command with confirmation</option><option value="window.list">List open windows</option><option value="system.info">Check system information</option></select></Field><Field><FieldLabel htmlFor={`routine-args-${index}`}>Action details (JSON)</FieldLabel><Textarea id={`routine-args-${index}`} value={step.args} onChange={event => patchStep(index, { args: event.target.value })} /></Field></>}<div className="work-actions"><Button variant="ghost" disabled={index === 0} onClick={() => { setDirty(true); setSteps(current => { const copy = [...current]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy }) }}>Move up</Button><Button variant="ghost" disabled={steps.length === 1} onClick={() => { setDirty(true); setSteps(current => current.filter((_, i) => i !== index)) }}>Remove step</Button></div></div>)}
    <Button variant="outline" disabled={steps.length >= 32} onClick={() => { setDirty(true); setSteps(current => [...current, blankStep()]) }}>Add step</Button><Field><FieldLabel>Pinned sources for this routine</FieldLabel><div className="work-actions">{[...captures.filter(record => !record.extractionError), ...notes].map(record => <Button key={record.id} variant="outline" aria-pressed={sourceIds.includes(record.id)} onClick={() => { setDirty(true); setSourceIds(current => current.includes(record.id) ? current.filter(id => id !== record.id) : [...current, record.id]) }}>{sourceIds.includes(record.id) ? "Selected: " : ""}{record.title}</Button>)}</div></Field><p className="work-meta">{sourceIds.length} pinned sources. Saving never approves execution. {dirty ? "Unsaved edits. Save before running." : notice}</p><Field><FieldLabel htmlFor="routine-inputs">Current inputs for this run</FieldLabel><Textarea id="routine-inputs" value={inputs} onChange={event => setInputs(event.target.value)} /></Field>{error && <p role="alert">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save routine"}</Button><Button variant="outline" disabled={busy || !selected || dirty} onClick={() => void invoke().catch(failure => setError(String(failure)))}>Run saved routine</Button></DialogFooter></DialogContent></Dialog>
}
