/** The simulation engine — stands in for the Rust agent core.
 *
 * §11's milestone order puts the voice loop and the tool runtime after the
 * shell, so there is nothing real to talk to yet. Rather than build the UI
 * against static props and discover the timing problems later, this drives the
 * store on the actual §04 clock: 180 ms to a wake, partials arriving every
 * ~90 ms, an acknowledgement inside 150 ms of the endpoint, first token around
 * 640 ms, tool calls that take as long as tool calls take.
 *
 * Everything here is `await sleep(n)`. When `bindings.ts` lands, the surfaces
 * do not change — this file is deleted and the Rust events call the same store
 * actions.
 */

import { useFriday, speakWithNativeVoice, stopNativeVoice } from "./store"
import type { Confirmation, PlanStep, ToolCall, TurnOutput } from "./types"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const jitter = (base: number, spread = 0.25) =>
  Math.round(base * (1 - spread / 2 + Math.random() * spread))

let token = 0
/** Bumped by `cancel()`. Every await point checks it, so the kill switch and
 *  Escape actually stop a turn mid-flight instead of letting it finish. */
const live = () => token
const alive = (t: number) => t === token

export function cancel() {
  token += 1
  stopNativeVoice()
}

/* ── scenarios ───────────────────────────────────────────────────────────── */

interface Scenario {
  /** What the recogniser will "hear", streamed as partials. */
  heard: string
  plan: Omit<PlanStep, "status">[]
  tools: (Omit<ToolCall, "status" | "started_at"> & { runtime: number })[]
  confirm?: Confirmation
  result: TurnOutput
  /** Markdown appended to the Console thread. */
  show?: string
}

