import React, { useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useFridayStore } from "@/lib/store";
import { useFriday } from "@/lib/store";
import { useProjects } from "@/lib/projects";
import { useSavedPlaces } from "@/lib/saved-places";

export type PaletteAction = {
  id: string;
  label: string;
  group: "Actions" | "Navigation" | "Recent" | "Settings" | "Projects" | "Tasks & notes" | "Saved places" | "Conversations";
  shortcut?: string;
  run: () => void;
};

export interface PaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions?: PaletteAction[];
  docked?: boolean;
  onOpenSettings?: () => void;
}

export function Palette({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  actions: customActions,
  onOpenSettings,
}: PaletteProps) {
  const {
    paletteOpen,
    setPaletteOpen,
    openConsoleTab,
    submitQuery,
    simulateVoiceTurn,
    startVoiceCapture,
    stopVoiceCapture,
    bargeIn,
    mode: inputMode,
    setInputMode,
    orb: orbState,
  } = useFridayStore();

  const isOpen = controlledOpen !== undefined ? controlledOpen : paletteOpen;
  const projects = useProjects(state => state.projects);
  const workspaceItems = useProjects(state => state.items);
  const savedPlaces = useSavedPlaces(state => state.places);
  const threads = useFriday(state => state.threads);
  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    } else {
      setPaletteOpen(nextOpen);
    }
  };

  const defaultActions: PaletteAction[] = useMemo(() => [
    // --- ACTIONS ---
    {
      id: "cmd-screen-read",
      label: "screen.read — Inspect Active Window & OCR",
      group: "Actions",
      run: () => submitQuery("Inspect active window and extract visible text"),
    },
    {
      id: "cmd-clipboard-get",
      label: "clipboard.get — Read Current Clipboard",
      group: "Actions",
      run: () => submitQuery("Read what is currently in my clipboard"),
    },
    {
      id: "cmd-voice-toggle",
      label: orbState === "listening" ? "voice.stop — Stop Microphone" : "voice.start — Start Microphone",
      group: "Actions",
      shortcut: "Alt+Shift",
      run: () => {
        if (orbState === "listening") {
          stopVoiceCapture();
        } else {
          startVoiceCapture();
        }
      },
    },
    {
      id: "cmd-barge-in",
      label: "voice.stop — Barge-In / Interrupt Speech & Action",
      group: "Actions",
      shortcut: "Esc",
      run: () => bargeIn(),
    },
    {
      id: "cmd-dictation",
      label: `voice.mode — Switch to ${inputMode === "dictation" ? "Command" : "Dictation"} Mode`,
      group: "Actions",
      shortcut: "Alt+Shift+D",
      run: () => setInputMode(inputMode === "dictation" ? "command" : "dictation"),
    },
    {
      id: "cmd-project-mode",
      label: `project.mode — Switch to ${inputMode === "project" ? "Command" : "Project"} Mode`,
      group: "Actions",
      shortcut: "Alt+Shift+P",
      run: () => {
        const nextMode = inputMode === "project" ? "command" : "project";
        setInputMode(nextMode);
        if (nextMode === "project") {
          openConsoleTab("projects");
        }
      },
    },
    {
      id: "cmd-fs-rename",
      label: "fs.move — Rename & Organize Desktop Screenshots",
      group: "Actions",
      run: () => submitQuery("Rename every screenshot on my desktop to its date and move them to Assets"),
    },
    {
      id: "cmd-standup",
      label: "skill:standup-digest — Generate Daily Standup",
      group: "Actions",
      run: () => submitQuery("What did I change yesterday, then write my standup"),
    },
    {
      id: "cmd-focus-block",
      label: "system.focus — Start 45-Minute Focus Block",
      group: "Actions",
      run: () => submitQuery("Start a 45-minute focus block"),
    },
    {
      id: "cmd-shell-test",
      label: "shell.run — Execute Allowlisted Test Suite",
      group: "Actions",
      run: () => submitQuery("Run the tests and only tell me what failed"),
    },
    {
      id: "cmd-voice-sim",
      label: "voice.simulate — Trigger Voice Interaction Demo",
      group: "Actions",
      run: () => simulateVoiceTurn(),
    },

    // --- NAVIGATION ---
    {
      id: "nav-chat",
      label: "Go to Chat / Operator",
      group: "Navigation",
      shortcut: "1",
      run: () => openConsoleTab("chat"),
    },
    {
      id: "nav-automations",
      label: "Go to Automations",
      group: "Navigation",
      shortcut: "2",
      run: () => openConsoleTab("automations"),
    },
    {
      id: "nav-memory",
      label: "Go to Memory Graph",
      group: "Navigation",
      shortcut: "3",
      run: () => openConsoleTab("memory"),
    },
    {
      id: "nav-review",
      label: "Go to Code Review & Diffs",
      group: "Navigation",
      shortcut: "4",
      run: () => openConsoleTab("review"),
    },
    {
      id: "nav-skills",
      label: "Go to Installed Skills",
      group: "Navigation",
      shortcut: "5",
      run: () => openConsoleTab("skills"),
    },
    {
      id: "nav-audit",
      label: "Go to Security Audit Log",
      group: "Navigation",
      shortcut: "6",
      run: () => openConsoleTab("audit"),
    },
    {
      id: "nav-settings",
      label: "Go to System Settings",
      group: "Navigation",
      shortcut: "7",
      run: () => (onOpenSettings ? onOpenSettings() : openConsoleTab("settings")),
    },
    {
      id: "nav-browser",
      label: "Go to Browser Operator",
      group: "Navigation",
      shortcut: "8",
      run: () => openConsoleTab("browser"),
    },
    {
      id: "nav-beast",
      label: "Go to Beast (Code Intelligence & Search)",
      group: "Navigation",
      shortcut: "9",
      run: () => openConsoleTab("beast"),
    },
    {
      id: "nav-delphi",
      label: "Go to Delphi (Developer Workbench)",
      group: "Navigation",
      run: () => openConsoleTab("delphi"),
    },

    // --- RECENT ---
    {
      id: "recent-test",
      label: "Run test harness and check diagnostics",
      group: "Recent",
      run: () => submitQuery("Run cargo check and test suite"),
    },
    {
      id: "recent-git",
      label: "Inspect repository git status",
      group: "Recent",
      run: () => submitQuery("Show modified files and git status"),
    },

    // --- SETTINGS ---
    {
      id: "set-models",
      label: "Configure AI Model Providers & Keys",
      group: "Settings",
      run: () => openConsoleTab("settings"),
    },
    {
      id: "set-voice",
      label: "Configure Microphone, VAD & Wake Word",
      group: "Settings",
      run: () => openConsoleTab("settings"),
    },
    {
      id: "set-audition",
      label: "Audition Voice Profiles (Jessica / Glados / Onyx)",
      group: "Settings",
      run: () => openConsoleTab("settings"),
    },
  ], [
    orbState,
    inputMode,
    stopVoiceCapture,
    startVoiceCapture,
    bargeIn,
    setInputMode,
    submitQuery,
    simulateVoiceTurn,
    openConsoleTab,
    onOpenSettings,
  ]);

  const openWork = (projectId: string, view: string, itemId?: string) => {
    useProjects.getState().select(projectId);
    openConsoleTab("projects");
    window.dispatchEvent(new CustomEvent("friday:open-work-record", { detail: { projectId, view, itemId } }));
  };
  const recordActions: PaletteAction[] = [
    ...projects.map(project => ({ id: `project-${project.id}`, label: project.name, group: "Projects" as const, run: () => openWork(project.id, "overview") })),
    ...workspaceItems.filter(item => ["task", "note"].includes(item.type)).map(item => ({ id: `item-${item.id}`, label: `${item.title} · ${projects.find(project => project.id === item.projectId)?.name || "Project"}`, group: "Tasks & notes" as const, run: () => openWork(item.projectId, item.type === "note" ? "notes" : "tasks", item.id) })),
    ...savedPlaces.map(place => ({ id: `place-${place.id}`, label: place.name, group: "Saved places" as const, run: () => { openConsoleTab("map"); window.dispatchEvent(new CustomEvent("friday:select-place", { detail: place })); sessionStorage.setItem("friday-open-place", JSON.stringify(place)); } })),
    ...threads.map(thread => ({ id: `thread-${thread.id}`, label: thread.title, group: "Conversations" as const, run: () => { useFriday.getState().setActiveThread(thread.id); openConsoleTab("chat"); } })),
  ];
  const effectiveActions = customActions || [...defaultActions, ...recordActions];
  const groups = ["Projects", "Tasks & notes", "Saved places", "Conversations", "Actions", "Navigation", "Recent", "Settings"] as const;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="FRIDAY command palette"
      description="Search actions and destinations"
      className="top-[18%] translate-y-0 overflow-hidden rounded-[18px] border-black/15 p-0 sm:max-w-[680px] dark:border-white/15"
    >
      <div className="bg-black text-white">
        <CommandInput
          placeholder="Type a command or destination…"
          className="text-white placeholder:text-white/40 font-instrument"
        />
      </div>
      <CommandList className="max-h-[420px] bg-[hsl(var(--surface-raised))] p-2 font-instrument">
        <CommandEmpty className="py-6 text-center text-xs text-[hsl(var(--muted))]">
          No matching command.
        </CommandEmpty>
        {groups.map((group, index) => {
          const items = effectiveActions.filter((action) => action.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              {index > 0 && <CommandSeparator className="my-1 border-[hsl(var(--line))]" />}
              <CommandGroup heading={group} className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted))] font-medium">
                {items.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={`${group} ${action.label}`}
                    onSelect={() => {
                      action.run();
                      handleOpenChange(false);
                    }}
                    className="min-h-10 rounded-[10px] data-[selected=true]:bg-black data-[selected=true]:text-white dark:data-[selected=true]:bg-white dark:data-[selected=true]:text-black text-xs cursor-pointer transition-colors px-3 py-2 flex items-center justify-between"
                  >
                    <span className="truncate">{action.label}</span>
                    {action.shortcut && (
                      <CommandShortcut className="font-instrument text-[10px] text-[hsl(var(--muted))] ml-2 shrink-0">
                        {action.shortcut}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

export default Palette;
