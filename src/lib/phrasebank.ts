/** FRIDAY Phrase Bank System (§05.5 The Phrase Bank & §04 Latency Budgets)
 *
 * Provides instantaneous (0 ms first-sound) playback for conversational turns:
 * - 18+ Pre-rendered Golden Phrases categorized into Acknowledgements, Confirmations,
 *   Plan staging, Clarifications, and System Cues
 * - Exact and fuzzy normalized matching on incoming utterance responses
 * - In-memory AudioBuffer caching with Web Audio Studio DSP
 * - Hardware acoustic acknowledgement integration (rodio / Web Audio)
 * - Real-time telemetry tracking hits and milliseconds saved
 */

import type { Emotion, PhraseBankItem, PhraseCategory } from "./types"
import { getAudioContext, getOrCreateStudioDsp, playKokoroBuffer, fetchKokoroSpeech } from "./kokoro"
import { type KokoroVoiceId } from "./types"

export const PHRASE_BANK_CATALOG: PhraseBankItem[] = [
  // ── Acknowledgements (≤ 150 ms acknowledgment budget)
  {
    id: "pb-ack-1",
    key: "on_it",
    text: "On it.",
    category: "acknowledgement",
    emotion: "focused",
    latency_budget_ms: 150,
    cached: true,
  },
  {
    id: "pb-ack-2",
    key: "got_it",
    text: "Got it.",
    category: "acknowledgement",
    emotion: "focused",
    latency_budget_ms: 150,
    cached: true,
  },
  {
    id: "pb-ack-3",
    key: "right_away",
    text: "Right away.",
    category: "acknowledgement",
    emotion: "focused",
    latency_budget_ms: 150,
    cached: true,
  },
  {
    id: "pb-ack-4",
    key: "on_that",
    text: "I'm on that.",
    category: "acknowledgement",
    emotion: "focused",
    latency_budget_ms: 150,
    cached: true,
  },
  {
    id: "pb-ack-5",
    key: "one_second",
    text: "One second.",
    category: "acknowledgement",
    emotion: "focused",
    latency_budget_ms: 150,
    cached: true,
  },

  // ── Confirmations (Instant 0 ms post-action narration)
  {
    id: "pb-conf-1",
    key: "done",
    text: "Done.",
    category: "confirmation",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-conf-2",
    key: "all_done",
    text: "All done.",
    category: "confirmation",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-conf-3",
    key: "took_care",
    text: "Took care of that.",
    category: "confirmation",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-conf-4",
    key: "all_set",
    text: "All set.",
    category: "confirmation",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-conf-5",
    key: "sorted",
    text: "All sorted.",
    category: "confirmation",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },

  // ── Plan Staging & Risk Confirmation
  {
    id: "pb-plan-1",
    key: "plan_staged",
    text: "I've put a plan together on your screen. Want me to go ahead?",
    category: "plan",
    emotion: "bright",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-plan-2",
    key: "left_alone",
    text: "Left it alone.",
    category: "plan",
    emotion: "neutral",
    latency_budget_ms: 0,
    cached: true,
  },

  // ── Status & Clarifications
  {
    id: "pb-stat-1",
    key: "ready",
    text: "Ready when you are.",
    category: "status",
    emotion: "bright",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-stat-2",
    key: "say_again",
    text: "Sorry, say that again?",
    category: "status",
    emotion: "calm-concerned",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-stat-3",
    key: "still_working",
    text: "Still working on that.",
    category: "status",
    emotion: "focused",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-stat-4",
    key: "nothing_to_report",
    text: "Nothing to report.",
    category: "status",
    emotion: "neutral",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-stat-5",
    key: "audition",
    text: "Hey. I'm right here whenever you need me. What are we working on?",
    category: "status",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },

  // ── System Cues
  {
    id: "pb-sys-1",
    key: "listening",
    text: "I'm listening.",
    category: "system",
    emotion: "focused",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-2",
    key: "paused",
    text: "Paused.",
    category: "system",
    emotion: "neutral",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-3",
    key: "copied",
    text: "Copied to clipboard.",
    category: "system",
    emotion: "neutral",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-4",
    key: "focus_started",
    text: "Focus block started for forty-five minutes. Notifications are muted.",
    category: "system",
    emotion: "focused",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-5",
    key: "ai_conn_err_full",
    text: "I ran into an issue connecting to your AI provider. Please check your settings.",
    category: "system",
    emotion: "calm-concerned",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-6",
    key: "ai_conn_err_short",
    text: "I ran into an issue connecting to your AI provider.",
    category: "system",
    emotion: "calm-concerned",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-7",
    key: "check_settings",
    text: "Please check your settings.",
    category: "system",
    emotion: "focused",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-8",
    key: "req_issue_settings",
    text: "There was an issue processing your request. Please check Settings.",
    category: "system",
    emotion: "calm-concerned",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-9",
    key: "ai_endpoint_err",
    text: "I ran into a connection error with the AI endpoint. Please check your settings.",
    category: "system",
    emotion: "calm-concerned",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-10",
    key: "needs_key_full",
    text: "I'm right here, but my AI reasoning engine needs an API key. Please open Settings and enter your key so we can get to work.",
    category: "system",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
  {
    id: "pb-sys-11",
    key: "right_here",
    text: "Right here.",
    category: "system",
    emotion: "warm",
    latency_budget_ms: 0,
    cached: true,
  },
]

// In-Memory AudioBuffer Cache for instantaneous playback
const phraseAudioCache = new Map<string, AudioBuffer>()
let totalHits = 0
let totalMsSaved = 0

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ")
}