export const SCENARIOS = {
  /* Green — runs silently, narrated in the past tense. */
  weather: {
    heard: "what's the weather doing this afternoon",
    plan: [{ id: "p1", label: "Check forecast for London", tier: "green" }],
    tools: [
      {
        id: "s-w1",
        name: "web.fetch",
        tier: "green",
        args: { url: "https://api.open-meteo.com/v1/forecast", city: "London" },
        output: "14°C, overcast, rain from 16:00, 8mm expected",
        duration_ms: 310,
        runtime: 310,
      },
    ],
    result: {
      say: "Rain from four, about eight millimetres. Take the heavier coat.",
      delivery: {
        emotion: "neutral",
        pace: 1.0,
        energy: 0.55,
        pause_before_ms: 0,
        emphasis: ["four"],
      },
      show: "**London · this afternoon**\n\n| Time | Temp | Condition |\n| --- | ---: | --- |\n| 14:00 | 14°C | Overcast |\n| 16:00 | 13°C | Rain, 4mm |\n| 18:00 | 12°C | Rain, 4mm |",
    },
  },

  /* Amber — one-sentence preview, 8s timeout, "go ahead" accepted. */
  rename: {
    heard: "rename everything in downloads to the date it was modified",
    plan: [
      { id: "p1", label: "List ~/Downloads", tier: "green" },
      { id: "p2", label: "Rename 61 files", tier: "amber" },
    ],
    tools: [
      {
        id: "s-r1",
        name: "fs.list",
        tier: "green",
        args: { path: "~/Downloads" },
        output: "61 entries · 4 folders skipped",
        duration_ms: 22,
        runtime: 220,
      },
      {
        id: "s-r2",
        name: "fs.move",
        tier: "amber",
        args: { count: 61, pattern: "YYYY-MM-DD-name.ext" },
        output: "61 renamed · 0 collisions",
        duration_ms: 340,
        runtime: 620,
        undoable: true,
      },
    ],
    confirm: {
      tier: "amber",
      preview: "That renames 61 files in Downloads. Want me to go ahead?",
      timeout_ms: 8_000,
    },
    result: {
      say: "Renamed sixty-one files. Undo is there if you want it back.",
      delivery: {
        emotion: "neutral",
        pace: 1.0,
        energy: 0.52,
        pause_before_ms: 0,
        emphasis: [],
      },
      show: "Renamed **61 files** in `~/Downloads` → `YYYY-MM-DD-name.ext`. No collisions. Undo available for 1 hour.",
    },
  },

  /* Red — reads back a distinguishing detail, requires the literal "confirm". */
  send: {
    heard: "send that draft to the whole kestrel list",
    plan: [
      { id: "p1", label: "Resolve recipient list", tier: "green" },
      { id: "p2", label: "Send to 41 recipients", tier: "red" },
    ],
    tools: [
      {
        id: "s-s1",
        name: "mail.contacts",
        tier: "green",
        args: { list: "kestrel-all" },
        output: "41 recipients across 3 domains",
        duration_ms: 190,
        runtime: 380,
      },
      {
        id: "s-s2",
        name: "mail.send",
        tier: "red",
        args: { recipients: 41, subject: "Re: Revised scope — v3" },
        output: "Sent · message-id 0x91ff",
        duration_ms: 880,
        runtime: 900,
      },
    ],
    confirm: {
      tier: "red",
      preview: "This sends to 41 recipients across 3 domains, including two external.",
      distinguishing: "41 recipients",
    },
    result: {
      say: "Sent to all forty-one. It's in your sent folder if you need the receipt.",
      delivery: {
        emotion: "focused",
        pace: 0.98,
        energy: 0.55,
        pause_before_ms: 140,
        emphasis: [],
      },
      show: "Sent **Re: Revised scope — v3** to 41 recipients. Message-id `0x91ff`.",
    },
  },

  /* Red with a diff — the fs.write case §06 calls out explicitly. */
  patch: {
    heard: "fix the timeout in the config, it should be thirty seconds",
    plan: [
      { id: "p1", label: "Read config.toml", tier: "green" },
      { id: "p2", label: "Write config.toml", tier: "red" },
    ],
    tools: [
      {
        id: "s-p1",
        name: "fs.read",
        tier: "green",
        args: { path: "./config.toml" },
        output: "38 lines",
        duration_ms: 9,
        runtime: 180,
      },
      {
        id: "s-p2",
        name: "fs.write",
        tier: "red",
        args: { path: "./config.toml", lines_changed: 1 },
        output: "1 line changed",
        duration_ms: 14,
        runtime: 300,
        undoable: true,
      },
    ],
    confirm: {
      tier: "red",
      preview: "One line in config.toml — the request timeout goes from 5 to 30 seconds.",
      distinguishing: "config.toml, line 12",
      diff: {
        path: "config.toml",
        before: `[server]\nhost = "0.0.0.0"\nport = 8080\n\n[client]\nretries = 3\ntimeout_secs = 5\nkeepalive = true`,
        after: `[server]\nhost = "0.0.0.0"\nport = 8080\n\n[client]\nretries = 3\ntimeout_secs = 30\nkeepalive = true`,
      },
    },
    result: {
      say: "Done. Timeout's thirty seconds now.",
      delivery: {
        emotion: "neutral",
        pace: 1.0,
        energy: 0.5,
        pause_before_ms: 0,
        emphasis: [],
      },
      show: "`config.toml` line 12 — `timeout_secs = 5` → `timeout_secs = 30`.",
    },
  },

  /* shell.run — the Console renders this one in a terminal. */
  build: {
    heard: "run the build and tell me if it passes",
    plan: [{ id: "p1", label: "Run pnpm build", tier: "red" }],
    tools: [
      {
        id: "s-b1",
        name: "shell.run",
        tier: "red",
        args: { argv: ["pnpm", "build"], cwd: "~/code/friday" },
        output: [
          "$ pnpm build",
          "vite v7.1.7 building for production...",
          "✓ 1,284 modules transformed.",
          "dist/index.html                 0.51 kB │ gzip:  0.32 kB",
          "dist/assets/index-B4kQ.css     42.18 kB │ gzip:  8.90 kB",
          "dist/assets/index-Dp2x.js     318.44 kB │ gzip: 98.61 kB",
          "✓ built in 3.42s",
        ].join("\n"),
        duration_ms: 3_420,
        runtime: 2_600,
      },
    ],
    confirm: {
      tier: "red",
      preview: "That runs pnpm build in the friday repo.",
      distinguishing: "pnpm build",
    },
    result: {
      say: "Build passed in three and a half seconds. Bundle's ninety-nine kilobytes gzipped.",
      delivery: {
        emotion: "bright",
        pace: 1.0,
        energy: 0.6,
        pause_before_ms: 0,
        emphasis: ["passed"],
      },
    },
  },
} satisfies Record<string, Scenario>

