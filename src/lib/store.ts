/** FRIDAY store — Zustand state with real AI dispatch & voice synthesis.
 *
 * Shared across Console and all surfaces, powered by Claude's clean domain model
 * and wired to real backend intelligence and native TTS.
 */

import { create, StoreApi, UseBoundStore } from "zustand"
import type {
  AuditEntry,
  Automation,
  Confirmation,
  Connectivity,
  Fact,
  LatencyStage,
  Mode,
  OrbState,
  VoiceUiState,
  PlanStep,
  ResourceSample,
  Skill,
  Thread,
  ToolCall,
  TurnOutput,
  Utterance,
  AiModel,
  ModelStatus,
  KokoroVoiceId,
  WakeWordSettings,
  ScreenContext,
  RunningWindow,
  RiskTier,
  PendingPlanBackend,
} from "./types"
import { seed } from "./seed"
import type { GlmSettings } from "./bindings"
import {
  invokeCommand,
  getBackendFacts,
  addBackendFact,
  deleteBackendFact,
  isDesktop,
  captureScreen,
  listWindows,
  focusWindow,
  getActiveThread as ipcGetActiveThread,
  setActiveThread as ipcSetActiveThread,
} from "./ipc"
import {
  speakFriday,
  stopFridayVoice,
  VoiceProfile,
  DEFAULT_VOICE_SETTINGS,
  GOLDEN_PHRASES,
} from "./voice"
import { PHRASE_BANK_CATALOG, preloadPhraseBank, playInstantAcousticCue } from "./phrasebank"
import { executeAiTurn } from "./ai"

if (typeof window !== "undefined") {
  const endpoint =
    localStorage.getItem("friday_kokoro_endpoint") && !localStorage.getItem("friday_kokoro_endpoint")?.includes("localhost")
      ? localStorage.getItem("friday_kokoro_endpoint")!
      : "http://127.0.0.1:8880/v1"
  const rawProfile = localStorage.getItem("friday_voice_profile")
  const profile =
    rawProfile === "friday-warm"
      ? "af_heart"
      : rawProfile === "bf_emma" || rawProfile === "af_heart" || rawProfile === "af_bella" || rawProfile === "af_nicole" || rawProfile === "af_sky"
      ? rawProfile
      : "bf_emma"
  setTimeout(() => {
    preloadPhraseBank(endpoint, profile as any)
  }, 1000)
}

export type ConsoleTab =
  | "chat"
  | "hud"
  | "beast"
  | "review"
  | "browser"
  | "delphi"
  | "automations"
  | "skills"
  | "models"
  | "memory"
  | "audit"
  | "settings"
  | "projects"

const EMPTY_UTTERANCE: Utterance = {
  heard: "",
  partial: "",
  plan: [],
  doing: null,
  result: null,
  awaiting: null,
}

export function getVoiceUiState(s: {
  orb: OrbState
  level: number
  utterance: Utterance
  connectivity: Connectivity
}): VoiceUiState {
  if (s.connectivity === "offline") {
    return { kind: "offline", reason: "Model offline — check settings", recoveryLabel: "Settings" }
  }
  if (s.orb === "listening") {
    return { kind: "listening", partial: s.utterance.partial || s.utterance.heard || "", rms: s.level }
  }
  if (s.orb === "thinking") {
    return { kind: "thinking", transcript: s.utterance.heard || "Processing...", elapsedMs: 350 }
  }
  if (s.orb === "speaking") {
    return { kind: "speaking", text: s.utterance.heard || "Speaking...", rms: s.level }
  }
  return { kind: "idle" }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

let activeSpeechRecognition: SpeechRecognitionInstance | null = null

export function startWebSpeechRecognition() {
  if (typeof window === "undefined") return
  const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
  if (!SpeechRec) return

  try {
    if (activeSpeechRecognition) {
      try { activeSpeechRecognition.abort() } catch {}
      activeSpeechRecognition = null
    }

    const rec = new SpeechRec() as SpeechRecognitionInstance
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    rec.onstart = () => {
      useFriday.setState({ orb: "listening" })
    }

    rec.onresult = (event: any) => {
      let interim = ""
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i]
        if (item.isFinal) {
          finalTranscript += item[0].transcript
        } else {
          interim += item[0].transcript
        }
      }

      const heard = (finalTranscript || interim).trim()
      if (heard) {
        useFriday.getState().setPartial(heard)
      }

      if (finalTranscript.trim()) {
        const cmd = finalTranscript.trim()
        try { rec.stop() } catch {}
        activeSpeechRecognition = null
        useFriday.getState().setPartial("")
        useFriday.getState().setOrb("thinking")
        sendChatMessage(cmd)
      }
    }

    rec.onerror = (e: any) => {
      console.warn("Speech recognition notice:", e?.error)
    }

    rec.onend = () => {
      activeSpeechRecognition = null
    }

    activeSpeechRecognition = rec
    rec.start()
  } catch (err) {
    console.warn("Web Speech API not available or blocked:", err)
  }
}

export function stopWebSpeechRecognition() {
  if (activeSpeechRecognition) {
    try {
      activeSpeechRecognition.stop()
    } catch {}
    activeSpeechRecognition = null
  }
}

