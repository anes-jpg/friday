export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export type InputMode = "command" | "dictation" | "conversation";

export type RiskTier = "Green" | "Amber" | "Red";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  duration_ms?: number;
  status: "pending" | "running" | "done" | "failed";
}

export interface PlanStep {
  description: string;
  tier: RiskTier;
  completed?: boolean;
}

export interface PendingPlan {
  id: string;
  heard: string;
  steps: PlanStep[];
  currentStepIndex: number;
  diff?: string;
  filename?: string;
  tier: RiskTier;
  status: "awaiting_confirm" | "executing" | "done" | "cancelled";
  resultSummary?: string;
  undoable?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  say?: string;
  show?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  latency_ms?: number;
  ttft_ms?: number;
  tokens?: number;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Fact {
  id: string;
  content: string;
  confidence: number;
  sourceMessageId: string;
  createdAt: number;
}

export interface AuditEntry {
  id: string;
  toolName: string;
  argsHash: string;
  tier: RiskTier;
  decision: "allowed" | "confirmed" | "denied";
  durationMs: number;
  timestamp: number;
}

export interface Automation {
  id: string;
  name: string;
  triggerType: "cron" | "phrase" | "event";
  triggerExpr: string;
  enabled: boolean;
  lastRun?: number;
  actionSummary: string;
}

export interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  enabled: boolean;
}

export interface SystemTelemetry {
  cpuPercent: number;
  idleRssMb: number;
  peakRssMb: number;
  glmTtftMs: number;
  lastVoiceRoundtripMs: number;
  micRms: number;
  outputRms: number;
  offlineMode: boolean;
  activeWindow?: string;
  clipboardPreview?: string;
}

export interface GlmSettings {
  baseUrl: string;
  heavyModel: string;
  lightModel: string;
  hasKey: boolean;
  dailySpendCapUsd: number;
  currentSpendUsd: number;
}

export interface UiCursorElement {
  name: string;
  control_type: string;
  value?: string;
  window_title: string;
  process_name: string;
  pid: number;
  x: number;
  y: number;
  bounds: [number, number, number, number];
}

export interface FocusedAppSnapshot {
  window_title: string;
  process_name: string;
  pid: number;
  bounds: [number, number, number, number];
  cursor_pos: [number, number];
  element_name?: string;
}

export interface OverwatchInterjection {
  id: string;
  category: "PanicStacktrace" | "BuildFailure" | "ThermalSpike" | "SocketAnomaly" | "TaskRecommendation";
  title: string;
  summary: string;
  suggestion: string;
  code_snippet?: string;
  timestamp: number;
  dismissed: boolean;
}

export type LegionRole = "Scout" | "Architect" | "Sentinel" | "Operator";
export type LegionTaskStatus = "Pending" | "Running" | "Completed" | "Failed";

export interface LegionSubagentNode {
  id: string;
  role: LegionRole;
  status: LegionTaskStatus;
  task: string;
  output?: string;
  latency_ms: number;
  dependencies: string[];
}

export interface LegionSwarmPlan {
  id: string;
  goal: string;
  nodes: LegionSubagentNode[];
  start_time: number;
  total_duration_ms: number;
  completed: boolean;
}

export interface DbEpisodicEvent {
  id: string;
  app_name: string;
  window_title: string;
  file_path?: string;
  git_branch?: string;
  summary: string;
  created_at: number;
  duration_secs: number;
}