/** `satisfies` above, then a widening read here. The annotation alone would
 *  widen the keys to `string` and `ScenarioKey` with them, so every caller
 *  would need a cast and a typo would only surface as an undefined scenario at
 *  runtime. `satisfies` alone keeps each literal's exact shape, which drops the
 *  optional `confirm` and `show` from the scenarios that do not use them. This
 *  pair gives both: exact keys, declared values. */
export type ScenarioKey = keyof typeof SCENARIOS

const scenario = (key: ScenarioKey): Scenario => SCENARIOS[key]

/** The scenario as declared, not as inferred — see `scenario` above. Callers
 *  reading optional fields off the catalogue should come through here. */
export const getScenario = scenario

/* ── the turn ────────────────────────────────────────────────────────────── */

/** Stream a string in as recogniser partials, word by word, the way a
 *  streaming ASR actually emits: fast, uneven, occasionally revising. */
async function streamPartials(text: string, t: number) {
  const s = useFriday.getState()
  const words = text.split(" ")
  let acc = ""
  for (let i = 0; i < words.length; i++) {
    if (!alive(t)) return false
    acc = acc ? `${acc} ${words[i]}` : words[i]
    s.setPartial(acc)
    // The mic level tracks speech: loud on vowels, dipping between words.
    s.setLevel(0.22 + Math.random() * 0.55)
    await sleep(jitter(95, 0.6))
  }
  s.setLevel(0.08)
  return alive(t)
}

/** §04 — the endpoint fires 280 ms after speech stops, and the acknowledgement
 *  must land within 150 ms of that. Both are visible in the Bar. */
async function endpointAndAck(t: number) {
  const s = useFriday.getState()
  await sleep(jitter(280, 0.15))
  if (!alive(t)) return false
  s.setOrb("thinking")
  await sleep(jitter(118, 0.3))
  if (!alive(t)) return false
  s.acknowledge()
  return true
}

interface RunOptions {
  /** Resolves the Amber/Red gate. The Bar wires this to the confirm UI; when
   *  omitted the turn auto-approves after a beat so demos flow. */
  awaitConfirm?: (c: Confirmation) => Promise<boolean>
  /** Append the turn to this Console thread as it happens. */
  threadId?: string | null
}

