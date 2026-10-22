/** Seed data — what the Console shows before the Rust agent core exists.
 *
 * Every string here is written to be *plausible for this product*: the tool
 * names come from §06's catalogue, the risk tiers match the table there, and
 * the latency numbers are the §04 budget with realistic p95s sitting under it.
 * Placeholder lorem would make the layout lie about how the real thing reads.
 */

import type {
  AuditEntry,
  Automation,
  Fact,
  LatencyStage,
  ResourceSample,
  Skill,
  Thread,
} from "./types"

const now = Date.now()
const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString()

const threads: Thread[] = [
  {
    id: "t-1",
    title: "Quarterly numbers pull",
    updated_at: at(4),
    pinned: true,
    message_count: 6,
    messages: [
      {
        id: "m-1",
        role: "user",
        content: "Pull the Q3 revenue sheet and tell me if we're tracking.",
        created_at: at(6),
      },
      {
        id: "m-2",
        role: "assistant",
        content:
          "Q3 closed at **$412,800** against a $400,000 target — 3.2% ahead.\n\n| Month | Booked | Target | Δ |\n| --- | ---: | ---: | ---: |\n| Jul | $128,400 | $130,000 | −1.2% |\n| Aug | $139,100 | $135,000 | +3.0% |\n| Sep | $145,300 | $135,000 | +7.6% |\n\nSeptember carried it. July was the only month under.",
        say: "You closed Q3 three percent ahead. September carried it — July was the only month under target.",
        delivery: {
          emotion: "bright",
          pace: 1.0,
          energy: 0.62,
          pause_before_ms: 0,
          emphasis: ["three percent ahead"],
        },
        created_at: at(4),
        usage: { model: "glm-4.6", prompt: 2140, completion: 186, ttft_ms: 640 },
        tool_calls: [
          {
            id: "tc-1",
            name: "fs.read",
            tier: "green",
            status: "ok",
            args: { path: "~/Documents/finance/q3-2026.xlsx", sheet: "Summary" },
            output: "3 sheets, 412 rows. Parsed Summary → 3 monthly rows.",
            duration_ms: 84,
            started_at: at(5),
          },
          {
            id: "tc-2",
            name: "compute.aggregate",
            tier: "green",
            status: "ok",
            args: { op: "sum", column: "booked" },
            output: "412800",
            duration_ms: 3,
            started_at: at(5),
          },
        ],
      },
    ],
  },
  {
    id: "t-2",
    title: "Rename the screenshot batch",
    updated_at: at(52),
    pinned: false,
    message_count: 4,
    messages: [
      {
        id: "m-3",
        role: "user",
        content: "Rename everything in Screenshots to the date it was taken.",
        created_at: at(54),
      },
      {
        id: "m-4",
        role: "assistant",
        content:
          "Renamed 34 files in `~/Pictures/Screenshots` to `YYYY-MM-DD-HHMM.png`. Two collisions got a `-2` suffix. Undo is available for the next hour.",
        say: "Renamed thirty-four files. Two had the same timestamp, so I suffixed those.",
        delivery: {
          emotion: "neutral",
          pace: 1.0,
          energy: 0.5,
          pause_before_ms: 0,
          emphasis: [],
        },
        created_at: at(52),
        usage: { model: "glm-4.6", prompt: 1180, completion: 92, ttft_ms: 520 },
        tool_calls: [
          {
            id: "tc-3",
            name: "fs.list",
            tier: "green",
            status: "ok",
            args: { path: "~/Pictures/Screenshots" },
            output: "34 entries",
            duration_ms: 12,
            started_at: at(54),
          },
          {
            id: "tc-4",
            name: "fs.move",
            tier: "amber",
            status: "ok",
            args: { count: 34, pattern: "YYYY-MM-DD-HHMM.png" },
            output: "34 renamed, 2 suffixed",
            duration_ms: 218,
            started_at: at(53),
            undoable: true,
          },
        ],
      },
    ],
  },
  {
    id: "t-3",
    title: "Draft reply to the Kestrel thread",
    updated_at: at(180),
    pinned: false,
    message_count: 8,
    messages: [
      {
        id: "m-5",
        role: "user",
        content: "Draft a reply to the Kestrel thread. Keep it short.",
        created_at: at(182),
      },
      {
        id: "m-6",
        role: "assistant",
        content:
          "Drafted, not sent — it's sitting in your drafts folder.\n\n> Thanks for the revised scope. Two things before we sign: the Nov 14 milestone needs to move to Nov 21 given the holiday week, and I'd like the support SLA written into the body rather than the annex. Everything else looks right.",
        say: "It's in your drafts. I moved the milestone request to the top since that's the one with a deadline.",
        delivery: {
          emotion: "focused",
          pace: 0.98,
          energy: 0.55,
          pause_before_ms: 120,
          emphasis: [],
        },
        created_at: at(180),
        usage: { model: "glm-4.6", prompt: 3820, completion: 214, ttft_ms: 710 },
        tool_calls: [
          {
            id: "tc-5",
            name: "mail.search",
            tier: "green",
            status: "ok",
            args: { query: "Kestrel", limit: 20 },
            output: "7 messages in 1 thread",
            duration_ms: 340,
            started_at: at(182),
            from_untrusted: true,
          },
          {
            id: "tc-6",
            name: "mail.draft",
            tier: "amber",
            status: "ok",
            args: { to: "p.mensah@kestrel.co", subject: "Re: Revised scope — v3" },
            output: "Draft saved, id 0x91ff",
            duration_ms: 156,
            started_at: at(181),
            undoable: true,
          },
        ],
      },
    ],
  },
  {
    id: "t-4",
    title: "Why is the fan running",
    updated_at: at(1440),
    pinned: false,
    message_count: 3,
    messages: [
      {
        id: "m-7",
        role: "user",
        content: "Why is the fan running?",
        created_at: at(1442),
      },
      {
        id: "m-8",
        role: "assistant",
        content:
          "A Node process from the `mailer-api` folder is holding 180% CPU — it's been up 6 hours. Nothing else is above 4%.",
        say: "A Node process from mailer-api is pinning two cores. It's been up six hours.",
        delivery: {
          emotion: "dry-amused",
          pace: 1.0,
          energy: 0.58,
          pause_before_ms: 0,
          emphasis: ["six hours"],
        },
        created_at: at(1440),
        usage: { model: "glm-4.6", prompt: 940, completion: 64, ttft_ms: 480 },
        tool_calls: [
          {
            id: "tc-7",
            name: "sys.processes",
            tier: "green",
            status: "ok",
            args: { sort: "cpu", limit: 10 },
            output: "node.exe 180.4% · chrome.exe 3.8% · ...",
            duration_ms: 46,
            started_at: at(1441),
          },
        ],
      },
    ],
  },
]

