import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

describe("integrated workspace surfaces", () => {
  let storage: Map<string, string>
  beforeEach(() => {
    vi.resetModules()
    storage = new Map()
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(`session:${key}`) ?? null, setItem: (key: string, value: string) => storage.set(`session:${key}`, value), removeItem: (key: string) => storage.delete(`session:${key}`) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it("renders ordinary undated tasks and business discovery actions on Today", async () => {
    storage.set("friday-project-workspace-v2", JSON.stringify({ version: 2, activeId: "atlas", projects: [{ id: "atlas", name: "Atlas", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }], items: [{ id: "backlog", projectId: "atlas", type: "task", title: "Ship the business homepage", status: "todo" }, { id: "personal", projectId: "", type: "task", title: "Personal undated task", status: "todo" }] }))
    const { useProjects, saveDurableItem } = await import("../src/lib/projects")
    const { TodayView } = await import("../src/surfaces/console/TodayView")
    const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(TodayView, { onOpen: () => {}, onCreate: () => {} })))
    const markup = render()
    expect(markup).toContain("Ship the business homepage")
    expect(markup).toContain("Personal undated task")
    expect(markup).toContain("Find businesses. Build websites.")
    expect(markup).toContain('aria-label="Complete Ship the business homepage"')
    expect(markup).toContain("Work on this")
    await saveDurableItem({ ...useProjects.getState().items[0], status: "done" })
    vi.resetModules()
    const reloaded = (await import("../src/surfaces/console/TodayView")).TodayView
    const afterRestart = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(reloaded, { onOpen: () => {}, onCreate: () => {} })))
    expect(afterRestart).not.toContain("Ship the business homepage")
  }, 15_000)
  it("hands a prepared website request and selected source to the shared Work route without starting an unreviewed run", async () => {
    const dispatch = vi.fn()
    vi.stubGlobal("window", { dispatchEvent: dispatch })
    const { useProjects, projectFromDraft, emptyProjectDraft } = await import("../src/lib/projects")
    const project = projectFromDraft({ ...emptyProjectDraft, name: "Website" })
    useProjects.getState().saveProject(project)
    const { prepareWorkRequest } = await import("../src/lib/work-navigation")
    const { useFriday } = await import("../src/lib/store")
    const { useDailyWork } = await import("../src/lib/daily-work")
    prepareWorkRequest(project.id, "Build the draft", ["business-source"], "task-2")
    expect(useFriday.getState().tab).toBe("projects")
    expect(useDailyWork.getState().selectedSourceIds).toEqual(["business-source"])
    expect(useDailyWork.getState().selectedTaskId).toBe("task-2")
    expect(JSON.parse(storage.get("session:friday-open-work-record") || "{}")).toMatchObject({ projectId: project.id, request: "Build the draft", view: "overview" })
    const event = dispatch.mock.calls[0][0] as CustomEvent<{ request: string }>
    expect(event.type).toBe("friday:open-work-record")
    expect(event.detail.request).toBe("Build the draft")
    expect(useFriday.getState().orb).toBe("idle")
  })
})
