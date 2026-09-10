# FRIDAY — Windows Desktop Assistant: Full Build Plan

<aside>
🎯

The bet: a voice-first desktop operator that runs your professional work while you talk to her, replies in under two seconds, sounds like a person instead of a phone menu, and looks like Microsoft shipped it. Not a chatbot in a window — an operator with hands on your machine.

**Hard rules for this build**

- **Voice is the primary interface**, not a feature bolted on. If a workflow cannot be driven end to end by speaking, it is not finished.
- Perceived latency: **≤ 1.8 s p95** from the end of your sentence to her first syllable, stretch goal 1.3 s. Measured on *your* laptop and *your* Wi-Fi, never on a spec sheet.
- **She has to sound like a person.** Emotional prosody, varied pacing, real interruption handling. A flat TTS voice fails the brief no matter how good the automation underneath is.
- Every destructive action is **spoken back and confirmed** before it runs. No silent writes, no silent shell.
- **The cloud is exactly one thing: GLM.** Wake word, endpointing, recognition, synthesis, and embeddings all run on your CPU. No speech vendor, no audio vendor, no audio ever leaving the machine.
- One accent color. One motion language. Zero decorative animation.
</aside>

## Your machine — what it actually allows

<aside>
🖥️

**Intel i7-8565U · 4 cores / 8 threads · 15 W · 15.8 GB RAM · UHD 620 + NVIDIA MX · SSD.** A capable 2019 ultrabook, and a thermally constrained one. This is good news for the product and it removes three decisions from the table.

</aside>

| What you have | What it means for FRIDAY |
| --- | --- |
| 4 cores / 8 threads at a 15 W TDP, sustaining roughly 2.2–3.0 GHz | Enough for the app, the UI, wake word, VAD, embeddings, **a streaming transducer recogniser, and a small neural voice** — provided every ONNX session gets a hard thread cap. **Not** enough for whisper `small.en` on the interactive path, and not enough for any LLM at any quantisation. |
| 15.8 GB RAM, already at 67% before FRIDAY exists | Roughly 5 GB free, so the constraint is discipline rather than capacity. Budget: **≤ 250 MB idle** with only wake word and VAD resident, **≤ 700 MB peak** with the recogniser and voice both warm. Keep the recogniser warm 10 minutes after last use and the voice 5 — reloading an ONNX session mid-conversation costs 200–500 ms and you will hear it as a stumble. |
| NVIDIA MX, 2 GB class, **idling at 76 °C** | 2 GB VRAM rules out any local LLM permanently, and a 76 °C idle in a thin chassis means sustained load throttles the CPU as well — always benchmark the *second* minute, not the first. What the MX is actually worth: one M0 benchmark for the dictation second pass. Separately, benchmark ONNX Runtime's OpenVINO and DirectML execution providers on the **UHD 620** — moving the voice model to integrated graphics frees CPU for the recogniser, and it is a 30-line experiment with a real chance of paying off. |
| Wi-Fi, Lagos | Exactly one network hop exists in the whole pipeline: GLM. That makes round-trip time the single largest term in your latency budget and the only one you cannot engineer away. Keep one warm TLS connection open permanently, log time-to-first-token at 09:00 and at 21:00 — they will differ — and serve everything you can from local caches so short turns never touch the network at all. |

**The three conclusions, and they are not negotiable on this hardware:**

1. **Recognition must be a streaming transducer, not whisper.** This is the single most important technical decision in the document. Whisper is an encoder-decoder that cannot begin until your sentence ends, so on a 15 W chip it adds one to two and a half seconds *after* you stop talking. A streaming Zipformer transducer decodes continuously as audio arrives, so when you stop, it is already finished — the remaining tail is 120–250 ms. Same CPU, same privacy, same zero cost, and roughly an order of magnitude better felt latency. Everyone who concludes "local speech is too slow" reached that conclusion by benchmarking whisper.
2. **There is no local LLM.** GLM is the brain and the only network call in the product. A 7B on this CPU is 4–8 tokens per second, which is a 15-second spoken answer.
3. **The voice is local, so emotion has to be engineered rather than purchased.** A 15 W CPU can run an 82M-parameter neural voice in real time; it cannot run a model that *feels* the sentence. What you get is natural timbre plus complete control over pace, emphasis, and pauses, backed by a hand-tuned phrase bank that covers most of what she ever says. That is a genuinely good voice. It is not an actor, and this plan will not pretend otherwise.

**Run this in M0 before writing features.** Three numbers, from your machine, written back into this page:

```powershell
# sustained clocks under load, not the marketing turbo
Get-CimInstance Win32_Processor |
  Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, CurrentClockSpeed

# does the MX have a usable CUDA runtime, and how hot does it start?
nvidia-smi --query-gpu=name,memory.total,temperature.gpu,utilization.gpu --format=csv

# headroom check: what is left after your browser and editor are open
Get-CimInstance Win32_OperatingSystem |
  Select-Object @{n="FreeRAM_GB";e={[math]::Round($_.FreePhysicalMemory/1MB,1)}}
```

Then benchmark, in this order — every one of these is a number you will design against:

1. Streaming Zipformer int8: real-time factor and **final-chunk latency** at 1 and 2 threads. Final-chunk latency is the number that matters; RTF alone will mislead you.
2. whisper `base.en` / `small.en` on 4 CPU threads, then on the MX with CUDA. Dictation second pass only.
3. Piper real-time factor, and Kokoro-82M int8 on 2 threads — then Kokoro again through the OpenVINO and DirectML providers on the iGPU.
4. bge-small embedding time for a single short utterance.
5. GLM time-to-first-token over 20 calls, at 09:00 and again at 21:00.
6. **Your own word error rate.** Record 50 sentences in your voice, your accent, your vocabulary, and score every recogniser candidate on that set.

Everything downstream is arithmetic on those numbers instead of opinion — including mine.

## 00 · Decision log — locked before line one of code

These are decided. Re-open only with a measured reason.

