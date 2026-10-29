import { describe, expect, it } from "vitest"
import { runAnalytics, taskSnapshot } from "../src/lib/task-analytics"
import { memoryLinks } from "../src/lib/memory-graph"
import type { RunRecord } from "../src/lib/workspace-native"
import type { ProjectItem } from "../src/lib/projects"
import type { Fact } from "../src/lib/types"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryGraph } from "../src/components/memory/MemoryGraph"

const now = new Date(2026, 9, 29, 12)
function run(id: string, status: string, offset: number, duration = 1000): RunRecord {
  const date = new Date(now)
  date.setDate(date.getDate() + offset)
  return { id, status, created_at: date.getTime(), updated_at: date.getTime() + duration, utterance: id, project_id: null, thread_id: "thread", provider_profile_id: null, request_id: null }
}
describe("Recorded task and run analytics", () => {
  it("does not count active runs as finished or assume an empty completion rate", () => {
    expect(runAnalytics([], 7, now).successRate).toBeNull()
    const result = runAnalytics([run("a", "completed", -1), run("b", "failed", -1), run("c", "cancelled", -1), run("d", "interrupted", -1), run("e", "running", -1), run("f", "awaiting_confirmation", -1)], 7, now)
    expect(result).toMatchObject({ total: 6, finished: 4, completed: 1, successRate: 25 })
  })
  it("includes the first calendar day and excludes older and future records", () => {
    const boundary = run("first", "completed", -6)
    const first = new Date(boundary.created_at); first.setHours(0, 0, 0, 0); boundary.created_at = first.getTime()
    const result = runAnalytics([boundary, run("old", "completed", -7), run("future", "completed", 1)], 7, now)
    expect(result.total).toBe(1)
    expect(result.buckets[0].total).toBe(1)
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(result.total)
  })
  it("uses both middle values for an even median and rejects negative elapsed durations", () => {
    expect(runAnalytics([run("a", "completed", -1, 1000), run("b", "failed", -1, 3000), run("c", "completed", -1, -1)], 7, now).median).toBe(2000)
  })
  it("counts only tasks, excludes completed deadlines, and uses the local calendar date", () => {
    const items: ProjectItem[] = [
      { id: "a", projectId: "p", type: "task", title: "Overdue", status: "todo", dueDate: "2026-10-28" },
      { id: "b", projectId: "p", type: "task", title: "Today", status: "in-progress", dueDate: "2026-10-29" },
      { id: "c", projectId: "p", type: "task", title: "Done", status: "done", dueDate: "2026-10-27" },
      { id: "d", projectId: "p", type: "note", title: "Note", status: "todo", dueDate: "2026-10-27" },
    ]
    expect(taskSnapshot(items, now)).toEqual({ total: 3, done: 1, active: 1, todo: 1, overdue: 1 })
  })
})

function fact(id: string, subject: string, source: string): Fact {
  return { id, subject, value: id, source_message_id: source, confidence: 1, tier: "semantic", pinned: false, created_at: now.toISOString() }
}
describe("Explainable memory associations", () => {
  it("connects shared subjects and actual source messages without linking all manual entries", () => {
    const links = memoryLinks([fact("a", "Writing", "user-direct"), fact("b", " writing ", "user-direct"), fact("c", "Travel", "user-direct"), fact("d", "Food", "message-1"), fact("e", "Places", "message-1")])
    expect(links).toEqual([{ from: "a", to: "b", kind: "subject" }, { from: "d", to: "e", kind: "source" }])
  })
  it("does not generate self-links or duplicate links for matching subject and source", () => {
    expect(memoryLinks([fact("a", "Same", "m"), fact("b", "Same", "m")])).toEqual([{ from: "a", to: "b", kind: "subject" }])
  })
  it("renders a selected record beyond the first graph page with keyboard semantics", () => {
    const facts = Array.from({ length: 80 }, (_, index) => fact(`f-${index}`, `Subject ${index}`, "user-direct"))
    const markup = renderToStaticMarkup(createElement(MemoryGraph, { facts, selectedId: "f-79", onSelect: () => {} }))
    expect(markup).toContain("Page 2 of 2")
    expect(markup).toContain('aria-label="Subject 79: f-79"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup.match(/role="button"/g)).toHaveLength(16)
    expect(markup).not.toContain('aria-label="Subject 0: f-0"')
  })
})
