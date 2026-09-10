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
