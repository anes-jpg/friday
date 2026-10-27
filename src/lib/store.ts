import { automationFromSaved, type SavedAutomation } from "./automations"
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
import { DEFAULT_AI_URL, DEFAULT_HEAVY_MODEL, DEFAULT_LIGHT_MODEL, validateProviderConfig } from "./ai-config"
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
  ipcGetThreads,
  ipcCreateThread,
  ipcDeleteThread,
  ipcRenameThread,
  ipcToggleThreadPin,
  ipcGetMessages,
  ipcAddMessage,
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
import { flushWorkspaceWrites, type RunEvent } from "./workspace-native"

interface PendingRequest { id: string; threadId: string; runId?: string; cancelled: boolean; lastSequence?:number }
const pendingRequests = new Map<string, PendingRequest>()
let visibleRequestId: string | undefined

export function acceptRunEvent(event: RunEvent) {
  const requestId = typeof event.detail.request_id === "string" ? event.detail.request_id : undefined
  const request = requestId ? pendingRequests.get(requestId) : [...pendingRequests.values()].find(item => item.runId === event.run_id)
  if (!request) return
  if (event.sequence <= (request.lastSequence || 0)) return
  request.lastSequence=event.sequence
  request.runId = event.run_id
  if (request.cancelled) { void invokeCommand("cancel_run", { runId: event.run_id }).catch(() => {}); return }
  if (visibleRequestId !== request.id || useFriday.getState().activeThreadId !== request.threadId) return
  const store = useFriday.getState()
  if (event.status === "running" && event.step) {
    const label = typeof event.detail.tool === "string" ? event.detail.tool : "Work through the request"
    store.setPlan([{ id: event.step, label, tier: "green", status: "active" }])
    store.setDoing(0)
  }
  if (["cancelled", "interrupted", "failed"].includes(event.status)) {
    request.cancelled = event.status !== "failed"
    store.setDoing(null); store.setOrb("idle")
  }
}

export async function cancelActiveExecution() {
  const started=performance.now()
  stopFridayVoice()
  useFriday.getState().setDoing(null)
  useFriday.getState().setOrb("idle")
  const request = visibleRequestId ? pendingRequests.get(visibleRequestId) : undefined
  if (request) {
    request.cancelled = true
  }
  await Promise.all([invokeCommand("barge_in").catch(() => {}),request?.runId && isDesktop ? invokeCommand("cancel_run", { runId:request.runId }).catch(()=>{}) : Promise.resolve()])
  recordLatency("barge",performance.now()-started)
}

const latencySamples=new Map<string,number[]>()
export function recordLatency(key:string,value:number) {
  if (!Number.isFinite(value) || value<0) return
  const samples=[...(latencySamples.get(key) || []).slice(-99),value]
  latencySamples.set(key,samples)
  const ordered=[...samples].sort((a,b)=>a-b)
  const measured=ordered[Math.ceil(ordered.length*.95)-1]
  useFriday.setState(state=>({latency:state.latency.map(stage=>stage.key===key ? {...stage,value:measured} : stage)}))
}
export function recordVoiceMetrics(metrics:Record<string,unknown>) {
  if (typeof metrics.endpoint_ms==="number") recordLatency("endpoint",metrics.endpoint_ms)
  if (typeof metrics.recognition_tail_ms==="number") recordLatency("asr",metrics.recognition_tail_ms)
}

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
    preloadPhraseBank(endpoint, profile)
  }, 1000)
}

export type ConsoleTab =
  | "map"
  | "cameras"
  | "recordings"
  | "alerts"
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
  processLocally?: boolean
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

type SpeechRecognitionWindow = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  SpeechRecognition?: new () => SpeechRecognitionInstance
}

let activeSpeechRecognition: SpeechRecognitionInstance | null = null