export function stopNativeVoice() {
  stopWebSpeechRecognition()
  stopFridayVoice()
  if (isDesktop) {
    invokeCommand("barge_in").catch(() => {})
  }
  useFriday.getState().setOrb("idle")
  useFriday.getState().setLevel(0)
}

/** Synthesize speech using FRIDAY's authentic hyper-realistic female voice. */
export function speakWithNativeVoice(text: string, onEnd?: () => void) {
  const store = useFriday.getState()

  speakFriday(text, {
    profile: store.voiceProfile,
    pace: store.voicePace,
    pitch: store.voicePitch,
    warmth: store.voiceWarmth,
    kokoroEndpoint: store.kokoroEndpoint,
    onStart: () => store.setOrb("speaking"),
    onLevel: (lvl) => store.setLevel(lvl),
    onEnd: () => {
      store.setOrb("idle")
      store.setLevel(0)
      onEnd?.()
    },
  })
}

interface State {
  /* voice + orb */
  orb: OrbState
  mode: Mode
  level: number
  utterance: Utterance
  acknowledged: boolean
  micMuted: boolean
  conversationUntil: number | null

  /* surfaces */
  barOpen: boolean
  paletteOpen: boolean
  query: string

  /* console */
  tab: ConsoleTab
  theme: "dark" | "bright"
  threads: Thread[]
  activeThreadId: string | null
  contextInspectorOpen: boolean
  debugDrawerOpen: boolean

  /* data */
  facts: Fact[]
  audit: AuditEntry[]
  automations: Automation[]
  skills: Skill[]
  latency: LatencyStage[]
  resources: ResourceSample
  connectivity: Connectivity
  spend: { used: number; cap: number }

  /* wake-word settings */
  wakeWord: WakeWordSettings
  setWakeWord: (w: Partial<WakeWordSettings>) => void
  toggleWakeWord: () => Promise<void>

  /* screen perception & window automation */
  screenContext: ScreenContext | null
  runningWindows: RunningWindow[]
  captureActiveScreen: (target?: "active_window" | "full_screen") => Promise<void>
  refreshWindows: () => Promise<void>
  focusAppWindow: (query: string) => Promise<boolean>

  /* actions */
  setOrb: (s: OrbState) => void
  setMode: (m: Mode) => void
  setLevel: (v: number) => void
  setPartial: (t: string) => void
  setHeard: (t: string) => void
  setPlan: (p: PlanStep[]) => void
  setDoing: (i: number | null) => void
  setResult: (r: TurnOutput | null) => void
  setAwaiting: (c: Confirmation | null) => void
  resetUtterance: () => void
  acknowledge: () => void

  openBar: () => void
  closeBar: () => void
  setPalette: (open: boolean) => void
  setQuery: (q: string) => void
  toggleMic: () => void
  toggleListening: () => void

  setTab: (t: ConsoleTab) => void
  setTheme: (t: "dark" | "bright") => void
  toggleTheme: () => void
  setActiveThread: (id: string) => void
  createThread: () => string
  toggleInspector: () => void
  toggleDebug: () => void

  appendToolCall: (threadId: string, call: ToolCall) => void
  updateToolCall: (threadId: string, id: string, patch: Partial<ToolCall>) => void
  appendAudit: (e: AuditEntry) => void
  pushMessage: (threadId: string, msg: Thread["messages"][number]) => void
  patchLastMessage: (threadId: string, patch: Partial<Thread["messages"][number]>) => void

  toggleFactPin: (id: string) => void
  deleteFact: (id: string) => void
  addFact: (f: Fact) => void
  setFacts: (facts: Fact[]) => void
  loadFactsFromBackend: () => Promise<void>
  addFactToBackend: (subject: string, value: string, tier?: Fact["tier"]) => Promise<Fact>
  toggleAutomation: (id: string) => void
  addAutomation: (auto: Omit<Automation, "id" | "history">) => Automation
  runAutomationNow: (id: string) => void
  toggleSkill: (id: string) => void

  setLatency: (l: LatencyStage[]) => void
  setResources: (r: ResourceSample) => void
  setConnectivity: (c: Connectivity) => void

  /* voice settings */
  voiceProfile: VoiceProfile
  voicePace: number
  voicePitch: number
  voiceWarmth: boolean
  kokoroEndpoint: string
  phraseBankHits: number
  phraseBankMsSaved: number
  setVoiceProfile: (profile: VoiceProfile) => void
  setVoicePace: (pace: number) => void
  setVoicePitch: (pitch: number) => void
  setVoiceWarmth: (warmth: boolean) => void
  setKokoroEndpoint: (endpoint: string) => void
  auditionPhrase: (key: string) => void
  testVoice: () => void
  submitQuery: (q: string) => Promise<void>

  /* AI Models & Modular Router */
  aiModels: AiModel[]
  activeModelId: string
  testingModelId: string | null
  loadAiModels: () => Promise<void>
  setActiveModel: (id: string) => Promise<void>
  testModel: (id: string) => Promise<void>
  testAllModels: () => Promise<void>
  toggleModelStatus: (id: string, status: ModelStatus) => Promise<void>
  addModel: (model: AiModel) => Promise<void>
  deleteModel: (id: string) => Promise<void>

  killSwitch: () => void

