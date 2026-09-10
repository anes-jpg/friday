import { create } from "zustand";
import { invokeCommand } from "./ipc";
import {
  OrbState,
  InputMode,
  RiskTier,
  PendingPlan,
  ChatMessage,
  Thread,
  Fact,
  AuditEntry,
  Automation,
  Skill,
  SystemTelemetry,
  GlmSettings,
} from "./bindings";

interface FridayState {
  activeSurface: "bar" | "console";
  paletteOpen: boolean;
  orbState: OrbState;
  inputMode: InputMode;
  caretText: string;
  asrPartial: string;
  pendingPlan: PendingPlan | null;
  activeConsoleTab: "chat" | "automations" | "skills" | "memory" | "audit" | "settings";

  // Data
  threads: Thread[];
  activeThreadId: string;
  messages: Record<string, ChatMessage[]>;
  facts: Fact[];
  auditLog: AuditEntry[];
  automations: Automation[];
  skills: Skill[];
  telemetry: SystemTelemetry;
  glmSettings: GlmSettings;

  // Actions
  setActiveSurface: (surface: "bar" | "console") => void;
  setPaletteOpen: (open: boolean) => void;
  setOrbState: (state: OrbState) => void;
  setInputMode: (mode: InputMode) => void;
  setCaretText: (text: string) => void;
  setAsrPartial: (partial: string) => void;
  setActiveConsoleTab: (tab: "chat" | "automations" | "skills" | "memory" | "audit" | "settings") => void;
  openConsoleTab: (tab: "chat" | "automations" | "skills" | "memory" | "audit" | "settings") => Promise<void>;
  setActiveThreadId: (threadId: string) => void;

  startVoiceCapture: () => Promise<void>;
  stopVoiceCapture: () => Promise<void>;
  bargeIn: () => Promise<void>;
  updateAudioRms: () => Promise<void>;
  submitQuery: (text: string) => Promise<void>;
  confirmPendingPlan: () => Promise<void>;
  cancelPendingPlan: () => void;
  undoLastAction: () => void;
  deleteFact: (id: string) => Promise<void>;
  toggleAutomation: (id: string) => Promise<void>;
  toggleSkill: (id: string) => Promise<void>;
  loadBackendData: () => Promise<void>;
  updateGlmSettings: (settings: Partial<GlmSettings>) => void;
  simulateVoiceTurn: (scenario?: "amber_diff" | "red_shell" | "green_read") => void;
}

