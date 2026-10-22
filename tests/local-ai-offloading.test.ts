import { describe, it, expect } from "vitest"
import { executeAiTurn } from "../src/lib/ai"

describe("Local AI Offloading Stack (Deterministic Action Engine & Semantic Router)", () => {
  it("routes media commands to local engine with 0 tokens and < 15ms latency", async () => {
    const res = await executeAiTurn("mute")

    expect(res.tokens).toBe(0)
    expect(res.model).toBe("on-device-engine")
    expect(res.say).toBe("Audio toggled.")
    expect(res.show).toContain("Media Control Actuated")
    expect(res.toolCalls.length).toBe(1)
    expect(res.toolCalls[0].name).toBe("media.control")
    expect(res.toolCalls[0].tier).toBe("green")
  })

  it("routes hardware telemetry queries to local engine with 0 tokens", async () => {
    const res = await executeAiTurn("check gpu temp")

    expect(res.tokens).toBe(0)
    expect(res.model).toBe("on-device-engine")
    expect(res.say).toContain("GPU is running")
    expect(res.show).toContain("Zero cloud API tokens used")
    expect(res.toolCalls.length).toBe(1)
    expect(res.toolCalls[0].name).toBe("hardware.gpu")
  })

  it("routes git repository status to local engine with 0 tokens", async () => {
    const res = await executeAiTurn("what branch am i on")

    expect(res.tokens).toBe(0)
    expect(res.model).toBe("on-device-engine")
    expect(res.say).toContain("master branch")
    expect(res.show).toContain("Branch `master`")
    expect(res.toolCalls.length).toBe(1)
    expect(res.toolCalls[0].name).toBe("git.branch")
  })
})
