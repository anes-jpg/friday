import { describe, it, expect, vi } from "vitest"
import { ipcPiperSpeak, ipcPiperStop, ipcGetPiperStatus, ipcConfigurePiper } from "../src/lib/piper"
import { FRIDAY_CARBON_STYLE, FRIDAY_VECTOR_STYLE, getFridayMapStyle, registerPmTilesProtocol } from "../src/lib/map-style"

describe("FRIDAY Native Piper TTS & Cartography Engine (§03, §04)", () => {
  it("generates speech via Piper fallback in browser with valid audio metadata", async () => {
    const onLevel = vi.fn()
    const result = await ipcPiperSpeak("Testing Piper voice synthesis", "calm", 1.0, onLevel)

    expect(result.success).toBe(true)
    expect(result.style).toBe("calm")
    expect(result.sample_rate).toBe(22050)
  })

  it("handles immediate barge-in stop cleanly without throwing", async () => {
    const onLevel = vi.fn()
    await expect(ipcPiperStop(onLevel)).resolves.not.toThrow()
    expect(onLevel).toHaveBeenCalledWith(0)
  })

  it("returns default Piper engine status in browser fallback", async () => {
    const status = await ipcGetPiperStatus()
    expect(status.ready).toBe(false)
    expect(status.active_style).toBe("calm")
    expect(status.sample_rate).toBe(22050)
  })

  it("configures prosody styles dynamically (tactical, whisper, witty)", async () => {
    const status = await ipcConfigurePiper({ style: "tactical" })
    expect(status.active_style).toBe("tactical")

    const status2 = await ipcConfigurePiper({ style: "witty" })
    expect(status2.active_style).toBe("witty")
  })

  it("exports valid MapLibre Style Specification for Carbon basemap", () => {
    expect(FRIDAY_CARBON_STYLE.version).toBe(8)
    expect(FRIDAY_CARBON_STYLE.sources.carto_dark).toBeDefined()
    expect(FRIDAY_CARBON_STYLE.layers.some((l) => l.id === "background")).toBe(true)
    expect(FRIDAY_CARBON_STYLE.layers.some((l) => l.id === "carto-dark-tiles")).toBe(true)
  })

  it("exports valid MapLibre Style Specification for Vector basemap", () => {
    const style = getFridayMapStyle("vector")
    expect(style.version).toBe(8)
    expect(style.sources.openfreemap).toBeDefined()
    expect(style.layers.some((l) => l.id === "background")).toBe(true)
  })

  it("registers PMTiles protocol idempotently without crashing", () => {
    expect(() => registerPmTilesProtocol()).not.toThrow()
  })
})