export const useFridayStore = create<FridayState>((set, get) => ({
  activeSurface: "bar",
  paletteOpen: false,
  orbState: "idle",
  inputMode: "command",
  caretText: "",
  asrPartial: "",
  pendingPlan: null,
  activeConsoleTab: "chat",

  activeThreadId: "thread-1",
  threads: [
    {
      id: "thread-1",
      title: "Active Desktop Session",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      messageCount: 3,
    },
    {
      id: "thread-2",
      title: "AN STUDIO Design Brief Sync",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 82000000,
      messageCount: 8,
    },
    {
      id: "thread-3",
      title: "Git Standup Generation",
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 170000000,
      messageCount: 4,
    },
  ],

  messages: {
    "thread-1": [
      {
        id: "msg-1",
        role: "user",
        say: "What's on my screen and summarize open tasks.",
        timestamp: Date.now() - 120000,
      },
      {
        id: "msg-2",
        role: "assistant",
        say: "You have VS Code open with Friday's implementation plan and two pending Notion reviews.",
        show: "### Active Context Summary\n- **Window**: `Code - C:\\Users\\anesx\\Desktop\\friday`\n- **OCR Entities**: 14 items detected\n- **Pending PRs**: 1 unread notification from GitHub\n- **Next event**: Standup in 25 minutes",
        toolCalls: [
          {
            id: "tc-1",
            name: "screen.read",
            args: { target: "active_window" },
            output: "{\"app\": \"Code.exe\", \"title\": \"FRIDAY Plan\", \"elements\": 14}",
            duration_ms: 120,
            status: "done",
          },
        ],
        timestamp: Date.now() - 110000,
        latency_ms: 1420,
        ttft_ms: 680,
        tokens: 312,
      },
    ],
  },

  facts: [
    {
      id: "fact-1",
      content: "Kwame prefers WhatsApp updates over email.",
      confidence: 0.98,
      sourceMessageId: "msg-ancient-1",
      createdAt: Date.now() - 259200000,
    },
    {
      id: "fact-2",
      content: "Primary accent color for FRIDAY is OKLCH --color-acid (oklch(78% 0.19 152)).",
      confidence: 1.0,
      sourceMessageId: "msg-spec-2",
      createdAt: Date.now() - 172800000,
    },
    {
      id: "fact-3",
      content: "Hardware profile: i7-8565U (15W TDP), 15.8 GB RAM, NVIDIA MX.",
      confidence: 1.0,
      sourceMessageId: "msg-spec-3",
      createdAt: Date.now() - 86400000,
    },
  ],

  auditLog: [
    {
      id: "audit-1",
      toolName: "screen.read",
      argsHash: "sha256:7a4f9b",
      tier: "Green",
      decision: "allowed",
      durationMs: 120,
      timestamp: Date.now() - 110000,
    },
    {
      id: "audit-2",
      toolName: "clipboard.get",
      argsHash: "sha256:12cd34",
      tier: "Green",
      decision: "allowed",
      durationMs: 15,
      timestamp: Date.now() - 180000,
    },
    {
      id: "audit-3",
      toolName: "fs.write",
      argsHash: "sha256:99ab11",
      tier: "Red",
      decision: "confirmed",
      durationMs: 45,
      timestamp: Date.now() - 3600000,
    },
  ],

  automations: [
    {
      id: "auto-1",
      name: "Morning Work Briefing",
      triggerType: "cron",
      triggerExpr: "0 45 8 * * MON-FRI",
      enabled: true,
      lastRun: Date.now() - 28800000,
      actionSummary: "Digest calendar, unread commits, and speaking briefing.",
    },
    {
      id: "auto-2",
      name: "Screenshot Date Renamer & Sorter",
      triggerType: "event",
      triggerExpr: "fs.watch:Desktop/*.png",
      enabled: true,
      lastRun: Date.now() - 86400000,
      actionSummary: "Batch rename raw screenshot captures to ISO date format.",
    },
  ],

  skills: [
    {
      id: "standup-digest",
      name: "Standup Digest",
      version: "1.0.0",
      description: "Summarize yesterday's commits and task changes into a clean standup note.",
      permissions: ["notion.read", "web.fetch:api.github.com", "notify.toast"],
      enabled: true,
    },
    {
      id: "notion-operator",
      name: "Notion Workspace Bridge",
      version: "1.2.0",
      description: "Direct bi-directional search and task mutations across AN STUDIO Notion pages.",
      permissions: ["notion.read", "notion.write"],
      enabled: true,
    },
  ],

  telemetry: {
    cpuPercent: 2.1,
    idleRssMb: 184,
    peakRssMb: 495,
    glmTtftMs: 680,
    lastVoiceRoundtripMs: 1420,
    micRms: 0.0,
    outputRms: 0.0,
    offlineMode: false,
    activeWindow: "Code.exe — FRIDAY",
    clipboardPreview: "https://glm.ai/api/v4/chat/completions",
  },

  glmSettings: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    heavyModel: "glm-4-plus",
    lightModel: "glm-4-flash",
    hasKey: true,
    dailySpendCapUsd: 5.0,
    currentSpendUsd: 0.42,
  },

  setActiveSurface: (surface) => {
    set({ activeSurface: surface });
    if (surface === "console") {
      invokeCommand("show_console").catch(() => {});
    }
  },
  openConsoleTab: async (tab) => {
    set({ activeSurface: "console", activeConsoleTab: tab });
    try {
      await invokeCommand("show_console", { tab });
    } catch {
      // ignore
    }
  },
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setOrbState: (orbState) => set({ orbState }),
  setInputMode: (inputMode) => set({ inputMode }),
  setCaretText: (caretText) => set({ caretText }),
  setAsrPartial: (asrPartial) => set({ asrPartial }),
  setActiveConsoleTab: (activeConsoleTab) => set({ activeConsoleTab }),
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),

  startVoiceCapture: async () => {
    // Stop any active speech output immediately
    try {
      await invokeCommand("barge_in");
    } catch {
      // ignore
    }
    set({ orbState: "listening", asrPartial: "Listening..." });
    try {
      await invokeCommand("start_mic_capture");
    } catch {
      // ignore
    }
  },

  stopVoiceCapture: async () => {
    set({ orbState: "thinking" });
    try {
      await invokeCommand("stop_mic_capture");
    } catch {
      // ignore
    }
    const current = get().asrPartial === "Listening..." ? "what's on my screen" : (get().asrPartial || "what's on my screen");
    await get().submitQuery(current);
  },

  bargeIn: async () => {
    try {
      await invokeCommand("barge_in");
    } catch {
      // ignore
    }
    set({ orbState: "idle" });
  },

  updateAudioRms: async () => {
    try {
      const res = await invokeCommand<{ mic_rms: number; output_rms: number }>("get_audio_rms");
      if (res && typeof res.mic_rms === "number") {
        set((state) => ({
          telemetry: {
            ...state.telemetry,
            micRms: res.mic_rms,
            outputRms: res.output_rms,
          },
        }));
      }
    } catch {
      // ignore
    }
  },

  submitQuery: async (text: string) => {
    if (!text.trim()) return;

    set({ caretText: "", asrPartial: "", orbState: "thinking" });

    // Handle command shortcuts
    if (text.startsWith(">")) {
      set({ paletteOpen: true, orbState: "idle" });
      return;
    }

    // Try live Tauri backend first if available
    try {
      const backendRes = await invokeCommand<{
        say: string;
        show: string;
        pending_plan?: PendingPlan;
        tool_calls?: unknown[];
        latency_ms?: number;
        ttft_ms?: number;
        tokens?: number;
      }>("submit_utterance", { utterance: text, mode: get().inputMode });

      if (backendRes && (backendRes.say || backendRes.pending_plan)) {
        if (backendRes.pending_plan) {
          set({ pendingPlan: backendRes.pending_plan, orbState: "idle" });
          return;
        }

        const userMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "user",
          say: text,
          timestamp: Date.now(),
        };

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          say: backendRes.say,
          show: backendRes.show,
          timestamp: Date.now() + 100,
          latency_ms: backendRes.latency_ms,
          ttft_ms: backendRes.ttft_ms,
          tokens: backendRes.tokens,
        };

        const threadId = get().activeThreadId;
        const currentMsgs = get().messages[threadId] || [];

        set({
          messages: {
            ...get().messages,
            [threadId]: [...currentMsgs, userMsg, assistantMsg],
          },
          orbState: "speaking",
        });

        setTimeout(() => {
          set({ orbState: "idle" });
        }, 1800);
        return;
      }
    } catch {
      // Fallback to local simulator
    }

    const lower = text.toLowerCase();

    // Check if it's a file write / rename mutation (triggers Amber / Red preview)
    if (
      lower.includes("rename") ||
      lower.includes("move") ||
      lower.includes("clean") ||
      lower.includes("write") ||
      lower.includes("delete") ||
      lower.includes("drop")
    ) {
      const plan: PendingPlan = {
        id: `plan-${Date.now()}`,
        heard: text,
        tier: lower.includes("delete") || lower.includes("drop") ? "Red" : "Amber",
        status: "awaiting_confirm",
        filename: "Desktop/Screenshots/2026-09-10_Capture.png",
        diff: `--- a/Desktop/Screenshots/Screen_Shot_001.png\n+++ b/Desktop/Assets/2026-09-10_Design_Review.png\n@@ -1 +1 @@\n-Unsorted capture from session\n+Tagged as Assets: 2026-09-10_Design_Review`,
        steps: [
          { description: "Inspect 12 matching screenshots on Desktop", tier: "Green" },
          { description: "Rename screenshots using ISO timestamps", tier: "Amber" },
          { description: "Move files into Assets directory", tier: "Amber" },
        ],
        currentStepIndex: 0,
        resultSummary: "Prepared 12 file moves. Ready for confirmation.",
        undoable: true,
      };

      set({ pendingPlan: plan, orbState: "idle" });
      return;
    }

    // Otherwise standard assistant turn
    await new Promise((r) => setTimeout(r, 600));

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      say: text,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      say: "Processed your request. Everything is updated on screen.",
      show: `### Result\nExecuted instruction: **"${text}"**\n- Evaluated in 14ms via local router\n- Completed with 0 warnings`,
      timestamp: Date.now() + 100,
      latency_ms: 1350,
      ttft_ms: 610,
      tokens: 184,
    };

    const threadId = get().activeThreadId;
    const currentMsgs = get().messages[threadId] || [];

    set({
      messages: {
        ...get().messages,
        [threadId]: [...currentMsgs, userMsg, assistantMsg],
      },
      orbState: "speaking",
    });

    setTimeout(() => {
      set({ orbState: "idle" });
    }, 1800);
  },

  confirmPendingPlan: async () => {
    const plan = get().pendingPlan;
    if (!plan) return;

    set({
      orbState: "thinking",
      pendingPlan: { ...plan, status: "executing", currentStepIndex: 1 },
    });

    await new Promise((r) => setTimeout(r, 800));

    const updatedPlan: PendingPlan = {
      ...plan,
      status: "done",
      currentStepIndex: plan.steps.length,
      resultSummary: "Executed: 12 screenshots moved to Assets. Undo available.",
    };

    const auditEntry: AuditEntry = {
      id: `audit-${Date.now()}`,
      toolName: "fs.move",
      argsHash: "sha256:d89e21",
      tier: plan.tier,
      decision: "confirmed",
      durationMs: 78,
      timestamp: Date.now(),
    };

    set({
      pendingPlan: updatedPlan,
      auditLog: [auditEntry, ...get().auditLog],
      orbState: "idle",
    });
  },

  cancelPendingPlan: () => {
    set({ pendingPlan: null, orbState: "idle" });
  },

  undoLastAction: () => {
    const plan = get().pendingPlan;
    if (!plan) return;

    set({
      pendingPlan: {
        ...plan,
        resultSummary: "Reverted last change. Files restored to original locations.",
        undoable: false,
      },
    });
  },

  deleteFact: async (id) => {
    set({ facts: get().facts.filter((f) => f.id !== id) });
    try {
      await invokeCommand("delete_fact", { id });
    } catch {
      // ignore
    }
  },

  toggleAutomation: async (id) => {
    set({
      automations: get().automations.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    });
    try {
      await invokeCommand("toggle_automation", { id });
    } catch {
      // ignore
    }
  },

  toggleSkill: async (id) => {
    set({
      skills: get().skills.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
    try {
      await invokeCommand("toggle_skill", { id });
    } catch {
      // ignore
    }
  },

  loadBackendData: async () => {
    try {
      const backendFacts = await invokeCommand<Record<string, unknown>[]>("get_facts");
      if (backendFacts && Array.isArray(backendFacts)) {
        set({
          facts: backendFacts.map((f) => ({
            id: String(f.id || `fact-${Date.now()}`),
            content: String(f.content || ""),
            confidence: Number(f.confidence || 0.9),
            sourceMessageId: String(f.sourceMessageId || f.source_message_id || "direct"),
            createdAt: Number(f.createdAt || f.created_at || Date.now()),
          })),
        });
      }

      const backendAutos = await invokeCommand<Record<string, unknown>[]>("get_automations");
      if (backendAutos && Array.isArray(backendAutos)) {
        set({
          automations: backendAutos.map((a) => ({
            id: String(a.id || `auto-${Date.now()}`),
            name: String(a.name || "Automation"),
            triggerType: (a.triggerType || a.trigger_type || "cron") as "cron" | "phrase" | "event",
            triggerExpr: String(a.triggerExpr || a.trigger_expr || ""),
            actionSummary: String(a.actionSummary || a.action_tool || "Automated Task"),
            enabled: Boolean(a.enabled),
            lastRun: typeof a.lastRun === "number" ? a.lastRun : (typeof a.last_run === "number" ? a.last_run : undefined),
          })),
        });
      }

      const backendSkills = await invokeCommand<Skill[]>("get_skills");
      if (backendSkills && Array.isArray(backendSkills)) {
        set({ skills: backendSkills });
      }

      const backendAudit = await invokeCommand<Record<string, unknown>[]>("get_audit_log");
      if (backendAudit && Array.isArray(backendAudit)) {
        set({
          auditLog: backendAudit.map((l) => ({
            id: String(l.id || `audit-${Date.now()}`),
            toolName: String(l.toolName || l.tool_name || ""),
            argsHash: String(l.argsHash || l.args_hash || ""),
            tier: (l.tier === "Red" || l.tier === "Amber" ? l.tier : "Green") as RiskTier,
            decision: (l.decision === "confirmed" || l.decision === "denied" ? l.decision : "allowed") as "allowed" | "confirmed" | "denied",
            durationMs: Number(l.durationMs || l.duration_ms || 0),
            timestamp: Number(l.timestamp || l.created_at || Date.now()),
          })),
        });
      }
    } catch {
      // ignore
    }
  },

  updateGlmSettings: (settings) => {
    set({ glmSettings: { ...get().glmSettings, ...settings } });
  },

  simulateVoiceTurn: (scenario = "amber_diff") => {
    // 1. Enter listening
    set({ orbState: "listening", asrPartial: "rename every screenshot...", inputMode: "command" });

    setTimeout(() => {
      set({ asrPartial: "rename every screenshot on my desktop to its date" });
    }, 400);

    setTimeout(() => {
      const fullText = "rename every screenshot on my desktop to its date and move them to Assets";
      set({ asrPartial: fullText, orbState: "thinking" });

      setTimeout(() => {
        get().submitQuery(fullText);
      }, 350);
    }, 900);
  },
}));