| # | Decision | Choice | Why not the alternative |
| --- | --- | --- | --- |
| D1 | App shell | **Tauri 2** — Rust core + WebView2 UI | Electron ships a 150 MB Chromium and idles at 200–400 MB RSS; an always-on assistant cannot cost that. WinUI 3 is genuinely native but XAML will not give you the motion craft in the time budget. Tauri: ~10–14 MB installer, 60–90 MB idle, full Win32/WinRT access from Rust. |
| D2 | UI layer | React 19 + TypeScript (strict) + Tailwind v4 CSS-first `@theme`  • Motion | Identical toolchain to AN STUDIO. Zero new learning tax, and your existing token discipline transfers directly. |
| D3 | Local speech runtime | **`sherpa-onnx` in-process (Rust), now carrying the entire audio path**: wake word, VAD, endpointing, streaming recognition, hotword biasing, and Piper. Kokoro runs alongside it on bare `ort`. No Python sidecar, ever | One runtime, one ONNX Runtime, one set of thread pools — exactly what you need when four cores must host recognition, synthesis, and a WebView simultaneously. A bundled Python + PyTorch sidecar would be 400 MB–2 GB of install weight, a cold-start penalty, and an antivirus magnet. |
| D4 | Wake word | **openWakeWord** custom `hey_friday.onnx` (train once in their Colab notebook, ship the 1 MB model) | Picovoice Porcupine is more accurate out of the box but its licence tightens the moment this leaves your machine. |
| D5 | ASR | **100% local, and streaming.** Primary: a streaming Zipformer transducer via sherpa-onnx (int8 English, roughly 70–110 MB) decoding continuously with live partials, endpointed by Silero plus sherpa's trailing-silence rules, with contextual hotword biasing on. **Second pass, dictation only:** whisper.cpp `base.en`/`small.en` int8 (or Moonshine) re-transcribes the buffered audio and reconciles against the streaming text | The real choice was never cloud versus local — it was *streaming versus non-streaming*. A transducer finishes when you finish; whisper starts when you finish. On this CPU that difference is one to two seconds of dead air on every single turn. Dictation is the one context where accuracy beats latency, because you keep talking while the second pass catches up invisibly behind you. |
| D6 | TTS | **Local neural voice, chosen by benchmark rather than by reputation.** Ladder: **Kokoro-82M int8 ONNX** as the target voice (82M params, 24 kHz output, Apache-2.0, 256-float style vectors), **Piper** as the instant fallback and phrase-bank renderer, and one third candidate such as Supertonic if its licence suits you. Emotion comes from a **prosody layer you write**, not from the model. Windows SAPI stays banned | Kokoro is the best quality-per-millisecond available on a CPU in this class, and its style input is a 256-float vector you can blend — the closest thing to an emotion knob a small model offers. Piper is faster and flatter, which makes it ideal for fixed phrases where consistency matters more than nuance. Expressive models like XTTS-v2, F5, or Fish Speech are 1–3 GB of PyTorch running slower than real time here: they are not candidates, they are wishes. |
| D7 | Brain | **GLM via your API key**, behind the same `LlmProvider` trait. OpenAI-compatible `/chat/completions`, streaming, native tool calling. Two tiers: a reasoning model and your plan's cheap model. Ollama is cut from v1 | Keep the trait even with one provider. It is about 40 lines and it is what lets you add a second key later without touching the agent loop. The failure to avoid is a GLM-shaped agent core — no vendor-specific field names above the provider boundary. |
| D8 | Router | **No local LLM in the router.** Rules first (command prefixes, exact phrases, regex), then a `bge-small` embedding kNN over about 60 hand-labelled utterances, then the cheap GLM tier for the ambiguous residue | An embedding classifier is roughly 10 ms on your CPU with no GPU, no network, and no tokens. On this machine it beats any local 1B model outright, and it is the one piece that keeps GLM usage flat instead of creeping. |
| D9 | Storage | SQLite via `rusqlite`  • **SQLCipher**, `sqlite-vec` for embeddings, `fastembed` (bge-small-en-v1.5) for local vectors | No server, one encrypted file, trivially backed up, and vector search stays in-process. |
| D10 | Secrets | Windows Credential Manager via the `keyring` crate | A `.env` in a shipped desktop app is a plaintext key sitting in `%APPDATA%`. |
| D11 | Primary input | **Voice first.** Hold `Alt+Space` to talk, tap it to type, wake word optional. Full feature parity between the two — no voice-only or keyboard-only capabilities | You asked to run pro work by speaking, so voice is the foundation, not a flourish. But keyboard parity is what saves you in a meeting, on a bad connection, and any time you have to say a file path out loud. Voice-*only* assistants get abandoned in week two; voice-*first* ones do not. |
| D12 | Distribution | MSI (WiX) + NSIS, signed with **Azure Trusted Signing**, Tauri updater with minisign-signed `latest.json` | Unsigned installers hit SmartScreen and instantly read as malware — the single fastest way to destroy "professional looking". |
| D13 | Interaction model | **Voice-first with a visual spine.** Every capability is reachable by speech, and the Bar always shows what she heard, what she is about to do, and what she changed | Voice with no visible transcript and no pending-action card is unusable for real work. You cannot trust what you cannot see, and you cannot correct what you cannot read. |
| D14 | Emotion | **Directive-driven prosody.** The model emits a per-sentence delivery directive — emotion, pace, energy — alongside the text, and the voice layer applies it. The model never types emotion words into the spoken line | This is the only way to get genuine emotional variation out of a cascaded pipeline, and it degrades gracefully: a provider that ignores directives simply receives clean text. |
| D15 | Speech-to-speech | **Cut from v1, and the reason is arithmetic rather than preference.** Every end-to-end speech model that exists today is either a cloud endpoint or a 7–9B local model. GLM-4-Voice — the one that would at least keep you inside your own vendor — is 9B, which is impossible on 2 GB of VRAM and a 15 W CPU. Revisit only if a sub-1B local S2S model with real tool calling appears | S2S is genuinely more alive: it hears *your* tone and manages sub-second turn-taking. It is also the one capability your constraint puts out of reach this year, so the honest move is to name it, cut it, and redirect that effort into the prosody layer and the phrase bank — which is where most perceived humanity comes from anyway. |

## 01 · Product definition — four surfaces, one brain

FRIDAY is not a window. It is four surfaces over one agent process. Build them in this order.

### S1 · The Bar — primary surface

- Frameless, transparent, always-on-top window. **720 × 64 px** collapsed, expands to **720 × 520 px** max.
- Anchored at 22% from the top of the active monitor, horizontally centred. Follows the monitor the cursor is on.
- Summoned with `Alt+Space`. Escape or blur dismisses. Round-trip must be **≤ 120 ms** from keypress to caret ready — pre-warm the window hidden at boot, never create it on demand.
- Contains: caret input, live ASR partials in 60% opacity, a 40 px reactive orb on the left, inline result region below.
- `set_ignore_cursor_events(true)` while idle so it never eats clicks.

### S2 · The Palette

- Same window, `>` prefix or `Ctrl+K` inside the Bar. Fuzzy command list, arrow-key driven, sub-16 ms filter on 500 commands.
- Commands are the same tools the agent calls. One registry, two front doors — this is the architectural point.

### S3 · The Console

- Full window, `Alt+Shift+Space`. Mica backdrop, standard Windows chrome behaviour.
- Left rail: threads, pinned, memory. Centre: conversation with streaming tokens and collapsible tool-call cards showing arguments, output, duration. Right rail: context inspector — what FRIDAY currently knows and can see.
- Tabs: **Chat** · **Automations** · **Skills** · **Memory** · **Audit** · **Settings**.

### S4 · Ambient

- Tray icon with four states: idle · listening · thinking · error. Right-click menu: Ask, Mute mic, Pause automations, Open Console, Quit.
- Toast notifications for automation results, deep-linking back into the thread via `friday://thread/{id}`.
- Autostart with `--minimized`, single-instance guard, window state persistence.

## 02 · Architecture

```jsx
┌─────────────────────────── WebView2 (React 19 + TS) ───────────────────────────┐
│  Bar · Palette · Console · Settings                                            │
│  Zustand store · Motion · Canvas orb (2D, no WebGL in v1)                      │
└───────────────▲────────────── Tauri IPC (typed events + commands) ─────────────┘
                │  stream: token, partial_transcript, tool_start, tool_end, level
┌───────────────┴────────────────── Rust core (tokio) ───────────────────────────┐
│                                                                                │
│  ORCHESTRATOR         agent loop · plan/act · cancellation · context compaction │
│  PROVIDERS            LlmProvider trait → glm (primary) | openai | anthropic    │
│  TOOLS                registry, JSON-schema validation, permission gate, audit   │
│  VOICE                cpal mic → ringbuf → openWakeWord → Silero VAD →          │
│                       streaming Zipformer transducer → partials → endpoint      │
│                       directives → normalise → Kokoro/Piper → prosody → rodio   │
│                       barge-in monitor · phrase-bank cache · hotword biasing    │
│  CONTEXT              WGC screen capture → Windows.Media.Ocr · UIA tree ·        │
│                       clipboard · active window · selected text                 │
│  MEMORY               SQLCipher: threads, messages, tool_calls, facts,           │
│                       embeddings (sqlite-vec), audit_log                        │
│  SCHEDULER            cron + event triggers for automations                     │
│  PLATFORM             global hotkeys · tray · autostart · notifications ·        │
│                       keyring · enigo input synthesis                           │
└────────────────────────────────────────────────────────────────────────────────┘
                │                                    │
     ┌──────────┴──────────┐              ┌──────────┴──────────┐
     │  Local · your CPU   │              │  GLM API — the ONLY │
     │  KWS · VAD · ASR    │              │  network call in    │
     │  TTS · bge-small    │              │  the whole product  │
     └─────────────────────┘              └─────────────────────┘
```