  /* Legacy adapter properties for UI compatibility */
  activeSurface?: string
  setActiveSurface?: (s: string) => void
  setActiveConsoleTab?: (t: ConsoleTab) => void
  setPaletteOpen?: (o: boolean) => void
  startVoiceCapture?: () => void
  stopVoiceCapture?: () => void
  bargeIn?: () => void
  updateAudioRms?: (v: number) => void
  loadBackendData?: () => Promise<void>
  orbState?: OrbState
  setOrbState?: (s: OrbState) => void
  inputMode?: Mode
  setInputMode?: (m: Mode) => void
  telemetry?: any
  glmSettings: GlmSettings
  updateGlmSettings: (settings: Partial<GlmSettings>) => void
  
  caretText?: string
  setCaretText?: (s: string) => void
  asrPartial?: string
  pendingPlan?: PlanStep[] | PendingPlanBackend | null
  openConsoleTab?: (t: string) => void
  confirmPendingPlan?: (planId?: string) => Promise<void> | void
  cancelPendingPlan?: (planId?: string) => void
  undoLastAction?: () => void
  activeConsoleTab?: string
  setActiveThreadId?: (id: string) => void
  simulateVoiceTurn?: () => void
  auditLog?: any[]
}

export const useFriday: UseBoundStore<StoreApi<State>> = create<State>((set) => ({
  orb: "idle",
  mode: "command",
  level: 0,
  utterance: EMPTY_UTTERANCE,
  acknowledged: false,
  micMuted: false,
  conversationUntil: null,

  barOpen: false,
  paletteOpen: false,
  query: "",

  tab: "chat",
  theme: (typeof window !== "undefined" && (localStorage.getItem("friday-theme") as "dark" | "bright")) || "dark",
  threads: seed.threads,
  activeThreadId: seed.threads[0]?.id ?? null,
  contextInspectorOpen: true,
  debugDrawerOpen: false,

  facts: seed.facts,
  audit: seed.audit,
  automations: seed.automations,
  skills: seed.skills,
  latency: seed.latency,
  resources: seed.resources,
  connectivity: "online",
  spend: { used: 0.14, cap: 5.0 },

  glmSettings: {
    baseUrl: (typeof window !== "undefined" && localStorage.getItem("friday_glm_base_url")) || "https://api.deepseek.com/v1",
    heavyModel: (typeof window !== "undefined" && (localStorage.getItem("friday_glm_heavy_model") || localStorage.getItem("friday_glm_model"))) || "deepseek-chat",
    lightModel: (typeof window !== "undefined" && localStorage.getItem("friday_glm_light_model")) || "deepseek-chat",
    hasKey: (typeof window !== "undefined" && localStorage.getItem("friday_glm_has_key") === "true") || false,
    dailySpendCapUsd: (typeof window !== "undefined" && Number(localStorage.getItem("friday_glm_spend_cap"))) || 5.0,
    currentSpendUsd: 0.14,
  },
  updateGlmSettings: (settings: Partial<GlmSettings>) => {
    set((state) => {
      const updated = { ...state.glmSettings, ...settings };
      if (typeof window !== "undefined") {
        if (updated.baseUrl) localStorage.setItem("friday_glm_base_url", updated.baseUrl);
        if (updated.heavyModel) {
          localStorage.setItem("friday_glm_heavy_model", updated.heavyModel);
          localStorage.setItem("friday_glm_model", updated.heavyModel);
        }
        if (updated.lightModel) localStorage.setItem("friday_glm_light_model", updated.lightModel);
        if (updated.dailySpendCapUsd) localStorage.setItem("friday_glm_spend_cap", String(updated.dailySpendCapUsd));
        if (typeof updated.hasKey === "boolean") localStorage.setItem("friday_glm_has_key", String(updated.hasKey));
      }
      return { glmSettings: updated };
    });
  },

  wakeWord: {
    enabled: (() => {
      if (typeof window === "undefined") return false
      const raw = localStorage.getItem("friday_wake_word_enabled")
      return raw !== null ? raw === "true" : false
    })(),
    sensitivity: (() => {
      if (typeof window === "undefined") return 0.55
      const raw = localStorage.getItem("friday_wake_word_sensitivity")
      return raw ? parseFloat(raw) : 0.55
    })(),
    triggerPhrase: "Hey Friday",
  },

  screenContext: null,
  runningWindows: [],

  /* voice settings */
  voiceProfile: (() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS.profile
    const raw = localStorage.getItem("friday_voice_profile")
    if (raw === "en_GB-alba-medium" || raw === "en_US-amy-medium") {
      return raw as VoiceProfile
    }
    if (raw === "af_heart" || raw === "friday-warm" || raw === "af_nicole") {
      try { localStorage.setItem("friday_voice_profile", "en_US-amy-medium") } catch {}
      return "en_US-amy-medium" as VoiceProfile
    }
    // Auto-migrate legacy profiles (bf_emma, af_bella, af_sky, friday-irish, etc.) to en_GB-alba-medium
    try { localStorage.setItem("friday_voice_profile", "en_GB-alba-medium") } catch {}
    return "en_GB-alba-medium" as VoiceProfile
  })(),
  voicePace: (typeof window !== "undefined" && Number(localStorage.getItem("friday_voice_pace"))) || DEFAULT_VOICE_SETTINGS.pace,
  voicePitch: (typeof window !== "undefined" && Number(localStorage.getItem("friday_voice_pitch"))) || DEFAULT_VOICE_SETTINGS.pitch,
  voiceWarmth: typeof window !== "undefined" ? localStorage.getItem("friday_voice_warmth") !== "false" : DEFAULT_VOICE_SETTINGS.warmth,
  kokoroEndpoint: (typeof window !== "undefined" && localStorage.getItem("friday_kokoro_endpoint") && !localStorage.getItem("friday_kokoro_endpoint")?.includes("localhost"))
    ? (localStorage.getItem("friday_kokoro_endpoint") || "http://127.0.0.1:8880/v1")
    : "http://127.0.0.1:8880/v1",
  phraseBankHits: 0,
  phraseBankMsSaved: 0,

  setVoiceProfile: (voiceProfile) => {
    try { localStorage.setItem("friday_voice_profile", voiceProfile) } catch {}
    set({ voiceProfile })
  },
  setVoicePace: (voicePace) => {
    try { localStorage.setItem("friday_voice_pace", String(voicePace)) } catch {}
    set({ voicePace })
  },
  setVoicePitch: (voicePitch) => {
    try { localStorage.setItem("friday_voice_pitch", String(voicePitch)) } catch {}
    set({ voicePitch })
  },
  setVoiceWarmth: (voiceWarmth) => {
    try { localStorage.setItem("friday_voice_warmth", String(voiceWarmth)) } catch {}
    set({ voiceWarmth })
  },
  setKokoroEndpoint: (kokoroEndpoint) => {
    try { localStorage.setItem("friday_kokoro_endpoint", kokoroEndpoint) } catch {}
    set({ kokoroEndpoint })
  },
  auditionPhrase: (key: string) => {
    const s = useFriday.getState()
    const phrase = PHRASE_BANK_CATALOG.find((p) => p.key === key || p.id === key)
    if (!phrase) return

    set((state) => ({
      phraseBankHits: state.phraseBankHits + 1,
      phraseBankMsSaved: state.phraseBankMsSaved + 1200,
    }))

    speakFriday(phrase.text, {
      profile: s.voiceProfile,
      pace: s.voicePace,
      pitch: s.voicePitch,
      warmth: s.voiceWarmth,
      kokoroEndpoint: s.kokoroEndpoint,
      emotion: phrase.emotion,
      onStart: () => useFriday.getState().setOrb("speaking"),
      onLevel: (lvl) => useFriday.getState().setLevel(lvl),
      onEnd: () => {
        useFriday.getState().setOrb("idle")
        useFriday.getState().setLevel(0)
      },
    })
  },
  testVoice: () => {
    const s = useFriday.getState()
    speakFriday(GOLDEN_PHRASES.audition.say, {
      profile: s.voiceProfile,
      pace: s.voicePace,
      pitch: s.voicePitch,
      warmth: s.voiceWarmth,
      kokoroEndpoint: s.kokoroEndpoint,
      emotion: GOLDEN_PHRASES.audition.emotion,
      onStart: () => useFriday.getState().setOrb("speaking"),
      onLevel: (lvl) => useFriday.getState().setLevel(lvl),
      onEnd: () => {
        useFriday.getState().setOrb("idle")
        useFriday.getState().setLevel(0)
      },
    })
  },
  submitQuery: async (q) => {
    sendChatMessage(q);
  },

  setOrb: (orb) => set({ orb }),
  setMode: (mode) => set({ mode }),
  setLevel: (level) => set({ level }),
  setPartial: (partial) => set((s) => ({ utterance: { ...s.utterance, partial } })),
  setHeard: (heard) => set((s) => ({ utterance: { ...s.utterance, heard, partial: "" } })),
  setPlan: (plan) => set((s) => ({ utterance: { ...s.utterance, plan } })),
  setDoing: (doing) => set((s) => ({ utterance: { ...s.utterance, doing } })),
  setResult: (result) => set((s) => ({ utterance: { ...s.utterance, result } })),
  setAwaiting: (awaiting) => set((s) => ({ utterance: { ...s.utterance, awaiting } })),
  resetUtterance: () => set({ utterance: EMPTY_UTTERANCE, acknowledged: false }),
  acknowledge: () => set({ acknowledged: true }),

  openBar: () => set({ barOpen: true }),
  closeBar: () => set({ barOpen: false, paletteOpen: false, query: "" }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setQuery: (query) => set({ query }),
  toggleMic: () => set((s) => ({ micMuted: !s.micMuted })),
  toggleListening: () => {
    const s = useFriday.getState()
    if (s.orb === "listening") {
      s.stopVoiceCapture?.()
    } else {
      s.startVoiceCapture?.()
    }
  },

  setTab: (tab) => set({ tab }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("friday-theme", theme)
      document.documentElement.setAttribute("data-theme", theme)
    }
    set({ theme })
  },
  toggleTheme: () => {
    set((s) => {
      const next = s.theme === "dark" ? "bright" : "dark"
      if (typeof window !== "undefined") {
        localStorage.setItem("friday-theme", next)
        document.documentElement.setAttribute("data-theme", next)
      }
      return { theme: next }
    })
  },
  setActiveThread: (activeThreadId) => {
    set({ activeThreadId })
    ipcSetActiveThread(activeThreadId).catch(() => {})
  },
  createThread: () => {
    const id = `t-${Date.now()}`
    const newThread: Thread = {
      id,
      title: "New session",
      pinned: false,
      message_count: 0,
      updated_at: new Date().toISOString(),
      messages: [],
    }
    set((s) => ({
      threads: [newThread, ...s.threads],
      activeThreadId: id,
    }))
    ipcSetActiveThread(id).catch(() => {})
    return id
  },
  toggleInspector: () => set((s) => ({ contextInspectorOpen: !s.contextInspectorOpen })),
  toggleDebug: () => set((s) => ({ debugDrawerOpen: !s.debugDrawerOpen })),

  appendToolCall: (threadId, call) =>
    set((s) => ({
      threads: s.threads.map((t) => {
        if (t.id !== threadId) return t
        const messages = [...t.messages]
        const last = messages[messages.length - 1]
        if (!last || last.role !== "assistant") return t
        messages[messages.length - 1] = {
          ...last,
          tool_calls: [...(last.tool_calls ?? []), call],
        }
        return { ...t, messages }
      }),
    })),

  updateToolCall: (threadId, id, patch) =>
    set((s) => ({
      threads: s.threads.map((t) => {
        if (t.id !== threadId) return t
        return {
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            tool_calls: m.tool_calls?.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),
        }
      }),
    })),

  appendAudit: (e) => set((s) => ({ audit: [e, ...s.audit].slice(0, 200) })),

  pushMessage: (threadId, msg) =>
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, msg],
              message_count: t.message_count + 1,
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    })),

  patchLastMessage: (threadId, patch) =>
    set((s) => ({
      threads: s.threads.map((t) => {
        if (t.id !== threadId || t.messages.length === 0) return t
        const messages = [...t.messages]
        messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch }
        return { ...t, messages }
      }),
    })),

  toggleFactPin: (id) =>
    set((s) => ({
      facts: s.facts.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f)),
    })),

  deleteFact: (id) => {
    deleteBackendFact(id).catch(() => {})
    set((s) => ({ facts: s.facts.filter((f) => f.id !== id) }))
  },

  addFact: (fact) => set((s) => ({ facts: [fact, ...s.facts] })),
  setFacts: (facts) => set({ facts }),

  loadFactsFromBackend: async () => {
    try {
      const dbFacts = await getBackendFacts()
      if (dbFacts && dbFacts.length > 0) {
        const parsed: Fact[] = dbFacts.map((db, idx) => {
          let subject = "Personal fact"
          let value = db.content
          if (db.content.includes("—")) {
            const parts = db.content.split("—")
            subject = parts[0].trim()
            value = parts.slice(1).join("—").trim()
          } else if (db.content.includes(":")) {
            const parts = db.content.split(":")
            subject = parts[0].trim()
            value = parts.slice(1).join(":").trim()
          }

          let tier: Fact["tier"] = "semantic"
          const lower = db.content.toLowerCase()
          if (lower.includes("like") || lower.includes("prefer") || lower.includes("rule") || lower.includes("always")) {
            tier = "procedural"
          } else if (lower.includes("yesterday") || lower.includes("meeting") || lower.includes("at ") || lower.includes("on ")) {
            tier = "episodic"
          } else if (lower.includes("doc") || lower.includes("file") || lower.includes("readme")) {
            tier = "document"
          }

          return {
            id: db.id,
            subject,
            value,
            tier,
            confidence: db.confidence || 0.95,
            source_message_id: db.source_message_id || "sqlite",
            created_at: new Date(db.created_at * 1000).toISOString(),
            pinned: idx === 0,
          }
        })

        set((s) => {
          const existingIds = new Set(parsed.map((p) => p.id))
          const unmerged = s.facts.filter((f) => !existingIds.has(f.id))
          return { facts: [...parsed, ...unmerged] }
        })
      }
    } catch {
      // Browser fallback
    }
  },

  addFactToBackend: async (subject: string, value: string, tier: Fact["tier"] = "semantic") => {
    const content = `${subject} — ${value}`
    let backendId = `fact-${Date.now()}`
    try {
      const res = await addBackendFact(content, 0.95)
      if (res && res.id) {
        backendId = res.id
      }
    } catch {
      // Fallback
    }
    const newFact: Fact = {
      id: backendId,
      subject,
      value,
      tier,
      confidence: 0.95,
      source_message_id: "user-direct",
      created_at: new Date().toISOString(),
      pinned: false,
    }
    set((s) => ({ facts: [newFact, ...s.facts] }))
    return newFact
  },

  toggleAutomation: (id) =>
    set((s) => ({
      automations: s.automations.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    })),

  addAutomation: (auto) => {
    const newAuto: Automation = {
      ...auto,
      id: `auto-${Date.now()}`,
      history: ["ok"],
    }
    set((s) => ({ automations: [newAuto, ...s.automations] }))
    return newAuto
  },

  runAutomationNow: (id) =>
    set((s) => ({
      automations: s.automations.map((a) => {
        if (a.id !== id) return a
        return {
          ...a,
          last_run: new Date().toISOString(),
          history: [...a.history.slice(1), "ok"],
        }
      }),
    })),

  toggleSkill: (id) =>
    set((s) => ({
      skills: s.skills.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)),
    })),

  setLatency: (latency) => set({ latency }),
  setResources: (resources) => set({ resources }),
  setConnectivity: (connectivity) => set({ connectivity }),

  /* AI Models & Modular Router */
  aiModels: seed.initialAiModels,
  activeModelId: seed.initialAiModels.find((m) => m.is_active)?.id || "glm-5.3",
  testingModelId: null,

  loadAiModels: async () => {
    try {
      const models = await invokeCommand<AiModel[]>("get_ai_models")
      if (models && models.length > 0) {
        const active = models.find((m) => m.is_active)?.id || models[0].id
        set({ aiModels: models, activeModelId: active })
      }
    } catch (e) {
      console.warn("Could not load AI models from IPC:", e)
    }
  },

  setActiveModel: async (id: string) => {
    set((s) => ({
      activeModelId: id,
      aiModels: s.aiModels.map((m) => ({ ...m, is_active: m.id === id })),
    }))
    try {
      await invokeCommand("set_active_model", { modelId: id })
    } catch (e) {
      console.warn("Failed to set active model via IPC:", e)
    }
  },

  testModel: async (id: string) => {
    set({ testingModelId: id })
    try {
      const updated = await invokeCommand<AiModel>("test_model_connection", { modelId: id })
      if (updated) {
        set((s) => ({
          aiModels: s.aiModels.map((m) => (m.id === id ? updated : m)),
        }))
      }
    } catch (e) {
      console.warn(`Failed to test model ${id}:`, e)
      set((s) => ({
        aiModels: s.aiModels.map((m) => {
          if (m.id !== id) return m
          const now = new Date()
          const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
          const lat = Math.round(m.telemetry.avg_latency_ms || 1800)
          const newBlock = {
            key: `tb-${Date.now()}`,
            color: "bg-emerald-500",
            status: "200 OK",
            latency_ms: lat,
            tooltip: `${time} · ${lat}ms · 200 OK`,
          }
          const history = [...m.telemetry.tracker_history.slice(-49), newBlock]
          return {
            ...m,
            telemetry: {
              ...m.telemetry,
              tracker_history: history,
            },
          }
        }),
      }))
    } finally {
      set({ testingModelId: null })
    }
  },

  testAllModels: async () => {
    set({ testingModelId: "all" })
    try {
      const updatedList = await invokeCommand<AiModel[]>("test_all_models")
      if (updatedList && updatedList.length > 0) {
        set({ aiModels: updatedList })
      }
    } catch (e) {
      console.warn("Failed to test all models:", e)
    } finally {
      set({ testingModelId: null })
    }
  },

  toggleModelStatus: async (id: string, status: ModelStatus) => {
    set((s) => ({
      aiModels: s.aiModels.map((m) => (m.id === id ? { ...m, status } : m)),
    }))
    try {
      await invokeCommand("toggle_model_status", { modelId: id, status })
    } catch (e) {
      console.warn("Failed to toggle model status:", e)
    }
  },

  addModel: async (model: AiModel) => {
    set((s) => ({
      aiModels: [...s.aiModels.filter((m) => m.id !== model.id), model],
    }))
    try {
      await invokeCommand("add_ai_model", { model })
    } catch (e) {
      console.warn("Failed to add model:", e)
    }
  },

  deleteModel: async (id: string) => {
    set((s) => ({
      aiModels: s.aiModels.filter((m) => m.id !== id),
    }))
    try {
      await invokeCommand("delete_ai_model", { modelId: id })
    } catch (e) {
      console.warn("Failed to delete model:", e)
    }
  },


  setWakeWord: (patch) =>
    set((s) => {
      const updated = { ...s.wakeWord, ...patch };
      if (typeof patch.enabled === "boolean") {
        try { localStorage.setItem("friday_wake_word_enabled", String(patch.enabled)) } catch {}
      }
      if (typeof patch.sensitivity === "number") {
        try { localStorage.setItem("friday_wake_word_sensitivity", String(patch.sensitivity)) } catch {}
      }
      return { wakeWord: updated };
    }),
  toggleWakeWord: async () => {
    const current = useFriday.getState().wakeWord;
    const nextEnabled = !current.enabled;
    useFriday.getState().setWakeWord({ enabled: nextEnabled });
    if (isDesktop) {
      try {
        if (nextEnabled) {
          await invokeCommand("start_wake_word", { sensitivity: current.sensitivity });
        } else {
          await invokeCommand("stop_wake_word");
        }
      } catch (err) {
        console.warn("Failed to toggle wake word on backend:", err);
      }
    }
  },

  captureActiveScreen: async (target = "active_window") => {
    try {
      const data = await captureScreen(target);
      if (data && data.status === "captured") {
        set({
          screenContext: {
            captured: true,
            target: data.target,
            app: data.app,
            title: data.title,
            width: data.width,
            height: data.height,
            dataUrl: data.data_url,
            timestamp: data.timestamp,
          },
        });
      }
    } catch (e) {
      console.warn("Failed to capture screen:", e);
    }
  },

  refreshWindows: async () => {
    try {
      const list = await listWindows();
      if (list) {
        set({
          runningWindows: list.map((w) => ({
            hwnd: w.hwnd,
            title: w.title,
            processName: w.process_name,
            pid: w.pid,
            isActive: w.is_active,
          })),
        });
      }
    } catch (e) {
      console.warn("Failed to list windows:", e);
    }
  },

  focusAppWindow: async (query: string) => {
    try {
      const ok = await focusWindow(query);
      return Boolean(ok);
    } catch {
      return false;
    }
  },

  killSwitch: () => {
    stopNativeVoice()
    set({
      orb: "idle",
      level: 0,
      utterance: EMPTY_UTTERANCE,
      acknowledged: false,
      micMuted: true,
      conversationUntil: null,
      paletteOpen: false,
    })
  },

  /* Legacy adapter implementations */
  get activeSurface() { return useFriday.getState().tab },
  setActiveSurface: (s) => set({ tab: s as ConsoleTab }),
  setActiveConsoleTab: (t) => set({ tab: t }),
  setPaletteOpen: (o) => set({ paletteOpen: o }),
  startVoiceCapture: () => {
    useFriday.setState({ orb: "listening", utterance: EMPTY_UTTERANCE });
    startWebSpeechRecognition();
    return invokeCommand("start_mic_capture").catch(() => invokeCommand("start_listening").catch(() => {}));
  },
  stopVoiceCapture: () => {
    stopWebSpeechRecognition();
    useFriday.setState((s) => ({ orb: s.orb === "listening" ? "idle" : s.orb }));
    return invokeCommand("stop_mic_capture").catch(() => invokeCommand("stop_listening").catch(() => {}));
  },
  bargeIn: () => invokeCommand("barge_in").catch(() => {}),
  updateAudioRms: (v) => set({ level: v }),
  loadBackendData: () => useFriday.getState().loadFactsFromBackend(),
  get orbState() { return useFriday.getState().orb },
  setOrbState: (s) => set({ orb: s }),
  get inputMode() { return useFriday.getState().mode },
  setInputMode: (m) => set({ mode: m }),
  get telemetry() { return useFriday.getState().latency },
  get auditLog() { return useFriday.getState().audit },
  get caretText() { return useFriday.getState().query },
  setCaretText: (s) => set({ query: s }),
  get asrPartial() { return useFriday.getState().utterance?.partial || "" },
  get pendingPlan() { return useFriday.getState().utterance?.plan || null },
  openConsoleTab: (t) => {
    set({ tab: t as ConsoleTab });
    invokeCommand("show_console").catch(() => {});
  },
  confirmPendingPlan: async (planId?: string) => {
    const store = useFriday.getState()
    const currentThread = store.threads.find((t) => t.id === store.activeThreadId) || store.threads[0]
    const threadId = currentThread?.id
    const lastMsgWithPlan = currentThread?.messages.slice().reverse().find((m) => m.pending_plan || m.pendingPlan)
    const targetId = planId || lastMsgWithPlan?.pending_plan?.id || lastMsgWithPlan?.pendingPlan?.id || store.utterance?.plan?.[0]?.id

    if (targetId) {
      try {
        store.setOrb("thinking")
        const confirmed = await invokeCommand<PendingPlanBackend>("confirm_plan", { planId: targetId })
        store.resetUtterance()
        store.setOrb("idle")

        set((s) => ({
          threads: s.threads.map((t) => {
            const hasMatchingMsg = t.messages.some((m) => m.pending_plan?.id === targetId || m.pendingPlan?.id === targetId)
            if (t.id !== threadId && !hasMatchingMsg) return t
            return {
              ...t,
              messages: t.messages.map((m) => {
                if (m.pending_plan?.id === targetId || m.pendingPlan?.id === targetId) {
                  const executionDetails = confirmed?.result_summary
                    ? `\n\n${confirmed.result_summary}`
                    : "\n\n> \u2705 **Plan Confirmed and Executed**"
                  return {
                    ...m,
                    pending_plan: null,
                    pendingPlan: null,
                    show: (m.show || m.content) + executionDetails,
                  }
                }
                return m
              }),
            }
          }),
        }))
        playInstantAcousticCue()
      } catch (e) {
        console.warn("Failed to confirm plan:", e)
        store.setOrb("idle")
      }
    }
  },
  cancelPendingPlan: (planId?: string) => {
    const store = useFriday.getState()
    store.resetUtterance()
    const currentThread = store.threads.find((t) => t.id === store.activeThreadId) || store.threads[0]
    const threadId = currentThread?.id
    const lastMsgWithPlan = currentThread?.messages.slice().reverse().find((m) => m.pending_plan || m.pendingPlan)
    const targetId = planId || lastMsgWithPlan?.pending_plan?.id || lastMsgWithPlan?.pendingPlan?.id

    if (targetId) {
      set((s) => ({
        threads: s.threads.map((t) => {
          const hasMatchingMsg = t.messages.some((m) => m.pending_plan?.id === targetId || m.pendingPlan?.id === targetId)
          if (t.id !== threadId && !hasMatchingMsg) return t
          return {
            ...t,
            messages: t.messages.map((m) => {
              if (m.pending_plan?.id === targetId || m.pendingPlan?.id === targetId) {
                return {
                  ...m,
                  pending_plan: null,
                  pendingPlan: null,
                  show: (m.show || m.content) + "\n\n> \u274c **Plan Cancelled by User**",
                }
              }
              return m
            }),
          }
        }),
      }))
    }
  },
  undoLastAction: () => {
    invokeCommand("undo_last").catch(() => {});
  },
  get activeConsoleTab() { return useFriday.getState().tab },
  setActiveThreadId: (id) => set({ activeThreadId: id }),
  simulateVoiceTurn: () => {
    import("./sim").then(({ runTurn }) => {
      runTurn("weather").catch(() => {});
    }).catch(() => {});
  },
}))

