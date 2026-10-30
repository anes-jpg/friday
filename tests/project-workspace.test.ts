import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("personal project workspaces", () => {
  let saved: Map<string, string>
  beforeEach(() => {
    vi.resetModules()
    saved = new Map()
    vi.stubGlobal("localStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
  })
  afterEach(() => { vi.unstubAllGlobals() })
  it("starts empty without demo projects or completed tasks", async () => {
    const { useProjects } = await import("../src/lib/projects")
    expect(useProjects.getState().projects).toEqual([])
    expect(useProjects.getState().items).toEqual([])
    expect(useProjects.getState().loadError).toBeNull()
  })
  it("keeps customization, tasks, and notes through reload, isolated by project", async () => {
    const { useProjects, projectFromDraft, emptyProjectDraft, buildProjectPrompt } = await import("../src/lib/projects")
    const first = projectFromDraft({ ...emptyProjectDraft, name: "Atlas", instructions: "Use DZD.", responseLanguage: "fr", contextLinks: "https://example.com" })
    const second = projectFromDraft({ ...emptyProjectDraft, name: "Second" })
    useProjects.getState().saveProject(first); useProjects.getState().saveProject(second)
    useProjects.getState().saveItem({ id: "task-one", projectId: first.id, type: "task", title: "Research stores", status: "todo" })
    expect(buildProjectPrompt(first, "Prepare a plan")).toContain("Reply in French.")
    vi.resetModules()
    const reloaded = (await import("../src/lib/projects")).useProjects.getState()
    expect(reloaded.projects.find(project => project.id === first.id)?.instructions).toBe("Use DZD.")
    expect(reloaded.items.filter(item => item.projectId === second.id)).toEqual([])
    expect(reloaded.items[0].status).toBe("todo")
  })
  it("preserves an empty legacy workspace rather than restoring seeded defaults", async () => {
    saved.set("friday_workspace_projects_v1", "[]"); saved.set("friday_workspace_items_v1", "[]")
    const { useProjects } = await import("../src/lib/projects")
    expect(useProjects.getState().projects).toEqual([])
  })
  it("reports persistence failure without changing the in-memory project list", async () => {
    const { useProjects, projectFromDraft, emptyProjectDraft } = await import("../src/lib/projects")
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("Storage full") } })
    expect(() => useProjects.getState().saveProject(projectFromDraft({ ...emptyProjectDraft, name: "Unsaved" }))).toThrow("Storage full")
    expect(useProjects.getState().projects).toHaveLength(0)
  })
  it("refuses unsafe reference URLs before saving", async () => {
    const { projectFromDraft, emptyProjectDraft } = await import("../src/lib/projects")
    expect(() => projectFromDraft({ ...emptyProjectDraft, name: "Invalid", contextLinks: "javascript:alert(1)" })).toThrow(/HTTP/)
  })
  it("validates arbitrary languages at the field that needs attention", async () => {
    const { projectDraftIssue, projectFromDraft, emptyProjectDraft } = await import("../src/lib/projects")
    expect(projectDraftIssue({ ...emptyProjectDraft, name: "Research", responseLanguage: " " })?.field).toBe("responseLanguage")
    expect(projectDraftIssue({ ...emptyProjectDraft, name: "Research", responseLanguage: "x".repeat(81) })?.field).toBe("responseLanguage")
    expect(projectFromDraft({ ...emptyProjectDraft, name: "Research", responseLanguage: "Español" }).responseLanguage).toBe("Español")
    expect(projectFromDraft({ ...emptyProjectDraft, name: "بحث", responseLanguage: "العربية" }).responseLanguage).toBe("العربية")
    expect(projectDraftIssue({ ...emptyProjectDraft, name: "x".repeat(120) })).toBeUndefined()
  })
  it("preserves corrupt saved records and blocks overwriting them", async () => {
    const { emptyProjectDraft, projectFromDraft } = await import("../src/lib/projects")
    const project = projectFromDraft({ ...emptyProjectDraft, name: "Saved" })
    const data = JSON.stringify({ version: 2, activeId: project.id, projects: [{ ...project, contextLinks: ["javascript:alert(1)"] }], items: [] })
    saved.set("friday-project-workspace-v2", data)
    vi.resetModules()
    const store = (await import("../src/lib/projects")).useProjects.getState()
    expect(store.loadError).toContain("Existing records have been kept")
    expect(() => store.saveProject(project)).toThrow(/could not be read/)
    expect(saved.get("friday-project-workspace-v2")).toBe(data)
  })
})