export function startWebSpeechRecognition() {
  if (typeof window === "undefined") return
  if (useFriday.getState().micMuted) {
    console.warn("[Voice] Web Speech blocked: microphone is currently muted.")
    return
  }
  const speechWindow = window as SpeechRecognitionWindow
  const SpeechRec = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  if (!SpeechRec) return

  try {
    if (activeSpeechRecognition) {
      try { activeSpeechRecognition.abort() } catch {}
      activeSpeechRecognition = null
    }

    const rec = new SpeechRec() as SpeechRecognitionInstance
    // Browser speech must explicitly support local recognition; never use cloud ASR.
    if (!("processLocally" in rec)) return
    rec.processLocally = true
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    rec.onstart = () => {
      useFriday.setState({ orb: "listening" })
    }

    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      if (useFriday.getState().micMuted) {
        try { rec.stop() } catch {}
        activeSpeechRecognition = null
        return
      }

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

    rec.onerror = (e: { error: string }) => {
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
  chatHistoryOpen: boolean
  spatialHudActive: boolean
  setSpatialHudActive: (active: boolean) => void
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
  createThread: (title?: string) => string
  deleteThread: (id: string) => void
  renameThread: (id: string, title: string) => void
  toggleThreadPin: (id: string) => void
  toggleChatHistory: (open?: boolean) => void
  hydrateThreadsFromBackend: () => Promise<void>
  toggleInspector: () => void
  toggleDebug: () => void

  appendToolCall: (threadId: string, call: ToolCall) => void
  updateToolCall: (threadId: string, id: string, patch: Partial<ToolCall>) => void
  appendAudit: (e: AuditEntry) => void
  pushMessage: (threadId: string, msg: Thread["messages"][number], persist?: boolean) => void
  patchLastMessage: (threadId: string, patch: Partial<Thread["messages"][number]>) => void

  toggleFactPin: (id: string) => void
  deleteFact: (id: string) => Promise<void>
  addFact: (f: Fact) => void
  setFacts: (facts: Fact[]) => void
  loadFactsFromBackend: () => Promise<void>
  addFactToBackend: (subject: string, value: string, tier?: Fact["tier"]) => Promise<Fact>
  toggleAutomation: (id: string) => Promise<void>
  addAutomation: (auto: Omit<Automation, "id" | "history">) => Promise<Automation>
  runAutomationNow: (id: string) => Promise<string>
  loadAutomationsFromBackend: () => Promise<void>
  deleteAutomation: (id: string) => Promise<void>
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
  activeSurface: string
  setActiveSurface: (s: string) => void
  setActiveConsoleTab: (t: ConsoleTab) => void
  setPaletteOpen: (o: boolean) => void
  startVoiceCapture: () => Promise<void>
  stopVoiceCapture: () => Promise<void>
  bargeIn: () => Promise<unknown>
  updateAudioRms: (v: number) => void
  loadBackendData: () => Promise<void>
  orbState: OrbState
  setOrbState: (s: OrbState) => void
  inputMode: Mode
  setInputMode: (m: Mode) => void
  telemetry: LatencyStage[]
  glmSettings: GlmSettings
  updateGlmSettings: (settings: Partial<GlmSettings>) => void
  
  caretText: string
  setCaretText: (s: string) => void
  asrPartial: string
  pendingPlan: PlanStep[] | PendingPlanBackend | null
  openConsoleTab: (t: string) => void
  confirmPendingPlan: (planId?: string) => Promise<void>
  cancelPendingPlan: (planId?: string) => void
  undoLastAction: () => Promise<void>
  activeConsoleTab: string
  setActiveThreadId: (id: string) => void
  simulateVoiceTurn: () => void
  auditLog: AuditEntry[]
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
  threads: [],
  activeThreadId: null,
  chatHistoryOpen: false,
  spatialHudActive: false,
  contextInspectorOpen: true,
  debugDrawerOpen: false,

  facts: [],
  audit: [],
  automations: [],
  skills: [],
  latency: [...seed.latency.filter(stage=>stage.key!=="wake").map(stage=>({...stage,value:null})),{key:"barge",label:"Barge-in stop",value:null,budget:200,kind:"local"}],
  resources: {cpu_pct:null,rss_mb:null,thermal_c:null,asr_warm:false,tts_warm:false},
  connectivity: "online",
  spend: { used: 0.14, cap: 5.0 },

  glmSettings: {
    baseUrl: (typeof window !== "undefined" && localStorage.getItem("friday_glm_base_url")) || DEFAULT_AI_URL,
    heavyModel: (typeof window !== "undefined" && (localStorage.getItem("friday_glm_heavy_model") || localStorage.getItem("friday_glm_model"))) || DEFAULT_HEAVY_MODEL,
    lightModel: (typeof window !== "undefined" && localStorage.getItem("friday_glm_light_model")) || DEFAULT_LIGHT_MODEL,
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
  toggleMic: () => {
    const nextMuted = !useFriday.getState().micMuted
    set({ micMuted: nextMuted })
    if (nextMuted) {
      stopWebSpeechRecognition()
      stopFridayVoice()
      set({ orb: "idle", utterance: EMPTY_UTTERANCE })
      invokeCommand("stop_mic_capture").catch(() => {})
      invokeCommand("stop_listening").catch(() => {})
      invokeCommand("barge_in").catch(() => {})
    }
  },
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
    const current = useFriday.getState().threads.find((t) => t.id === activeThreadId)
    if (current && (!current.messages || current.messages.length === 0)) {
      ipcGetMessages(activeThreadId)
        .then((msgs) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            set((s) => ({
              threads: s.threads.map((t) =>
                t.id === activeThreadId
                  ? {
                      ...t,
                      messages: msgs.map((m) => ({
                        id: m.id,
                        role: m.role as "user" | "assistant",
                        content: m.show || m.say || "",
                        say: m.say,
                        show: m.show,
                        created_at: new Date(m.created_at * 1000).toISOString(),
                      })),
                      message_count: msgs.length,
                    }
                  : t
              ),
            }))
          }
        })
        .catch(() => {})
    }
  },
  createThread: (title?: string) => {
    const id = `t-${Date.now()}`
    const threadTitle = title?.trim() || "New session"
    const newThread: Thread = {
      id,
      title: threadTitle,
      pinned: false,
      message_count: 0,
      updated_at: new Date().toISOString(),
      messages: [],
    }
    set((s) => {
      const shouldClose = typeof window !== "undefined" && window.innerWidth < 768
      return {
        threads: [newThread, ...s.threads],
        activeThreadId: id,
        chatHistoryOpen: shouldClose ? false : s.chatHistoryOpen,
      }
    })
    ipcCreateThread(threadTitle, id).catch(() => {})
    ipcSetActiveThread(id).catch(() => {})
    return id
  },
  deleteThread: (threadId: string) => {
    set((s) => {
      const remaining = s.threads.filter((t) => t.id !== threadId)
      let nextActiveId = s.activeThreadId
      if (s.activeThreadId === threadId) {
        if (remaining.length > 0) {
          nextActiveId = remaining[0].id
        } else {
          const freshId = `t-${Date.now()}`
          const freshThread: Thread = {
            id: freshId,
            title: "New session",
            pinned: false,
            message_count: 0,
            updated_at: new Date().toISOString(),
            messages: [],
          }
          ipcCreateThread("New session", freshId).catch(() => {})
          ipcSetActiveThread(freshId).catch(() => {})
          return {
            threads: [freshThread],
            activeThreadId: freshId,
          }
        }
      }
      if (nextActiveId && nextActiveId !== s.activeThreadId) {
        ipcSetActiveThread(nextActiveId).catch(() => {})
      }
      return {
        threads: remaining,
        activeThreadId: nextActiveId,
      }
    })
    ipcDeleteThread(threadId).catch(() => {})
  },
  renameThread: (threadId: string, title: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    const nowIso = new Date().toISOString()
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, title: cleanTitle, updated_at: nowIso } : t
      ),
    }))
    ipcRenameThread(threadId, cleanTitle).catch(() => {})
  },
  toggleThreadPin: (threadId: string) => {
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, pinned: !t.pinned } : t
      ),
    }))
    ipcToggleThreadPin(threadId).catch(() => {})
  },
  toggleChatHistory: (open?: boolean) => {
    set((s) => {
      const next = typeof open === "boolean" ? open : !s.chatHistoryOpen
      if (typeof window !== "undefined") {
        try { localStorage.setItem("friday_chat_history_open", String(next)) } catch {}
      }
      return { chatHistoryOpen: next }
    })
  },
  setSpatialHudActive: (active: boolean) => {
    set({ spatialHudActive: active })
    void import("./window-mode").then(async ({ useWindowMode }) => {
      if (active) await useWindowMode.getState().enterSpatial()
      else await useWindowMode.getState().exitSpatial()
    })
  },
  hydrateThreadsFromBackend: async () => {
    try {
      const [backendThreads, activeId] = await Promise.all([
        ipcGetThreads(),
        ipcGetActiveThread().catch(() => null),
      ])
      if (Array.isArray(backendThreads) && backendThreads.length > 0) {
        set((s) => {
          const existingMap = new Map(s.threads.map((t) => [t.id, t]))
          const merged: Thread[] = backendThreads.map((bt) => {
            const existing = existingMap.get(bt.id)
            const count = existing?.messages?.length ? existing.messages.length : (bt.message_count ?? 0)
            return {
              id: bt.id,
              title: bt.title,
              pinned: bt.pinned,
              updated_at: new Date(bt.updated_at * 1000).toISOString(),
              message_count: count,
              messages: existing?.messages ?? [],
            }
          })
          const resolvedActive =
            activeId && merged.some((t) => t.id === activeId)
              ? activeId
              : s.activeThreadId && merged.some((t) => t.id === s.activeThreadId)
              ? s.activeThreadId
              : merged[0]?.id ?? null
          return {
            threads: merged,
            activeThreadId: resolvedActive,
          }
        })

        // Also fetch messages for active thread if empty
        const curActive = useFriday.getState().activeThreadId
        if (curActive) {
          const cur = useFriday.getState().threads.find((t) => t.id === curActive)
          if (cur && (!cur.messages || cur.messages.length === 0)) {
            ipcGetMessages(curActive)
              .then((msgs) => {
                if (Array.isArray(msgs) && msgs.length > 0) {
                  set((s) => ({
                    threads: s.threads.map((t) =>
                      t.id === curActive
                        ? {
                            ...t,
                            messages: msgs.map((m) => ({
                              id: m.id,
                              role: m.role as "user" | "assistant",
                              content: m.show || m.say || "",
                              say: m.say,
                              show: m.show,
                              created_at: new Date(m.created_at * 1000).toISOString(),
                            })),
                            message_count: msgs.length,
                          }
                        : t
                    ),
                  }))
                }
              })
              .catch(() => {})
          }
        }
      }
    } catch (e) {
      console.warn("Failed to hydrate threads from backend:", e)
    }
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

  pushMessage: (threadId, msg, persist = true) => {
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, msg],
              message_count: (t.message_count ?? t.messages.length) + 1,
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    }))
    if (persist) ipcAddMessage(threadId, msg.role, msg.say, msg.show || msg.content).catch(() => {})
  },

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

  deleteFact: async (id) => {
    const deleted = await deleteBackendFact(id)
    if (!deleted) throw new Error("The memory was not deleted. Reload and try again.")
    set((s) => ({ facts: s.facts.filter((f) => f.id !== id) }))
  },

  addFact: (fact) => set((s) => ({ facts: [fact, ...s.facts] })),
  setFacts: (facts) => set({ facts }),

  loadFactsFromBackend: async () => {
    const dbFacts = await getBackendFacts()
    const parsed: Fact[] = (dbFacts ?? []).map((db) => {
      const separator = db.content.includes("—") ? "—" : ":"
      const parts = db.content.split(separator)
      return {
        id: db.id, subject: parts.length > 1 ? parts[0].trim() : "Saved fact",
        value: parts.length > 1 ? parts.slice(1).join(separator).trim() : db.content,
        tier: "semantic", confidence: db.confidence,
        source_message_id: db.source_message_id ?? "Saved context",
        created_at: new Date(db.created_at * 1000).toISOString(), pinned: false,
      }
    })
    set({ facts: parsed })
  },

  addFactToBackend: async (subject: string, value: string, tier: Fact["tier"] = "semantic") => {
    if (!subject.trim() || !value.trim()) throw new Error("Enter a subject and a memory.")
    const saved = await addBackendFact(subject.trim() + " — " + value.trim(), 1)
    if (!saved?.id) throw new Error("The memory was not saved.")
    const fact: Fact = {
      id: saved.id, subject: subject.trim(), value: value.trim(), tier,
      confidence: saved.confidence, source_message_id: saved.source_message_id ?? "user-direct",
      created_at: new Date(saved.created_at * 1000).toISOString(), pinned: false,
    }
    set((s) => ({ facts: [fact, ...s.facts] }))
    return fact
  },

  loadAutomationsFromBackend: async () => {
    const saved = await invokeCommand<SavedAutomation[]>("get_automations")
    set({ automations: (saved ?? []).map(automationFromSaved) })
  },
  toggleAutomation: async (id) => {
    const enabled = await invokeCommand<boolean>("toggle_automation", { id })
    set((s) => ({ automations: s.automations.map((auto) => auto.id === id ? { ...auto, enabled, next_run: undefined } : auto) }))
  },
  addAutomation: async (auto) => {
    if (auto.trigger.type !== "cron") throw new Error("Choose a recurring schedule.")
    const saved = await invokeCommand<SavedAutomation>("create_automation", { name: auto.name, expr: auto.trigger.expr, tool: auto.actionTool, args: auto.actionArgs ?? "{}" })
    if (!saved?.id) throw new Error("The automation was not saved.")
    const created = automationFromSaved(saved)
    set((s) => ({ automations: [created, ...s.automations] }))
    return created
  },
  deleteAutomation: async (id) => {
    const deleted = await invokeCommand<boolean>("delete_automation", { id })
    if (!deleted) throw new Error("The automation was not deleted. Reload and try again.")
    set((s) => ({ automations: s.automations.filter((auto) => auto.id !== id) }))
  },
  runAutomationNow: async (id) => {
    const result = await invokeCommand<string>("trigger_automation", { id })
    await useFriday.getState().loadAutomationsFromBackend()
    return result
  },

  toggleSkill: (id) =>
    set((s) => ({
      skills: s.skills.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)),
    })),

  setLatency: (latency) => set({ latency }),
  setResources: (resources) => set({ resources }),
  setConnectivity: (connectivity) => set({ connectivity }),

  /* AI Models & Modular Router */
  aiModels: seed.initialAiModels,
  activeModelId: seed.initialAiModels.find((m) => m.is_active)?.id || DEFAULT_HEAVY_MODEL,
  testingModelId: null,

  loadAiModels: async () => {
    try {
      const loaded = await invokeCommand<AiModel[]>("get_ai_models")
      const models = loaded?.filter((m) => validateProviderConfig(m.base_url, m.name) === null)
      if (models && models.length > 0) {
        const active = models.find((m) => m.is_active)?.id || models[0].id
        set({ aiModels: models, activeModelId: active })
      }
    } catch (e) {
      console.warn("Could not load AI models from IPC:", e)
    }
  },

  setActiveModel: async (id: string) => {
    const targetModel = useFriday.getState().aiModels.find((m) => m.id === id)
    if (!targetModel) throw new Error("Model not found")
    if (targetModel.provider.startsWith("profile:")) {
      const { useSettings, profilesToModels } = await import("./settings")
      const settings = useSettings.getState()
      const current = await invokeCommand<import("./settings").DesktopSettings>("activate_provider_profile", { profileId: id })
      useSettings.setState({ saved: current, draft: { ...settings.draft, activeProfileId: id, revision: current.revision } })
      const profile = current.profiles.find((item) => item.id === id)
      if (profile) useFriday.getState().updateGlmSettings({ baseUrl: profile.baseUrl, heavyModel: profile.model, lightModel: profile.lightModel, hasKey: profile.hasKey })
      set({ aiModels: profilesToModels(current), activeModelId: id })
      return
    }
    const error = validateProviderConfig(targetModel.base_url, targetModel.name)
    if (error) throw new Error(error)
    await invokeCommand("set_active_model", { modelId: id })
    set((s) => ({
      activeModelId: id,
      aiModels: s.aiModels.map((m) => ({ ...m, is_active: m.id === id })),
      glmSettings: { ...s.glmSettings, heavyModel: targetModel.provider === "local_edge" ? targetModel.id : targetModel.name, lightModel: targetModel.provider === "local_edge" ? targetModel.id : targetModel.name, baseUrl: targetModel.base_url },
    }))
    if (typeof window !== "undefined") {
      const modelTag = targetModel.provider === "local_edge" ? targetModel.id : targetModel.name
      localStorage.setItem("friday_glm_heavy_model", modelTag)
      localStorage.setItem("friday_glm_light_model", modelTag)
      localStorage.setItem("friday_glm_model", modelTag)
      localStorage.setItem("friday_glm_base_url", targetModel.base_url)
    }
  },

  testModel: async (id: string) => {
    set({ testingModelId: id })
    try {
      const updated = await invokeCommand<AiModel>("test_model_connection", { modelId: id })
      if (!updated) throw new Error("Model connection testing requires the desktop app")
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
            color: "bg-red-500",
            status: "Connection failed",
            latency_ms: 0,
            tooltip: `${time} · Connection failed`,
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
    const configError = validateProviderConfig(model.base_url, model.name)
    if (configError) throw new Error(configError)
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
    if (!isDesktop) return Promise.resolve()
    stopFridayVoice()
    useFriday.setState({ orb: "idle", micMuted: false, utterance: EMPTY_UTTERANCE });
    const acknowledged=performance.now()
    playInstantAcousticCue()
    window.dispatchEvent(new CustomEvent("friday:voice-acknowledged", { detail: { acknowledgement_ms: performance.now()-acknowledged } }))
    return invokeCommand<void>("start_mic_capture").then(() => {
      if (!useFriday.getState().micMuted) useFriday.setState({ orb: "listening" })
    }).catch((error: unknown) => {
      useFriday.setState({ orb: "idle", micMuted: true });
      window.dispatchEvent(new CustomEvent("friday:voice-error", { detail: String(error) }))
    });
  },
  stopVoiceCapture: () => {
    stopWebSpeechRecognition();
    return invokeCommand<void>("finish_mic_capture").catch((error:unknown)=>{
      useFriday.setState({orb:"idle"});
      window.dispatchEvent(new CustomEvent("friday:voice-error",{detail:String(error)}))
    });
  },
  bargeIn: cancelActiveExecution,
  updateAudioRms: (v) => set({ level: v }),
  loadBackendData: async () => { if (isDesktop) await useFriday.getState().loadFactsFromBackend().catch((error: unknown) => console.warn("Saved context unavailable", error)) },
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
        const confirmed = await invokeCommand<PendingPlanBackend>("confirm_plan", { planId: targetId, confirmation: "confirm" })
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
        store.setResult({ say: String(e instanceof Error ? e.message : e), show: "The plan was not completed. Review its run history before retrying.", delivery: { emotion: "calm-concerned", pace: 1, energy: 0.6, pause_before_ms: 0, emphasis: [] } })
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
      if (isDesktop) void invokeCommand("cancel_plan", { planId: targetId }).catch((error: unknown) => store.setResult({ say: String(error), delivery: { emotion: "calm-concerned", pace: 1, energy: 0.6, pause_before_ms: 0, emphasis: [] } }))
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
  undoLastAction: async () => {
    await invokeCommand("undo_last");
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

export function formatAutoThreadTitle(prompt: string): string {
  const singleLine = prompt.replace(/[\r\n\t]+/g, " ").trim()
  if (!singleLine) return "New session"

  const capitalized = singleLine.charAt(0).toUpperCase() + singleLine.slice(1)
  if (capitalized.length <= 42) {
    return capitalized
  }

  const sliceZone = capitalized.slice(0, 42)
  const lastSpace = sliceZone.lastIndexOf(" ")
  if (lastSpace > 16) {
    return sliceZone.slice(0, lastSpace).trim() + "…"
  }

  return sliceZone.slice(0, 38).trim() + "…"
}

/** Dispatches a real message turn into the active thread and queries the configured provider. */
export async function sendChatMessage(text: string, expandedMode: boolean = false, context: { projectId?: string; providerProfileId?: string; threadId?: string } = {}) {
  const clean = text.trim()
  if (!clean) return

  // Constitutional Sub-150ms Non-Verbal Acoustic Earcon (§01 & §03)
  playInstantAcousticCue()

  const store = useFriday.getState()
  const threadId = context.threadId || store.activeThreadId || store.threads[0]?.id || store.createThread()
  const providerProfileId=context.providerProfileId || store.activeModelId
  const request: PendingRequest = { id: crypto.randomUUID(), threadId, cancelled: false }
  pendingRequests.set(request.id, request)
  visibleRequestId = request.id

  const userMsgId = `m-${Date.now()}-u`
  const asstMsgId = `m-${Date.now()}-a`

  const currentThread = store.threads.find((t) => t.id === threadId)
  if (currentThread && (currentThread.title.toLowerCase() === "new session" || !currentThread.title.trim())) {
    const autoTitle = formatAutoThreadTitle(clean)
    useFriday.setState((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, title: autoTitle } : t
      ),
    }))
    ipcRenameThread(threadId, autoTitle).catch(() => {})
  }

  // 1. Add User Message
  store.pushMessage(threadId, {
    id: userMsgId,
    role: "user",
    content: clean,
    say: clean,
    created_at: new Date().toISOString(),
  }, !isDesktop)

  // Every turn starts the same visible contract, including ordinary chat replies.
  store.resetUtterance()
  store.setHeard(clean)
  store.setPlan([{ id: `${userMsgId}-respond`, label: "Work through your instruction", tier: "green", status: "active" }])
  store.setDoing(0)
  store.setOrb("thinking")

  try {
    const recentMessages = (currentThread?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    await flushWorkspaceWrites()
    const aiRes = await executeAiTurn(clean, recentMessages, expandedMode ? "expanded" : "command", { ...context, providerProfileId, threadId, requestId: request.id })
    request.runId = aiRes.runId
    recordLatency("ttft",aiRes.ttftMs)
    if (request.cancelled) return

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
    }, !isDesktop)

    if (visibleRequestId !== request.id || useFriday.getState().activeThreadId !== threadId) return

    // Actuate client-side UI navigations if requested by on-device or SLM tools
    if (aiRes.toolCalls?.some((tc) => tc.name === "os.settings" || tc.name === "settings" || tc.name === "windows_settings")) {
      store.setTab("settings")
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("friday:os-mode", { detail: "console" }))
      }
    }
    if (aiRes.toolCalls?.some((tc) => tc.name === "os.godseye")) {
      store.setSpatialHudActive(true)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("friday:os-mode", { detail: "godseye" }))
      }
    }
    if (aiRes.toolCalls?.some((tc) => tc.name === "os.split")) {
      store.setSpatialHudActive(true)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("friday:os-mode", { detail: "unified" }))
      }
    }
    if (aiRes.toolCalls?.some((tc) => tc.name === "os.legion")) {
      store.setSpatialHudActive(true)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("friday:os-mode", { detail: "legion" }))
      }
    }
    if (aiRes.toolCalls?.some((tc) => tc.name === "os.grid")) {
      store.setSpatialHudActive(true)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("friday:os-mode", { detail: "unified" }))
      }
    }

    store.setResult({
      say: aiRes.say,
      show: aiRes.show,
      delivery: { emotion: aiRes.emotion, pace: 1, energy: 0.6, pause_before_ms: 0, emphasis: [] },
    })
    store.setDoing(null)
    store.setPlan([{ id: `${userMsgId}-respond`, label: "Work through your instruction", tier: "green", status: aiRes.failed ? "failed" : "done" }])

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
      store.setDoing(null)
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
    if (request.cancelled) return
    const errMsg = typeof err === "string" ? err : err instanceof Error ? err.message : JSON.stringify(err)
    store.pushMessage(threadId, {
      id: asstMsgId,
      role: "assistant",
      content: `### Response Notice\n\n${errMsg}\n\nPlease check your provider endpoint and API key in Settings.`,
      say: "There was an issue processing your request. Please check Settings.",
      show: `### Response Notice\n\n${errMsg}\n\nPlease check your provider endpoint and API key in Settings.`,
      created_at: new Date().toISOString(),
    })
    store.setOrb("idle")
    store.setDoing(null)
    store.setPlan([{ id: `${userMsgId}-respond`, label: "Work through your instruction", tier: "green", status: "failed" }])
    store.setResult({
      say: "The instruction could not be completed. Check the connection in Settings and try again.",
      delivery: { emotion: "calm-concerned", pace: 1, energy: 0.6, pause_before_ms: 0, emphasis: [] },
    })
  } finally {
    if (!request.runId || !useFriday.getState().threads.some(thread => thread.messages.some(message => message.pendingPlan?.run_id === request.runId))) pendingRequests.delete(request.id)
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