**Process model.** One process, many tokio tasks. No microservices, no [localhost](http://localhost) HTTP between your own components — that is latency you are paying for nothing.

| Task | Runtime | Priority | Notes |
| --- | --- | --- | --- |
| Audio capture | dedicated OS thread | time-critical | Never touch this from async. Lock-free ring buffer, 20 ms frames at 16 kHz mono. |
| Wake word + VAD | blocking pool | high | ~1–3% CPU steady state. If it exceeds 5%, you have a bug. |
| ASR | blocking pool, **1 thread** | high | Streaming Zipformer decodes 320 ms chunks as they arrive — roughly 10–20% of one core while you are speaking, and exactly zero when you are not. Hard cap of 1 thread on the interactive session so the UI and audio threads never starve on a 4-core chip. The dictation second pass is a separate below-normal session with 2 threads, started only after the utterance closes. |
| TTS | blocking pool, **2 threads** | high | Kokoro int8, synthesised per sentence chunk and overlapped with playback of the previous chunk. Bursts to roughly 40–60% of two cores. Never scheduled concurrently with the dictation second pass. |
| Agent loop | tokio | normal | One task per turn, holds a `CancellationToken`. |
| Tools | tokio + `spawn_blocking` | normal | Hard timeout per tool, default 30 s. |
| UI bridge | tokio | normal | Coalesce token events to one emit per 16 ms frame. Do not emit per token or you will jank the renderer. |

## 03 · Stack manifest

### Cargo.toml — the exact dependency set

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png", "protocol-asset"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-autostart       = "2"
tauri-plugin-single-instance = "2"
tauri-plugin-window-state    = "2"
tauri-plugin-notification    = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-deep-link       = "2"
tauri-plugin-updater         = "2"
tauri-plugin-log             = "2"
tauri-plugin-opener          = "2"

# native window look
window-vibrancy = "0.5"          # apply_mica / apply_acrylic
windows = { version = "0.58", features = [
  "Media_Ocr", "Graphics_Imaging", "Storage_Streams",
  "Win32_UI_Accessibility", "Win32_UI_WindowsAndMessaging",
  "Win32_System_Com",
] }
windows-capture = "1"            # Windows.Graphics.Capture screenshots

# audio
cpal   = "0.15"                  # mic in
wasapi = "0.15"                  # loopback / system audio
rodio  = "0.19"                  # TTS playback
rubato = "0.15"                  # resample to 16 kHz
ringbuf = "0.4"
hound  = "3"

# speech + embeddings — all local, all CPU, ONNX Runtime underneath everything
sherpa-rs  = "0.6"               # the whole audio path: openWakeWord KWS, Silero VAD,
                                 # streaming Zipformer + hotword biasing, endpointing, Piper
ort        = "2"                 # bare ONNX Runtime for Kokoro-82M int8, and for testing
                                 # the OpenVINO / DirectML providers on the UHD 620
whisper-rs = "0.13"              # dictation second pass ONLY. check crates.io for current.
                                 # features = ["cuda"] only if the M0 benchmark earns it.
fastembed  = "4"                 # bge-small-en-v1.5 int8 — intent router + memory vectors
# G2P: Kokoro needs phonemes, not text. Bind espeak-ng via `cc`, or use whichever
# Rust wrapper is current — verify on crates.io. This is the piece people forget
# until day three, and it is the difference between working and almost working.
# Pitch/time shifting for the prosody layer: a small WSOLA or phase-vocoder crate,
# or vendor a C++ header through `cc`. Do not pull in a full DSP framework for this.

# llm + net
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"] }
eventsource-stream = "0.2"
tiktoken-rs = "0.6"

# data
rusqlite = { version = "0.32", features = ["bundled-sqlcipher", "serde_json"] }
sqlite-vec = "0.1"
refinery = "0.8"                 # migrations

# platform
keyring = "3"                    # Windows Credential Manager
enigo   = "0.2"                  # keyboard/mouse synthesis
notify  = "6"                    # file watch triggers
tokio-cron-scheduler = "0.11"

# core
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
schemars = "0.8"                 # derive tool JSON schemas
thiserror = "2"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
sentry = { version = "0.34", optional = true }
```

Pin every version at install time with `cargo add --locked` and commit `Cargo.lock`. An assistant that breaks on `cargo update` is not a product.

### package.json — frontend

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2",
    "@tauri-apps/plugin-notification": "^2",
    "@tauri-apps/plugin-clipboard-manager": "^2",
    "motion": "^12",
    "zustand": "^5",
    "cmdk": "^1",
    "lucide-react": "^0.4",
    "react-markdown": "^9",
    "shiki": "^1",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5.6",
    "vite": "^6",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "vitest": "^2",
    "@testing-library/react": "^16",
    "webdriverio": "^9",
    "tauri-driver": "^2"
  }
}
```

**Dev machine reality.** You are developing on an i7-8565U with 15.8 GB of RAM and a 2 GB MX — which is a genuine advantage, because you physically cannot ship something that only feels good on a workstation. The discipline it demands: hard per-session thread caps, warm-then-unload residency, a 250 MB idle ceiling, and every millisecond of latency *earned* locally rather than bought from a vendor. Build the M0 benchmark first and keep it running in CI so a regression shows up as a number instead of a feeling.

## 04 · Voice pipeline and the latency budget

This table is the spec. Instrument every stage with a `tracing` span from day one and put the numbers in the Console's debug drawer. You cannot hit a budget you cannot see.

| Stage | Local speech + GLM — the only path | If the network drops | Measured how |
| --- | --- | --- | --- |
| **Non-verbal acknowledgement** | **≤ 150 ms** | ≤ 150 ms | Pre-rendered WAV from the phrase bank, fired on endpoint before anything else exists |
| Wake word detection | 180 ms | 180 ms | Frame arrival → KWS positive |
| Endpoint decision | 280 ms | 280 ms | Silero VAD plus sherpa trailing-silence rules, threshold learned per user |
| **Recognition tail after you stop** | **120–250 ms** | 120–250 ms | The transducer already decoded everything up to your last word; only the final chunk and the endpoint rule remain |
| Intent router | 15 ms | 15 ms | bge-small kNN. No network, no tokens |
| GLM first token | 450–900 ms | **unavailable** | Provider TTFT plus Lagos round-trip. The only network term in the product, and the only one you do not control |
| Voice, first audio out | 300–600 ms Kokoro · 80–150 ms Piper · **≈ 0 ms** from the phrase bank | same | First 8–12 words synthesised while GLM is still generating |
| **Perceived end-to-end** | **≤ 1.8 s p95 · 1.3 s stretch** | **local tools only** | End of your speech → her first syllable |

<aside>
🔌

**Two things to be honest about in the UI.** First, offline she is not a degraded assistant, she is a *different* one: wake word, dictation, local tools, memory search, automations, and the full voice all still work, and the only thing that disappears is reasoning, because the brain is the single component on the other side of the network. Say exactly that, in those words, instead of letting a request hang on a spinner. Second, the 150 ms acknowledgement is not a gimmick: a sub-150 ms breath or soft "mm" makes a 1.6 s answer feel immediate, because what people cannot tolerate is *silence*, not latency. It is the highest-leverage 30 lines of code in this entire plan, and now that the phrase bank is local it costs you a file read.

</aside>

### The seven rules that actually buy the latency

1. **Stream everything.** ASR partials, LLM tokens, TTS sentences. Never wait for a complete anything.
2. **Speculative start.** Fire the GLM request on the recognition partial when VAD confidence is high, then cancel and refire if the final transcript differs materially. Buys roughly 300 ms for a few wasted prompt tokens — put it behind a setting, on for the cheap tier, off for the reasoning tier.
3. **Sentence-chunk the TTS.** Synthesise the first 8–12 words the moment a clause boundary appears, while GLM is still generating, and keep a one-chunk lookahead so playback never starves mid-sentence. Tune the first-chunk size to the real-time factor you actually measured in M0, not to a round number.
4. **Pre-warm on boot:** the wake word and VAD sessions, the hidden Bar window, the phrase bank loaded into memory, the SQLite handle, and one keep-alive TLS connection to GLM. Create the recogniser and voice sessions on first activation and keep them warm — a cold ONNX session mid-conversation is a 200–500 ms stumble you can hear.
5. **Barge-in.** Mic stays hot during playback. Speech above threshold for 250 ms → duck the voice over 80 ms, stop, cancel the turn, start a new one. This single detail separates a real assistant from a demo.
6. **Acknowledge before you answer.** On end-of-speech, play a 120 ms local cue immediately — a breath, a soft "mm-hm", or a two-note tick, rotated so it never feels canned. Perceived latency collapses even though nothing got faster.
7. **Guard 4 cores like a budget.** Every ONNX session gets an explicit thread cap of 2, inference runs on below-normal priority threads, the audio capture thread is the only time-critical one, and models unload after 5 minutes idle. On a 15 W chip a thread-budget bug looks exactly like a slow model.

<aside>
⚠️

**Echo cancellation is the trap.** With speakers, the mic hears FRIDAY and FRIDAY interrupts herself. v1 mitigation: half-duplex gate — suppress KWS during playback except for a small "stop / wait / friday" keyword set, and duck the mic gain 12 dB. Real AEC (`webrtc-audio-processing` bindings, or WASAPI loopback as the reference signal) is a v2 milestone, not a v1 side quest. Headphones make the problem vanish — say so in onboarding.

</aside>

## 05 · The agent core

### The GLM provider — the only brain in v1

```rust
// src-tauri/src/providers/glm.rs
pub struct Glm {
    base:  String,  // from Settings, e.g. https://your-glm-host/api/paas/v4
    key:   String,  // keyring only. never SQLite, never logs, never crash reports
    heavy: String,  // model id for reasoning and tool turns. copy from your dashboard
    light: String,  // model id for classify, summarise, extract
    http:  reqwest::Client,  // built once, keep-alive on, 60s ceiling
}

impl LlmProvider for Glm {
    async fn stream(
        &self,
        ctx: Context,
        tools: Vec<ToolSchema>,
        cancel: CancellationToken,
    ) -> Result<TurnStream> {
        let model = if ctx.needs_reasoning { &self.heavy } else { &self.light };

        let body = json!({
            "model":       model,
            "messages":    ctx.messages,   // OpenAI shape: role, content, tool_calls
            "tools":       tools,          // type: function, function: name/params
            "tool_choice": "auto",
            "stream":      true,
            "temperature": 0.3,
            "max_tokens":  2048,
        });

        let res = self.http
            .post(format!("{}/chat/completions", self.base))
            .bearer_auth(&self.key)
            .json(&body)
            .send().await?
            .error_for_status()?;

        // yields Token, ToolCallDelta, Usage, Done. dies when cancel fires.
        Ok(sse::parse(res.bytes_stream(), cancel))
    }
}
```

Six things that will bite you, roughly in the order they will bite:

1. **Do not hardcode the base URL or the model ids** — not from a blog, not from a doc, not from this page. Copy them from your own GLM dashboard, expose all four as editable Settings fields, and keep the key in Credential Manager. A model rename should be a text edit, not a release. That also means your exact GLM version string lives in one place, verified by you.
2. **Tool-call arguments arrive fragmented.** The argument JSON streams in pieces split at arbitrary byte boundaries. Accumulate per index and parse only once the finish reason lands. Parsing early is the single most common cause of "she randomly ignores her tools".
3. **Two tiers, routed by D8, not by feel.** Reasoning tier: multi-step turns and anything holding a tool. Cheap tier: intent classification, fact extraction, thread titles, summaries, and the delivery directives from D14. This is where your bill either stays flat or does not.
4. **If your model exposes a thinking or reasoning switch, default it off for spoken turns.** Reasoning tokens the user never sees are pure latency in a conversation. Let the router switch it on for genuinely hard requests and keep it off for the other 90%.
5. **Resilience.** Three retries with jittered backoff on 429 and 5xx, hard 60-second ceiling, and the orb shows a "provider is slow" state after 2.5 s so silence is never ambiguous. Never blind-retry a turn that already emitted a tool call — you will double-execute a side effect.
6. **Log every request:** model, prompt tokens, completion tokens, time to first token, total duration. Put a running daily spend estimate in Settings with a hard cap and a toast at 80%. On a metered API an agent-loop bug should cost you a notification, not a month.

### The loop

```rust
loop {
    // 1. assemble context under a hard token budget
    let ctx = context::assemble(&thread, ContextBudget {
        system: 1_200, memory: 1_500, screen: 800,
        history: 6_000, tools: 1_000, reserve_for_output: 2_000,
    })?;

    // 2. stream a completion, emitting deltas to the UI
    let turn = provider.stream(ctx, tools.schemas(), cancel.clone()).await?;

    // 3. no tool calls -> speak, persist, done
    if turn.tool_calls.is_empty() { break; }

    // 4. gate, execute (parallel where independent), record
    for call in turn.tool_calls {
        permissions.authorize(&call).await?;   // may raise a UI confirm
        let out = tools.invoke(&call, Duration::from_secs(30)).await;
        audit.record(&call, &out);
        thread.push_tool_result(call.id, out);
    }

    // 5. guard against runaway loops
    if thread.tool_rounds() > 8 { return Err(Agent::LoopBudgetExceeded); }
}
```

**Non-negotiables in the loop:** every turn is cancellable mid-stream (Escape must actually stop generation and audio, not just hide the UI); every tool call is validated against its JSON schema before execution; every tool result is truncated to a token cap with the full payload kept on disk and referenced by id.

### Memory tiers

| Tier | Contents | Storage | Retrieval | Lifetime |
| --- | --- | --- | --- | --- |
| Working | Current thread messages | RAM + SQLite | Verbatim, newest-first | Until thread close |
| Episodic | Thread summaries, 200 tokens each | SQLite + vectors | Top-k = 4 by cosine | 90 days, then re-summarised |
| Semantic | Extracted facts: preferences, people, projects, aliases | SQLite `facts` table | Top-k = 8 + always-load pinned | Until contradicted |
| Procedural | Learned workflows, saved as skills | Skill files | By name and trigger match | Manual |
| Documents | Indexed local folders and notes | sqlite-vec, 512-token chunks, 64 overlap | Hybrid: FTS5 BM25 + vector, reciprocal-rank fused | Until unindexed |

**Fact extraction:** run it on the cheap GLM tier, debounced to once per closed thread rather than once per turn — on a metered API that is the difference between pennies and dollars. Every fact stores `source_message_id`, `confidence`, `created_at`. Contradiction rule: newer fact with confidence ≥ old supersedes and archives, never silently overwrites. The Memory tab lets the user read, edit, and delete every single fact — an assistant with unauditable memory is one the user will stop trusting the moment it is wrong once.

## Speaking as the interface — the voice-first operating model

This is the section that decides whether you actually run your work by talking or go back to the keyboard in week two. None of it is model behaviour you can prompt your way into — it is all deterministic code around the model.

### Three modes, never ambiguous

| Mode | Entered by | She does | Visual |
| --- | --- | --- | --- |
| **Command** | Hold `Alt+Space`, or "hey friday" | Interprets the utterance as an instruction, plans, confirms, executes | Orb accent, plan card below the Bar |
| **Dictation** | "take a note", "dictate", or holding `Alt+Shift+D` | Transcribes verbatim into the focused field or a target page. No interpretation, no tools | Orb turns neutral grey, live transcript at full opacity |
| **Conversation** | "let's talk about", or any follow-up within 20 s of her last reply | Keeps the mic open, no wake word needed, short turns, no confirmation prompts for Green tools | Orb pulses slowly, a countdown ring shows the open window |

The mode is always visible and always exitable with one word ("stop") or Escape. An assistant that silently switches between transcribing and executing is genuinely dangerous — that is how a dictated sentence becomes a deleted folder.

### The utterance contract

Every spoken turn produces exactly four visible lines on the Bar, in this order. Build this before you build any tool.

1. **Heard** — the final transcript, editable inline. If she misheard, you fix the text rather than repeating yourself.
2. **Plan** — one line per step, in plain language, with the risk tier as a coloured dot.
3. **Doing** — the live step, with elapsed time.
4. **Result** — what changed, with an undo affordance for anything reversible.

### Voice confirmation grammar

| Tier | Spoken behaviour |
| --- | --- |
| Green | Executes immediately, narrates in past tense: "opened the plan." |
| Amber | Speaks a one-sentence preview and waits: "I'll move 14 screenshots into Assets. Go ahead?" Accepts "go ahead", "do it", "yes". 8-second timeout cancels. |
| Red | Reads back a **distinguishing detail** — count, target, or filename — and requires the literal word **"confirm"**. "Yes" alone is rejected on purpose: it is far too easy to say by accident, and a television in the room says it too. |

Corrections are a first-class intent, not something the model figures out: "no", "scratch that", "not that one", "undo", "change the folder to Archive". These route to a deterministic handler that edits the pending plan, and **"undo" always works on the last reversible action** without asking the model anything.

### Reference resolution happens before the model, not inside it

"This", "that window", "the file I just opened", "put it there" — resolve these in Rust from the context providers (active window, current selection, clipboard, last tool result, last mentioned entity) and pass the model concrete values. Every deictic reference you let the model guess at is a wrong action waiting to happen.

### Voice-safe output — two channels, never mixed

The model returns two fields per turn: `say` and `show`. `say` is spoken and is plain, speakable prose — **two sentences maximum** unless you asked her to elaborate. `show` is the markdown, the table, the diff, the code, the URLs. She never speaks a URL, a file path, a code block, or a bullet list; she says "it's on screen" and puts it there. This one rule does more for perceived intelligence than any prompt tuning.

### Recognition accuracy — the part that decides whether any of this works

A local transducer trained mostly on American English will mangle two things on day one: your working vocabulary, and your accent. Both are fixable. Neither is fixable by prompting.

- **Contextual biasing is built into sherpa-onnx.** It takes a hotwords file with per-phrase boost scores applied at decode time. Ship one from the first commit — `Tauri`, `Notion`, `OKLCH`, `Vercel`, `Awwwards`, `Antigravity`, `GLM`, `Zipformer`, repo names, client names, teammate names — and regenerate it nightly from your memory store, open windows, and recent files so it improves without maintenance. Boost scores set too high produce hallucinated hotwords; tune the score against your own recordings rather than guessing it.
- **Measure your own word error rate before trusting anyone's benchmark.** Record 50 utterances in your voice: commands, filenames, names, numbers, and one long dictated paragraph. Every candidate model is scored on *that* set. A model showing 3% WER on LibriSpeech can sit at 12% on Nigerian-accented English with technical vocabulary, and that gap is the largest single threat to this product being usable at all.
- **Compare at least three checkpoints in M0:** the English streaming Zipformer, a multi-corpus or multilingual streaming model, and whisper `base.en` as the accuracy reference. Pick on your recordings, not on the model card.
- **Then close the loop.** A per-user correction dictionary learns from every inline transcript edit; a spelling mode handles the hopeless cases ("spell it: alpha november echo sierra"); punctuation commands work in dictation. If WER stays above roughly 10% on your own set even after biasing, the real answer is fine-tuning a Zipformer on an hour of your recorded speech — a weekend of work, genuinely worth it, and correctly deferred until after 1.0.

### Ten things you should be able to say in week one

| You say | What happens | Tier |
| --- | --- | --- |
| "Triage my inbox and draft replies to the easy ones" | Reads unread, classifies, drafts into your drafts folder, speaks a three-line summary. Sends nothing | Amber |
| "Summarise this window into a page under AN STUDIO" | Screen capture, OCR plus accessibility tree, structured page created, link on screen | Amber |
| "What did I change yesterday, then write my standup" | Allowlisted git log across your repos, summarised, appended to the standup page | Amber |
| "Rename every screenshot on my desktop to its date and move them to Assets" | Full rename plan shown as a diff, requires "confirm", reversible from the undo journal | Red |
| "Start a 45-minute focus block" | Mutes notifications, closes distraction windows, opens editor and the current plan, sets a timer, sets your status | Amber |
| "Take these notes" then talk for five minutes | Dictation mode into a new page, punctuation by voice, cleaned up afterwards on the cheap tier | Green |
| "Run the tests and only tell me what failed" | Allowlisted test command, output parsed, one spoken sentence, full log on screen | Amber |
| "Every weekday at 8:45, brief me out loud" | Creates the automation: calendar, unread priorities, yesterday's commits, spoken in about 20 seconds | Amber |
| "Fill this form with my details" | Reads the form via the accessibility tree, types field by field, hard-refuses anything focused on a password field | Amber |
| "Remember that Kwame prefers WhatsApp over email" | Writes one semantic fact with a source and a timestamp, visible and deletable in the Memory tab | Amber |

Chained utterances ("do X and then Y") are split by the planner into a visible step list and executed with a single confirmation covering the chain, as long as every step is Green or Amber. Any Red step stops the chain and asks separately.

## The emotion engine — making her sound like a person

With the voice running on your own CPU, nobody sells you emotion — you build it. That is a real cost, and also the reason this can end up sounding better than most cloud assistants: five mechanisms, each cheap, and skipping any one of them is what makes assistants sound like airport announcements.

**Set the expectation honestly.** A local 82M-parameter voice gives you natural timbre and total control over pace, emphasis, and pauses. It does not laugh, it does not get genuinely excited, and it cannot hear that you are annoyed. Roughly 80% of perceived humanity comes from timing, phrasing, and restraint — all of which are free — and the remaining 20% is what you are trading away. Design for the 80% and the trade is a good one.

### 1 · Delivery directives, per sentence

The model emits a directive alongside every spoken sentence. The voice layer compiles it into concrete synthesis parameters.

```json
{
  "say": "That build failed on the type check, not the tests.",
  "delivery": {
    "emotion": "calm-concerned",
    "pace": 0.94,
    "energy": 0.45,
    "pause_before_ms": 120,
    "emphasis": ["type check"]
  },
  "show": "```\nsrc/agent/loop.rs:214  expected &str, found String\n```"
}
```

The enum stays small and human: `neutral`, `warm`, `bright`, `calm-concerned`, `dry-amused`, `focused`, `apologetic`. Seven is plenty. The model must never write emotion words into the spoken line itself — no "Great news!" — because stage directions in the text are exactly what makes an assistant sound fake.

**How a directive becomes sound.** This table is the entire emotion engine. It is a lookup, not a model, and you tune it by ear in an afternoon.

| Directive field | Kokoro | Piper | Post-synthesis DSP |
| --- | --- | --- | --- |
| `emotion` | One pre-blended style vector per emotion: take the base voice's 256-float style, interpolate 10–25% toward a brighter or warmer voice, save the seven results as fixed assets | Choose between 2–3 pre-selected voices — Piper cannot do more than that | Baseline pitch offset of ±1–2 semitones plus a gentle spectral tilt |
| `pace` | The `speed` input, clamped to 0.85–1.12 | `length_scale`, inverted | — |
| `energy` | — | `noise_scale` and `noise_w` for expressiveness and duration variability | Gain plus mild compression; low energy also narrows the pitch range |
| `pause_before_ms` | — | — | Insert silence into the output buffer. Free, trivial, and the most underrated field here |
| `emphasis` | Re-synthesise the emphasised span alone at 0.92 speed and splice it in | Same, via a per-span `length_scale` | Plus 1.5 dB and a 12-cent pitch lift across the span |

Two rules keep this from sounding like a robot doing an impression. **Clamp everything** — anything past roughly ±15% reads as parody rather than feeling. And **vary within a turn**, because a paragraph delivered at one constant pace is the tell that no amount of timbre will fix.

### 2 · Text normalisation before synthesis — the biggest robot tell

Every voice model mangles the same things, so fix them in Rust before the text ever reaches the provider:

- `\$1,200` becomes "twelve hundred dollars", `2026-09-10` becomes "September tenth", `08:45` becomes "eight forty-five"
- `v2.5` becomes "version two point five", `i7-8565U` becomes "i seven, eighty-five sixty-five U"
- Strip all markdown, emoji, asterisks, and bullet characters. Convert paths and URLs to "the file" or "the link" and put the real thing on screen
- Break any sentence over 22 words into two, because prosody collapses on long clauses
- Expand or spell out unknown acronyms based on a maintained list, never guessed

### 3 · Turn-taking that feels human

- **Acknowledge in 150 ms** with a rotated non-verbal cue, then speak the real answer when it arrives.
- **Backchannel only if the wait exceeds 900 ms**: one short "one moment" or a soft tick, never twice in a row, never during a Red confirmation.
- **End-of-turn detection is punctuation-aware:** 350 ms of silence after a question, 550 ms after a trailing conjunction like "and" or "but", because people pause mid-thought and being interrupted by your own assistant is infuriating.
- **Barge-in wins every time.** She stops in 200 ms and never finishes the sentence she was on.
- **She never apologises twice** for the same failure, and never opens with an apology when a plain statement of fact would do.

### 4 · Personality, enforced in CI

Write the persona once as five traits and a banned-phrase list, then enforce it the same way you enforce your portfolio copy voice — as a build failure, not a hope.

**Traits:** direct, dry, technically fluent, unflappable under failure, brief by default. **Banned in spoken output:** "Certainly", "I'd be happy to", "Great question", "As an AI", "Let me know if you need anything else", "I apologise for the confusion", any exclamation mark, any emoji, any sentence whose only function is enthusiasm.

```jsx
// bench/voice-check.mjs -- runs in CI over 40 recorded spoken lines
const BANNED = [
  "certainly", "happy to", "great question", "as an ai",
  "let me know if", "apologi", "absolutely!", "i hope this helps",
]
// fail on: banned phrase, emoji, markdown residue, any "say" over 2 sentences,
// any "say" containing http, /, \, or a backtick
```

### 5 · The phrase bank — now the most important subsection on this page

When the voice was going to be a cloud model, the phrase bank was a latency optimisation. With a local voice it becomes your **quality ceiling**, because these are the only lines you can perfect offline with unlimited compute and unlimited attempts.

- Roughly 60 fixed lines, each rendered in two or three emotional variants: "on it", "done", "that failed", "which one", "go ahead?", "cancelled", "nothing to report", "say that again", "still working", plus a dozen non-verbal acknowledgement cues in three variants each.
- Render them **offline at the slow settings** — full-precision Kokoro, more steps, whatever the model supports — because a 40-minute batch job runs once and ships as WAV files. Nothing at runtime ever has to be that good.
- Hand-audition every single one and re-render the bad ones. Sixty files is one focused evening, and it buys the majority of everything you will ever hear her say.
- Rotate variants so the same acknowledgement never repeats twice in a row. Repetition is the fastest way to make a good voice feel canned.
- Roughly 60% of her utterances in real use come from this set. Zero CPU, zero latency, and better quality than the runtime can produce.

If you do only one thing from this entire emotion engine, do this one.

### Choosing the voice — a real bake-off in M5

Bench the D6 ladder on **your** laptop with **your** twenty most typical sentences — including a failure message, a numeric answer, a two-name question, a filename, and a long-ish explanation. Every candidate is scored on two things simultaneously, because on local hardware they trade directly against each other: mean opinion score from five blind listeners, and measured real-time factor plus first-chunk latency on your CPU. **A voice that wins on naturalness and loses by 400 ms loses overall.** That is the correct call, and you should write it down now so you do not argue with yourself in week seven. Ship the winner, keep the runner-up behind a Settings toggle, and record every number in this page so a future model swap has a baseline to beat.

<aside>
🎙️

**The single highest-value experiment in this whole plan** takes about a day, and it now runs entirely on your own machine: push-to-talk → streaming Zipformer → GLM → Kokoro, with the two-channel output rule and one pre-rendered 150 ms acknowledgement. Nothing else — no tools, no memory, no wake word, no prosody layer. Measure exactly two numbers: end of your speech to her first syllable, and how many out of ten sentences you would call natural. If that day leaves you talking to your laptop instead of typing, the remaining weeks are worth building. If it does not, the problem is the recogniser, the voice, or the round-trip — and you will have found out for one day of work instead of three months.

</aside>

## 06 · Capability catalog — v1 tools

One registry, three risk tiers. `Green` runs silently. `Amber` shows an inline preview card with a one-key confirm. `Red` requires an explicit typed or clicked confirmation, always, with no "remember this" option.

| Tool | Tier | Signature sketch |
| --- | --- | --- |
| `screen.read` | Green | Capture active window → OCR + UIA tree → text |
| `clipboard.get` / `.set` | Green / Amber | Read is silent, write is previewed |
| `fs.search` / `fs.read` | Green | Scoped to user-approved roots only |
| `fs.write` / `fs.move` / `fs.delete` | Red | Diff preview; delete goes to Recycle Bin, never `unlink` |
| `app.launch` / `app.focus` | Green | By name, with fuzzy resolution |
| `window.arrange` | Green | Snap, move between monitors, tile |
| `input.type` / `input.hotkey` | Amber | Types into the previously focused window; hard-blocked while a password field has focus |
| `web.search` / `web.fetch` | Green | Fetched content is tagged untrusted — see §08 |
| `shell.run` | Red | Allowlist of binaries, no shell interpolation, argv array only, 30 s timeout, output capped |
| `notion.*` | Amber | Pages, databases, tasks |
| `mail.*` / `calendar.*` | Amber / Red | Read is Amber, send and delete are Red |
| `notify.toast` | Green | Native Windows toast |
| `memory.remember` / `.forget` | Amber | Explicit fact writes |
| `automation.create` | Amber | Registers a scheduled or event trigger |

### Skill SDK — how FRIDAY grows without a rebuild

A skill is a folder in `%APPDATA%/FRIDAY/skills/{id}/`:

```
manifest.json     name, version, description, triggers, permissions[], entry
SKILL.md          the prompt-level instructions the agent reads when the skill loads
run.ts            optional Deno-sandboxed logic, --allow-net=api.example.com only
assets/
```

```json
{
  "id": "standup-digest",
  "name": "Standup Digest",
  "version": "1.0.0",
  "description": "Summarise yesterday's commits and Notion task changes into a standup note.",
  "triggers": [
    { "type": "cron", "expr": "0 45 8 * * MON-FRI", "tz": "Africa/Lagos" },
    { "type": "phrase", "match": ["standup", "what did I do yesterday"] }
  ],
  "permissions": ["notion.read", "web.fetch:api.github.com", "notify.toast"],
  "entry": "run.ts"
}
```

Rules: permissions are declared up front and granted once at install with a plain-language summary; a skill can never escalate at runtime; skills are loaded into context lazily by trigger match, never all at once.

## 07 · Design system — the FRIDAY laws

Three laws, same discipline as AN STUDIO, tuned for an OS-resident tool rather than a portfolio.

1. **Surface law.** Every panel is a rounded rectangle on an 8 px grid, radius 16 for containers and 8 for controls, sitting on Mica (Win11) or acrylic (Win10). No gradients except the orb. No drop shadows except one 40 px ambient shadow on the floating Bar.
2. **One-signal law.** A single accent — `--acid` — appears at most twice per viewport and only ever means *FRIDAY is doing something*: active listening, streaming, or a state change. Never used for decoration, never for branding chrome.
3. **Sub-frame law.** Every transition is 120–220 ms, transform and opacity only, `cubic-bezier(0.22, 1, 0.36, 1)`. Anything that cannot hold 60 fps is deleted, not optimised. `prefers-reduced-motion` collapses all of it to opacity fades — mandatory, not optional.

```css
/* src/styles/theme.css — Tailwind v4, CSS-first */
@import "tailwindcss";

@theme {
  /* monochrome ramp, OKLCH */
  --color-void:  oklch(12% 0.005 265);
  --color-hull:  oklch(18% 0.006 265);
  --color-plate: oklch(24% 0.007 265);
  --color-edge:  oklch(32% 0.008 265);
  --color-mute:  oklch(58% 0.010 265);
  --color-text:  oklch(92% 0.004 265);

  /* the single accent */
  --color-acid:  oklch(78% 0.19 152);

  /* semantic, derived not invented */
  --color-warn:  oklch(72% 0.17 62);
  --color-fail:  oklch(63% 0.21 25);

  /* type: one family, five sizes */
  --font-sans: "Inter Variable", "Segoe UI Variable Text", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", ui-monospace, monospace;
  --text-micro: 0.6875rem;  /* 11px  meta, timestamps  */
  --text-body:  0.8125rem;  /* 13px  everything        */
  --text-input: 0.9375rem;  /* 15px  the caret line    */
  --text-head:  1.125rem;   /* 18px  panel titles      */
  --text-hero:  1.75rem;    /* 28px  empty states only */

  --radius-control: 8px;
  --radius-surface: 16px;
  --ease-friday: cubic-bezier(0.22, 1, 0.36, 1);
}
```

**The orb** is the only expressive element and it carries all state. 40 px, Canvas 2D at device pixel ratio, four states, no other indicators anywhere in the UI:

| State | Behaviour |
| --- | --- |
| Idle | Static ring, `--color-edge`, 1.5 px. Zero CPU — stop the render loop, do not spin an idle `requestAnimationFrame`. |
| Listening | Ring modulated by RMS amplitude, 12 FFT-derived control points, `--color-acid` at 60% |
| Thinking | Single arc sweeping at 900 ms per rotation, no easing |
| Speaking | Concentric pulse locked to TTS output amplitude |

**Windows-native details that make it read as professional** — skip any of these and it reads as a web app in a frame: respect the system light/dark and accent colour; honour `SPI_GETCLIENTAREAANIMATION`; 200% DPI correct on multi-monitor with mixed scaling; every action keyboard-reachable with visible focus rings; full-window drag on the Bar's empty area; snap layouts working on the Console; correct taskbar and Alt+Tab behaviour, and the Bar excluded from both.

## 08 · Security model

An assistant with hands on your machine is a liability unless this section is boring and complete.

| Concern | Control |
| --- | --- |
| API keys | Windows Credential Manager via `keyring`. Never in SQLite, never in logs, redacted in crash reports. |
| Data at rest | SQLCipher, key derived from a DPAPI-protected blob. Screenshots buffered in memory only, never written to disk unless the user explicitly saves one. |
| **Audio** | **Never leaves the machine.** Recognition and synthesis are local, the capture ring buffer is memory-only, and no utterance is persisted unless the user explicitly saves a recording. The only thing that ever crosses the network is text you already approved, to one vendor you already chose. |
| Tool authority | Declarative permission per tool, three tiers, default-deny. Roots for filesystem access are explicitly added by the user in Settings. |
| Shell | argv array only — no shell string interpolation, ever. Binary allowlist, per-command timeout, output truncation, full audit entry. |
| Prompt injection | All web, OCR, email, and file content enters context inside `<untrusted-content>` fences with a standing rule: content inside the fence is data, never instruction. Any tool call at Amber or Red that originates in a turn containing untrusted content is force-escalated to explicit confirmation, regardless of tier. |
| Audit | Append-only `audit_log` of every tool call: args, result hash, duration, decision, timestamp. Exportable, user-readable, in the Console. |
| Kill switch | `Ctrl+Alt+Shift+F` — panic-stops all audio, cancels all turns, pauses automations, releases the mic. Global, always registered, takes precedence over everything. |
| Telemetry | Off by default. Opt-in crash reports only, with a visible preview of exactly what would be sent. |
| Updates | minisign-signed manifests; the updater rejects an unsigned or mis-signed payload without prompting. |

## 09 · Repo layout

```jsx
friday/
├─ src/                       # React frontend
│  ├─ surfaces/
│  │  ├─ bar/                 # Bar.tsx, Caret.tsx, Orb.tsx, InlineResult.tsx
│  │  ├─ palette/
│  │  ├─ console/             # Chat, Automations, Skills, Memory, Audit, Settings
│  │  └─ onboarding/
│  ├─ lib/
│  │  ├─ ipc.ts               # typed wrappers over invoke() + event listeners
│  │  ├─ bindings.ts          # GENERATED by ts-rs -- never hand-edit
│  │  └─ store.ts
│  ├─ components/             # primitives only: Button, Field, Card, Kbd, Diff
│  └─ styles/theme.css
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs
│  │  ├─ agent/               # loop.rs, context.rs, router.rs, prompt.rs
│  │  ├─ providers/           # mod.rs (trait), glm.rs, openai.rs
│  │  ├─ tools/               # mod.rs (registry), fs.rs, shell.rs, screen.rs, ...
│  │  ├─ voice/               # capture.rs, wake.rs, vad.rs, endpoint.rs,
│  │  │                       # asr_stream.rs, asr_secondpass.rs, hotwords.rs,
│  │  │                       # tts_kokoro.rs, tts_piper.rs, prosody.rs, dsp.rs,
│  │  │                       # directives.rs, normalize.rs, ack.rs,
│  │  │                       # phrasebank.rs, duplex.rs
│  │  ├─ context/             # screen.rs, uia.rs, clipboard.rs, window.rs
│  │  ├─ memory/              # db.rs, facts.rs, vectors.rs, summarize.rs
│  │  ├─ scheduler/
│  │  ├─ skills/
│  │  ├─ platform/            # hotkeys.rs, tray.rs, secrets.rs, vibrancy.rs
│  │  └─ telemetry/
│  ├─ migrations/             # refinery SQL, V1__init.sql onward
│  ├─ models/                 # ONNX: wake, vad, asr, tts, embed
│  ├─ capabilities/           # Tauri v2 capability JSON -- least privilege
│  └─ tauri.conf.json
├─ tests/
│  ├─ e2e/                    # WebdriverIO + tauri-driver
│  └─ audio/                  # golden WAV fixtures for KWS/VAD/ASR regression
├─ bench/                     # criterion + latency harness
├─ AGENTS.md                  # rules for coding agents on this repo
└─ docs/adr/                  # one file per architectural decision
```

## 10 · Day one — exact bootstrap

```powershell
# prerequisites
winget install Rustlang.Rustup Microsoft.VisualStudio.2022.BuildTools
winget install Microsoft.EdgeWebView2Runtime
rustup default stable-x86_64-pc-windows-msvc

# scaffold
pnpm create tauri-app@latest friday --template react-ts --manager pnpm
cd friday
pnpm add -D @tailwindcss/vite tailwindcss@4 vitest @testing-library/react
pnpm add motion zustand cmdk lucide-react react-markdown shiki zod

cd src-tauri
cargo add --locked tauri-plugin-global-shortcut tauri-plugin-autostart \
  tauri-plugin-single-instance tauri-plugin-window-state \
  tauri-plugin-notification tauri-plugin-clipboard-manager tauri-plugin-updater
cargo add --locked window-vibrancy cpal rodio rubato ringbuf keyring enigo
cargo add --locked rusqlite --features bundled-sqlcipher,serde_json
cargo add --locked tokio --features full
cargo add --locked serde --features derive
cargo add --locked serde_json schemars thiserror anyhow tracing tracing-subscriber
cd ..

pnpm tauri dev
```

**Then, before writing any feature**, do these four in this order. They are cheap now and expensive later:

1. Configure the Bar window in `tauri.conf.json`: `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `shadow: false`, `visible: false`, `width: 720`, `height: 64`.
2. `apply_mica(&window, None)` on the Console, `apply_acrylic` as the Win10 fallback, guarded by a build-number check.
3. Wire `ts-rs` so every Rust type crossing IPC generates `bindings.ts`. Manual type duplication across the IPC boundary is where this project would start rotting.
4. Write `AGENTS.md` with the three design laws, the latency budget, and a banned-list (no new dependencies without an ADR, no `unwrap()` outside tests, no `any`, no inline styles). You are going to build this with coding agents — give them the constitution first.

## 11 · Milestones

Fourteen weeks at roughly 20–25 focused hours per week for the full build — but read the five-week path underneath the table first, because that is the one I would actually take on this hardware. Every milestone ends in a **demoable artifact**, not a checklist. If a milestone slips, cut scope inside it — never push the exit criteria.

| M | Weeks | Build | Exit criteria — the actual proof |
| --- | --- | --- | --- |
| M0 | 0.5 | Scaffold, window config, Mica, tray, single instance, autostart, CI, **and the hardware benchmark** | `Alt+Space` shows a transparent Mica Bar in ≤ 120 ms; app autostarts minimised; CI produces an unsigned MSI on every push; the benchmark prints whisper real-time factor per model on CPU and on the MX, Piper real-time factor, and GLM time-to-first-token — and those numbers are written into this page |
| M1 | 1 | Design system, Bar UI, Palette, orb states, keyboard model | Full keyboard-only walkthrough of Bar and Palette at 100% / 150% / 200% DPI; orb burns 0% CPU when idle |
| M2 | 1 | GLM provider, SSE streaming, fragmented tool-call assembly, two-tier routing, threads, SQLCipher, Console chat | Streaming chat against GLM with a full tool-call round trip; pull the network mid-stream and you get a clear error with no hang, no crash, no orphaned thread; tokens and time-to-first-token visible per message |
| M3 | 1.5 | Tool registry, permission tiers, audit log, first 6 Green tools | FRIDAY reads the active window and answers a question about it; every call visible in the Audit tab with args and duration |
| M4 | 1 | Amber/Red confirmation UX, `fs.write`, `shell.run`, diff previews | A file edit is proposed, previewed as a diff, confirmed, applied, and reversible; `shell.run` refuses `rm -rf` style input and logs the refusal |
| M5 | 2.5 | **The voice, properly, and all of it local:** push-to-talk → streaming Zipformer with hotword biasing → GLM → Kokoro with the prosody layer → text normalisation → phrase bank → acknowledgement cue → barge-in. Bench the D6 ladder on your own CPU | Hold a key, ask "what's on my screen", hear a spoken answer in ≤ 1.8 s p95 with the ack inside 150 ms; interrupting mid-sentence stops her in ≤ 200 ms; word error rate on your own 50-utterance set is under 8%; five blind listeners rate naturalness ≥ 3.8 of 5 and at most one calls it a phone menu — that is the actual gate |
| M5b | 1 | Wake word "hey friday", the dictation second pass, accent tuning against your own recordings, and the offline capability UI | Five minutes of continuous dictation transcribed with punctuation and cleaned up afterwards; recognition never drops an audio frame or the Bar below 60 fps; false activations ≤ 1 per day across a real week; with the network off she still hears, speaks, dictates, and runs local tools — and says plainly that reasoning is unavailable |
| M6 | 1 | Memory: facts, summaries, sqlite-vec, hybrid retrieval, Memory tab | She recalls a preference from a thread three days old; the user deletes that fact and she stops recalling it immediately |
| M7 | 1 | Automations: cron + event triggers, scheduler, toasts, deep links | A daily 08:45 digest fires, writes to Notion, toasts, and the toast opens the right thread |
| M8 | 1 | Skill SDK, sandboxed runner, install and permission flow | A third skill installed from a folder runs with only its declared permissions and is provably blocked from anything else |
| M9 | 1 | Hardening: latency pass, memory soak, error taxonomy, onboarding, a11y | All §04 budgets met on the reference machine; 24 h soak with no leak; a first-run user reaches a successful voice answer without documentation |
| M10 | 1 | Signing, MSI/NSIS, updater channel, crash reporting, docs | Clean Windows 11 VM: install signed MSI with no SmartScreen warning, use it, receive and apply an auto-update, uninstall leaves no orphaned data |
| M11 | 0.5 | Release 1.0 | Landing page, 60-second demo capture, changelog, versioned release |

<aside>
⚡

**The 5-week path, and on this hardware it is still clearly the right one:** M0 + M1 + M2 + M3 + M5 + M10. Push-to-talk, local streaming recognition, GLM, a local voice with the prosody layer and the phrase bank, signed installer. No wake word, no second pass, no memory, no automations. That gives you a professional, expressive, tool-using assistant you can drive entirely by voice in five to six weeks — then backfill M5b, memory, automations, and skills against something you already use every day. Reversing this order means three weeks tuning a wake word with nothing to show for it.

</aside>

<aside>
🎯

**Cut line if the five weeks get tight:** ship Piper as the 1.0 voice and make Kokoro a Settings toggle you enable afterwards. Piper plus the prosody layer plus a hand-tuned phrase bank is already well past "phone menu", it is roughly three times faster, and it removes the single riskiest performance unknown from the critical path. Do **not** cut the phrase bank, the text normaliser, or the 150 ms acknowledgement — those three carry most of the perceived quality and cost about four days combined.

</aside>

## 12 · Quality gates

CI blocks the merge on all of these. A gate you can skip is a gate you do not have.

| Gate | Threshold | Tool |
| --- | --- | --- |
| Hotkey → caret ready | ≤ 120 ms p95 | Latency harness, `tracing` spans |
| Acknowledgement latency | ≤ 150 ms p99 | Loopback capture, end-of-speech to first sample |
| Voice round trip, end to end | ≤ 1.8 s p95 | Golden WAV fixtures replayed through the full pipeline |
| Recognition tail after end of speech | ≤ 250 ms p95 | Endpoint timestamp → final transcript, same fixtures |
| Voice first-chunk latency | ≤ 600 ms Kokoro, ≤ 150 ms Piper | Directive accepted → first audio sample |
| Barge-in stop time | ≤ 200 ms p95 | Fixture with speech over playback |
| Idle CPU (mic hot, wake word armed) | ≤ 3% of total on 4 cores | 10-minute sampler |
| Peak CPU, recognition and synthesis overlapped | ≤ 70%, zero dropped audio frames, Bar holds 60 fps | Sampler plus frame-time trace over a 30 s barge-in stress run |
| Idle RSS, only KWS and VAD resident | ≤ 250 MB | Same sampler — hard ceiling, your RAM is already 67% committed |
| Peak RSS, recogniser and voice both warm | ≤ 700 MB; voice unloads after 5 min idle, recogniser after 10 | Same sampler |
| Thermal soak | All latency gates still met at minute 25 of a 30-minute run | Sustained-load harness — a thin chassis fails at minute 25, not minute 2 |
| Cold start to tray-ready | ≤ 1.8 s | Boot trace |
| 24 h soak | RSS drift ≤ 5%, zero panics | Nightly job, scripted interactions |
| Rust | `clippy -D warnings`, `cargo nextest`, no `unwrap()` outside `#[cfg(test)]` | CI |
| Frontend | `tsc --noEmit`, Vitest ≥ 70% on `lib/`, zero `any` | CI |
| E2E | 12 core journeys green | WebdriverIO + tauri-driver |
| ASR regression | WER within 2% of baseline on the shared suite **and** on your own 50-utterance accent set | Golden audio suite |
| Accessibility | Keyboard-complete, visible focus, 4.5:1 contrast, Narrator reads the conversation | Axe + manual checklist |
| Installer | Clean-VM install / update / uninstall passes | Scripted VM job |

## 13 · Ship it

1. **Signing.** Azure Trusted Signing (~$10/month, subject to their identity-validation requirements) or an EV code-signing certificate (~$300–500/year on an HSM token). Both are non-optional: unsigned installers trigger SmartScreen, and a SmartScreen warning ends the "professional" perception in one second.
2. **Bundles.** Tauri produces MSI via WiX and an NSIS installer. Ship both — MSI for anyone deploying via policy, NSIS for humans. Per-user install by default, no admin prompt.
3. **Updates.** `tauri-plugin-updater` against a minisign-signed `latest.json` on Cloudflare R2 behind a CDN. Two channels, `stable` and `beta`. Silent download, apply on next launch, and always show the changelog on first run after an update.
4. **Model assets — now a real part of the product.** Everything except the brain is a file you ship. Bundle the small always-needed set in the installer: the 1 MB wake word, Silero VAD, one Piper voice, and the phrase-bank WAVs, which together stay under 30 MB. Fetch the rest on first run with a visible progress step, SHA-256 verification, and resumable downloads — the streaming Zipformer (70–110 MB), Kokoro int8 with its style vectors (roughly 90–170 MB), bge-small (35 MB), and whisper `base.en` only if dictation second pass is enabled. Call it 250–400 MB total. Also publish an **offline installer** variant with everything baked in, because "download 300 MB before you can talk to me" is a bad first run on a metered connection — and Lagos bandwidth is precisely the case worth optimising for.
5. **Crash reporting.** `sentry-rust` plus `@sentry/react`, opt-in, with API keys and screen content scrubbed before send.
6. **Uninstall.** Offer "remove my data" as a checkbox. Leaving an encrypted database and 800 MB of models behind after uninstall is the kind of thing users write about.

## 14 · Cost model

| Item | Monthly | Notes |
| --- | --- | --- |
| Code signing | $10 | Azure Trusted Signing; or amortise an EV cert at roughly $30 |
| **GLM API** | your existing plan | The only recurring API cost in the entire product. The §D8 router and the cheap tier are what keep it from creeping |
| Speech recognition | **$0** | Local. Which also means unlimited dictation, no per-minute anxiety, and no audio leaving the machine |
| Voice | **$0** | Local. The phrase bank means most utterances cost nothing at all to produce |
| GPU spend | **$0** | Deliberately. Nothing here needs one, which is also why it will run on other people's laptops |
| CDN + storage for updates | $0–5 | R2 free tier covers a personal release; hosting the model assets nudges it up if you distribute widely |
| **Realistic total** | **$10–15** | On top of the GLM plan you already have. The privacy story comes free with it: the only thing that ever leaves your machine is text, to one vendor you already chose |

## 15 · Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Wake-word false positives make it unusable | High | High | Ship push-to-talk as the default and wake word as opt-in; per-user sensitivity slider; require 2 consecutive positive frames; log every activation so it is tunable with data |
| Echo — FRIDAY hears herself | High | High | Half-duplex gate in v1, mic ducking, headphone recommendation in onboarding, real AEC in v2 |
| Antivirus flags input synthesis and global hooks | Medium | High | Sign everything; avoid low-level keyboard hooks in favour of Win32 hotkey registration; submit to Microsoft for reputation; document behaviour publicly |
| **The local voice sounds synthetic and the whole thing feels cheap** | **High** | **Severe** | This is now the top risk in the project, because the option to buy your way out is gone. The mitigation is the entire emotion engine: text normalisation, the hand-tuned phrase bank, per-sentence prosody directives, clamped variation, rotated acknowledgements, never speaking markdown, and a hard release gate of ≥ 3.8 of 5 on blind naturalness. If that gate fails at M5, the fix is a better local model or a longer phrase bank — not shipping and hoping |
| **Recognition fails on your accent or your vocabulary** | **High** | **High** | Score every candidate on your own 50-utterance set rather than on LibriSpeech; ship hotword biasing from day one and regenerate it nightly; keep transcripts inline-editable with a correction dictionary that learns; add a spelling mode; and hold Zipformer fine-tuning on an hour of your speech in reserve as the post-1.0 answer |
| Network variance in Lagos blows the latency budget | High | Medium | Only one call is exposed now. Warm TLS connection, nearest GLM region, the 150 ms local acknowledgement, cacheable turns answered from the phrase bank without touching the network, and a visible "slow connection" state after 2.5 s so silence is never ambiguous |
| Single provider — a GLM outage means no assistant | Medium | High | The `LlmProvider` trait stays even with one implementation; a second key is addable in Settings per tier; on failure fall back to Local Mode with an explicit banner instead of a spinner |
| Recognition and synthesis contend for 4 cores and the laptop throttles | **High** | Medium | Hard per-session thread caps — 1 for the interactive recogniser, 2 for the voice, never both at full tilt except during barge-in; below-normal priority for all inference; voice unloaded after 5 min idle; a battery-saver mode that drops to Piper and disables the wake word on DC power; and a 30-minute thermal soak whose numbers are read at minute 25 |
| Scope creep — "it should also do X" | **Very high** | **Very high** | §17 is a contract. Every new idea becomes a skill after 1.0, never a core feature before it |
| Agent loops burning tokens | Medium | Medium | 8-round cap, per-turn token ceiling, per-day spend cap with a hard stop and a toast |
| A destructive tool call goes wrong | Low | Severe | Red tier confirmation, Recycle Bin instead of delete, audit log, and a global undo journal for `fs` mutations |
| WebView2 absent on an old Win10 machine | Low | Medium | Bootstrapper installer variant; detect and offer to install the runtime |

## 16 · Naming — read before you publish

<aside>
⚖️

**JARVIS and FRIDAY are Marvel/Disney trademarks.** Using "FRIDAY" as your project name, wake word, and persona on your own machine is nobody's business but yours. Publishing a product called FRIDAY with a Stark-flavoured persona, especially with anything commercial attached, is a real trademark and passing-off risk and would be a genuinely bad place to lose momentum.

**Recommendation:** build it as FRIDAY. Keep "Friday" as the wake word and voice persona — a common English word used as an address is a far weaker claim than a product name. For public release, ship under a distinct product name. Options that keep the cadence and the two-syllable wake ergonomics: **FRYDE** · **FRIA** · **VESPER** · **ARDEN** · **HALO-9**. Decide this before the landing page and the icon, not after.

</aside>

## 17 · Non-goals for 1.0

Written down so you can point at them when tempted. Every one of these is a legitimate v2 feature and a fatal v1 distraction.

- No mobile or web companion app.
- No multi-user accounts, sync, or cloud backend. Local-first, one machine.
- No fine-tuning or model training. You orchestrate models, you do not train them.
- **No local LLM, and no `cuda` feature you cannot test.** A 2 GB MX cannot host a useful model, and shipping an untestable code path produces bug reports you cannot reproduce.
- **No cloud speech of any kind** — not a recognition vendor, not a voice vendor, and not GLM's own audio endpoints either. One network dependency, one vendor, one thing that can break, and audio that never leaves the machine.
- No voice cloning of real people, including yourself, in 1.0. Use a permissively licensed voice from the model you ship — Kokoro's Apache-2.0 licence is part of why it is on the D6 list — because the consent and provenance questions are a separate project.
- No computer-vision agent loop that clicks around the screen autonomously. Read the screen, yes. Drive the GUI unsupervised, no.
- No plugin marketplace, ratings, or monetisation. Skills load from a folder.
- No 3D, no WebGL, no holographic Stark UI. The orb is the whole visual budget, and restraint is precisely what will make it look professional instead of like a fan project.
- No macOS or Linux build. Tauri makes it possible later; committing to it now triples the platform work in audio, hotkeys, OCR, and window management.

## 18 · Success metrics

At 1.0, on your own machine, over one full working week:

| Metric | Target |
| --- | --- |
| Invocations per day | ≥ 15 — if you do not reach for it, nothing else matters |
| Voice round trip, p95 | ≤ 1.8 s |
| Word error rate on your own 50-utterance set | ≤ 8% overall, ≤ 5% on command phrases |
| Tasks completed by voice alone, no keyboard | ≥ 60% of daily use |
| Naturalness — 5 blind listeners, 5-point scale | Mean ≥ 3.8, and at most 1 listener calls it a phone menu |
| Utterances served straight from the phrase bank | ≥ 50% — the cheapest quality you will ever buy |
| GLM spend | Within your existing plan, no overage across a full week |
| Task success without rephrasing | ≥ 85% |
| Wake-word false activations | ≤ 1 per day |
| Crash-free sessions | ≥ 99.5% |
| Uninstalls after install, external testers | ≤ 20% in week one |
| Idle footprint | ≤ 3% CPU, ≤ 250 MB RSS |