const facts: Fact[] = [
  {
    id: "f-1",
    subject: "Timezone",
    value: "Europe/London, and travels to Lagos roughly monthly",
    tier: "semantic",
    confidence: 0.96,
    source_message_id: "m-42",
    created_at: at(14_400),
    pinned: true,
  },
  {
    id: "f-2",
    subject: "Writing voice",
    value: "Short sentences. Dislikes exclamation marks and the word 'delighted'.",
    tier: "semantic",
    confidence: 0.88,
    source_message_id: "m-51",
    created_at: at(10_080),
    pinned: true,
  },
  {
    id: "f-3",
    subject: "Kestrel contract",
    value: "Renewal is Nov 14. Paul Mensah is the counterparty.",
    tier: "episodic",
    confidence: 0.91,
    source_message_id: "m-5",
    created_at: at(180),
    pinned: false,
  },
  {
    id: "f-4",
    subject: "Screenshot convention",
    value: "Prefers YYYY-MM-DD-HHMM for renamed screenshots",
    tier: "procedural",
    confidence: 0.79,
    source_message_id: "m-3",
    created_at: at(54),
    pinned: false,
  },
  {
    id: "f-5",
    subject: "Standing meeting",
    value: "Tuesday 09:30 engineering sync, 45 minutes",
    tier: "episodic",
    confidence: 0.84,
    source_message_id: "m-19",
    created_at: at(5_760),
    pinned: false,
  },
  {
    id: "f-6",
    subject: "Q3 target",
    value: "$400,000 booked revenue",
    tier: "document",
    confidence: 0.99,
    source_message_id: "m-1",
    created_at: at(6),
    pinned: false,
  },
]

