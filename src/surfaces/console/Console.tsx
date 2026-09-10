import React from "react";
import { useFridayStore } from "@/lib/store";
import { ChatTab } from "./ChatTab";
import { AutomationsTab } from "./AutomationsTab";
import { SkillsTab } from "./SkillsTab";
import { MemoryTab } from "./MemoryTab";
import { AuditTab } from "./AuditTab";
import { SettingsTab } from "./SettingsTab";
import { KpiCard } from "@/components/tremor/KpiCard";
import { StatusMonitoring } from "@/components/tremor/StatusMonitoring";
import { TremorBadge } from "@/components/tremor/Badge";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import {
  MessageSquare,
  Clock,
  Sparkles,
  Brain,
  Shield,
  Settings,
  Plus,
  ArrowLeft,
  Monitor,
  Clipboard,
  Cpu,
  Zap,
  Radio,
  Activity,
} from "lucide-react";

export const Console: React.FC = () => {
  const {
    activeConsoleTab,
    setActiveConsoleTab,
    threads,
    activeThreadId,
    setActiveThreadId,
    setActiveSurface,
    telemetry,
  } = useFridayStore();

  const tabs = [
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "automations", label: "Automations", icon: <Clock className="w-4 h-4" /> },
    { id: "skills", label: "Skills", icon: <Sparkles className="w-4 h-4" /> },
    { id: "memory", label: "Memory", icon: <Brain className="w-4 h-4" /> },
    { id: "audit", label: "Audit", icon: <Shield className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="flex flex-col h-screen w-screen mica-backdrop text-[var(--color-text)] overflow-hidden select-none">
      {/* Top Windows Chrome Bar */}
      <header className="flex items-center justify-between h-10 px-4 border-b border-[var(--color-edge)] bg-[oklch(12%_0.005_265_/_0.7)]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSurface("bar")}
            className="h-6 px-2 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Switch to Bar <Kbd className="ml-1.5">Alt+Space</Kbd>
          </Button>

          <div className="h-4 w-px bg-[var(--color-edge)]" />

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-acid)]" />
            <span className="font-semibold text-xs tracking-wide">FRIDAY CONSOLE</span>
          </div>
        </div>

        {/* Top Tab Bar */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveConsoleTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-control)] text-xs transition-colors ${
                activeConsoleTab === tab.id
                  ? "bg-[var(--color-plate)] text-[var(--color-text)] font-medium border border-[var(--color-edge)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-text)] hover:bg-[var(--color-hull)]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Kill switch reminder */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-mute)]">
          <span>Panic:</span>
          <Kbd>Ctrl+Alt+Shift+F</Kbd>
        </div>
      </header>

      {/* 3-Rail Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail: Threads, Pinned, Memory */}
        <aside className="w-64 border-r border-[var(--color-edge)] bg-[oklch(14%_0.006_265_/_0.5)] flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
                Active Threads
              </span>
              <button
                onClick={() => {}}
                className="p-1 rounded hover:bg-[var(--color-plate)] text-[var(--color-mute)] hover:text-[var(--color-text)]"
                title="New Thread"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full flex flex-col text-left p-2 rounded-[var(--radius-control)] text-xs transition-colors ${
                    activeThreadId === thread.id
                      ? "bg-[var(--color-plate)] border border-[var(--color-edge)] text-[var(--color-text)]"
                      : "hover:bg-[var(--color-hull)] text-[var(--color-mute)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <span className="font-medium truncate">{thread.title}</span>
                  <span className="text-[10px] font-mono text-[var(--color-mute)] mt-0.5">
                    {thread.messageCount} messages · {new Date(thread.updatedAt).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick status footer */}
          <div className="p-3 border-t border-[var(--color-edge)] bg-[var(--color-void)] text-[10px] font-mono text-[var(--color-mute)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-[var(--color-acid)]" /> KWS Armed
            </span>
            <span>v1.0.0-dev</span>
          </div>
        </aside>

        {/* Center Main Stage */}
        <main className="flex-1 overflow-hidden bg-[oklch(12%_0.005_265_/_0.4)]">
          {activeConsoleTab === "chat" && <ChatTab />}
          {activeConsoleTab === "automations" && <AutomationsTab />}
          {activeConsoleTab === "skills" && <SkillsTab />}
          {activeConsoleTab === "memory" && <MemoryTab />}
          {activeConsoleTab === "audit" && <AuditTab />}
          {activeConsoleTab === "settings" && <SettingsTab />}
        </main>

        {/* Right Rail: Context & Telemetry Inspector */}
        <aside className="w-72 border-l border-[var(--color-edge)] bg-[oklch(14%_0.006_265_/_0.5)] p-3 space-y-4 shrink-0 overflow-y-auto">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
              Context Inspector
            </span>
            <div className="mt-2 space-y-2 text-xs">
              <div className="p-2.5 rounded bg-[var(--color-hull)] border border-[var(--color-edge)] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--color-mute)] text-[10px] font-mono">
                  <Monitor className="w-3 h-3 text-[var(--color-acid)]" /> ACTIVE WINDOW
                </div>
                <div className="font-mono text-[var(--color-text)] truncate">
                  {telemetry.activeWindow || "Visual Studio Code"}
                </div>
              </div>

              <div className="p-2.5 rounded bg-[var(--color-hull)] border border-[var(--color-edge)] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--color-mute)] text-[10px] font-mono">
                  <Clipboard className="w-3 h-3 text-[var(--color-acid)]" /> CLIPBOARD
                </div>
                <div className="font-mono text-[var(--color-mute)] text-[11px] truncate">
                  {telemetry.clipboardPreview || "(Empty)"}
                </div>
              </div>
            </div>
          </div>

          {/* Tremor-adapted KPI Metrics */}
          <div className="space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
              Hardware & Latency (§04 Spec)
            </span>

            {/* Tremor Pipeline Latency Tracker */}
            <StatusMonitoring
              stages={[
                { name: "Non-verbal Ack", measured: 142, budget: 150, status: "pass" },
                { name: "Wake Word", measured: 178, budget: 180, status: "pass" },
                { name: "Endpoint VAD", measured: 275, budget: 280, status: "pass" },
                { name: "ASR Tail", measured: 185, budget: 250, status: "pass" },
                { name: "Intent Router", measured: 12, budget: 15, status: "pass" },
                { name: "GLM TTFT", measured: 610, budget: 900, status: "pass" },
                { name: "Voice First Audio", measured: 295, budget: 600, status: "pass" },
              ]}
            />

            <div className="space-y-2">
              <KpiCard
                title="Voice Turn Roundtrip"
                metric={telemetry.lastVoiceRoundtripMs}
                unit="ms"
                subtitle="End of speech → first syllable"
                change="-180ms"
                changeType="positive"
                progressValue={Math.round((telemetry.lastVoiceRoundtripMs / 1800) * 100)}
              />

              <KpiCard
                title="GLM TTFT (Lagos Network)"
                metric={telemetry.glmTtftMs}
                unit="ms"
                subtitle="Warm TLS keep-alive connection"
                change="+12ms"
                changeType="neutral"
              />

              <KpiCard
                title="CPU Utilization"
                metric={telemetry.cpuPercent}
                unit="%"
                subtitle="i7-8565U (15W TDP limit)"
                change="Within Cap"
                changeType="positive"
                progressValue={Math.round(telemetry.cpuPercent * 10)}
              />

              <KpiCard
                title="Resident Memory"
                metric={telemetry.idleRssMb}
                unit="MB"
                subtitle="KWS + VAD armed in RAM"
                change="≤ 250MB Cap"
                changeType="positive"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
