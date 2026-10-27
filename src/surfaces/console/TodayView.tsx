import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useProjects, flushProjects, type ProjectItem } from "@/lib/projects"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { RunRecord } from "@/lib/workspace-native"
import type { SavedAutomation } from "@/lib/automations"

interface WorkspaceSearchResult { source: string; kind: string; id: string; threadId?: string; title: string }
function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export function TodayView({ onOpen, onCreate }: { onOpen: (projectId: string, view?: string, itemId?: string) => void; onCreate: () => void }) {
  const { projects, items, activeId, ready, loadError } = useProjects()
  const [capture, setCapture] = useState("")
  const [projectId, setProjectId] = useState(activeId || projects[0]?.id || "")
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const workspaceSearch = useQuery({ queryKey: ["workspace-search", searchQuery], enabled: isDesktop && searchQuery.trim().length > 2, queryFn: () => invokeCommand<WorkspaceSearchResult[]>("workspace_search", { query: searchQuery }) })
  const date = localDate()
  const tasks = useMemo(() => items.filter(item => item.type === "task" && item.status !== "done"), [items])
  const overdue = tasks.filter(task => task.dueDate && task.dueDate.slice(0, 10) < date)
  const today = tasks.filter(task => task.dueDate?.slice(0, 10) === date)
  const activity = useQuery({ queryKey: ["run-history", "today"], enabled: isDesktop, queryFn: () => invokeCommand<RunRecord[]>("get_run_history"), refetchInterval: 30_000 })
  const schedules = useQuery({ queryKey: ["agenda-reminders"], enabled: isDesktop, queryFn: () => invokeCommand<SavedAutomation[]>("get_automations"), refetchInterval: 30_000 })
  const reminders = [...(schedules.data ?? [])].filter(item => item.enabled && item.next_run != null).sort((a, b) => (a.next_run ?? 0) - (b.next_run ?? 0)).slice(0, 6)
  const captureTask = async () => {
    if (!capture.trim() || !projectId) return
    setError(null)
    try {
      useProjects.getState().saveItem({ id: crypto.randomUUID(), projectId, type: "task", title: capture.trim(), status: "todo", dueDate: date })
      await flushProjects()
      setCapture("")
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }
  const taskList = (label: string, records: ProjectItem[]) => <section className="today-section"><h3>{label} <small>{records.length}</small></h3>{records.length ? <ul className="today-rows">{records.map(task => <li key={task.id}><button type="button" onClick={() => onOpen(task.projectId, "tasks", task.id)}><span><strong dir="auto">{task.title}</strong><small>{projects.find(project => project.id === task.projectId)?.name} · {task.dueDate}</small></span><ArrowUpRight size={16} /></button></li>)}</ul> : <p className="text-muted-foreground">Nothing scheduled here.</p>}</section>
  return <div className="today-view"><header className="today-heading"><span className="instrument-label">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span><h2>Today</h2><p>Tasks, reminders, and the work you have actually run.</p></header>
    <form className="today-capture" onSubmit={event => { event.preventDefault(); void captureTask() }}><Field><FieldLabel htmlFor="today-capture">Quick capture</FieldLabel><Input id="today-capture" value={capture} onChange={event => setCapture(event.target.value)} placeholder="A task to remember today…" /></Field><Select value={projectId} onValueChange={setProjectId}><SelectTrigger aria-label="Capture project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent><SelectGroup>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectGroup></SelectContent></Select><Button type="submit" variant="outline" disabled={!capture.trim() || !projectId || !ready || Boolean(loadError)}><Plus data-icon="inline-start" />Add task</Button></form>
    {(error || loadError) && <p role="alert" className="project-error">{error || loadError}</p>}
    <section className="today-section today-search"><Field><FieldLabel htmlFor="today-search">Search workspace memory</FieldLabel><Input id="today-search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Messages, facts, files, project work…" /></Field>{workspaceSearch.isError && <p role="alert">{workspaceSearch.error.message}</p>}{workspaceSearch.data?.length ? <ul className="today-rows">{workspaceSearch.data.map(item => <li key={`${item.source}-${item.id}`}><span><strong dir="auto">{item.title}</strong><small>{item.source} · {item.kind}{item.id ? ` · ${item.id}` : ""}</small></span></li>)}</ul> : searchQuery.trim().length > 2 && !workspaceSearch.isFetching ? <p className="text-muted-foreground">No matching workspace records.</p> : null}</section>
    {!projects.length && <Empty><EmptyHeader><EmptyTitle>Give your tasks a home</EmptyTitle><EmptyDescription>Create a project, then capture a next step.</EmptyDescription></EmptyHeader><Button variant="outline" onClick={onCreate} disabled={!ready}>Create project</Button></Empty>}
    <div className="today-grid">{taskList("Overdue", overdue)}{taskList("Today’s tasks", today)}<section className="today-section"><h3>Upcoming reminders</h3>{schedules.isError && <p role="alert">{schedules.error.message}</p>}{reminders.length ? <ul className="today-rows">{reminders.map(reminder => <li key={reminder.id}><span><strong>{reminder.name}</strong><small>{new Date((reminder.next_run ?? 0) * 1000).toLocaleString()}</small></span></li>)}</ul> : <p className="text-muted-foreground">No upcoming reminders.</p>}</section><section className="today-section"><h3>Recent activity</h3>{activity.isError && <p role="alert">{activity.error.message}</p>}{activity.data?.length ? <ul className="today-rows">{activity.data.slice(0, 8).map(run => <li key={run.id}><button type="button" disabled={!run.project_id} onClick={() => run.project_id && onOpen(run.project_id, "history")}><span><strong>{run.utterance.slice(0, 100)}</strong><small>{run.status.replaceAll("_", " ")} · {new Date(run.created_at).toLocaleTimeString()}</small></span><ArrowUpRight size={16} /></button></li>)}</ul> : <p className="text-muted-foreground">Run activity appears here after you send a request.</p>}</section></div>
  </div>
}
