import { create } from "zustand"
import { invokeCommand, isDesktop } from "./ipc"
import { useFriday } from "./store"
import { DEFAULT_AI_URL, DEFAULT_HEAVY_MODEL, DEFAULT_LIGHT_MODEL, validateProviderConfig } from "./ai-config"
import type { VoiceProfile } from "./voice"
import type { AiModel } from "./types"

export interface ProviderProfile { id: string; name: string; baseUrl: string; model: string; lightModel: string; apiMode: "chat" | "responses"; hasKey: boolean; fallback: boolean }
export interface DesktopSettings {
  version: 2; revision: number; activeProfileId: string; profiles: ProviderProfile[]
  voice: { profile: string; endpoint: string; style: "calm" | "tactical" | "whisper" | "witty" }
  listening: { enabled: boolean; sensitivity: number }
  appearance: { theme: "dark" | "bright"; reducedMotion: boolean }
  monitoring: { previewLimit: number; storageLimitGb: number }
  dailySpendCapUsd: number
}
export const defaultSettings = (): DesktopSettings => ({
  version: 2, revision: 0, activeProfileId: "primary",
  profiles: [{ id: "primary", name: "Primary provider", baseUrl: DEFAULT_AI_URL, model: DEFAULT_HEAVY_MODEL, lightModel: DEFAULT_LIGHT_MODEL, apiMode: "chat", hasKey: false, fallback: false }],
  voice: { profile: "en_GB-alba-medium", endpoint: "http://127.0.0.1:8880/v1", style: "calm" },
  listening: { enabled: false, sensitivity: .55 },
  appearance: { theme: "dark", reducedMotion: false },
  monitoring: { previewLimit: 2, storageLimitGb: 10 }, dailySpendCapUsd: 5,
})

export function validateSettings(settings: DesktopSettings): string | null {
  if (!settings.profiles.length) return "Add at least one provider."
  if (!settings.profiles.some((profile) => profile.id === settings.activeProfileId)) return "Select an active provider."
  const ids = new Set<string>()
  for (const profile of settings.profiles) {
    if (ids.has(profile.id)) return "Provider IDs must be unique."
    ids.add(profile.id)
    if (!profile.name.trim()) return "Give each provider a name."
    const error = validateProviderConfig(profile.baseUrl, profile.model, profile.lightModel)
    if (error) return `${profile.name}: ${error}`
  }
  if (!Number.isFinite(settings.dailySpendCapUsd) || settings.dailySpendCapUsd < 0) return "Enter a daily spend cap of zero or more."
  if (![1, 2, 3, 4].includes(settings.monitoring.previewLimit)) return "Choose between one and four simultaneous previews."
  if (!Number.isFinite(settings.monitoring.storageLimitGb) || settings.monitoring.storageLimitGb < 1 || settings.monitoring.storageLimitGb > 1000) return "Set a recording limit between 1 and 1,000 GB."
  if (settings.listening.sensitivity < .2 || settings.listening.sensitivity > .95) return "Set wake-word sensitivity between 20% and 95%."
  try { const url = new URL(settings.voice.endpoint); if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "Speech must use a local endpoint." } catch { return "Enter a valid local speech endpoint." }
  return null
}
export function profilesToModels(settings: DesktopSettings): AiModel[] {
  return settings.profiles.map((profile, priority) => ({
    id: profile.id, name: profile.name, provider: `profile:${profile.id}`, base_url: profile.baseUrl,
    capabilities: [profile.apiMode], priority, status: profile.id === settings.activeProfileId || profile.fallback ? "Normal" : "No traffic",
    is_active: profile.id === settings.activeProfileId, telemetry: { availability_pct: 0, ttft_p90_ms: 0, avg_latency_ms: 0, tracker_history: [] },
  }))
}
function applySettings(settings: DesktopSettings) {
  const profile = settings.profiles.find((item) => item.id === settings.activeProfileId)
  const store = useFriday.getState()
  if (profile) store.updateGlmSettings({ baseUrl: profile.baseUrl, heavyModel: profile.model, lightModel: profile.lightModel, hasKey: profile.hasKey, dailySpendCapUsd: settings.dailySpendCapUsd })
  store.setVoiceProfile(settings.voice.profile as VoiceProfile)
  store.setKokoroEndpoint(settings.voice.endpoint)
  store.setWakeWord({ ...settings.listening, enabled:false })
  store.setTheme(settings.appearance.theme)
  useFriday.setState({ aiModels: profilesToModels(settings), activeModelId: settings.activeProfileId })
  document.documentElement.classList.toggle("reduce-motion", settings.appearance.reducedMotion)
}
interface SettingsStore {
  saved: DesktopSettings; draft: DesktopSettings; loaded: boolean; loading: boolean; saving: boolean; error: string | null; keys: Record<string, string>
  hydrate: () => Promise<void>; edit: (update: (draft: DesktopSettings) => DesktopSettings) => void
  setKey: (id: string, key: string) => void; save: () => Promise<boolean>; discard: () => void
}
export const useSettings = create<SettingsStore>((set, get) => ({
  saved: defaultSettings(), draft: defaultSettings(), loaded: false, loading: false, saving: false, error: null, keys: {},
  hydrate: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true, error: null })
    try {
      let settings: DesktopSettings
      if (isDesktop) settings = await invokeCommand<DesktopSettings>("get_desktop_settings")
      else {
        const raw = localStorage.getItem("friday-settings-v2")
        const legacy = useFriday.getState().glmSettings
        settings = raw ? JSON.parse(raw) as DesktopSettings : { ...defaultSettings(), profiles: [{ ...defaultSettings().profiles[0], baseUrl: legacy.baseUrl, model: legacy.heavyModel, lightModel: legacy.lightModel, hasKey: false }] }
      }
      const error = validateSettings(settings)
      if (error) throw new Error(error)
      set({ saved: settings, draft: structuredClone(settings), loaded: true })
      applySettings(settings)
    } catch (error) { set({ error: String(error) }) }
    finally { set({ loading: false }) }
  },
  edit: (update) => set({ draft: update(get().draft), error: null }),
  setKey: (id, key) => set({ keys: { ...get().keys, [id]: key }, error: null }),
  save: async () => {
    if (get().saving) return false
    const error = validateSettings(get().draft)
    if (error) { set({ error }); return false }
    set({ saving: true, error: null })
    try {
      let settings = structuredClone(get().draft)
      if (isDesktop) settings = await invokeCommand<DesktopSettings>("save_desktop_settings", { settings, keys: get().keys })
      else {
        if (Object.values(get().keys).some(Boolean)) throw new Error("Save API keys from the Windows app. Browser preview does not store credentials.")
        settings.revision++
        localStorage.setItem("friday-settings-v2", JSON.stringify(settings))
      }
      set({ saved: settings, draft: structuredClone(settings), keys: {}, loaded: true })
      applySettings(settings)
      return true
    } catch (error) { set({ error: String(error) }); return false }
    finally { set({ saving: false }) }
  },
  discard: () => set({ draft: structuredClone(get().saved), keys: {}, error: null }),
}))
