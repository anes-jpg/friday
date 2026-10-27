import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), update: vi.fn() }))
vi.mock("../src/lib/ipc", () => ({ isDesktop: true, invokeCommand: mocks.invoke }))
vi.mock("../src/lib/store", () => ({ useFriday: { getState: () => ({ updateGlmSettings: mocks.update, setVoiceProfile: vi.fn(), setKokoroEndpoint: vi.fn(), setWakeWord: vi.fn(), setTheme: vi.fn() }), setState: vi.fn() } }))
import { useSettings, defaultSettings, validateSettings } from "../src/lib/settings"
beforeEach(() => {
  vi.clearAllMocks()
  const saved = defaultSettings()
  useSettings.setState({ saved, draft: structuredClone(saved), keys: {}, loaded: true, loading: false, saving: false, error: null })
  vi.stubGlobal("document", { documentElement: { classList: { toggle: vi.fn() } } })
})
describe("Settings commit behavior", () => {
  it("retains the complete draft and credential after a failed native write", async () => {
    useSettings.getState().edit((draft) => ({ ...draft, profiles: draft.profiles.map((profile) => ({ ...profile, name: "My endpoint" })) }))
    useSettings.getState().setKey("primary", "private-test-value")
    mocks.invoke.mockRejectedValueOnce(new Error("Disk full"))
    expect(await useSettings.getState().save()).toBe(false)
    expect(useSettings.getState().saved.profiles[0].name).toBe("Primary provider")
    expect(useSettings.getState().draft.profiles[0].name).toBe("My endpoint")
    expect(useSettings.getState().keys.primary).toBe("private-test-value")
    expect(useSettings.getState().error).toContain("Disk full")
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("applies only the settings returned by a successful native commit", async () => {
    const committed = { ...defaultSettings(), revision: 3 }
    mocks.invoke.mockResolvedValueOnce(committed)
    useSettings.getState().setKey("primary", "private-test-value")
    expect(await useSettings.getState().save()).toBe(true)
    expect(useSettings.getState().saved.revision).toBe(3)
    expect(useSettings.getState().keys).toEqual({})
    const payload = mocks.invoke.mock.calls[0][1] as { settings: object; keys: object }
    expect(JSON.stringify(payload.settings)).not.toContain("private-test-value")
    expect(mocks.update).toHaveBeenCalledOnce()
  })
  it("rejects invalid models, remote speech, and invalid capacity before writing", () => {
    const settings = defaultSettings()
    settings.profiles[0].model = ""
    expect(validateSettings(settings)).not.toBeNull()
    settings.profiles[0].model = "custom:model"
    settings.voice.endpoint = "https://speech.example/v1"
    expect(validateSettings(settings)).toContain("local")
    settings.voice.endpoint = "http://127.0.0.1:8880/v1"
    settings.monitoring.storageLimitGb = NaN
    expect(validateSettings(settings)).not.toBeNull()
  })
})
