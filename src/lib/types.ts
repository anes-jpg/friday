/** FRIDAY domain model.
 *
 * These types mirror what §05 and §06 say crosses the IPC boundary. In the real
 * build §10.3 generates this file from the Rust types with `ts-rs` and it is
 * never hand-edited. Until the Rust agent core exists, this is the contract the
 * frontend is written against — which is the point: when `bindings.ts` arrives,
 * the surfaces should not have to change.
 */

/* ── §04 · voice pipeline ────────────────────────────────────────────────── */

/** §01 S1 / the orb table in §07. Four states, no other indicators anywhere. */
export type OrbState = "idle" | "listening" | "thinking" | "speaking"

/** Explicit UI Voice State Model from DESIGN.md Section 18.8 */
export type VoiceUiState =
  | { kind: "idle" }
  | { kind: "arming" }
  | { kind: "listening"; partial: string; rms: number }
  | { kind: "endpointing"; transcript: string }
  | { kind: "thinking"; transcript: string; elapsedMs: number }
  | { kind: "tool"; name: string; target?: string; cancellable: boolean }
  | { kind: "confirmation"; title: string; consequence: string; risk: "low" | "medium" | "high" }
  | { kind: "speaking"; text: string; rms: number }
  | { kind: "interrupted" }
  | { kind: "offline"; reason: string; recoveryLabel: string }
  | { kind: "error"; message: string; recoveryLabel?: string }

/** "Three modes, never ambiguous." The mode is always visible and always
 *  exitable with one word or Escape. */
export type Mode = "command" | "dictation" | "conversation" | "project"

/** §14 · the emotion enum stays small and human. Seven is plenty. */
export type Emotion =
  | "neutral"
  | "warm"
  | "bright"
  | "calm-concerned"
  | "dry-amused"
  | "focused"
  | "apologetic"

/** §"1 · Delivery directives, per sentence" — emitted by the model alongside
 *  the text, compiled by the voice layer into synthesis parameters. */
export interface Delivery {
  emotion: Emotion
  /** Clamped to 0.85–1.12 before it reaches Kokoro. */
  pace: number
  energy: number
  pause_before_ms: number
  emphasis: string[]
}

/** The two-channel output rule: `say` is spoken and is plain speakable prose,
 *  two sentences maximum. `show` is the markdown, table, diff, code and URLs.
 *  She never speaks a path, a URL or a bullet list. */
export interface TurnOutput {
  say: string
  delivery: Delivery
  show?: string
}

/* ── §06 · tools ─────────────────────────────────────────────────────────── */

/** One registry, three risk tiers. Green runs silently, Amber previews with a
 *  one-key confirm, Red requires the literal word "confirm". */
export type RiskTier = "green" | "amber" | "red"

export type ToolStatus = "pending" | "running" | "ok" | "failed" | "refused"

export interface ToolCall {
  id: string
  name: string
  tier: RiskTier
  status: ToolStatus
  args: Record<string, unknown>
  /** Truncated to a token cap. The full payload lives on disk, keyed by id. */
  output?: string
  /** Milliseconds. Rendered by the Console's tool-call cards. */
  duration_ms?: number
  started_at: string
  /** §08 — a call originating in a turn that contained untrusted content is
   *  force-escalated to explicit confirmation regardless of its declared tier. */
  from_untrusted?: boolean
  /** §"Voice confirmation grammar" — anything reversible carries an undo. */
  undoable?: boolean
}

/* ── the utterance contract ──────────────────────────────────────────────── */

/** "Every spoken turn produces exactly four visible lines on the Bar, in this
 *  order. Build this before you build any tool." */
export interface PlanStep {
  id: string
  label: string
  tier: RiskTier
  status: "waiting" | "active" | "done" | "failed" | "skipped"
  elapsed_ms?: number
}

export interface Utterance {
  /** 1 · Heard — the final transcript, editable inline. */
  heard: string
  /** Live partials, rendered at 60% opacity until the endpoint lands. */
  partial: string
  /** 2 · Plan — one line per step, risk tier as a coloured dot. */
  plan: PlanStep[]
  /** 3 · Doing — index into `plan`, or null. */
  doing: number | null
  /** 4 · Result — what changed, with an undo affordance. */
  result: TurnOutput | null
  /** Set while an Amber preview or a Red confirmation is waiting on the user. */
  awaiting: Confirmation | null
}