export async function runTurn(key: ScenarioKey, opts: RunOptions = {}) {
  cancel()
  const t = live()
  const sc = scenario(key)
  const s = useFriday.getState()
  const threadId = opts.threadId ?? null

  s.resetUtterance()
  s.setOrb("listening")
  s.setLevel(0.1)

  /* 1 · Heard */
  await sleep(jitter(180, 0.2)) // wake word
  if (!alive(t)) return
  if (!(await streamPartials(sc.heard, t))) return
  if (!(await endpointAndAck(t))) return
  useFriday.getState().setHeard(sc.heard)

  if (threadId) {
    useFriday.getState().pushMessage(threadId, {
      id: `m-${Date.now()}`,
      role: "user",
      content: sc.heard,
      created_at: new Date().toISOString(),
    })
  }

  /* 2 · Plan */
  await sleep(jitter(240, 0.3)) // router + first tokens of the plan
  if (!alive(t)) return
  const plan: PlanStep[] = sc.plan.map((p) => ({ ...p, status: "waiting" }))
  useFriday.getState().setPlan(plan)

  if (threadId) {
    useFriday.getState().pushMessage(threadId, {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      tool_calls: [],
    })
  }

  /* The gate, if this scenario has one. Amber and Red both land here; the
   * difference is what the UI demands, not what the runtime does. */
  if (sc.confirm) {
    useFriday.getState().setAwaiting(sc.confirm)
    speakWithNativeVoice(sc.confirm.preview)
    const ok = opts.awaitConfirm
      ? await opts.awaitConfirm(sc.confirm)
      : (await sleep(1_400), true)
    if (!alive(t)) {
      stopNativeVoice()
      return
    }
    useFriday.getState().setAwaiting(null)
    if (!ok) {
      useFriday.getState().setPlan(plan.map((p) => ({ ...p, status: "skipped" })))
      useFriday.getState().setResult({
        say: "Left it alone.",
        delivery: {
          emotion: "neutral",
          pace: 1.0,
          energy: 0.45,
          pause_before_ms: 0,
          emphasis: [],
        },
      })
      speakWithNativeVoice("Left it alone.")
      return
    }
  }

  /* 3 · Doing — one plan step at a time, with its tool call underneath. */
  for (let i = 0; i < plan.length; i++) {
    if (!alive(t)) {
      stopNativeVoice()
      return
    }
    const st = useFriday.getState()
    st.setDoing(i)
    st.setPlan(
      plan.map((p, j) => ({ ...p, status: j < i ? "done" : j === i ? "active" : "waiting" }))
    )

    const spec = sc.tools[i]
    if (spec) {
      const { runtime, ...rest } = spec
      const call: ToolCall = { ...rest, status: "running", started_at: new Date().toISOString() }
      if (threadId) useFriday.getState().appendToolCall(threadId, call)
      await sleep(jitter(runtime, 0.2))
      if (!alive(t)) {
        stopNativeVoice()
        return
      }
      if (threadId) useFriday.getState().updateToolCall(threadId, call.id, { status: "ok" })
      useFriday.getState().appendAudit({
        id: `a-${Date.now()}-${i}`,
        tool: spec.name,
        tier: spec.tier,
        decision: sc.confirm && spec.tier !== "green" ? "confirmed" : "auto",
        duration_ms: spec.duration_ms ?? runtime,
        result_hash: Math.random().toString(16).slice(2, 6) + "…" + Math.random().toString(16).slice(2, 6),
        created_at: new Date().toISOString(),
        args_preview: JSON.stringify(spec.args).slice(1, -1).slice(0, 60),
      })
    } else {
      await sleep(jitter(400))
    }

    plan[i] = { ...plan[i], status: "done", elapsed_ms: spec?.runtime }
  }
  if (!alive(t)) {
    stopNativeVoice()
    return
  }
  useFriday.getState().setPlan(plan.map((p) => ({ ...p, status: "done" })))
  useFriday.getState().setDoing(null)

  /* 4 · Result — spoken while the show-channel text streams in. */
  useFriday.getState().setResult(sc.result)
  speakWithNativeVoice(sc.result.say)

  if (threadId && sc.result.show) {
    await streamTokens(sc.result.show, threadId, t)
  }

  if (!alive(t)) {
    stopNativeVoice()
    return
  }

  if (threadId) {
    useFriday.getState().patchLastMessage(threadId, {
      say: sc.result.say,
      delivery: sc.result.delivery,
      usage: {
        model: "glm-4.6",
        prompt: 1_200 + Math.floor(Math.random() * 2_400),
        completion: 60 + Math.floor(Math.random() * 200),
        ttft_ms: jitter(640, 0.4),
      },
    })
  }
}

/** Token-by-token streaming into the active Console message. GLM emits in
 *  chunks, not characters — 3–8 characters at a time reads right. */
export async function streamTokens(text: string, threadId: string, t = live()) {
  let i = 0
  while (i < text.length) {
    if (!alive(t)) return
    const step = 3 + Math.floor(Math.random() * 6)
    i = Math.min(text.length, i + step)
    useFriday.getState().patchLastMessage(threadId, { content: text.slice(0, i) })
    await sleep(16)
  }
}

/* ── ambient telemetry ───────────────────────────────────────────────────── */

/** The debug drawer and the settings tab both render live numbers. Idle FRIDAY
 *  is supposed to sit under 1% CPU (§12), so the samples wander inside that. */
export function startTelemetry(): () => void {
  const id = window.setInterval(() => {
    const s = useFriday.getState()
    const busy = s.orb !== "idle"
    s.setResources({
      cpu_pct: busy ? 4 + Math.random() * 9 : 0.2 + Math.random() * 0.6,
      rss_mb: 470 + Math.round(Math.random() * 40),
      asr_warm: true,
      tts_warm: true,
      thermal_c: 52 + Math.round(Math.random() * 6),
    })
    s.setLatency(
      s.latency.map((l) => ({
        ...l,
        value: Math.max(1, Math.round((l.value ?? l.budget) * (0.96 + Math.random() * 0.08))),
      }))
    )
  }, 2_000)
  return () => window.clearInterval(id)
}
