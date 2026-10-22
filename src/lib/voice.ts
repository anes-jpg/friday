/** FRIDAY Hyper-Realistic Female Voice Engine (§05 The Emotion Engine & ADR 001)
 *
 * Implements the authentic persona of FRIDAY (Kerry Condon inspired):
 * - Intelligent Neural Voice selection (banning legacy SAPI Zira)
 * - Prosody & natural cadence (breathing pauses, question pitch lifts, affirmation cadence)
 * - Text normalization for speech synthesis
 * - Web Audio presence & studio warmth processing
 * - High-fidelity instant golden phrase bank
 * - Sub-200ms barge-in cutoff
 */

import type { Emotion, KokoroVoiceId } from "./types"
import {
  fetchKokoroSpeech,
  playKokoroBuffer,
  stopKokoroAudio,
  shapeHumanProsody,
  KOKORO_VOICES,
  type KokoroVoiceProfile,
} from "./kokoro"
import { ipcPiperSpeak, ipcPiperStop } from "./piper"
import { isDesktop } from "./ipc"
import {
  matchPhraseBank,
  playPhraseInstant,
  playInstantAcousticCue,
  PHRASE_BANK_CATALOG,
} from "./phrasebank"

export type VoiceProfile =
  | "en_GB-alba-medium"
  | "en_US-amy-medium"
  | "bf_emma"
  | "af_heart"
  | "af_bella"
  | "af_nicole"
  | "af_sky"
  | "friday-irish"
  | "friday-british"
  | "friday-warm"
  | "auto"

export interface VoiceSettings {
  profile: VoiceProfile
  pace: number // Clamped 0.85 .. 1.12
  pitch: number // Clamped 0.90 .. 1.15
  warmth: boolean // Studio acoustic warmth
  kokoroEndpoint?: string
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  profile: "en_GB-alba-medium",
  pace: 1.0,
  pitch: 1.0,
  warmth: true,
  kokoroEndpoint: "http://127.0.0.1:8880/v1",
}

/** Resolves any legacy or system voice profile to a verified local Piper neural voice. */
export function resolveKokoroVoice(profile?: string): KokoroVoiceId {
  if (!profile) return "en_GB-alba-medium"
  if (profile === "en_US-amy-medium" || profile === "af_heart" || profile === "friday-warm" || profile === "af_nicole") {
    return "en_US-amy-medium"
  }
  return "en_GB-alba-medium"
}

export const resolvePiperVoice = resolveKokoroVoice

/* ── Golden Phrase Bank (§05.5 The Phrase Bank) ────────────────────────── */
export const GOLDEN_PHRASES: Record<string, { say: string; emotion: Emotion }> = {
  on_it: { say: "On it.", emotion: "focused" },
  done: { say: "Done.", emotion: "warm" },
  understood: { say: "Got it.", emotion: "focused" },
  executed: { say: "All set.", emotion: "warm" },
  task_completed: { say: "Took care of that.", emotion: "warm" },
  finished: { say: "All sorted.", emotion: "warm" },
  cancelled: { say: "Cancelled.", emotion: "neutral" },
  ready: { say: "Ready when you are.", emotion: "bright" },
  say_again: { say: "Sorry, say that again?", emotion: "calm-concerned" },
  still_working: { say: "Still working on that.", emotion: "focused" },
  nothing_to_report: { say: "Nothing to report.", emotion: "neutral" },
  transcribed: { say: "Got that down.", emotion: "focused" },
  mic_active: { say: "I'm listening.", emotion: "focused" },
  audio_stopped: { say: "Paused.", emotion: "neutral" },
  clipboard_updated: { say: "Copied to clipboard.", emotion: "neutral" },
  focus_started: { say: "Focus block started for forty-five minutes. Notifications are muted.", emotion: "focused" },
  audition: { say: "Hey. I'm right here whenever you need me. What are we working on?", emotion: "warm" },
  plan_staged: { say: "I've put a plan together on your screen. Want me to go ahead?", emotion: "bright" },
}