export interface Confirmation {
  tier: Exclude<RiskTier, "green">
  /** Amber speaks a one-sentence preview. Red reads back a *distinguishing*
   *  detail — a count, a target, a filename. */
  preview: string
  /** Red only: the literal word "confirm" is required. "Yes" is rejected on
   *  purpose — a television in the room says it too. */
  distinguishing?: string
  /** Amber only: 8-second timeout cancels. */
  timeout_ms?: number
  /** A diff to show before applying. §06 `fs.write` / `fs.move` / `fs.delete`. */
  diff?: { path: string; before: string; after: string }
}

/* ── §05 · threads and memory ────────────────────────────────────────────── */

export interface PlanStepBackend {
  description: string
  tier: RiskTier | "Green" | "Amber" | "Red"
  completed: boolean
}

export interface PendingPlanBackend {
  id: string
  heard: string
  steps: PlanStepBackend[]
  current_step_index: number
  diff?: string | null
  filename?: string | null
  tier: RiskTier | "Green" | "Amber" | "Red"
  status: string // "awaiting_confirm" | "executing" | "done" | "cancelled"
  result_summary?: string | null
  undoable: boolean
  pending_tools?: Array<Record<string, unknown>> | null
}

export interface Message {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  say?: string
  show?: string
  latency_ms?: number
  tokens?: number
  delivery?: Delivery
  tool_calls?: ToolCall[]
  toolCalls?: ToolCall[]
  pending_plan?: PendingPlanBackend | null
  pendingPlan?: PendingPlanBackend | null
  created_at: string
  /** §05.6 — logged per request: model, tokens, TTFT, total duration. */
  usage?: { model: string; prompt: number; completion: number; ttft_ms: number }
}

export interface Thread {
  id: string
  title: string
  updated_at?: string
  updatedAt?: string
  pinned?: boolean
  message_count?: number
  messageCount?: number
  messages: Message[]
}

/** §05 memory tiers. Every fact stores a source, a confidence and a timestamp;
 *  the Memory tab lets the user read, edit and delete every single one. */
export interface Fact {
  id: string
  subject: string
  value: string
  content?: string
  tier: "semantic" | "episodic" | "procedural" | "document"
  confidence: number
  source_message_id: string
  created_at: string
  pinned: boolean
}

/* ── §08 · audit ─────────────────────────────────────────────────────────── */

/** Append-only. Every tool call: args, result hash, duration, decision. */
export interface AuditEntry {
  id: string
  tool: string
  toolName?: string
  tier: RiskTier
  decision: "auto" | "confirmed" | "refused" | "escalated"
  status?: string
  duration_ms: number
  durationMs?: number
  result_hash: string
  argsHash?: string
  created_at: string
  timestamp?: string
  args_preview: string
}

/* ── §07 · automations and skills ────────────────────────────────────────── */

export interface Automation {
  id: string
  name: string
  trigger: { type: "cron"; expr: string; tz: string } | { type: "event"; on: string }
  triggerExpr?: string
  actionSummary?: string
  enabled: boolean
  last_run?: string
  lastRun?: string | null
  next_run?: string
  /** Last 24 runs, newest last — feeds the status tracker. */
  history: ("ok" | "failed" | "skipped")[]
}

/** §06 Skill SDK — a folder in %APPDATA%/FRIDAY/skills/{id}/. */
export interface Skill {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  /** Declared up front, granted once at install. A skill can never escalate. */
  permissions: string[]
  triggers: string[]
  installed_at: string
}

/* ── §04 / §12 · the latency budget, as data ─────────────────────────────── */

/** One row of the §04 table. The Console debug drawer renders these live —
 *  "You cannot hit a budget you cannot see." */
export interface LatencyStage {
  key: string
  label: string
  /** Measured p95, milliseconds. */
  value: number
  /** The §04 budget for this stage. Over budget renders in --color-fail. */
  budget: number
  /** Local stages are free and offline-safe; `network` is the one GLM hop. */
  kind: "local" | "network" | "derived"
}

/** §12 gates that are resource rather than latency shaped. */
export interface ResourceSample {
  cpu_pct: number
  rss_mb: number
  /** §03 — recogniser warm 10 min after last use, voice 5. */
  asr_warm: boolean
  tts_warm: boolean
  /** Sustained clocks under load. A thin chassis fails at minute 25. */
  thermal_c: number
}

/** §04 aside — offline she is not a degraded assistant, she is a different one.
 *  Only reasoning disappears, because the brain is the one thing across the
 *  network. The banner says exactly that, in those words. */
export type Connectivity = "online" | "slow" | "offline"

/* ── AI Modular Routing & Telemetry ────────────────────────────────────────── */

export type ModelStatus = "Normal" | "Demote" | "No traffic"