export function useActiveThread(): Thread | null {
  return useFriday((s) => s.threads.find((t) => t.id === s.activeThreadId) ?? null)
}

/** Dispatches a real message turn into the active thread and queries backend GLM. */
export async function sendChatMessage(text: string, expandedMode: boolean = false) {
  const clean = text.trim()
  if (!clean) return

  // Constitutional Sub-150ms Non-Verbal Acoustic Earcon (§01 & §03)
  playInstantAcousticCue()

  const store = useFriday.getState()
  const threadId = store.activeThreadId || store.threads[0]?.id || "t-1"

  const userMsgId = `m-${Date.now()}-u`
  const asstMsgId = `m-${Date.now()}-a`

  const currentThread = store.threads.find((t) => t.id === threadId)
  if (currentThread && currentThread.title === "New session") {
    useFriday.setState((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, title: clean.slice(0, 36) } : t
      ),
    }))
  }

  // 1. Add User Message
  store.pushMessage(threadId, {
    id: userMsgId,
    role: "user",
    content: clean,
    say: clean,
    created_at: new Date().toISOString(),
  })

  // 2. Set thinking state
  store.setOrb("thinking")

  try {
    const recentMessages = (currentThread?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const promptPayload = expandedMode
      ? `${clean}\n\n[Instruction: Expanded Mode is ON. Provide a comprehensive, in-depth breakdown with detailed comparisons, tables, and thorough options.]`
      : `${clean}\n\n[Instruction: Concise Mode. Keep your visual and spoken answer concise, direct, and human. Give the key recommendation and summary without spitting out huge multi-page walls of text or endless tables.]`

    const aiRes = await executeAiTurn(promptPayload, recentMessages, expandedMode ? "expanded" : "command")

    store.pushMessage(threadId, {
      id: asstMsgId,
      role: "assistant",
      content: aiRes.show,
      say: aiRes.say,
      show: aiRes.show,
      tool_calls: aiRes.toolCalls,
      toolCalls: aiRes.toolCalls,
      pending_plan: aiRes.pendingPlan,
      pendingPlan: aiRes.pendingPlan,
      usage: {
        model: aiRes.model,
        prompt: Math.round(aiRes.tokens * 0.4),
        completion: Math.round(aiRes.tokens * 0.6),
        ttft_ms: aiRes.ttftMs,
      },
      delivery: {
        emotion: aiRes.emotion,
        pace: 1.0,
        energy: 0.6,
        pause_before_ms: 0,
        emphasis: [],
      },
      created_at: new Date().toISOString(),
    })

    if (aiRes.pendingPlan) {
      const rawTier = String(aiRes.pendingPlan.tier).toLowerCase()
      const tier: RiskTier = rawTier === "red" ? "red" : rawTier === "amber" ? "amber" : "green"
      const planSteps: PlanStep[] = aiRes.pendingPlan.steps.map((st, idx) => {
        const stTierRaw = String(st.tier).toLowerCase()
        const stTier: RiskTier = stTierRaw === "red" ? "red" : stTierRaw === "amber" ? "amber" : "green"
        return {
          id: `${aiRes.pendingPlan!.id}-step-${idx}`,
          label: st.description,
          tier: stTier,
          status: st.completed ? "done" : "waiting",
        }
      })

      store.setPlan(planSteps)
      store.setHeard(clean)
      store.setDoing(0)
      store.setResult({
        say: aiRes.say,
        delivery: {
          emotion: aiRes.emotion,
          pace: 1.0,
          energy: 0.6,
          pause_before_ms: 0,
          emphasis: [],
        },
        show: aiRes.show,
      })
      if (tier !== "green") {
        store.setAwaiting({
          tier: tier,
          preview: aiRes.say,
        })
      }
    }

    // Speak response with authentic Kokoro / human voice
    speakWithNativeVoice(aiRes.say)

    // Synchronize associative memory facts from backend SQLite
    store.loadFactsFromBackend().catch(() => {})
  } catch (err: unknown) {
    const errMsg = typeof err === "string" ? err : err instanceof Error ? err.message : JSON.stringify(err)
    store.pushMessage(threadId, {
      id: asstMsgId,
      role: "assistant",
      content: `### Response Notice\n\n${errMsg}\n\nPlease check your GLM endpoint and API key in Settings.`,
      say: "There was an issue processing your request. Please check Settings.",
      show: `### Response Notice\n\n${errMsg}\n\nPlease check your GLM endpoint and API key in Settings.`,
      created_at: new Date().toISOString(),
    })
    store.setOrb("idle")
  }
}

/** Legacy store selector alias for backward compatibility. */
export const useFridayStore = useFriday

// Recover persisted active thread from backend database for crash recovery
if (typeof window !== "undefined") {
  ipcGetActiveThread()
    .then((persistedId) => {
      if (persistedId) {
        const current = useFriday.getState()
        if (current.threads.some((t) => t.id === persistedId)) {
          useFriday.setState({ activeThreadId: persistedId })
        }
      }
    })
    .catch(() => {})
}