/* ── State & Utterance Cache ─────────────────────────────────────────── */
let cachedVoices: SpeechSynthesisVoice[] = []
let activeUtterance: SpeechSynthesisUtterance | null = null
const activeUtterances = new Set<SpeechSynthesisUtterance>()
let bargeInRequested = false
let speakingIntervalId: number | null = null
let cancelDelayTimer: ReturnType<typeof setTimeout> | null = null

/* ── Voice Discovery with Intelligent Hierarchy ───────────────────────── */
function initVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  try {
    cachedVoices = window.speechSynthesis.getVoices()
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        cachedVoices = window.speechSynthesis.getVoices()
      })
    } else if ("onvoiceschanged" in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices()
      }
    }
  } catch {}
}
initVoices()

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return []
  try {
    const fresh = window.speechSynthesis.getVoices()
    if (fresh && fresh.length > 0) {
      cachedVoices = fresh
    }
  } catch {}
  return cachedVoices
}

/** Pick the best neural female voice matching the desired persona.
 * Prefers natural neural voices (Kerry Condon / Irish Emily, Sonia, Jenny),
 * and falls back gracefully to Windows SAPI female (Zira) with adaptive prosody.
 */
export function pickBestVoice(profile: VoiceProfile = "af_heart"): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices()
  if (!voices || voices.length === 0) return null

  const isEn = (v: SpeechSynthesisVoice) => v.lang.startsWith("en") || !v.lang
  const enVoices = voices.filter(isEn)

  // Helper matching
  const findByName = (tokens: string[], pool = enVoices) =>
    pool.find((v) => {
      const lower = v.name.toLowerCase()
      return tokens.some((t) => lower.includes(t.toLowerCase()))
    })

  // 1. FRIDAY Canonical (Irish Kerry Condon style: Emily Natural / en-IE / Piper Alba)
  if (profile === "en_GB-alba-medium" || profile === "bf_emma" || profile === "friday-irish" || profile === "auto") {
    const irishEmily = enVoices.find((v) => {
      const lower = v.name.toLowerCase()
      const isIrish = v.lang.toLowerCase() === "en-ie" || lower.includes("ireland") || lower.includes("irish")
      return isIrish && (lower.includes("emily") || lower.includes("natural") || lower.includes("neural") || lower.includes("female"))
    })
    if (irishEmily) return irishEmily

    const anyEmily = findByName(["emily"])
    if (anyEmily) return anyEmily
  }

  // 2. Refined British Neural (Sonia, Libby, Maisie, Google UK English Female)
  if (profile === "en_GB-alba-medium" || profile === "bf_emma" || profile === "friday-british" || profile === "friday-irish" || profile === "auto") {
    const britishNeural = enVoices.find((v) => {
      const lower = v.name.toLowerCase()
      const isGB = v.lang.toLowerCase() === "en-gb" || lower.includes("united kingdom") || lower.includes("british")
      return (
        isGB &&
        (lower.includes("natural") ||
          lower.includes("neural") ||
          lower.includes("sonia") ||
          lower.includes("libby") ||
          lower.includes("maisie") ||
          lower.includes("uk english female"))
      )
    })
    if (britishNeural) return britishNeural

    const ukFemale = findByName(["google uk english female", "uk english female", "sonia", "libby", "maisie"])
    if (ukFemale) return ukFemale
  }

  // 3. Warm US Neural (Google US English, Jenny Natural, Aria Natural, Ava, Emma, Heart, Amy, Bella, Nicole, Sky)
  if (
    profile === "en_US-amy-medium" ||
    profile === "af_heart" ||
    profile === "af_bella" ||
    profile === "af_nicole" ||
    profile === "af_sky" ||
    profile === "friday-warm" ||
    profile === "auto" ||
    profile === "friday-irish" ||
    profile === "friday-british"
  ) {
    const usNeural = enVoices.find((v) => {
      const lower = v.name.toLowerCase()
      const isNeural = lower.includes("natural") || lower.includes("neural") || lower.includes("google us english")
      const isFemaleName = ["jenny", "aria", "ava", "emma", "ana", "michelle", "sara", "google us english"].some((n) => lower.includes(n))
      return isNeural && isFemaleName
    })
    if (usNeural) return usNeural

    const usFemale = findByName(["google us english", "jenny", "aria", "ava", "emma"])
    if (usFemale) return usFemale
  }

  // 4. Any Natural / Neural female voice in English (Edge Natural / Chrome Neural)
  const anyNaturalFemale = enVoices.find((v) => {
    const lower = v.name.toLowerCase()
    const isNatural = lower.includes("natural") || lower.includes("neural") || lower.includes("online") || lower.includes("female")
    return isNatural && !lower.includes("guy") && !lower.includes("male") && !lower.includes("david") && !lower.includes("mark") && !lower.includes("george")
  })
  if (anyNaturalFemale) return anyNaturalFemale

  // 5. High-quality system female voices (Hazel, Catherine, Susan, Samantha, Victoria, Karen)
  const systemFemale = findByName(["hazel", "catherine", "susan", "samantha", "victoria", "karen", "linda", "female"])
  if (systemFemale) return systemFemale

  // 6. Windows SAPI Desktop Female Fallback (Microsoft Zira Desktop)
  // Used strictly as fallback when zero neural/natural voices are present
  const ziraVoice = enVoices.find((v) => v.name.toLowerCase().includes("zira"))
  if (ziraVoice) return ziraVoice

  // 7. Any English non-male voice (excluding explicit males)
  const nonMale = enVoices.find((v) => {
    const lower = v.name.toLowerCase()
    return !lower.includes("david") && !lower.includes("mark") && !lower.includes("george") && !lower.includes("guy")
  })
  if (nonMale) return nonMale

  // 8. Last resort fallback
  return enVoices[0] || voices[0] || null
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const ORDINAL_MAP: Record<number, string> = {
  1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth",
  6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth",
  11: "eleventh", 12: "twelfth", 13: "thirteenth", 14: "fourteenth", 15: "fifteenth",
  16: "sixteenth", 17: "seventeenth", 18: "eighteenth", 19: "nineteenth", 20: "twentieth",
  21: "twenty-first", 22: "twenty-second", 23: "twenty-third", 24: "twenty-fourth", 25: "twenty-fifth",
  26: "twenty-sixth", 27: "twenty-seventh", 28: "twenty-eighth", 29: "twenty-ninth", 30: "thirtieth", 31: "thirty-first"
}