export interface TrackerBlockItem {
  key?: string | number
  color?: string
  tooltip?: string
  latency_ms?: number
  status?: string
  timestamp?: number
}

export interface ModelTelemetry {
  availability_pct: number
  ttft_p90_ms: number
  avg_latency_ms: number
  tracker_history: TrackerBlockItem[]
}

export interface AiModel {
  id: string
  name: string
  provider: string
  base_url: string
  api_key?: string
  capabilities: string[]
  status: ModelStatus
  priority: number
  is_active: boolean
  telemetry: ModelTelemetry
}

/* ── Piper & Neural TTS System ────────────────────────────────── */

export type PiperVoiceId = "en_GB-alba-medium" | "en_US-amy-medium"
export type KokoroVoiceId = PiperVoiceId | "af_heart" | "bf_emma" | "af_bella" | "af_nicole" | "af_sky"

export type PhraseCategory = "acknowledgement" | "confirmation" | "plan" | "status" | "system"

export interface PhraseBankItem {
  id: string
  key: string
  text: string
  category: PhraseCategory
  emotion: Emotion
  latency_budget_ms: number
  cached: boolean
  hits?: number
}

export interface WakeWordSettings {
  enabled: boolean
  sensitivity: number
  triggerPhrase: string
  lastDetectedMs?: number
}

export interface ScreenContext {
  captured: boolean
  target?: string
  app?: string
  title?: string
  width?: number
  height?: number
  dataUrl?: string
  timestamp?: number
}

export interface RunningWindow {
  hwnd: number
  title: string
  processName: string
  pid: number
  isActive: boolean
}

/* ── §09 · Project Scaffolding & Repo Intelligence ────────────────────────── */

export type ProjectArchetypeId =
  | "better-t-stack"
  | "react-bits-vite"
  | "python-mcp-agent"
  | "rust-tauri-operator"
  | "custom"

export interface ScaffoldArchetype {
  id: ProjectArchetypeId
  name: string
  friendlyName?: string
  description: string
  beginnerSummary?: string
  tag: string
  badge?: string
  framework: string
  features: string[]
  whatYouGet?: string[]
  defaultInstallCmd: string
  tokenSavingsMultiplier: string
  defaultProjectName?: string
}

export interface DiscoveredRepo {
  id: string
  name: string
  path: string
  framework: string
  packageManager: "pnpm" | "bun" | "npm" | "yarn" | "cargo" | "pip"
  gitBranch?: string
  lastModified: string
  hasUncommittedChanges: boolean
  dependenciesCount: number
}

export interface ProjectMetadata {
  name: string
  description: string
  framework: string
  packageManager: string
  gitBranch?: string
  uncommittedChangesCount: number
  dependenciesCount: number
  devDependenciesCount: number
  scripts: { name: string; command: string }[]
  totalFilesCount: number
  lastModified: string
}

export interface ProjectWorkspace {
  id: string
  name: string
  directive: string
  rootPath?: string
  archetype?: ProjectArchetypeId
  framework?: string
  packageManager?: string
  status: "active" | "completed" | "archived"
  priority?: "low" | "medium" | "high" | "critical"
  tags: string[]
  metadata?: ProjectMetadata
  created_at: string
  updated_at: string
}

export interface WorkspaceItem {
  id: string
  projectId: string
  type: "project" | "task" | "note" | "goal" | "milestone" | "reminder"
  title: string
  description?: string
  status: "todo" | "in-progress" | "done"
  priority?: "low" | "medium" | "high" | "critical"
  riskTier?: "green" | "amber" | "red"
  dueDate?: string
  progress?: number
  tag?: string
  toolAction?: string
}

export interface WorkflowExecutionStep {
  id: string
  label: string
  tier: RiskTier
  status: "waiting" | "active" | "done" | "failed"
  toolName?: string
  durationMs?: number
}

export interface ProjectWorkflow {
  id: string
  projectId: string
  title: string
  directive: string
  steps: WorkflowExecutionStep[]
  status: "idle" | "running" | "awaiting_confirm" | "completed" | "failed"
}

export interface ProjectFileNode {
  name: string
  path: string
  is_dir: boolean
  size_bytes?: number
  children?: ProjectFileNode[]
}

export interface ProjectCommandResult {
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
}

export type ProjectTabSubView = "roadmap" | "code" | "terminal" | "git" | "settings"

export interface ProjectScript {
  name: string
  command: string
  category?: "dev" | "build" | "test" | "lint" | "other"
}

export interface ProjectGitDiffInfo {
  branch: string
  diff: string
  modified_files: string[]
  has_changes: boolean
}



