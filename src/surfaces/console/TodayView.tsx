import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Check, Globe, Plus, Play, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { useProjects, saveDurableItem, type ProjectItem } from "@/lib/projects"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { RunRecord } from "@/lib/workspace-native"
import { useDailyWork } from "@/lib/daily-work"
import { prepareWorkRequest, resumeProject } from "@/lib/work-navigation"
import { useFriday } from "@/lib/store"
import { taskQueue } from "@/lib/task-analytics"

interface ReconcileAction { id: string; run_id: string; tool: string; status: string }
export function TodayView({ onOpen, onCreate }: { onOpen: (projectId: string, view?: string, itemId?: string) => void; onCreate: () => void }) {
  const { projects, items, ready, loadError } = useProjects()
  const { captures, resumes, routines } = useDailyWork()
  const [text, setText] = useState("")
  const [projectId, setProjectId] = useState("")
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState("all")
  const [status, setStatus] = useState("open")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<ProjectItem | null>(null)
  const tasks = useMemo(() => taskQueue(items), [items])
  const visible = tasks.filter(task => (scope === "all" || task.projectId === scope) && (status !== "active" || task.status === "in-progress") && `${task.title} ${task.description || ""}`.toLowerCase().includes(query.toLowerCase()))
  const history = useQuery({ queryKey: ["run-history", "today"], enabled: isDesktop, queryFn: () => invokeCommand<RunRecord[]>("get_run_history"), refetchInterval: 10_000, refetchIntervalInBackground: false })
  const review = useQuery({ queryKey: ["reconcile-actions"], enabled: isDesktop, queryFn: () => invokeCommand<ReconcileAction[]>("get_reconcile_actions"), refetchInterval: 30_000 })
  const activeRuns = (history.data ?? []).filter(run => ["queued", "running", "awaiting_confirmation"].includes(run.status))
  const inbox = captures.filter(record => record.inbox).slice().reverse().slice(0, 5)
  const pinned = routines.filter(record => record.pinned)
  const update = async (task: ProjectItem, next: ProjectItem["status"]) => {
    setBusy(task.id); setError(null)
    try { await saveDurableItem({ ...task, status: next }); setUndo(task) }
    catch (failure) { setError(String(failure)) }
    finally { setBusy(null) }
  }
  const add = async () => {
    if (!text.trim() || busy) return
    setBusy("capture"); setError(null)
    try { await saveDurableItem({ id: crypto.randomUUID(), projectId, type: "task", title: text.trim(), status: "todo" }); setText("") }
    catch (failure) { setError(String(failure)) }
    finally { setBusy(null) }
  }
  return <div className="work-command-center">
    <header className="work-center-heading"><div><span className="instrument-label">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span><h2>Make progress.</h2><p>{tasks.length} open tasks · {projects.filter(project => project.status === "active").length} active projects · {activeRuns.length} live runs</p></div><Button variant="outline" onClick={onCreate} disabled={!ready || Boolean(loadError)}><Plus size={16} />New project</Button></header>
    <div className="work-launch-strip"><button type="button" onClick={() => useFriday.getState().setTab("map")}><Globe size={20} /><span><strong>Find businesses. Build websites.</strong><small>Explore an area → shortlist → website brief → project</small></span><ArrowUpRight size={18} /></button><button type="button" onClick={() => useDailyWork.getState().openCapture()}><Plus size={20} /><span><strong>Capture an idea or source</strong><small>Files, links, notes, and screenshots in one inbox</small></span><ArrowUpRight size={18} /></button></div>
    {(loadError || error) && <p className="project-error" role="alert">{loadError || error}</p>}
    {!ready && <AsciiLoader label="Opening saved work" />}
    {undo && <div className="work-undo" role="status"><span>Task updated.</span><Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={async () => { setBusy(undo.id); try { await saveDurableItem(undo); setUndo(null) } catch (failure) { setError(String(failure)) } finally { setBusy(null) } }}>Undo last change</Button></div>}
    <div className="work-center-grid"><section className="work-queue" aria-label="Your task queue"><header><div><span className="instrument-label">Execution queue</span><h3>What’s next</h3></div><span>{visible.length} tasks</span></header>
      <form className="work-task-composer" onSubmit={event => { event.preventDefault(); void add() }}><Input aria-label="New task" value={text} onChange={event => setText(event.target.value)} placeholder="Write a task and press Enter…" /><select aria-label="New task project" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">Personal inbox</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><Button variant="outline" size="icon" type="submit" aria-label="Add task" disabled={!text.trim() || Boolean(busy) || !ready || Boolean(loadError)}><Plus size={16} /></Button></form>
      <div className="work-queue-filters"><div><Search size={14} /><Input aria-label="Search task queue" placeholder="Filter tasks…" value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Task project filter" value={scope} onChange={event => setScope(event.target.value)}><option value="all">All projects</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}<option value="">Personal inbox</option></select><button type="button" aria-pressed={status === "active"} onClick={() => setStatus(current => current === "active" ? "open" : "active")}>In progress</button></div>
      <ul className="work-task-queue">{visible.map(task => <li key={task.id} data-state={task.status}><button type="button" className="work-complete" aria-label={`Complete ${task.title}`} disabled={Boolean(busy)} onClick={() => void update(task, "done")}><Check size={16} /></button><button type="button" className="work-task-title" onClick={() => onOpen(task.projectId, "tasks", task.id)}><strong dir="auto">{task.title}</strong><small>{projects.find(project => project.id === task.projectId)?.name || "Personal inbox"} · {task.status === "in-progress" ? "In progress" : "To do"}{task.dueDate ? ` · Due ${task.dueDate}` : ""}{task.priority ? ` · ${task.priority}` : ""}</small></button><div className="work-task-actions"><Button variant="ghost" size="icon" aria-label={`${task.status === "in-progress" ? "Pause" : "Start"} ${task.title}`} disabled={Boolean(busy)} onClick={() => void update(task, task.status === "in-progress" ? "todo" : "in-progress")}><Play size={14} /></Button><Button variant="ghost" size="sm" disabled={!task.projectId || Boolean(busy)} onClick={() => prepareWorkRequest(task.projectId, `${task.title}\n${task.description || ""}`, task.sourceIds, task.id)}><Sparkles size={14} />Work on this</Button></div></li>)}</ul>
      {!visible.length && <div className="work-queue-empty"><h4>{tasks.length ? "No tasks match these filters" : "Ready for your next move"}</h4><p>{tasks.length ? "Change the project or task filter to see the rest of your queue." : "Add a task above, open a project, or find a business to build for."}</p></div>}
    </section><aside className="work-context-stack"><section><header><h3>Your projects</h3><button type="button" onClick={onCreate} aria-label="Create a project"><Plus size={16} /></button></header>{projects.filter(project => project.status === "active").map(project => { const work = tasks.filter(task => task.projectId === project.id); return <button key={project.id} type="button" className="work-project-launch" onClick={() => onOpen(project.id)}><span className="project-monogram">{project.name.slice(0, 2).toUpperCase()}</span><span><strong>{project.name}</strong><small>{work.length} open · {project.tags.includes("business-website") ? "Business website" : project.kind}{project.rootPath ? " · Folder connected" : ""}</small></span><ArrowUpRight size={14} /></button>})}{!projects.length && <p>Create a project or start one from a business on the map.</p>}</section>
      {activeRuns.length > 0 && <section><h3>FRIDAY is working</h3>{activeRuns.map(run => <button className="work-activity-row" key={run.id} type="button" onClick={() => { useFriday.getState().setActiveThread(run.thread_id); useFriday.getState().setTab("chat") }}><AsciiLoader label={run.status.replaceAll("_", " ")} /><span>{run.utterance.slice(0, 100)}</span></button>)}</section>}
      {resumes.length > 0 && <section><h3>Continue where you left off</h3>{resumes.slice().reverse().slice(0, 3).map(record => <button className="work-activity-row" key={record.id} type="button" onClick={() => resumeProject(record)}><strong>{projects.find(project => project.id === record.projectId)?.name || record.name}</strong><small>{record.nextStep || record.checkpoint}</small></button>)}</section>}
      {inbox.length > 0 && <section><h3>Captured sources</h3>{inbox.map(record => <button type="button" key={record.id} className="work-activity-row" onClick={() => useDailyWork.getState().openCapture(record)}><strong>{record.title}</strong><small>{record.sourceKind}</small></button>)}</section>}
      {pinned.length > 0 && <section><h3>Pinned routines</h3>{pinned.map(record => <button type="button" key={record.id} className="work-activity-row" onClick={() => { sessionStorage.setItem("friday-open-routine", record.id); useDailyWork.setState({ routineOpen: true }) }}><strong>{record.name}</strong><small>{record.steps.length} steps</small></button>)}</section>}
      {(review.data?.length || review.isError) ? <section><h3>Review before retrying</h3>{review.isError ? <p role="alert">{review.error.message}</p> : review.data?.map(action => <button key={action.id} type="button" className="work-activity-row" onClick={() => useFriday.getState().setTab("history")}><strong>{action.tool}</strong><small>{action.status.replaceAll("_", " ")}</small></button>)}</section> : null}
      <section><header><h3>Recent execution</h3><button type="button" onClick={() => useFriday.getState().setTab("history")}>History<ArrowUpRight size={14} /></button></header>{history.isFetching && !history.data && <AsciiLoader label="Reading run history" />}{history.isError && <p role="alert">{history.error.message}</p>}{history.data?.slice(0, 4).map(run => <button type="button" key={run.id} className="work-activity-row" onClick={() => { useFriday.getState().setActiveThread(run.thread_id); useFriday.getState().setTab("chat") }}><strong>{run.utterance.slice(0, 90)}</strong><small>{run.status.replaceAll("_", " ")} · {new Date(run.created_at).toLocaleTimeString()}</small></button>)}{!history.data?.length && !history.isFetching && <p>Project requests record their plan, approvals, and result here.</p>}</section>
      <div className="work-context-links"><Button variant="ghost" size="sm" onClick={() => useFriday.getState().setTab("analytics")}>Task analytics<ArrowUpRight size={14} /></Button><Button variant="ghost" size="sm" onClick={() => useDailyWork.setState({ searchOpen: true })}>Search everything<Search size={14} /></Button><Button variant="ghost" size="sm" onClick={() => useDailyWork.setState({ routineOpen: true })}>Routines<ArrowUpRight size={14} /></Button></div>
    </aside></div>
  </div>
}
