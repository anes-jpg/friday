import { useFriday } from "./store"
import { useProjects } from "./projects"
import { useDailyWork, type ResumeRecord } from "./daily-work"

export function openWorkRecord(projectId: string, view = "overview", itemId?: string) {
  if (projectId) useProjects.getState().select(projectId)
  const record = { projectId, view, itemId }
  sessionStorage.setItem("friday-open-work-record", JSON.stringify(record))
  useFriday.getState().setTab("projects")
  window.dispatchEvent(new CustomEvent("friday:open-work-record", { detail: record }))
}
export function resumeProject(record: ResumeRecord) {
  useProjects.getState().select(record.projectId)
  useDailyWork.setState({ contextProjectId: record.projectId, selectedSourceIds: [...record.sourceIds], selectedTaskId: record.taskId })
  if (record.threadId) { useFriday.getState().setActiveThread(record.threadId); useFriday.getState().setTab("chat") }
  else openWorkRecord(record.projectId, record.taskId ? "tasks" : "overview", record.taskId)
}

export function openSavedSource(id: string) {
  const capture = useDailyWork.getState().captures.find(record => record.id === id)
  if (capture) { useDailyWork.getState().openCapture(capture); return }
  const item = useProjects.getState().items.find(record => record.id === id)
  if (item) openWorkRecord(item.projectId, item.type === "note" ? "notes" : "tasks", id)
  else useDailyWork.setState({ searchOpen: true })
}

export function openOrigin(origin: { threadId: string; messageId: string }) {
  sessionStorage.setItem("friday-open-message", origin.messageId)
  useFriday.getState().setActiveThread(origin.threadId)
  useFriday.getState().setTab("chat")
}
