import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { completeGuide, deferGuide, readGuideStep, rememberGuideStep, shouldShowGuide } from "../src/lib/onboarding"

describe("resumable onboarding", () => {
  let records: Map<string, string>
  beforeEach(() => {
    records = new Map()
    vi.stubGlobal("localStorage", { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => records.set(key, value) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it("keeps leaving for settings separate from completion and remembers the current step", () => {
    expect(shouldShowGuide()).toBe(true)
    rememberGuideStep(2)
    deferGuide()
    expect(readGuideStep(5)).toBe(2)
    expect(shouldShowGuide()).toBe(false)
    expect(records.has("friday_onboarded_v1_0")).toBe(false)
    expect(records.has("friday_onboarded")).toBe(false)
    completeGuide()
    expect(records.get("friday_onboarded_v1_0")).toBe("true")
    expect(records.get("friday_onboarded")).toBe("true")
  })
  it("starts safely when saved progress is invalid or belongs to an older guide", () => {
    for (const value of ["oops", "-1", "9", "2.5", "Infinity"]) {
      records.set("friday-guide-step-v1", value)
      expect(readGuideStep(5)).toBe(0)
    }
  })
  it("respects existing completion", () => {
    records.set("friday_onboarded_v1_0", "true")
    expect(shouldShowGuide()).toBe(false)
  })
  it("does not report successful dismissal when storage fails", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Unavailable") }, setItem: () => { throw new Error("Full") } })
    expect(shouldShowGuide()).toBe(true)
    expect(readGuideStep(5)).toBe(0)
    expect(() => deferGuide()).toThrow("Full")
    expect(() => completeGuide()).toThrow("Full")
  })
})
