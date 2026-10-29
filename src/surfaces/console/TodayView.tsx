import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useProjects, flushProjects, saveDurableItem, type ProjectItem } from "@/lib/projects"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { RunRecord } from "@/lib/workspace-native"
import type { SavedAutomation } from "@/lib/automations"

import { useDailyWork, newCapture } from "@/lib/daily-work"
import { resumeProject } from "@/lib/work-navigation"
import { openSearchResult } from "@/components/work/WorkspaceSearch"
import { useFriday } from "@/lib/store"

interface WorkspaceSearchResult { source: string; kind: string; id: string; threadId?: string; title: string }
interface ReconcileAction { id: string; run_id: string; tool: string; status: string; reconcile_required: boolean }
function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export function TodayView({ onOpen, onCreate }: { onOpen: (projectId: string, view?: string, itemId?: string) => void; onCreate: () => void }) {
  const { projects, items, activeId, ready, loadError } = useProjects()
  const { captures, resumes, routines } = useDailyWork()
  const [capture, setCapture] = useState("")
  const [captureId, setCaptureId] = useState<string | undefined>()
  const [capturing, setCapturing] = useState(false)
  const [projectId, setProjectId] = useState(activeId || projects[0]?.id || "")
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const workspaceSearch = useQuery({ queryKey: ["workspace-search", searchQuery], enabled: isDesktop && searchQuery.trim().length > 2, queryFn: () => invokeCommand<WorkspaceSearchResult[]>("workspace_search", { query: searchQuery }) })
  const date = localDate()
  const tasks = useMemo(() => items.filter(item => item.type === "task" && item.status !== "done"), [items])
  const overdue = tasks.filter(task => task.dueDate && task.dueDate.slice(0, 10) < date)
  const today = tasks.filter(task => task.dueDate?.slice(0, 10) === date)
  const inProgress = tasks.filter(task => task.status === "in-progress")
  const activity = useQuery({ queryKey: ["run-history", "today"], enabled: isDesktop, queryFn: () => invokeCommand<RunRecord[]>("get_run_history"), refetchInterval: 30_000 })
  const reconciliation = useQuery({ queryKey: ["reconcile-actions"], enabled: isDesktop, queryFn: () => invokeCommand<ReconcileAction[]>("get_reconcile_actions"), refetchInterval: 30_000 })
  const needsReview = reconciliation.data ?? []
  const activeRuns = (activity.data ?? []).filter(run => ["queued", "running", "awaiting_confirmation"].includes(run.status))
  const attentionCount = overdue.length + needsReview.length
  const schedules = useQuery({ queryKey: ["agenda-reminders"], enabled: isDesktop, queryFn: () => invokeCommand<SavedAutomation[]>("get_automations"), refetchInterval: 30_000 })
  const reminders = [...(schedules.data ?? [])].filter(item => item.enabled && item.next_run != null).sort((a, b) => (a.next_run ?? 0) - (b.next_run ?? 0)).slice(0, 6)
  const captureTask = async () => {
    if (!capture.trim() || capturing) return
    setCapturing(true)
    setError(null)
    try {
      const record = newCapture({ id: captureId, text: capture.trim(), projectId: projectId || undefined })
      setCaptureId(record.id)
      await useDailyWork.getState().saveCapture(record)
      await saveDurableItem({ id: `capture-${record.id}-task`, projectId, type: "task", title: capture.trim(), status: "todo", dueDate: date, sourceIds: [record.id] })
      await flushProjects()
      setCapture("")
      setCaptureId(undefined)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setCapturing(false) }
  }
  const taskList = (label: string, records: ProjectItem[], emptyMessage = "Nothing scheduled here.") => <section className="today-section"><h3><span>{label}</span><small>{records.length}</small></h3>{records.length ? <ul className="today-rows">{records.map(task => <li key={task.id}><button type="button" onClick={() => onOpen(task.projectId, "tasks", task.id)}><span><strong dir="auto">{task.title}</strong><small>{[projects.find(project => project.id === task.projectId)?.name, task.dueDate ? `Due ${task.dueDate}` : ""].filter(Boolean).join(" · ")}</small></span><ArrowUpRight size={16} /></button></li>)}</ul> : <p className="text-muted-foreground">{emptyMessage}</p>}</section>
  return <div className="today-view"><header className="today-heading"><div className="today-title"><span className="instrument-label">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span><h2>Today</h2><p>Your daily work, active runs, and anything that needs a decision.</p></div><div className="today-metrics" aria-label="Daily summary"><div className="today-metric"><strong>{tasks.length}</strong><span>Open tasks</span></div><div className="today-metric" data-attention={attentionCount > 0}><strong>{attentionCount}</strong><span>Need attention</span></div><div className="today-metric" data-active={activeRuns.length > 0}><strong>{activeRuns.length}</strong><span>Runs in motion</span></div></div></header>
    <div className="work-actions"><Button variant="outline" onClick={() => useDailyWork.getState().openCapture()}>Quick capture</Button><Button variant="outline" onClick={() => useDailyWork.setState({ searchOpen: true })}>Search workspace</Button><Button variant="outline" onClick={() => useDailyWork.setState({ routineOpen: true })}>Manage routines</Button></div>
    <div className="today-grid">
      <section className="today-section"><h3><span>Inbox</span><small>{captures.filter(record => record.inbox).length}</small></h3><ul className="today-rows">{captures.filter(record => record.inbox).slice().reverse().slice(0, 8).map(record => <li key={record.id}><button type="button" onClick={() => useDailyWork.getState().openCapture(record)}><span><strong>{record.title}</strong><small>{record.sourceKind} · {new Date(record.capturedAt).toLocaleString()}{record.extractionError ? " · Extraction unavailable" : ""}</small></span><ArrowUpRight size={16} /></button></li>)}</ul>{!captures.length && <p className="text-muted-foreground">Capture an idea or source without choosing a project.</p>}</section>
      <section className="today-section"><h3>Continue working</h3><ul className="today-rows">{resumes.slice().reverse().map(record => <li key={record.id}><button type="button" onClick={() => resumeProject(record)}><span><strong>{projects.find(project => project.id === record.projectId)?.name || record.name}</strong><small>{record.checkpoint}</small><small>Next: {record.nextStep || "Choose your next step"}</small></span><ArrowUpRight size={16} /></button></li>)}</ul>{!resumes.length && <p className="text-muted-foreground">Save a checkpoint from a project to resume later.</p>}</section>
      <section className="today-section"><h3>Pinned routines</h3><ul className="today-rows">{routines.filter(record => record.pinned).map(record => <li key={record.id}><button type="button" onClick={() => { sessionStorage.setItem("friday-open-routine", record.id); useDailyWork.setState({ routineOpen: true }) }}><span><strong>{record.name}</strong><small>{record.steps.length} steps · Review current inputs</small></span><ArrowUpRight size={16} /></button></li>)}</ul>{!routines.some(record => record.pinned) && <p className="text-muted-foreground">Pin a named routine after saving it.</p>}</section>
    </div>
    <div className="today-tools"><form className="today-capture" onSubmit={event => { event.preventDefault(); void captureTask() }}><Field><FieldLabel htmlFor="today-capture">Quick capture</FieldLabel><Input id="today-capture" value={capture} onChange={event => setCapture(event.target.value)} placeholder="Add the next thing you need to do…" /></Field><Select value={projectId || "none"} onValueChange={value => setProjectId(value === "none" ? "" : value)}><SelectTrigger aria-label="Capture project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">No project</SelectItem>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectGroup></SelectContent></Select><Button type="submit" variant="outline" disabled={capturing || !capture.trim() || !ready || Boolean(loadError)}><Plus data-icon="inline-start" />Add task</Button></form>
    {(error || loadError) && <p role="alert" className="project-error">{error || loadError}</p>}
    <section className="today-section today-search"><Field><FieldLabel htmlFor="today-search">Search workspace memory</FieldLabel><Input id="today-search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Messages, facts, files, project work…" /></Field>{workspaceSearch.isError && <p role="alert">{workspaceSearch.error.message}</p>}{workspaceSearch.data?.length ? <ul className="today-rows">{workspaceSearch.data.map(item => <li key={`${item.source}-${item.id}`}><button type="button" onClick={() => openSearchResult(item)}><span><strong dir="auto">{item.title}</strong><small>{item.source} · {item.kind}{item.id ? ` · ${item.id}` : ""}</small></span></button></li>)}</ul> : searchQuery.trim().length > 2 && !workspaceSearch.isFetching ? <p className="text-muted-foreground">No matching workspace records.</p> : null}</section></div>
    {!projects.length && <Empty><EmptyHeader><EmptyTitle>Create a project when you need one</EmptyTitle><EmptyDescription>Your inbox and tasks work without a project. Add one to organize a goal.</EmptyDescription></EmptyHeader><Button variant="outline" onClick={onCreate} disabled={!ready}>Create project</Button></Empty>}
    <div className="today-grid"><section className="today-section today-attention" data-attention={attentionCount > 0}><h3><span>Needs attention</span><small>{attentionCount}</small></h3>{reconciliation.isError && <p role="alert">Could not load actions awaiting review: {reconciliation.error.message}</p>}{overdue.length > 0 && <><h4 className="today-subheading">Overdue tasks</h4><ul className="today-rows">{overdue.slice(0, 5).map(task => <li key={task.id}><button type="button" onClick={() => onOpen(task.projectId, "tasks", task.id)}><span><strong dir="auto">{task.title}</strong><small>{projects.find(project => project.id === task.projectId)?.name} · Due {task.dueDate}</small></span><ArrowUpRight size={16} /></button></li>)}</ul>{overdue.length > 5 && <p className="today-overflow">{overdue.length - 5} more overdue tasks</p>}</>}{needsReview.length > 0 && <><h4 className="today-subheading">Actions to reconcile</h4><ul className="today-rows">{needsReview.slice(0, 5).map(action => { const run = activity.data?.find(item => item.id === action.run_id); return <li key={action.id}><button type="button" disabled={!run?.project_id} onClick={() => run?.project_id && onOpen(run.project_id, "history")}><span><strong>{action.tool} · {action.status.replaceAll("_", " ")}</strong><small>{run?.utterance.slice(0, 88) || `Run ${action.run_id.slice(0, 8)}`} · Review before retrying</small></span>{run?.project_id && <ArrowUpRight size={16} />}</button></li>})}</ul>{needsReview.length > 5 && <p className="today-overflow">{needsReview.length - 5} more actions need review</p>}</>}{attentionCount === 0 && !reconciliation.isError && <p className="text-muted-foreground">Nothing needs your attention right now.</p>}</section>{taskList("In progress", inProgress, "No tasks marked in progress.")}{taskList("Due tasks", today)}<section className="today-section"><h3><span>Upcoming reminders</span><small>{reminders.length}</small></h3>{schedules.isError && <p role="alert">{schedules.error.message}</p>}{reminders.length ? <ul className="today-rows">{reminders.map(reminder => <li key={reminder.id}><span><strong>{reminder.name}</strong><small>{new Date((reminder.next_run ?? 0) * 1000).toLocaleString()}</small></span></li>)}</ul> : <p className="text-muted-foreground">No upcoming reminders.</p>}</section><section className="today-section"><h3><span>Recent activity</span><small>{activity.data?.length ?? 0}</small></h3>{activity.isError && <p role="alert">{activity.error.message}</p>}{activity.data?.length ? <ul className="today-rows">{activity.data.slice(0, 8).map(run => <li key={run.id}><button type="button"  onClick={() => { if (run.project_id) onOpen(run.project_id, "history"); else { useFriday.getState().setActiveThread(run.thread_id); useFriday.getState().setTab("chat") } }}><span><strong>{run.utterance.slice(0, 100)}</strong><small>{run.status.replaceAll("_", " ")} · {new Date(run.created_at).toLocaleTimeString()}</small></span><ArrowUpRight size={16} /></button></li>)}</ul> : <p className="text-muted-foreground">Run activity appears here after you send a request.</p>}</section></div>
  </div>
}
