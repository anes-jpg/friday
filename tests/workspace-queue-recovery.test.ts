/** Regression coverage for the workspace write-queue recovery slice (audit F04).
 *
 * A failed write must never poison the queue: later saves still run, the
 * originating UI reports the failure immediately, and `flushWorkspaceWrites`
 * surfaces the pending failure exactly once before resolving clean again.
 */

import { describe, expect, it } from "vitest"
import { flushWorkspaceWrites, queueWorkspaceWrite } from "../src/lib/workspace-native"

describe("workspace write queue recovery", () => {
  it("keeps running later writes after one write fails and reports it once", async () => {
    const reported: string[] = []
    const executed: string[] = []

    queueWorkspaceWrite(async () => {
      executed.push("first")
      throw new Error("storage temporarily unavailable")
    }, error => reported.push(error.message))

    queueWorkspaceWrite(async () => {
      executed.push("second")
    }, error => reported.push(error.message))

    await expect(flushWorkspaceWrites()).rejects.toThrow("storage temporarily unavailable")
    await flushWorkspaceWrites()

    expect(executed).toEqual(["first", "second"])
    expect(reported).toEqual(["storage temporarily unavailable"])
  })

  it("resolves cleanly again once the failure has been surfaced", async () => {
    const executed: string[] = []

    queueWorkspaceWrite(async () => { executed.push("third") }, () => {})

    await expect(flushWorkspaceWrites()).resolves.toBeUndefined()
    expect(executed).toEqual(["third"])
  })
})
