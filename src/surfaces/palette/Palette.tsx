import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useFridayStore } from "@/lib/store";
import { Badge, RiskTier } from "@/components/ui/Badge";
import {
  Monitor,
  Clipboard,
  FileText,
  FolderOpen,
  Play,
  Search,
  Settings,
  Sparkles,
  RotateCcw,
  Zap,
  Terminal,
  Layers,
  X,
} from "lucide-react";

interface PaletteCommand {
  id: string;
  name: string;
  description: string;
  category: "Screen & Context" | "Filesystem" | "System" | "Automations" | "Agent Tools";
  tier: RiskTier;
  icon: React.ReactNode;
  action: () => void;
}

interface PaletteProps {
  docked?: boolean;
  onOpenSettings?: () => void;
}

export const Palette: React.FC<PaletteProps> = ({ docked = false, onOpenSettings }) => {
  const {
    paletteOpen,
    setPaletteOpen,
    setActiveSurface,
    setActiveConsoleTab,
    openConsoleTab,
    submitQuery,
    simulateVoiceTurn,
  } = useFridayStore();

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!paletteOpen) {
      setSearch("");
    }
  }, [paletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      } else if (e.key === "Escape" && paletteOpen) {
        e.preventDefault();
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, setPaletteOpen]);

  if (!paletteOpen) return null;

  const commands: PaletteCommand[] = [
    {
      id: "cmd-screen-read",
      name: "screen.read — Inspect Active Window & OCR",
      description: "Read the active window elements, text, and accessibility tree.",
      category: "Screen & Context",
      tier: "Green",
      icon: <Monitor className="w-4 h-4 text-[var(--color-acid)]" />,
      action: () => {
        submitQuery("Inspect active window and extract visible text");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-clipboard-get",
      name: "clipboard.get — Read Current Clipboard",
      description: "Inspect contents currently copied in the Windows clipboard.",
      category: "Screen & Context",
      tier: "Green",
      icon: <Clipboard className="w-4 h-4 text-[var(--color-acid)]" />,
      action: () => {
        submitQuery("Read what is currently in my clipboard");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-fs-rename",
      name: "fs.move — Rename & Organize Desktop Screenshots",
      description: "Batch organize raw captures with ISO dates into Assets folder.",
      category: "Filesystem",
      tier: "Amber",
      icon: <FolderOpen className="w-4 h-4 text-[var(--color-warn)]" />,
      action: () => {
        submitQuery("Rename every screenshot on my desktop to its date and move them to Assets");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-standup",
      name: "skill:standup-digest — Generate Daily Standup",
      description: "Summarize yesterday's commits and active PRs into standup page.",
      category: "Agent Tools",
      tier: "Amber",
      icon: <Sparkles className="w-4 h-4 text-[var(--color-warn)]" />,
      action: () => {
        submitQuery("What did I change yesterday, then write my standup");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-focus-block",
      name: "system.focus — Start 45-Minute Focus Block",
      description: "Mute notifications, set DND, close distraction tabs, open current plan.",
      category: "System",
      tier: "Amber",
      icon: <Zap className="w-4 h-4 text-[var(--color-warn)]" />,
      action: () => {
        submitQuery("Start a 45-minute focus block");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-shell-test",
      name: "shell.run — Execute Allowlisted Test Suite",
      description: "Run vitest/cargo nextest in sandbox and speak failure summary.",
      category: "System",
      tier: "Amber",
      icon: <Terminal className="w-4 h-4 text-[var(--color-warn)]" />,
      action: () => {
        submitQuery("Run the tests and only tell me what failed");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-voice-sim",
      name: "voice.simulate — Trigger Voice Interaction Demo",
      description: "Run a simulated end-to-end voice loop with ASR partials and directive synthesis.",
      category: "System",
      tier: "Green",
      icon: <Play className="w-4 h-4 text-[var(--color-acid)]" />,
      action: () => {
        simulateVoiceTurn();
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-console-open",
      name: "console.open — Open FRIDAY Console Surface",
      description: "Navigate to full Mica console with tabs, memory inspector, and audit log.",
      category: "System",
      tier: "Green",
      icon: <Layers className="w-4 h-4 text-[var(--color-text)]" />,
      action: () => {
        openConsoleTab("chat");
        setPaletteOpen(false);
      },
    },
    {
      id: "cmd-settings-open",
      name: "settings.open — Configure GLM & Hardware Credentials",
      description: "Update API keys, model parameters, and check system telemetry.",
      category: "System",
      tier: "Green",
      icon: <Settings className="w-4 h-4 text-[var(--color-text)]" />,
      action: () => {
        if (onOpenSettings) {
          onOpenSettings();
        } else {
          openConsoleTab("settings");
          setPaletteOpen(false);
        }
      },
    },
  ];

  const categories = Array.from(new Set(commands.map((c) => c.category)));

  const paletteContent = (
    <Command className="flex flex-col w-full text-[var(--color-text)]">
      {/* Header search */}
      <div className="flex items-center px-4 py-2.5 border-b border-[var(--color-edge)] gap-2 bg-[var(--color-plate)]">
        <Search className="w-4 h-4 text-[var(--color-mute)] shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search tools, skills, and system commands... (Esc to dismiss)"
          className="w-full bg-transparent border-none text-[var(--text-body)] text-[var(--color-text)] placeholder:text-[var(--color-mute)] focus:outline-none font-sans"
          autoFocus
        />
        <button
          onClick={() => setPaletteOpen(false)}
          className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-mute)] hover:text-[var(--color-text)] bg-[var(--color-hull)] px-1.5 py-0.5 rounded border border-[var(--color-edge)] cursor-pointer transition-colors"
          title="Dismiss Palette (Esc)"
        >
          <span>ESC</span>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* List items */}
      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-[var(--text-body)] text-[var(--color-mute)]">
          No matching commands found.
        </Command.Empty>

        {categories.map((cat) => (
          <Command.Group
            key={cat}
            heading={cat}
            className="px-2 py-1.5 text-[var(--text-micro)] font-mono uppercase tracking-wider text-[var(--color-mute)]"
          >
            {commands
              .filter((c) => c.category === cat)
              .map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={`${cmd.name} ${cmd.description}`}
                  onSelect={cmd.action}
                  className="flex items-center justify-between p-2.5 my-0.5 rounded-[var(--radius-control)] cursor-pointer select-none transition-colors hover:bg-[var(--color-plate)] aria-selected:bg-[var(--color-plate)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded bg-[var(--color-void)] border border-[var(--color-edge)]">
                      {cmd.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[var(--text-body)] font-medium text-[var(--color-text)]">
                        {cmd.name}
                      </span>
                      <span className="text-[var(--text-micro)] text-[var(--color-mute)]">
                        {cmd.description}
                      </span>
                    </div>
                  </div>
                  <Badge tier={cmd.tier} size="sm" />
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>

      {/* Footer status */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-edge)] bg-[var(--color-void)] text-[11px] text-[var(--color-mute)] font-mono">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Sub-16ms fuzzy tool registry</span>
      </div>
    </Command>
  );

  if (docked) {
    return (
      <div className="w-full border-t border-[var(--color-edge)] bg-[var(--color-hull)] overflow-hidden animate-in fade-in duration-150">
        {paletteContent}
      </div>
    );
  }

  return (
    <div
      onClick={() => setPaletteOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-edge)] bg-[var(--color-hull)] shadow-2xl"
      >
        {paletteContent}
      </div>
    </div>
  );
};
