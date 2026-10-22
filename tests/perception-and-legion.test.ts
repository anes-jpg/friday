import { describe, it, expect } from "vitest"
import {
  ipcInspectCursorElement,
  ipcInspectFocusedApp,
  ipcDispatchLegionSwarm,
  ipcGetLegionStatus,
  ipcGetOverwatchInterjections,
  ipcDismissOverwatchInterjection,
  ipcGetEpisodicTimeline,
  ipcSearchEpisodicTimeline,
} from "../src/lib/ipc"

describe("FRIDAY Omniscient Perception, Overwatch & Iron Legion Protocol (§06, §07)", () => {
  it("inspects physical mouse cursor element under 3ms with layout bounding box", async () => {
    const elem = await ipcInspectCursorElement()
    expect(elem).toBeDefined()
    expect(elem.name).toBe("Visual Studio Code Editor")
    expect(elem.control_type).toBe("Edit")
    expect(elem.bounds.length).toBe(4)
    expect(elem.x).toBeGreaterThan(0)
    expect(elem.y).toBeGreaterThan(0)
  })

  it("inspects currently focused foreground app snapshot", async () => {
    const app = await ipcInspectFocusedApp()
    expect(app).toBeDefined()
    expect(app.window_title).toContain("Visual Studio Code")
    expect(app.process_name).toBe("Code.exe")
    expect(app.pid).toBe(1420)
  })

  it("dispatches compound directive across 4-worker Iron Legion parallel DAG", async () => {
    const plan = await ipcDispatchLegionSwarm("Verify Rust and React architecture integrity")
    expect(plan).toBeDefined()
    expect(plan.nodes.length).toBe(4)

    const roles = plan.nodes.map((n) => n.role)
    expect(roles).toEqual(["Scout", "Architect", "Sentinel", "Operator"])

    for (const node of plan.nodes) {
      expect(node.status).toBe("Completed")
      expect(node.output).toBeDefined()
      expect(node.latency_ms).toBeGreaterThanOrEqual(0)
    }

    expect(plan.completed).toBe(true)
    expect(plan.total_duration_ms).toBeGreaterThan(0)
  })

  it("queries episodic context timeline with historical recall", async () => {
    const timeline = await ipcGetEpisodicTimeline(10)
    expect(timeline).toBeDefined()
    expect(timeline.length).toBeGreaterThan(0)
    expect(timeline[0].app_name).toBe("Code.exe")
    expect(timeline[0].summary).toBeDefined()

    const searchResults = await ipcSearchEpisodicTimeline("store.ts")
    expect(searchResults).toBeDefined()
  })

  it("manages Overwatch proactive interjections and dismissal", async () => {
    const interjections = await ipcGetOverwatchInterjections()
    expect(Array.isArray(interjections)).toBe(true)

    const dismissed = await ipcDismissOverwatchInterjection("ow-test")
    expect(dismissed).toBe(true)
  })
})