const audit: AuditEntry[] = [
  {
    id: "a-1",
    tool: "fs.read",
    tier: "green",
    decision: "auto",
    duration_ms: 84,
    result_hash: "8f2c…a91d",
    created_at: at(5),
    args_preview: "~/Documents/finance/q3-2026.xlsx",
  },
  {
    id: "a-2",
    tool: "mail.send",
    tier: "red",
    decision: "refused",
    duration_ms: 0,
    result_hash: "—",
    created_at: at(48),
    args_preview: "to: 41 recipients",
  },
  {
    id: "a-3",
    tool: "fs.move",
    tier: "amber",
    decision: "confirmed",
    duration_ms: 218,
    result_hash: "c104…77be",
    created_at: at(53),
    args_preview: "34 files → YYYY-MM-DD-HHMM.png",
  },
  {
    id: "a-4",
    tool: "mail.search",
    tier: "green",
    decision: "escalated",
    duration_ms: 340,
    result_hash: "1b6e…3c02",
    created_at: at(182),
    args_preview: "query: Kestrel  ·  untrusted content in result",
  },
  {
    id: "a-5",
    tool: "shell.run",
    tier: "red",
    decision: "confirmed",
    duration_ms: 1_240,
    result_hash: "de55…9a17",
    created_at: at(320),
    args_preview: "git push origin main",
  },
  {
    id: "a-6",
    tool: "sys.processes",
    tier: "green",
    decision: "auto",
    duration_ms: 46,
    result_hash: "0447…e8b1",
    created_at: at(1_441),
    args_preview: "sort: cpu, limit: 10",
  },
]

const automations: Automation[] = [
  {
    id: "au-1",
    name: "Morning brief",
    trigger: { type: "cron", expr: "0 7 * * 1-5", tz: "Europe/London" },
    enabled: true,
    last_run: at(180),
    next_run: at(-1_260),
    history: ["ok", "ok", "ok", "ok", "skipped", "ok", "ok", "ok", "ok", "ok", "failed", "ok"],
  },
  {
    id: "au-2",
    name: "Archive downloads older than 30 days",
    trigger: { type: "cron", expr: "0 3 * * 0", tz: "Europe/London" },
    enabled: true,
    last_run: at(4_320),
    next_run: at(-5_760),
    history: ["ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok"],
  },
  {
    id: "au-3",
    name: "Flag contracts nearing renewal",
    trigger: { type: "event", on: "calendar.event_added" },
    enabled: true,
    last_run: at(600),
    history: ["ok", "ok", "failed", "ok", "ok", "ok"],
  },
  {
    id: "au-4",
    name: "Nightly backup verify",
    trigger: { type: "cron", expr: "30 2 * * *", tz: "Europe/London" },
    enabled: false,
    last_run: at(11_520),
    history: ["ok", "failed", "failed", "ok", "ok"],
  },
]

const skills: Skill[] = [
  {
    id: "sk-beast",
    name: "Beast AST & Code Intelligence",
    version: "3.0.0",
    description: "Two-stage code search, AST chunking, and reciprocal rank fusion across workspace files.",
    enabled: true,
    permissions: ["fs.read", "code.search", "code.chunk"],
    triggers: ["search code", "find symbol", "chunk file", "definitions"],
    installed_at: at(100),
  },
  {
    id: "sk-jev",
    name: "Jev-Ultrafast Web Operator",
    version: "2.1.0",
    description: "Sub-8s autonomous browser agent loop with dynamic indexed element action space.",
    enabled: true,
    permissions: ["net.browser", "browser.snapshot", "browser.action"],
    triggers: ["browse", "open website", "click element", "web scrape"],
    installed_at: at(100),
  },
  {
    id: "sk-review",
    name: "OpenCodeReview Auditor",
    version: "1.4.0",
    description: "Real-world git diff parser, line hunks, smart bundling, and defect rule scans.",
    enabled: true,
    permissions: ["git.diff", "code.review"],
    triggers: ["review diff", "audit code", "check unwrap", "git scan"],
    installed_at: at(100),
  },
  {
    id: "sk-win32",
    name: "Windows UI & Screen Operator",
    version: "2.0.0",
    description: "Native Win32 GDI screen frame capture, window enumeration, focus switching, and desktop input injection.",
    enabled: true,
    permissions: ["screen.capture", "window.focus", "input.inject"],
    triggers: ["screen", "active window", "focus app", "click", "type"],
    installed_at: at(100),
  },
  {
    id: "sk-1",
    name: "Spotify",
    version: "1.2.0",
    description: "Playback control, queue, and library search on the local client.",
    enabled: true,
    permissions: ["net.http:api.spotify.com", "creds.read:spotify"],
    triggers: ["play", "pause", "skip", "queue", "what's playing"],
    installed_at: at(20_160),
  },
  {
    id: "sk-2",
    name: "Obsidian vault",
    version: "0.9.4",
    description: "Read, append and link notes in a local Obsidian vault.",
    enabled: true,
    permissions: ["fs.read:~/Vault", "fs.write:~/Vault"],
    triggers: ["note", "vault", "daily note", "link"],
    installed_at: at(14_400),
  },
  {
    id: "sk-3",
    name: "Docker",
    version: "0.4.1",
    description: "List, start, stop and tail logs for local containers.",
    enabled: true,
    permissions: ["shell.run:docker"],
    triggers: ["container", "docker", "compose"],
    installed_at: at(8_640),
  },
  {
    id: "sk-4",
    name: "Home Assistant",
    version: "2.0.0",
    description: "Lights, climate and scenes over the local HA instance.",
    enabled: false,
    permissions: ["net.http:homeassistant.local", "creds.read:hass"],
    triggers: ["lights", "thermostat", "scene"],
    installed_at: at(43_200),
  },
  {
    id: "sk-5",
    name: "Linear",
    version: "1.0.3",
    description: "Create and triage issues, read the current cycle.",
    enabled: true,
    permissions: ["net.http:api.linear.app", "creds.read:linear"],
    triggers: ["issue", "ticket", "cycle", "backlog"],
    installed_at: at(2_880),
  },
  {
    id: "sk-6",
    name: "Screenshot OCR",
    version: "0.2.0",
    description: "Reads text out of the most recent screenshot, fully offline.",
    enabled: true,
    permissions: ["fs.read:~/Pictures/Screenshots"],
    triggers: ["read this", "what does it say", "ocr"],
    installed_at: at(1_440),
  },
]