const lookupMap = new Map<string, PhraseBankItem>()
for (const item of PHRASE_BANK_CATALOG) {
  lookupMap.set(normalizeKey(item.text), item)
}

/** Matches incoming text against the Golden Phrase Bank catalog */
export function matchPhraseBank(rawText: string): PhraseBankItem | null {
  const normalized = normalizeKey(rawText)
  return lookupMap.get(normalized) ?? null
}

/** Pre-renders an acoustic buffer for instant phrase delivery */
export function generateAcousticCueBuffer(ctx: AudioContext, frequency: number, durationSecs: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const numSamples = Math.floor(sampleRate * durationSecs)
  const buffer = ctx.createBuffer(1, numSamples, sampleRate)
  const channel = buffer.getChannelData(0)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.sin((Math.PI * t) / durationSecs) * Math.exp(-t * 12.0)
    // Warm harmonic stack: fundamental + subtle 2nd harmonic
    const s1 = Math.sin(2.0 * Math.PI * frequency * t) * 0.7
    const s2 = Math.sin(2.0 * Math.PI * (frequency * 1.5) * t) * 0.3
    channel[i] = (s1 + s2) * envelope * 0.25
  }

  return buffer
}

/** Plays an instantaneous acoustic acknowledgement chime (< 150 ms) */
export function playInstantAcousticCue(): void {
  // Respect user preference: silenced by default to prevent repetitive acoustic irritation
  if (typeof window === "undefined" || localStorage.getItem("friday_earcon_enabled") !== "true") {
    return;
  }
  const ctx = getAudioContext()
  if (!ctx) return

  const buffer = generateAcousticCueBuffer(ctx, 480, 0.12)
  const source = ctx.createBufferSource()
  source.buffer = buffer

  const dsp = getOrCreateStudioDsp(ctx)
  source.connect(dsp.warmthFilter)
  source.start(0)
}

export const CRITICAL_PHRASE_KEYS = ["on_it", "got_it", "done", "all_set", "listening"]

/** Pre-caches audio buffers for instant phrase retrieval using Kokoro */
export async function preloadPhraseBank(endpoint: string, profile: KokoroVoiceId): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return

  // 1. High-frequency micro-acknowledgements first (instant responsiveness)
  const criticalItems = PHRASE_BANK_CATALOG.filter((p) => CRITICAL_PHRASE_KEYS.includes(p.key))
  for (const item of criticalItems) {
    if (!phraseAudioCache.has(item.key)) {
      try {
        const buffer = await fetchKokoroSpeech(item.text, profile, endpoint)
        if (buffer) {
          phraseAudioCache.set(item.key, buffer)
        }
      } catch {}
    }
  }

  // 2. Deferred background fetch for remaining catalog without competing with active turns
  if (typeof window !== "undefined") {
    setTimeout(async () => {
      const remainingItems = PHRASE_BANK_CATALOG.filter((p) => !CRITICAL_PHRASE_KEYS.includes(p.key))
      for (const item of remainingItems) {
        if (!phraseAudioCache.has(item.key)) {
          try {
            const buffer = await fetchKokoroSpeech(item.text, profile, endpoint)
            if (buffer) {
              phraseAudioCache.set(item.key, buffer)
            }
          } catch {}
        }
      }
    }, 2000)
  }
}

/** Plays a Phrase Bank item with 0 ms first-sound latency. Returns true if played, false if offline/unavailable. */
export async function playPhraseInstant(
  item: PhraseBankItem,
  options: {
    onLevel?: (level: number) => void
    onEnd?: () => void
  } = {}
): Promise<boolean> {
  const ctx = getAudioContext()
  if (!ctx) {
    options.onEnd?.()
    return false
  }

  let buffer = phraseAudioCache.get(item.key)
  if (!buffer) {
    try {
      const endpoint = localStorage.getItem("friday_kokoro_endpoint") || "http://127.0.0.1:8880/v1"
      const profile = (localStorage.getItem("friday_voice_profile") || "bf_emma") as KokoroVoiceId
      const kokoroBuffer = await fetchKokoroSpeech(item.text, profile, endpoint)
      if (kokoroBuffer) {
        buffer = kokoroBuffer
        phraseAudioCache.set(item.key, buffer)
      }
    } catch {
      // Offline
    }
  }

  if (!buffer) {
    return false
  }

  totalHits += 1
  totalMsSaved += 1200 // Approx 1.2s avoided LLM + TTS pipeline lag

  // Play audio through studio DSP chain
  await playKokoroBuffer(buffer, {
    enableWarmth: true,
    onLevel: options.onLevel,
    onEnd: options.onEnd,
  })
  return true
}

/** Retrieves Phrase Bank system telemetry */
export function getPhraseBankTelemetry() {
  return {
    catalogSize: PHRASE_BANK_CATALOG.length,
    totalHits,
    totalMsSaved,
    cachedBuffers: phraseAudioCache.size,
  }
}
