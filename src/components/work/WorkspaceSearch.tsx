import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useDailyWork } from "@/lib/daily-work"
import { useProjects } from "@/lib/projects"
import { useFriday } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { openWorkRecord } from "@/lib/work-navigation"

export interface WorkspaceSearchResult { source: string; kind: string; id: string; projectId?: string; threadId?: string; title: string }
export function openSearchResult(result: WorkspaceSearchResult) {
  if (result.kind === "capture") {
    const capture = useDailyWork.getState().captures.find(record => record.id === result.id)
    if (capture) useDailyWork.getState().openCapture(capture)
  } else if (result.source === "thread" || result.source === "message") {
    useFriday.getState().setActiveThread(result.source === "thread" ? result.id : result.threadId || "")
    useFriday.getState().setTab("chat")
    sessionStorage.setItem("friday-open-message", result.id)
  } else if (result.kind === "routine") { useDailyWork.setState({ routineOpen: true }); sessionStorage.setItem("friday-open-routine", result.id) }
  else if (result.kind === "resume") { openWorkRecord(result.projectId || "", "overview") }
  else if (result.source === "fact") useFriday.getState().setTab("memory")
  else {
    const item = useProjects.getState().items.find(record => record.id === result.id)
    if (result.kind === "project") openWorkRecord(result.id)
    else openWorkRecord(item?.projectId || result.projectId || "", result.kind === "note" ? "notes" : "tasks", result.id)
  }
  useDailyWork.setState({ searchOpen: false })
}
export function WorkspaceSearch() {
  const { searchOpen, captures, routines, resumes } = useDailyWork()
  const { projects, items } = useProjects()
  const threads = useFriday(state => state.threads)
  const [query, setQuery] = useState("")
  const native = useQuery({ queryKey: ["work-search", query], enabled: isDesktop && searchOpen && query.trim().length > 1, queryFn: () => invokeCommand<WorkspaceSearchResult[]>("workspace_search", { query }) })
  const browser: WorkspaceSearchResult[] = [
    ...projects.map(record => ({ source: "record", kind: "project", id: record.id, title: record.name })),
    ...items.map(record => ({ source: "record", kind: record.type, id: record.id, projectId: record.projectId, title: record.title, text: record.description })),
    ...captures.map(record => ({ source: "record", kind: "capture", id: record.id, title: record.title, text: record.text })),
    ...routines.map(record => ({ source: "record", kind: "routine", id: record.id, title: record.name })),
    ...resumes.map(record => ({ source: "record", kind: "resume", id: record.id, projectId: record.projectId, title: record.checkpoint || record.name })),
    ...threads.flatMap(thread => [{ source: "thread", kind: "thread", id: thread.id, title: thread.title }, ...thread.messages.map(message => ({ source: "message", kind: message.role, id: message.id, threadId: thread.id, title: (message.show || message.content).slice(0, 160) }))]),
  ].filter(record => `${record.title} ${"text" in record ? record.text : ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 150)
  const results = query.trim().length > 1 ? isDesktop ? native.data || [] : browser : []
  return <Dialog open={searchOpen} onOpenChange={open => useDailyWork.setState({ searchOpen: open })}><DialogContent className="work-dialog"><DialogHeader><DialogTitle>Search workspace</DialogTitle><DialogDescription>Open a saved conversation, capture, task, or note.</DialogDescription></DialogHeader><Input aria-label="Search saved work" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the material you saved…" autoFocus />{native.isError && <p role="alert">{native.error.message}</p>}<div className="work-search-results">{results.map(record => <Button key={`${record.source}-${record.id}`} variant="ghost" onClick={() => openSearchResult(record)}><span>{record.title}</span><small>{record.kind}</small></Button>)}</div>{query.length > 1 && !results.length && !native.isFetching && <p>No matching saved records.</p>}</DialogContent></Dialog>
}