/** §04's table, with p95s that sit under budget except the one that doesn't —
 *  the debug drawer is only useful if it can show you a miss. */
const latency: LatencyStage[] = [
  { key: "wake", label: "Wake word", value: 164, budget: 180, kind: "local" },
  { key: "endpoint", label: "Endpoint detect", value: 251, budget: 280, kind: "local" },
  { key: "asr", label: "Recognition tail", value: 208, budget: 250, kind: "local" },
  { key: "route", label: "Router", value: 11, budget: 15, kind: "local" },
  { key: "ttft", label: "GLM first token", value: 946, budget: 900, kind: "network" },
  { key: "tts", label: "First audio", value: 412, budget: 600, kind: "local" },
  { key: "ack", label: "Acknowledgement", value: 118, budget: 150, kind: "derived" },
  { key: "e2e", label: "Perceived end-to-end", value: 1_690, budget: 1_800, kind: "derived" },
]

const resources: ResourceSample = {
  cpu_pct: 0.4,
  rss_mb: 486,
  asr_warm: true,
  tts_warm: true,
  thermal_c: 54,
}

function makeBlocks(pattern: string, baseMs: number) {
  return pattern.split("").map((ch, i) => {
    let color = "bg-neutral-600/30"
    let status = "No Traffic"
    let lat = 0
    if (ch === "G") {
      color = "bg-emerald-500"
      status = "200 OK"
      lat = Math.round(baseMs * (0.85 + (i % 5) * 0.05))
    } else if (ch === "Y") {
      color = "bg-amber-500"
      status = "200 Slow TTFT"
      lat = Math.round(baseMs * 1.5)
    } else if (ch === "O") {
      color = "bg-orange-500"
      status = "200 High Latency"
      lat = Math.round(baseMs * 2.2)
    } else if (ch === "R") {
      color = "bg-rose-500"
      status = "500 Error"
      lat = 0
    }
    const minsAgo = pattern.length - i
    const d = new Date(Date.now() - minsAgo * 60_000)
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    return {
      key: `b-${i}`,
      color,
      status,
      latency_ms: lat,
      tooltip: ch === "." ? `${time} · Idle` : `${time} · ${lat}ms · ${status}`,
    }
  })
}

import type { AiModel } from "./types"