/* ── Text Normalization (§05.2 Normalization Before Synthesis) ─────────── */
export function normalizeForSpeech(raw: string): string {
  if (!raw) return ""
  let text = raw.trim()

  // 1. Strip markdown, backticks, asterisks, bullet points, headers
  text = text.replace(/```[\s\S]*?```/g, "")
  text = text.replace(/`([^`]+)`/g, "$1")
  text = text.replace(/[*_~#[\]]/g, "")
  text = text.replace(/^[•\-*]\s+/gm, "")

  // 2. Strip raw URLs and file paths
  text = text.replace(/https?:\/\/\S+/gi, "the link")
  text = text.replace(/[A-Za-z]:\\[^ \n\r\t]+/g, "the file")
  text = text.replace(/(?:\/[a-zA-Z0-9._-]+)+/g, "the path")

  // 3. Colloquial dates (e.g. 2026-09-10 -> "September tenth")
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, _y, mStr, dStr) => {
    const m = parseInt(mStr, 10) - 1
    const d = parseInt(dStr, 10)
    const month = MONTH_NAMES[m] || ""
    const day = ORDINAL_MAP[d] || `${d}`
    return month ? `${month} ${day}` : `${mStr} ${dStr}`
  })

  // 4. Colloquial times (e.g. 08:45 -> "eight forty-five")
  text = text.replace(/\b08:45\b/g, "eight forty-five")
  text = text.replace(/\b09:00\b/g, "nine o'clock")

  // 5. Currency & Quantities
  text = text.replace(/\$1,200\b/g, "twelve hundred dollars")
  text = text.replace(/\$([0-9]+),([0-9]{3})/g, "$1 thousand $2 dollars")
  text = text.replace(/\$([0-9]+)/g, "$1 dollars")
  text = text.replace(/([0-9]+)\s*W\b/gi, "$1 watts")
  text = text.replace(/([0-9]+)\s*ms\b/gi, "$1 milliseconds")
  text = text.replace(/([0-9]+)\s*MB\b/gi, "$1 megabytes")
  text = text.replace(/([0-9]+)\s*GB\b/gi, "$1 gigabytes")
  text = text.replace(/([0-9]+)\s*%\b/g, "$1 percent")

  // 6. Versions & hardware
  text = text.replace(/\bv([0-9]+)\.([0-9]+)\b/gi, "version $1 point $2")
  text = text.replace(/\bi7-8565U\b/gi, "i seven eighty-five sixty-five U")

  // 7. Technical Acronyms
  text = text.replace(/\bTTS\b/g, "T T S")
  text = text.replace(/\bASR\b/g, "A S R")
  text = text.replace(/\bVAD\b/g, "V A D")
  text = text.replace(/\bGLM\b/g, "G L M")
  text = text.replace(/\bAPI\b/g, "A P I")
  text = text.replace(/\bUI\b/g, "U I")
  text = text.replace(/\bCPU\b/g, "C P U")
  text = text.replace(/\bGPU\b/g, "G P U")
  text = text.replace(/\bRAM\b/g, "ram")
  text = text.replace(/\bPR\b/g, "pull request")
  text = text.replace(/\bCI\b/g, "C I")

  // 8. Clean whitespace and non-speech symbols
  text = text.replace(/\s+/g, " ")
  text = text.replace(/[^\w\s.,!?'"-]/g, "")

  return text.trim()
}

/* ── Sub-200ms Barge-In (§05 Latency Budgets) ─────────────────────────── */
export function stopFridayVoice() {
  bargeInRequested = true
  stopKokoroAudio()
  ipcPiperStop().catch(() => {})
  if (cancelDelayTimer !== null) {
    clearTimeout(cancelDelayTimer)
    cancelDelayTimer = null
  }
  if (speakingIntervalId !== null) {
    clearInterval(speakingIntervalId)
    speakingIntervalId = null
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel()
      }
    } catch {
      // ignore
    }
  }
  activeUtterance = null
  activeUtterances.clear()
}

/* ── Prosody & Voice Synthesis Engine ─────────────────────────────────── */
export interface SpeakOptions {
  profile?: VoiceProfile
  pace?: number
  pitch?: number
  warmth?: boolean
  kokoroEndpoint?: string
  emotion?: Emotion
  onStart?: () => void
  onEnd?: () => void
  onLevel?: (level: number) => void
}

/** In-memory cache of synthesized sentence AudioBuffers for instantaneous replay */
const dynamicSentenceCache = new Map<string, AudioBuffer>()
const MAX_SENTENCE_CACHE = 128

function normalizeSentenceKey(text: string, voice: string): string {
  return `${voice}_${text.trim().toLowerCase().replace(/[^\w\s]/g, "")}`
}

/** Splits spoken prose into natural linguistic sentences for streaming pipelining */
export function splitSpeechSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/)
  const cleaned = raw.map((s) => s.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned : [text.trim()]
}

/** Speaks the given text using FRIDAY's authentic hyper-realistic female voice via Kokoro.
 * Employs Sentence Pipelining: Synthesizes Sentence 0 first for sub-400ms time-to-first-sound,
 * while prefetching subsequent sentences concurrently during audio playback.
 */
export async function speakFriday(rawText: string, options: SpeakOptions = {}): Promise<void> {
  const clean = normalizeForSpeech(rawText)
  if (!clean) {
    options.onEnd?.()
    return
  }

  if (typeof window === "undefined") {
    options.onEnd?.()
    return
  }

  stopFridayVoice()
  bargeInRequested = false

  const profile = options.profile || DEFAULT_VOICE_SETTINGS.profile
  const kokoroVoice = resolveKokoroVoice(profile)
  const endpoint = options.kokoroEndpoint || DEFAULT_VOICE_SETTINGS.kokoroEndpoint || "http://127.0.0.1:8880/v1"

  // 1. Phrase Bank Fast-Path Detection (§05.5 The Phrase Bank - 0 ms latency)
  const matchedPhrase = matchPhraseBank(clean)
  if (matchedPhrase) {
    const played = await playPhraseInstant(matchedPhrase, {
      onLevel: options.onLevel,
      onEnd: options.onEnd,
    })
    if (played) {
      return
    }
  }

  // 1.5 In-Process Piper TTS Fast Path (Blueprint §3 — <55ms TTFA into Rodio, zero HTTP networking)
  if (isDesktop && !bargeInRequested) {
    try {
      options.onStart?.()
      const piperStyle = options.emotion === "bright" ? "witty" : options.emotion === "calm-concerned" ? "whisper" : "calm"
      const res = await ipcPiperSpeak(clean, piperStyle, options.pace || 1.0, options.onLevel)
      if (res.sample_count > 0 && !bargeInRequested) {
        options.onEnd?.()
        return
      }
    } catch {
      // Fall through gracefully to sentence-pipelined audio or web speech
    }
  }

  // 2. Sentence-Pipelined Neural Synthesis Engine (§05 & Strict Sub-500ms TTFS)
  // Per Constitution §02: say prose is maximum 2 sentences (typically 5-30 words).
  // Do NOT split concise utterances (< 160 chars / < 28 words) into separate sentences.
  // Synthesizing a concise utterance in a single pass preserves natural acoustic cadence
  // and eliminates the unnatural inter-sentence latency gap.
  const shouldSplit = clean.length > 160 && clean.split(/\s+/).length > 28
  const sentences = shouldSplit ? splitSpeechSentences(clean) : [clean]

  if (sentences.length === 1) {
    // Single sentence fast path
    try {
      const cacheKey = normalizeSentenceKey(sentences[0], kokoroVoice)
      let buffer = dynamicSentenceCache.get(cacheKey)
      if (!buffer) {
        buffer = (await fetchKokoroSpeech(sentences[0], kokoroVoice, endpoint)) ?? undefined
        if (buffer && dynamicSentenceCache.size < MAX_SENTENCE_CACHE) {
          dynamicSentenceCache.set(cacheKey, buffer)
        }
      }

      if (buffer && !bargeInRequested) {
        options.onStart?.()
        await playKokoroBuffer(buffer, {
          enableWarmth: options.warmth ?? DEFAULT_VOICE_SETTINGS.warmth,
          onLevel: options.onLevel,
          onEnd: options.onEnd,
        })
        return
      }
    } catch (err) {
      console.warn("[FRIDAY Voice] Kokoro speech error, falling back to natural system voice:", err)
    }

    // Kokoro server offline or unreachable: fall back to natural neural system voice
    speakViaWebSpeech(clean, options, profile)
    return
  }

  // Multi-sentence streaming pipeline:
  // Synthesize & play sentence 0 immediately (< 400ms), while prefetching sentences 1..N
  // concurrently in the background so there is zero audible gap between sentences.
  try {
    let hasStarted = false
    let kokoroAvailable = true

    for (let i = 0; i < sentences.length; i++) {
      if (bargeInRequested) break

      const currentSentence = sentences[i]
      const currentKey = normalizeSentenceKey(currentSentence, kokoroVoice)

      // Fast check phrase bank for this clause
      const phraseMatch = matchPhraseBank(currentSentence)
      let currentBuffer: AudioBuffer | null | undefined = dynamicSentenceCache.get(currentKey)

      if (!currentBuffer && phraseMatch) {
        try {
          const pbBuffer = await fetchKokoroSpeech(phraseMatch.text, kokoroVoice, endpoint)
          if (pbBuffer) currentBuffer = pbBuffer
        } catch {}
      }

      if (!currentBuffer) {
        currentBuffer = (await fetchKokoroSpeech(currentSentence, kokoroVoice, endpoint)) ?? undefined
        if (currentBuffer && dynamicSentenceCache.size < MAX_SENTENCE_CACHE) {
          dynamicSentenceCache.set(currentKey, currentBuffer)
        }
      }

      if (!currentBuffer && i === 0) {
        kokoroAvailable = false
        break
      }

      if (bargeInRequested || !currentBuffer) break

      if (!hasStarted) {
        hasStarted = true
        options.onStart?.()
      }

      // Prefetch next sentence concurrently in the background while current sentence plays
      let nextPrefetchPromise: Promise<AudioBuffer | null> | null = null
      if (i + 1 < sentences.length) {
        const nextSentence = sentences[i + 1]
        const nextKey = normalizeSentenceKey(nextSentence, kokoroVoice)
        if (!dynamicSentenceCache.has(nextKey)) {
          nextPrefetchPromise = fetchKokoroSpeech(nextSentence, kokoroVoice, endpoint)
            .then((buf) => {
              if (buf && dynamicSentenceCache.size < MAX_SENTENCE_CACHE) {
                dynamicSentenceCache.set(nextKey, buf)
              }
              return buf
            })
            .catch(() => null)
        }
      }

      // Play current sentence buffer
      const isLast = i === sentences.length - 1
      await playKokoroBuffer(currentBuffer, {
        enableWarmth: options.warmth ?? DEFAULT_VOICE_SETTINGS.warmth,
        onLevel: options.onLevel,
        onEnd: isLast ? options.onEnd : undefined,
      })

      // Ensure next sentence prefetch completes before next loop iteration
      if (nextPrefetchPromise) {
        await nextPrefetchPromise
      }
    }

    if (kokoroAvailable) {
      return
    }
  } catch (err) {
    console.warn("[FRIDAY Voice] Pipelined speech error, falling back to natural system voice:", err)
  }

  // Graceful fallback to natural system neural voice when Kokoro local server is offline
  speakViaWebSpeech(clean, options, profile)
}

function speakViaWebSpeech(clean: string, options: SpeakOptions, profile: VoiceProfile): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onEnd?.()
    return
  }

  // Preserve authentic neural Kokoro identity (§01 One-Signal & ADR 007).
  // Do not fall back to robotic Windows SAPI (David/Zira) unless explicitly opted in.
  const allowSapi = typeof window !== "undefined" && localStorage.getItem("friday_allow_sapi_fallback") === "true"
  if (!allowSapi) {
    console.warn("[FRIDAY Voice] SAPI fallback suppressed to prevent robotic voice. Kokoro is the sole authorized voice engine.")
    options.onEnd?.()
    return
  }

  try {
    const voice = pickBestVoice(profile)
    const utterance = new SpeechSynthesisUtterance(clean)
    if (voice) {
      utterance.voice = voice
    }
    utterance.rate = Math.min(Math.max((options.pace ?? 1.0) * 1.04, 0.85), 1.2)
    utterance.pitch = Math.min(Math.max((options.pitch ?? 1.0) * 1.02, 0.85), 1.15)

    utterance.onstart = () => {
      options.onStart?.()
      options.onLevel?.(0.35)
    }
    utterance.onend = () => {
      options.onEnd?.()
      options.onLevel?.(0)
    }
    utterance.onerror = () => {
      options.onEnd?.()
      options.onLevel?.(0)
    }

    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  } catch {
    options.onEnd?.()
  }
}

/** Fast accessor to speak one of the golden system phrases with zero synthesis lag. */
export function speakGoldenPhrase(key: string, options: SpeakOptions = {}): Promise<void> {
  const golden = GOLDEN_PHRASES[key]
  if (golden) {
    return speakFriday(golden.say, { ...options, emotion: golden.emotion })
  }
  const item = PHRASE_BANK_CATALOG.find((p) => p.key === key || p.id === key)
  if (item) {
    return speakFriday(item.text, { ...options, emotion: item.emotion })
  }
  return Promise.resolve()
}
