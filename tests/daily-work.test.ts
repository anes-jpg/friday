import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("capture, save, and resume", () => {
  let saved: Map<string, string>
  beforeEach(() => {
    vi.resetModules()
    saved = new Map()
    vi.stubGlobal("localStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it("captures without a project, creates a linked task, and retrieves both after restart", async () => {
    const { useDailyWork, newCapture } = await import("../src/lib/daily-work")
    const { saveDurableItem } = await import("../src/lib/projects")
    const capture = newCapture({ text: "Review the design tomorrow", title: undefined })
    await useDailyWork.getState().saveCapture(capture)
    await saveDurableItem({ id: "task", projectId: "", type: "task", title: capture.title, description: capture.text, status: "todo", sourceIds: [capture.id] })
    vi.resetModules()
    expect((await import("../src/lib/daily-work")).useDailyWork.getState().captures[0].text).toBe(capture.text)
    expect((await import("../src/lib/projects")).useProjects.getState().items[0].sourceIds).toEqual([capture.id])
  })
  it("does not publish a failed save, retains the draft, and can retry", async () => {
    const { useDailyWork, newCapture } = await import("../src/lib/daily-work")
    const capture = newCapture({ text: "Keep this idea" })
    useDailyWork.getState().openCapture(capture)
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("Storage full") } })
    await expect(useDailyWork.getState().saveCapture(capture)).rejects.toThrow("Storage full")
    expect(useDailyWork.getState().captures).toEqual([])
    expect(useDailyWork.getState().draft.text).toBe("Keep this idea")
    vi.stubGlobal("localStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
    await useDailyWork.getState().saveCapture(capture)
    expect(useDailyWork.getState().captures).toHaveLength(1)
  })
  it("keeps old workspace records readable with additive defaults", async () => {
    saved.set("friday-project-workspace-v2", JSON.stringify({ version: 2, activeId: null, projects: [], items: [{ id: "old", projectId: "", type: "note", title: "Legacy", status: "todo" }] }))
    const store = (await import("../src/lib/projects")).useProjects.getState()
    expect(store.loadError).toBeNull()
    expect(store.items[0].title).toBe("Legacy")
  })
  it("preserves corrupted captures and prevents preferences from overwriting them", async () => {
    saved.set("friday-daily-work-v1", "{broken")
    const store = (await import("../src/lib/daily-work")).useDailyWork.getState()
    await expect(store.savePreferences(store.preferences)).rejects.toThrow("original data is retained")
    expect(saved.get("friday-daily-work-v1")).toBe("{broken")
  })
  it("removing a source chip removes it from the next request selection", async () => {
    const { useDailyWork } = await import("../src/lib/daily-work")
    useDailyWork.getState().selectSource("one", true)
    useDailyWork.getState().selectSource("two", true)
    useDailyWork.getState().selectSource("one", false)
    expect(useDailyWork.getState().selectedSourceIds).toEqual(["two"])
  })
  it("restores a checkpoint and its pinned context without executing anything", async () => {
    const { useDailyWork } = await import("../src/lib/daily-work")
    await useDailyWork.getState().saveResume({ id: "p", name: "Research", projectId: "p", threadId: "thread", taskId: "task", sourceIds: ["source"], checkpoint: "Compared two sources", links: ["https://example.com"], nextStep: "Check the disagreement", updatedAt: new Date().toISOString() })
    vi.resetModules()
    const checkpoint = (await import("../src/lib/daily-work")).useDailyWork.getState().resumes[0]
    expect(checkpoint.nextStep).toBe("Check the disagreement")
    expect(checkpoint.sourceIds).toEqual(["source"])
  })
  it("retains unsupported documents with a real explanation", async () => {
    const { captureFile } = await import("../src/lib/capture-input")
    const capture = await captureFile(new File(["binary"], "report.pdf"))
    expect(capture.text).toBe("")
    expect(capture.extractionError).toContain("not supported")
    expect(capture.path).toBe("report.pdf")
  })
  it("saves routines as definitions without granting approval", async () => {
    const { useDailyWork } = await import("../src/lib/daily-work")
    await useDailyWork.getState().saveRoutine({ id: "routine", name: "Prepare work", projectId: "p", pinned: true, sourceIds: [], steps: [{ kind: "prompt", text: "Summarize selected notes" }, { kind: "tool", tool: "shell.run", args: { binary: "git", args: ["status"] } }], updatedAt: new Date().toISOString() })
    expect(saved.get("friday-daily-work-v1")).not.toContain("approved")
    vi.resetModules()
    expect((await import("../src/lib/daily-work")).useDailyWork.getState().routines[0].steps).toHaveLength(2)
  })
})

describe("reminder interpretation", () => {
  it("resolves tomorrow against the configured timezone, including midnight boundaries", async () => {
    const { resolveReminderLanguage, previewWallTime } = await import("../src/lib/reminder-language")
    const now = new Date("2026-10-28T23:30:00Z")
    const schedule = resolveReminderLanguage("Remind me tomorrow at 9 AM to review this", "Africa/Lagos", now)
    expect(schedule).toEqual({ kind: "once", date: "2026-10-30", time: "09:00" })
    expect(previewWallTime(schedule.date, schedule.time, "Africa/Lagos", now).timestamp).toBe(new Date("2026-10-30T08:00:00Z").getTime() / 1000)
  })
  it("asks for AM/PM and rejects ambiguous dates, DST gaps, and folds", async () => {
    const { resolveReminderLanguage, previewWallTime } = await import("../src/lib/reminder-language")
    const now = new Date("2026-01-01T00:00:00Z")
    expect(() => resolveReminderLanguage("tomorrow at 9", "UTC", now)).toThrow("AM or 9 PM")
    expect(() => resolveReminderLanguage("11/02 at 9 AM", "UTC", now)).toThrow("Choose a date")
    expect(() => previewWallTime("2026-03-29", "02:30", "Europe/Paris", now)).toThrow("does not exist")
    expect(() => previewWallTime("2026-10-25", "02:30", "Europe/Paris", now)).toThrow("occurs twice")
  })
})
