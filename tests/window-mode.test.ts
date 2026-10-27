import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("../src/lib/ipc", () => ({ isDesktop: false, invokeCommand: vi.fn() }))
import { useWindowMode } from "../src/lib/window-mode"

beforeEach(() => {
  useWindowMode.setState({ fullscreen: false, spatial: false, busy: false, error: null, previousFullscreen: false })
  const documentMock = {
    fullscreenElement: null as object | null,
    documentElement: { requestFullscreen: vi.fn(async () => { documentMock.fullscreenElement = {} }) },
    exitFullscreen: vi.fn(async () => { documentMock.fullscreenElement = null }),
  }
  vi.stubGlobal("document", documentMock)
})
describe("Window mode ownership", () => {
  it("restores an existing ordinary fullscreen state on spatial exit", async () => {
    await useWindowMode.getState().toggleFullscreen()
    await useWindowMode.getState().enterSpatial()
    await useWindowMode.getState().exitSpatial()
    expect(useWindowMode.getState()).toMatchObject({ fullscreen: true, spatial: false })
    expect(document.exitFullscreen).not.toHaveBeenCalled()
  })
  it("exits spatial mode once and ignores repeated exits", async () => {
    await useWindowMode.getState().enterSpatial()
    await useWindowMode.getState().exitSpatial()
    await useWindowMode.getState().exitSpatial()
    expect(document.exitFullscreen).toHaveBeenCalledOnce()
    expect(useWindowMode.getState()).toMatchObject({ fullscreen: false, spatial: false })
  })
  it("keeps the previous window mode when fullscreen is rejected", async () => {
    vi.mocked(document.documentElement.requestFullscreen).mockRejectedValueOnce(new Error("Permission denied"))
    expect(await useWindowMode.getState().enterSpatial()).toBe(false)
    expect(useWindowMode.getState()).toMatchObject({ fullscreen: false, spatial: false, busy: false })
    expect(useWindowMode.getState().error).toContain("Permission denied")
  })
})
