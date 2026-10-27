import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFriday } from "../src/lib/store"
import * as ipc from "../src/lib/ipc"

describe("Saved action authority", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useFriday.setState({ facts: [{ id: "fact", subject: "Writing", value: "Keep it brief", confidence: 1, source_message_id: "user-direct", created_at: "2026-10-25", tier: "semantic", pinned: false }], automations: [] })
  })
  it("retains memory when a database delete fails", async () => {
    vi.spyOn(ipc, "deleteBackendFact").mockRejectedValueOnce(new Error("Database locked"))
    await expect(useFriday.getState().deleteFact("fact")).rejects.toThrow("Database locked")
    expect(useFriday.getState().facts[0].id).toBe("fact")
  })
  it("replaces stale memory with the authoritative empty list", async () => {
    vi.spyOn(ipc, "getBackendFacts").mockResolvedValueOnce([])
    await useFriday.getState().loadFactsFromBackend()
    expect(useFriday.getState().facts).toEqual([])
  })
  it("does not invent an automation when saving fails", async () => {
    vi.spyOn(ipc, "invokeCommand").mockRejectedValueOnce(new Error("Write failed"))
    await expect(useFriday.getState().addAutomation({ name: "Check", trigger: { type: "cron", expr: "0 9 * * *", tz: "UTC" }, actionTool: "system.info", enabled: true })).rejects.toThrow("Write failed")
    expect(useFriday.getState().automations).toEqual([])
  })
})
