import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from "react"
import { ProjectSetup } from "@/components/project/ProjectSetup"
import { useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable, columnFilteringFeature, globalFilteringFeature, rowSortingFeature, createFilteredRowModel, createSortedRowModel } from "@tanstack/react-table"
import { ArrowDownUp, ArrowUpRight, BookOpen, Code2, FolderOpen, Plus, RefreshCw, Settings2, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty"
import { useProjects, emptyProjectDraft, projectDraftError, projectFromDraft, projectPresets, presetItems, flushProjects, type ProjectPreset, type ProjectDraft, type WorkspaceProject, type ProjectItem } from "@/lib/projects"
import { CheckpointEditor } from "@/components/work/CheckpointEditor"
import { RecordSources, SavedNoteContent } from "@/components/work/RecordSources"
import { useDailyWork, newCapture, type Capture } from "@/lib/daily-work"
import { WebsitePreview } from "@/components/project/WebsitePreview"
import { BuilderStudio } from "@/components/project/BuilderStudio"
import { websiteBuildRequest, websiteSourceIds } from "@/lib/business-workflow"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { saveDurableItem } from "@/lib/projects"
import { resumeProject } from "@/lib/work-navigation"
import { TodayView } from "./TodayView"
import { RunHistoryView } from "./RunHistoryView"
import type { RunRecord } from "@/lib/workspace-native"
import { useSettings } from "@/lib/settings"
import { useFriday, sendChatMessage } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { ProjectMetadata } from "@/lib/types"

const CodeStudio = lazy(() => import("@/components/project/InAppCodeStudio").then(module => ({ default: module.InAppCodeStudio })))
const Terminal = lazy(() => import("@/components/project/InAppTerminal").then(module => ({ default: module.InAppTerminal })))
const GitViewer = lazy(() => import("@/components/project/InAppGitViewer").then(module => ({ default: module.InAppGitViewer })))
const taskFeatures = tableFeatures({ columnFilteringFeature, globalFilteringFeature, rowSortingFeature, filteredRowModel: createFilteredRowModel(), sortedRowModel: createSortedRowModel() })
const columnHelper = createColumnHelper<typeof taskFeatures, ProjectItem>()
const taskColumns = columnHelper.columns([
  columnHelper.accessor("title", { header: "Task" }),
  columnHelper.accessor("status", { header: "Status", cell: info => info.getValue().replaceAll("-", " ") }),
  columnHelper.accessor("priority", { header: "Priority", cell: info => info.getValue() || "medium" }),
  columnHelper.accessor("dueDate", { header: "Due", cell: info => info.getValue() || "Not set" }),
])


function TaskTable({ items, onEdit, onDelete, onAsk }: { items: ProjectItem[]; onEdit: (item: ProjectItem) => void; onDelete: (item: ProjectItem) => void; onAsk: (item: ProjectItem) => void }) {
  const table = useTable({ features: taskFeatures, columns: taskColumns, data: items, getRowId: row => row.id })
  return <div className="project-task-table"><Input aria-label="Search project tasks" placeholder="Find a task…" value={table.state.globalFilter ?? ""} onChange={event => table.setGlobalFilter(event.target.value)} /><Table><TableHeader>{table.getHeaderGroups().map(group => <TableRow key={group.id}>{group.headers.map(header => <TableHead key={header.id}><button type="button" onClick={header.column.getToggleSortingHandler()} aria-label={`Sort by ${header.column.id}`}><table.FlexRender header={header} /><ArrowDownUp size={13} /></button></TableHead>)}<TableHead><span className="sr-only">Task actions</span></TableHead></TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map(row => <TableRow key={row.id}>{row.getAllCells().map(cell => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}<TableCell><div className="project-row-actions"><Button variant="ghost" size="icon" aria-label={`Edit ${row.original.title}`} onClick={() => onEdit(row.original)}><Settings2 data-icon="inline-start" /></Button><Button variant="ghost" size="icon" aria-label={`Ask FRIDAY about ${row.original.title}`} onClick={() => onAsk(row.original)}><ArrowUpRight data-icon="inline-start" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${row.original.title}`} onClick={() => onDelete(row.original)}><Trash2 data-icon="inline-start" /></Button></div></TableCell></TableRow>)}{!table.getRowModel().rows.length && <TableRow><TableCell colSpan={5}>No tasks match this search.</TableCell></TableRow>}</TableBody></Table></div>
}

export function ProjectWorkspace() {
  const { projects, items, activeId, loadError, ready } = useProjects()
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [view, setView] = useState(() => sessionStorage.getItem("friday-work-view") || "today")
  const [setup, setSetup] = useState<"new" | WorkspaceProject | null>(null)
  const [itemEditor, setItemEditor] = useState<Partial<ProjectItem> | null>(null)
  const [itemTitle, setItemTitle] = useState("")
  const [itemDetails, setItemDetails] = useState("")
  const [itemStatus, setItemStatus] = useState<ProjectItem["status"]>("todo")
  const [itemPriority, setItemPriority] = useState<NonNullable<ProjectItem["priority"]>>("medium")
  const [itemDueDate, setItemDueDate] = useState("")
  const [instruction, setInstruction] = useState("")
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ project?: WorkspaceProject; item?: ProjectItem } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const selectedNotes = useDailyWork(state => state.selectedSourceIds)
  const captures = useDailyWork(state => state.captures)
  const setSelectedNotes = (update: (ids: string[]) => string[]) => useDailyWork.setState(current => ({ selectedSourceIds: update(current.selectedSourceIds) }))
  const profiles = useSettings(state => state.saved.profiles)
  const activeProfileId = useSettings(state => state.saved.activeProfileId)
  const threads = useFriday(state => state.threads)
  const project = projects.find(record => record.id === activeId) ?? projects[0]
  const projectItems = useMemo(() => items.filter(item => item.projectId === project?.id), [items, project?.id])
  const tasks = useMemo(() => projectItems.filter(item => item.type === "task"), [projectItems])
  const notes = useMemo(() => projectItems.filter(item => item.type === "note"), [projectItems])
  const metadata = useQuery({ queryKey: ["project-metadata", project?.id, project?.rootPath], enabled: isDesktop && Boolean(project?.rootPath), queryFn: () => invokeCommand<ProjectMetadata>("inspect_project_metadata", { path: project?.rootPath }) })
  const history = useQuery({ queryKey: ["run-history", project?.id], enabled: isDesktop && Boolean(project?.id) && ["history", "conversations"].includes(view), queryFn: () => invokeCommand<RunRecord[]>("get_run_history", { projectId: project?.id }), refetchInterval: view === "history" ? 10_000 : false })
  useEffect(() => {
    sessionStorage.setItem("friday-work-view", view)
    if (useDailyWork.getState().launchReady) void useDailyWork.getState().savePreferences({ previousWorkView: view as import("@/lib/daily-work").DailyPreferences["previousWorkView"] }).catch(failure => setError(String(failure)))
  }, [view])
  useEffect(() => {
    const open = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as { projectId?: string; view?: string; itemId?: string; request?: string; create?: boolean }
      if (detail.projectId) useProjects.getState().select(detail.projectId)
      sessionStorage.removeItem("friday-open-work-record")
      setView(detail.view || "overview")
      if (detail.create) setSetup("new")
      if (detail.request) setDraftPrompt(detail.request)
      if (detail.itemId) { const item = useProjects.getState().items.find(record => record.id === detail.itemId); if (item) editItem(item) }
    }
    const pending = sessionStorage.getItem("friday-open-work-record")
    if (pending) { try { open(new CustomEvent("friday:open-work-record", { detail: JSON.parse(pending) as unknown })) } catch { sessionStorage.removeItem("friday-open-work-record") } }
    window.addEventListener("friday:open-work-record", open)
    return () => window.removeEventListener("friday:open-work-record", open)
  }, [])
  const safeAction = (action: () => void) => { setError(null); try { action() } catch (failure) { setError(String(failure instanceof Error ? failure.message : failure)) } }
  const editItem = (item: Partial<ProjectItem>) => { setItemEditor(item); setItemTitle(item.title || ""); setItemDetails(item.description || ""); setItemStatus(item.status || "todo"); setItemPriority(item.priority || "medium"); setItemDueDate(item.dueDate || ""); setError(null) }
  const saveItem = async () => {
    if (!itemEditor || !itemTitle.trim()) { setError("Give this item a title."); return }
    setError(null)
    try { await saveDurableItem({ ...itemEditor, id: itemEditor.id ?? crypto.randomUUID(), projectId: itemEditor.projectId ?? project?.id ?? "", type: itemEditor.type || "task", title: itemTitle, description: itemDetails, status: itemStatus, priority: itemPriority, dueDate: itemDueDate || undefined }); setItemEditor(null) } catch (failure) { setError(String(failure)) }
  }
  const stageInstruction = async (text: string, source?: Partial<Capture>) => {
    if (!project || !text.trim()) return
    try {
      if (source) { const record = newCapture({ ...source, projectId: project.id, inbox: false }); await useDailyWork.getState().saveCapture(record); useDailyWork.getState().selectSource(record.id, true) }
      setDraftPrompt(text)
    } catch (failure) { setError(String(failure)) }
  }
  const send = async () => {
    if (!project || !draftPrompt) return
    setError(null); setSending(true)
    try {
      const threadId = project.threadId && useFriday.getState().threads.some(thread => thread.id === project.threadId) ? project.threadId : useFriday.getState().createThread(project.name)
      if (threadId !== project.threadId) { useProjects.getState().saveProject({ ...project, threadId }); await flushProjects() }
      useFriday.getState().setActiveThread(threadId)
      useFriday.getState().setTab("chat")
      const text = draftPrompt
      setDraftPrompt(null)
      await sendChatMessage(text, project.expanded, { projectId: project.id, providerProfileId: project.providerId || activeProfileId, threadId, sourceIds: [...new Set([...selectedNotes, ...useDailyWork.getState().selectedSourceIds])], taskId: useDailyWork.getState().selectedTaskId })
    } catch (failure) { setError(String(failure instanceof Error ? failure.message : failure)) }
    finally { setSending(false) }
  }
  const folderReady = Boolean(project?.rootPath) && isDesktop && metadata.isSuccess
  const runProjectCommand = async (command: string) => {
    if (!project) return
    const capturedProject = project
    const threadId = useFriday.getState().createThread(`Check: ${command}`)
    useFriday.getState().setTab("chat")
    await sendChatMessage(`Run project command: ${command}`, false, { projectId: capturedProject.id, providerProfileId: capturedProject.providerId || activeProfileId, threadId, sourceIds: [], toolCall: { name: "project.command", args: { command } } })
  }
  return <div className="project-workspace">
    <aside className="project-switcher"><header><span className="instrument-label">Your workspaces</span><Button variant="ghost" size="icon" aria-label="Create project" onClick={() => setSetup("new")} disabled={!ready || Boolean(loadError)}><Plus data-icon="inline-start" /></Button></header><h1>Work<span>.</span></h1><Button variant="ghost" onClick={() => setView("today")} aria-pressed={view === "today"}>Today</Button><Input aria-label="Search workspaces" placeholder="Find a project…" value={projectSearch} onChange={event => setProjectSearch(event.target.value)} /><div className="project-list">{projects.filter(record => `${record.name} ${record.tags.join(" ")}`.toLowerCase().includes(projectSearch.toLowerCase())).map(record => <button type="button" className={record.id === project?.id ? "is-current" : undefined} key={record.id} onClick={() => safeAction(() => { useProjects.getState().select(record.id); setView("overview"); setInstruction(""); const resume = useDailyWork.getState().resumes.find(value => value.projectId === record.id); useDailyWork.setState({ contextProjectId: record.id, selectedSourceIds: resume?.sourceIds || [], selectedTaskId: resume?.taskId }) })}><span className="project-monogram">{record.name.slice(0, 2).toUpperCase()}</span><span><strong dir="auto">{record.name}</strong><small>{record.kind} · {record.status}</small></span></button>)}</div><footer><span>{projects.length} saved workspaces</span><small>Stored on this device. Local files stay in your folder.</small></footer></aside>
    <main className="project-main">
      {loadError && <p className="project-error" role="alert">{loadError}</p>}
      {checkpointOpen && project && <CheckpointEditor project={project} onClose={() => setCheckpointOpen(false)} />}
      {view === "today" ? <TodayView onCreate={() => setSetup("new")} onOpen={(id, nextView, itemId) => { if (id) useProjects.getState().select(id); setView(nextView || "overview"); if (itemId) { const item = items.find(record => record.id === itemId); if (item) editItem(item) } }} /> : !project ? <div className="project-first-workspace"><span className="instrument-label">An idea needs a place.</span><h2>MAKE<br />SOMETHING<span>.</span></h2><p>Your code, research, references, tasks, and conversations — around a goal of your own.</p><Button variant="outline" onClick={() => setSetup("new")} disabled={Boolean(loadError)}><Plus data-icon="inline-start" />Create your first workspace</Button><div className="project-start-options"><span><Code2 size={18} />Build an app</span><span><BookOpen size={18} />Explore an idea</span><span><FolderOpen size={18} />Connect a folder</span></div></div> : <Fragment key={project.id}>
        <header className="project-heading" data-project-id={project.id}><div><span className="instrument-label">{project.kind} workspace / {project.status}</span><h2 dir="auto">{project.name}</h2><p dir="auto">{project.directive || "Set a goal in project customization."}</p></div><Button variant="outline" onClick={() => setCheckpointOpen(true)}>Save checkpoint</Button><Button variant="outline" onClick={() => setSetup(project)}><Settings2 data-icon="inline-start" />Customize</Button></header>
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger><TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger><TabsTrigger value="builder">Builder</TabsTrigger>{(project.kind === "code" || project.tags.includes("business-website")) && <TabsTrigger value="preview">Website preview</TabsTrigger>}<TabsTrigger value="code">Files</TabsTrigger><TabsTrigger value="terminal">Terminal</TabsTrigger><TabsTrigger value="git">Changes</TabsTrigger><TabsTrigger value="conversations">Conversations</TabsTrigger><TabsTrigger value="history">Run history</TabsTrigger></TabsList></Tabs>
        {error && !itemEditor && !draftPrompt && <p className="project-error" role="alert">{error}</p>}
        <div className="project-provider-context"><span>Project: {project.name}</span><span>Provider: {profiles.find(profile => profile.id === (project.providerId || activeProfileId))?.name || "Choose a provider in Settings"}</span><span>{selectedNotes.length} selected source{selectedNotes.length === 1 ? "" : "s"}</span></div>
        {view === "builder" && <BuilderStudio key={project.id} project={project} onPrepare={(request, sourceId) => { useDailyWork.setState({ contextProjectId: project.id, selectedTaskId: undefined, selectedSourceIds: [...new Set([...websiteSourceIds(project.id), sourceId])] }); void stageInstruction(request) }} />}
        {view === "history" && <RunHistoryView runs={history.data || []} pending={history.isPending && isDesktop} error={history.isError ? history.error.message : undefined} reload={() => history.refetch().then(() => undefined)} />}
        {view === "conversations" && <section className="project-items-view"><header><div><h3>Project conversations</h3><p>Continue the project conversation with its recorded context.</p></div><Button variant="outline" onClick={() => { const threadId = useFriday.getState().createThread(project.name); useProjects.getState().saveProject({ ...project, threadId }); useFriday.getState().setTab("chat") }}>New conversation</Button></header>{[...new Set([project.threadId, ...(history.data || []).map(run => run.thread_id)].filter((id): id is string => Boolean(id)))].map(id => <Button key={id} variant="ghost" onClick={() => { useFriday.getState().setActiveThread(id); useFriday.getState().setTab("chat") }}>{threads.find(thread => thread.id === id)?.title || "Project conversation"}<ArrowUpRight data-icon="inline-end" /></Button>)}{!project.threadId && !history.data?.length && <p>No conversation yet. Send the first request from Overview.</p>}</section>}
        {view === "overview" && useDailyWork.getState().resumes.find(record => record.projectId === project.id) && <section className="today-section"><h3>Last checkpoint</h3><p>{useDailyWork.getState().resumes.find(record => record.projectId === project.id)?.checkpoint}</p><Button variant="outline" onClick={() => { const record = useDailyWork.getState().resumes.find(record => record.projectId === project.id); if (record) resumeProject(record) }}>Continue conversation and pinned context</Button></section>}
        {view === "overview" && <div key={`overview-${project.id}`} className="project-overview project-execution-overview"><section className="project-execution"><header><div><span className="instrument-label">Next steps / {tasks.filter(task => task.status !== "done").length} open</span><h3>Move this project forward</h3></div><Button variant="outline" size="sm" onClick={() => setView("builder")}>Choose stack & blocks</Button><Button variant="ghost" size="sm" onClick={() => editItem({ type: "task" })}><Plus size={14} />Add task</Button></header>
          {project.tags.includes("business-website") && <div className="website-project-launch"><p>Your business source and brief are saved. Generate the website files, then review the desktop and mobile preview.</p><div><Button variant="outline" onClick={() => { useDailyWork.setState({ selectedSourceIds: websiteSourceIds(project.id), selectedTaskId: undefined }); void stageInstruction(websiteBuildRequest(project)) }}><Sparkles size={14} />Generate website draft</Button><Button variant="ghost" onClick={() => setView("preview")}>Website preview<ArrowUpRight size={14} /></Button></div></div>}
          <ul className="project-next-steps">{tasks.filter(task => task.status !== "done").slice(0, 8).map(task => <li key={task.id}><button type="button" onClick={() => editItem(task)}><span className="instrument-label">{task.status === "in-progress" ? "DOING" : "TO DO"}</span><strong>{task.title}</strong></button><Button variant="ghost" size="sm" onClick={() => { useDailyWork.setState({ selectedTaskId: task.id, selectedSourceIds: [...new Set([...(task.sourceIds || []), ...websiteSourceIds(project.id)])] }); void stageInstruction(`${task.title}\n${task.description || ""}`) }}>Work on this<ArrowUpRight size={14} /></Button></li>)}</ul>
          {!tasks.some(task => task.status !== "done") && <p className="place-source">Add a concrete next step, or describe the change you want below.</p>}
          <form className="project-work-composer" onSubmit={event => { event.preventDefault(); void stageInstruction(instruction) }}><Textarea aria-label="Project request" id="project-request" value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="What should FRIDAY build, research, or change?" dir="auto" rows={2} /><Button type="submit" variant="outline" disabled={!instruction.trim()}><Sparkles size={14} />Prepare request</Button></form>
          <Button variant="ghost" size="sm" onClick={() => setView("tasks")}>All tasks ({tasks.length})<ArrowUpRight size={14} /></Button>
        </section><div className="project-context-plates"><section><span className="instrument-label">Working folder</span><p className="project-folder" dir="auto">{project.rootPath || "No folder attached yet"}</p>{metadata.isPending && isDesktop && project.rootPath && <AsciiLoader label="Inspecting folder" />}{metadata.isError && <p className="project-error" role="alert">{metadata.error.message}</p>}{metadata.data && <p>{metadata.data.framework} · {metadata.data.totalFilesCount} files · {metadata.data.gitBranch || "No Git branch"}</p>}<Button variant="ghost" onClick={() => project.rootPath && isDesktop ? setView("code") : setSetup(project)}>{project.rootPath && isDesktop ? "Open files" : "Attach a folder"}<ArrowUpRight size={14} /></Button></section><section><span className="instrument-label">Sources & brief</span><p>{notes.length} saved notes · {captures.filter(source => source.projectId === project.id).length} captured sources</p><Button variant="ghost" onClick={() => setView("notes")}>Read project brief<ArrowUpRight size={14} /></Button>{project.contextLinks.map(link => <a href={link} key={link} target="_blank" rel="noopener noreferrer">{new URL(link).hostname}<ArrowUpRight size={13} /></a>)}</section><section><span className="instrument-label">Progress</span><strong className="project-counter">{tasks.filter(task => task.status === "done").length}<small> / {tasks.length}</small></strong><p>Tasks completed by you.</p><Button variant="ghost" onClick={() => setView("history")}>Recorded execution<ArrowUpRight size={14} /></Button></section></div></div>}
        {view === "preview" && <WebsitePreview key={project.id} project={project} onFiles={() => setView("code")} onGenerate={() => { useDailyWork.setState({ selectedSourceIds: websiteSourceIds(project.id), selectedTaskId: undefined, contextProjectId: project.id }); void stageInstruction(websiteBuildRequest(project)) }} />}
        {view === "tasks" && <section className="project-items-view"><header><div><h3>Tasks</h3><p>Track real tasks. Sending an instruction does not mark it complete.</p></div><Button variant="outline" onClick={() => editItem({ type: "task" })}><Plus data-icon="inline-start" />Add task</Button></header>{tasks.length ? <TaskTable items={tasks} onEdit={editItem} onDelete={item => setPendingDelete({ item })} onAsk={item => (() => { useDailyWork.setState({ selectedTaskId: item.id, contextProjectId: item.projectId || undefined }); stageInstruction(`${item.title}\n${item.description || ""}`) })()} /> : <Empty><EmptyHeader><EmptyMedia variant="icon"><Code2 /></EmptyMedia><EmptyTitle>No tasks yet</EmptyTitle><EmptyDescription>Add a specific next step for this project.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => editItem({ type: "task" })}>Add the first task</Button></EmptyContent></Empty>}</section>}
        {view === "notes" && <section className="project-items-view"><header><div><h3>Notes</h3><p>Decisions, research, and notes for this project.</p></div><Button variant="outline" onClick={() => editItem({ type: "note" })}><Plus data-icon="inline-start" />Add note</Button></header><div className="project-notes">{notes.map(note => <article key={note.id}><h4 dir="auto">{note.title}</h4><SavedNoteContent item={note} /><RecordSources item={note} />{note.sourceLinks?.map(link => <a key={link} href={link} target="_blank" rel="noopener noreferrer">{new URL(link).hostname}</a>)}<div><Button variant="ghost" aria-pressed={selectedNotes.includes(note.id)} onClick={() => setSelectedNotes(current => current.includes(note.id) ? current.filter(id => id !== note.id) : [...current, note.id])}>{selectedNotes.includes(note.id) ? "Remove from AI context" : "Use as cited context"}</Button><Button variant="ghost" onClick={() => editItem(note)}>Edit</Button><Button variant="ghost" onClick={() => setPendingDelete({ item: note })}>Delete</Button></div></article>)}</div>{!notes.length && <Empty><EmptyHeader><EmptyTitle>No notes yet</EmptyTitle><EmptyDescription>Save a decision or reference so it is easy to find later.</EmptyDescription></EmptyHeader></Empty>}</section>}
        {["code", "terminal", "git"].includes(view) && <div className="project-native-view">{folderReady && project.rootPath ? <Suspense fallback={<AsciiLoader label="Opening project tools" />}>{view === "code" ? <CodeStudio key={project.id} projectPath={project.rootPath} projectName={project.name} onAskFriday={stageInstruction} /> : view === "terminal" ? <Terminal key={project.id} projectPath={project.rootPath} projectName={project.name} onRunCommand={runProjectCommand} onAskFriday={stageInstruction} /> : <GitViewer key={project.id} projectPath={project.rootPath} projectName={project.name} onAskFriday={stageInstruction} />}</Suspense> : <Empty><EmptyHeader><EmptyMedia variant="icon"><FolderOpen /></EmptyMedia><EmptyTitle>{isDesktop ? "Attach a project folder" : "Local tools require Windows"}</EmptyTitle><EmptyDescription>{isDesktop ? "Connect an existing folder in project customization to browse files, run commands, and review changes." : "Your planning workspace, tasks, and notes work here. Open the Windows app to attach a folder and use its local tools."}</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => setSetup(project)}>Customize project</Button></EmptyContent></Empty>}</div>}
        <footer className="project-footer"><span>{project.rootPath ? "Folder connected" : "Planning workspace"} · Updated {new Date(project.updated_at).toLocaleDateString()}</span><Button variant="ghost" onClick={() => setPendingDelete({ project })}>Remove workspace</Button></footer>
      </Fragment>}
    </main>
    {setup && <ProjectSetup key={setup === "new" ? "new" : setup.id} project={setup === "new" ? undefined : setup} onClose={() => { setSetup(null); setView("overview") }} />}
    {itemEditor && <Dialog open onOpenChange={open => { if (!open) setItemEditor(null) }}><DialogContent className="project-item-dialog"><DialogHeader><DialogTitle>{itemEditor.id ? "Edit" : "New"} {itemEditor.type || "task"}</DialogTitle><DialogDescription>Saved in this project on your device.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); void saveItem() }}><FieldGroup><Field><FieldLabel htmlFor="project-item-title">Title</FieldLabel><Input id="project-item-title" value={itemTitle} onChange={event => setItemTitle(event.target.value)} autoFocus dir="auto" /></Field><Field><FieldLabel htmlFor="project-item-description">Details</FieldLabel><Textarea id="project-item-description" value={itemDetails} onChange={event => setItemDetails(event.target.value)} rows={4} dir="auto" /></Field>{itemEditor.type !== "note" && <Field><FieldLabel>Status</FieldLabel><Select value={itemStatus} onValueChange={value => setItemStatus(value as ProjectItem["status"])}><SelectTrigger aria-label="Task status"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="todo">To do</SelectItem><SelectItem value="in-progress">In progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectGroup></SelectContent></Select></Field>}
      {itemEditor.type !== "note" && <>
        <Field><FieldLabel>Priority</FieldLabel><Select value={itemPriority} onValueChange={value => setItemPriority(value as NonNullable<ProjectItem["priority"]>)}><SelectTrigger aria-label="Task priority"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectGroup></SelectContent></Select></Field>
        <Field><FieldLabel htmlFor="project-item-due">Due date (optional)</FieldLabel><Input id="project-item-due" type="date" value={itemDueDate} onChange={event => setItemDueDate(event.target.value)} /></Field>
      </>}
    </FieldGroup>{error && <p className="project-error" role="alert">{error}</p>}<DialogFooter><Button type="button" variant="ghost" onClick={() => setItemEditor(null)}>Cancel</Button><Button type="submit" variant="outline">Save {itemEditor.type || "task"}</Button></DialogFooter></form></DialogContent></Dialog>}
    {draftPrompt && <Dialog open onOpenChange={open => { if (!open && !sending) setDraftPrompt(null) }}><DialogContent className="project-request-dialog"><DialogHeader><DialogTitle>Send with project context.</DialogTitle><DialogDescription>Review the project, provider, and quoted sources. This request continues the project conversation.</DialogDescription></DialogHeader><p className="project-provider-context">{project?.name} · {profiles.find(profile => profile.id === (project?.providerId || activeProfileId))?.name || "Current provider"}</p><Field><FieldLabel htmlFor="project-prompt-preview">Request</FieldLabel><Textarea id="project-prompt-preview" value={draftPrompt} onChange={event => setDraftPrompt(event.target.value)} rows={12} dir="auto" /></Field>{error && <p className="project-error" role="alert">{error}</p>}<DialogFooter><Button variant="ghost" onClick={() => setDraftPrompt(null)} disabled={sending}>Cancel</Button><Button variant="outline" onClick={() => void send()} disabled={sending || !draftPrompt.trim()}>{sending ? "Sending…" : "Send & open conversation"}<ArrowUpRight data-icon="inline-end" /></Button></DialogFooter></DialogContent></Dialog>}
    {pendingDelete && <Dialog open onOpenChange={open => { if (!open) setPendingDelete(null) }}><DialogContent className="project-item-dialog"><DialogHeader><DialogTitle>Remove {pendingDelete.project ? "workspace" : pendingDelete.item?.type}?</DialogTitle><DialogDescription>{pendingDelete.project ? "This removes the saved workspace, tasks, and notes. Files in its local folder are kept." : `Remove “${pendingDelete.item?.title}” from this project.`}</DialogDescription></DialogHeader>{error && <p className="project-error" role="alert">{error}</p>}<DialogFooter><Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="outline" onClick={() => safeAction(() => { if (pendingDelete.project) useProjects.getState().removeProject(pendingDelete.project.id); else if (pendingDelete.item) useProjects.getState().removeItem(pendingDelete.item.id); setPendingDelete(null) })}>Remove</Button></DialogFooter></DialogContent></Dialog>}
  </div>
}
