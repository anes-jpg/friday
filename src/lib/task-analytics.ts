import type { ProjectItem } from "./projects"
import type { RunRecord } from "./workspace-native"

const terminal = new Set(["completed", "failed", "cancelled", "interrupted"])
export function taskSnapshot(items: ProjectItem[], now: Date) {
  const tasks = items.filter(item => item.type === "task")
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  return {
    total: tasks.length,
    done: tasks.filter(task => task.status === "done").length,
    active: tasks.filter(task => task.status === "in-progress").length,
    todo: tasks.filter(task => task.status === "todo").length,
    overdue: tasks.filter(task => task.status !== "done" && task.dueDate && /^\d{4}-\d{2}-\d{2}/.test(task.dueDate) && task.dueDate.slice(0, 10) < today).length,
  }
}

export function runAnalytics(runs: RunRecord[], days: number, now: Date) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days + 1)
  const windowRuns = runs.filter(run => run.created_at >= start.getTime() && run.created_at <= now.getTime())
  const finished = windowRuns.filter(run => terminal.has(run.status))
  const completed = finished.filter(run => run.status === "completed").length
  const durations = finished.filter(run => run.updated_at >= run.created_at).map(run => run.updated_at - run.created_at).sort((a, b) => a - b)
  const median = durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(date.getDate() + index)
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    const records = windowRuns.filter(run => run.created_at >= date.getTime() && run.created_at < next.getTime())
    return { date: date.getTime(), total: records.length, completed: records.filter(run => run.status === "completed").length }
  })
  return { total: windowRuns.length, completed, finished: finished.length, successRate: finished.length ? Math.round(completed / finished.length * 100) : null, median, buckets }
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "—"
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`
  return `${Math.floor(milliseconds / 60_000)}m ${Math.round(milliseconds % 60_000 / 1000)}s`
}