const initialAiModels: AiModel[] = [
  {
    id: "friday-1b-operator",
    name: "FRIDAY-1B-Operator (Fine-Tuned GGUF · 1.05GB VRAM)",
    provider: "local_edge",
    base_url: "http://127.0.0.1:11434/v1",
    capabilities: ["chat", "local_edge", "vram_sub_2gb", "friday_native", "tool_calling", "responses"],
    status: "Normal",
    priority: 0,
    is_active: true,
    telemetry: {
      availability_pct: 100.0,
      ttft_p90_ms: 60,
      avg_latency_ms: 210,
      tracker_history: makeBlocks("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", 210),
    },
  },
  {
    id: "smollm2-1.7b",
    name: "SmolLM2-1.7B-Instruct (4-bit · 1.05GB VRAM)",
    provider: "local_edge",
    base_url: "http://127.0.0.1:11434/v1",
    capabilities: ["chat", "local_edge", "vram_sub_2gb", "tool_calling", "responses"],
    status: "Normal",
    priority: 1,
    is_active: false,
    telemetry: {
      availability_pct: 100.0,
      ttft_p90_ms: 85,
      avg_latency_ms: 280,
      tracker_history: makeBlocks("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", 280),
    },
  },
  {
    id: "bitnet-b1.58-2b",
    name: "BitNet b1.58 2B (1-Bit Ternary · 410MB VRAM · Cold)",
    provider: "local_edge",
    base_url: "http://127.0.0.1:11434/v1",
    capabilities: ["chat", "local_edge", "vram_sub_2gb", "cold_thermal", "responses"],
    status: "Normal",
    priority: 2,
    is_active: false,
    telemetry: {
      availability_pct: 100.0,
      ttft_p90_ms: 45,
      avg_latency_ms: 175,
      tracker_history: makeBlocks("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", 175),
    },
  },
  {
    id: "lfm-1b",
    name: "Liquid LFM-1B (Non-Transformer LNN · 650MB VRAM)",
    provider: "local_edge",
    base_url: "http://127.0.0.1:11434/v1",
    capabilities: ["chat", "local_edge", "vram_sub_2gb", "zero_kv_blowout", "responses"],
    status: "Normal",
    priority: 3,
    is_active: false,
    telemetry: {
      availability_pct: 100.0,
      ttft_p90_ms: 40,
      avg_latency_ms: 190,
      tracker_history: makeBlocks("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", 190),
    },
  },
  {
    id: "deepseek-v4-flash",
    name: "deepseek-v4-flash (Cloud Turbo)",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["chat", "responses", "claude_native"],
    status: "Normal",
    priority: 4,
    is_active: false,
    telemetry: {
      availability_pct: 95.87,
      ttft_p90_ms: 1972,
      avg_latency_ms: 5905,
      tracker_history: makeBlocks("GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGYYYYYYYYYYYYYYYYYYYOOOOOOOOOO", 2400),
    },
  },
  {
    id: "gpt-6-astra",
    name: "gpt-6-astra",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["chat", "responses"],
    status: "Normal",
    priority: 2,
    is_active: false,
    telemetry: {
      availability_pct: 97.60,
      ttft_p90_ms: 31023,
      avg_latency_ms: 14814,
      tracker_history: makeBlocks("G..................................................YYGGGG", 14800),
    },
  },
  {
    id: "gpt-5.6-sol",
    name: "gpt-5.6-sol",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["chat", "responses"],
    status: "Normal",
    priority: 3,
    is_active: false,
    telemetry: {
      availability_pct: 98.81,
      ttft_p90_ms: 34284,
      avg_latency_ms: 32797,
      tracker_history: makeBlocks("O...................................................GGGGG", 28000),
    },
  },
  {
    id: "claude-opus-5",
    name: "claude-opus-5",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["claude_native"],
    status: "Demote",
    priority: 4,
    is_active: false,
    telemetry: {
      availability_pct: 90.68,
      ttft_p90_ms: 74685,
      avg_latency_ms: 39017,
      tracker_history: makeBlocks("G...................................................OOOOO", 38000),
    },
  },
  {
    id: "claude-opus-4-8",
    name: "claude-opus-4-8",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["claude_native"],
    status: "Demote",
    priority: 5,
    is_active: false,
    telemetry: {
      availability_pct: 83.59,
      ttft_p90_ms: 58285,
      avg_latency_ms: 28767,
      tracker_history: makeBlocks("....................................................OOOOO", 28500),
    },
  },
  {
    id: "claude-fable-5",
    name: "claude-fable-5",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["claude_native"],
    status: "No traffic",
    priority: 6,
    is_active: false,
    telemetry: {
      availability_pct: 0,
      ttft_p90_ms: 0,
      avg_latency_ms: 0,
      tracker_history: makeBlocks("..........................................................", 0),
    },
  },
  {
    id: "glm-5.3",
    name: "glm-5.3",
    provider: "agentrouter",
    base_url: "https://agentrouter.org/v1",
    capabilities: ["chat", "claude_native", "responses"],
    status: "No traffic",
    priority: 0,
    is_active: true,
    telemetry: {
      availability_pct: 0,
      ttft_p90_ms: 0,
      avg_latency_ms: 0,
      tracker_history: makeBlocks("..........................................................", 0),
    },
  },
]

export const seed = { threads, facts, audit, automations, skills, latency, resources, initialAiModels }
