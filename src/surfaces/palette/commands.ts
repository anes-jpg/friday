/** §01 S2 — the command palette's catalogue.
 *
 * Static verbs come from §06's tool registry; the rest is derived from live
 * state (threads, skills, automations, remembered facts), which is how a real
 * palette gets large. The seed yields 82 entries — §12's gate is "sub-16ms
 * filtering on 500 commands", and a user with a year of threads and facts
 * behind them reaches that through the derived half alone. The benchmark grows
 * the store to 500 rather than padding this list with verbs nobody would
 * invoke; see bench/palette-filter.bench.ts.
 */

import type { RiskTier } from "@/lib/types"
import { useFriday } from "@/lib/store"
import { invokeCommand } from "@/lib/ipc"

export interface Command {
  id: string
  label: string
  group: string
  /** Extra text cmdk matches against but never renders. */
  keywords?: string
  tier?: RiskTier
  shortcut?: string
  run: () => void
}

/** The fixed verbs. Everything here maps to something in §06's catalogue. */
function staticCommands(): Command[] {
  const s = useFriday.getState()
  return [
    /* windows */
    {
      id: "c-console",
      label: "Open Console",
      group: "FRIDAY",
      shortcut: "Alt+Shift+Space",
      run: () => {
        s.setTab("chat")
        invokeCommand("show_console").catch(() => {})
      },
    },
    { id: "c-settings", label: "Settings", group: "FRIDAY", keywords: "preferences options", run: () => { s.setTab("settings") } },
    { id: "c-onboarding", label: "Show Onboarding", group: "FRIDAY", keywords: "welcome setup tour intro video", run: () => window.dispatchEvent(new CustomEvent("friday:open-onboarding")) },
    { id: "c-audit", label: "Open audit log", group: "FRIDAY", keywords: "history security", run: () => { s.setTab("audit") } },
    { id: "c-memory", label: "Open memory", group: "FRIDAY", keywords: "facts recall", run: () => { s.setTab("memory") } },
    { id: "c-mute", label: s.micMuted ? "Unmute microphone" : "Mute microphone", group: "FRIDAY", keywords: "mic audio", run: () => s.toggleMic() },
    { id: "c-dictate", label: "Start dictation", group: "FRIDAY", shortcut: "Alt+Shift+D", keywords: "type transcribe", run: () => s.setMode("dictation") },
    { id: "c-stop", label: "Stop everything", group: "FRIDAY", shortcut: "Ctrl+Alt+Shift+F", keywords: "kill panic halt", tier: "red", run: () => s.killSwitch() },

    /* files — §06 fs.* */
    { id: "c-fs-find", label: "Find a file", group: "Files", tier: "green", keywords: "search locate", run: () => s.submitQuery("Find a file in the workspace") },
    { id: "c-fs-recent", label: "Recent files", group: "Files", tier: "green", run: () => s.submitQuery("List recent files in workspace") },
    { id: "c-fs-rename", label: "Batch rename in a folder", group: "Files", tier: "amber", run: () => s.submitQuery("Batch rename screenshot files to ISO date format") },
    { id: "c-fs-organise", label: "Organise Downloads by type", group: "Files", tier: "amber", run: () => s.submitQuery("Organize Downloads directory by file type") },
    { id: "c-fs-archive", label: "Archive files older than 30 days", group: "Files", tier: "amber", run: () => s.submitQuery("Archive files older than 30 days") },
    { id: "c-fs-delete", label: "Delete a folder", group: "Files", tier: "red", run: () => s.submitQuery("Delete folder") },

    /* system — §06 sys.* */
    { id: "c-sys-proc", label: "What's using the CPU", group: "System", tier: "green", keywords: "processes fan slow", run: () => s.submitQuery("What processes are using the CPU?") },
    { id: "c-sys-disk", label: "Disk space", group: "System", tier: "green", run: () => s.submitQuery("Check available disk space") },
    { id: "c-sys-vol", label: "Set volume", group: "System", tier: "green", run: () => s.submitQuery("Set master volume to 50%") },
    { id: "c-sys-kill", label: "End a process", group: "System", tier: "red", run: () => s.submitQuery("End high-resource process") },
    { id: "c-sys-sleep", label: "Sleep the machine", group: "System", tier: "amber", run: () => s.submitQuery("Put computer to sleep") },

    /* shell — §06 shell.run, argv array only, never string interpolation */
    { id: "c-sh-build", label: "Run build", group: "Shell", tier: "red", keywords: "pnpm compile", run: () => s.submitQuery("Run project build check") },
    { id: "c-sh-test", label: "Run tests", group: "Shell", tier: "red", run: () => s.submitQuery("Run test suite") },
    { id: "c-sh-status", label: "Git status", group: "Shell", tier: "green", run: () => s.submitQuery("Run git status") },
    { id: "c-sh-diff", label: "Git diff", group: "Shell", tier: "green", run: () => s.submitQuery("Review git diff and unwrap calls") },
    { id: "c-sh-push", label: "Git push", group: "Shell", tier: "red", run: () => s.submitQuery("Git push current branch") },

    /* mail + calendar */
    { id: "c-mail-unread", label: "What's unread", group: "Mail", tier: "green", run: () => s.submitQuery("Check unread messages and emails") },
    { id: "c-mail-draft", label: "Draft a reply", group: "Mail", tier: "amber", run: () => s.submitQuery("Draft a reply") },
    { id: "c-mail-send", label: "Send a message", group: "Mail", tier: "red", run: () => s.submitQuery("Send message") },
    { id: "c-cal-today", label: "What's on today", group: "Calendar", tier: "green", run: () => s.submitQuery("What is on my calendar today?") },
    { id: "c-cal-next", label: "Next meeting", group: "Calendar", tier: "green", run: () => s.submitQuery("When is my next meeting?") },
    { id: "c-cal-book", label: "Book a meeting", group: "Calendar", tier: "amber", run: () => s.submitQuery("Book a calendar meeting") },

    /* web + clipboard */
    { id: "c-web-search", label: "Search the web", group: "Web", tier: "green", run: () => s.submitQuery("Search web for documentation") },
    { id: "c-web-open", label: "Open a URL", group: "Web", tier: "green", run: () => s.submitQuery("Open browser URL") },
    { id: "c-web-summarise", label: "Summarise the page in my clipboard", group: "Web", tier: "green", run: () => s.submitQuery("Summarize the URL or page in my clipboard") },
    { id: "c-clip-read", label: "Read my clipboard", group: "Clipboard", tier: "green", run: () => s.submitQuery("What is currently on my clipboard?") },
    { id: "c-clip-fix", label: "Fix the grammar in my clipboard", group: "Clipboard", tier: "green", run: () => s.submitQuery("Fix the spelling and grammar in my clipboard text") },

    /* automations */
    { id: "c-auto-new", label: "Create an automation", group: "Automations", run: () => s.setTab("automations") },
    { id: "c-auto-pause", label: "Pause all automations", group: "Automations", tier: "amber", run: () => s.submitQuery("Pause all scheduled automations") },
  ]
}

/** Derived entries — the part that actually scales. */
function derivedCommands(): Command[] {
  const s = useFriday.getState()
  const out: Command[] = []

  for (const t of s.threads) {
    out.push({
      id: `thr-${t.id}`,
      label: t.title,
      group: "Threads",
      keywords: "conversation open thread",
      run: () => {
        s.setActiveThread(t.id)
        s.setTab("chat")
      },
    })
  }

  for (const k of s.skills) {
    out.push({
      id: `sk-${k.id}`,
      label: `${k.name} — ${k.enabled ? "disable" : "enable"}`,
      group: "Skills",
      keywords: k.triggers.join(" "),
      run: () => s.toggleSkill(k.id),
    })
    for (const trig of k.triggers) {
      out.push({
        id: `sk-${k.id}-${trig}`,
        label: `${k.name}: ${trig}`,
        group: "Skills",
        keywords: k.description,
        tier: "green",
        run: () => s.submitQuery(trig),
      })
    }
  }

  for (const a of s.automations) {
    out.push({
      id: `au-${a.id}`,
      label: `${a.name} — ${a.enabled ? "disable" : "enable"}`,
      group: "Automations",
      keywords: a.trigger.type === "cron" ? a.trigger.expr : a.trigger.on,
      run: () => s.toggleAutomation(a.id),
    })
    out.push({
      id: `au-run-${a.id}`,
      label: `Run "${a.name}" now`,
      group: "Automations",
      tier: "amber",
      run: () => s.runAutomationNow(a.id),
    })
  }

  for (const f of s.facts) {
    out.push({
      id: `f-${f.id}`,
      label: `Forget: ${f.subject}`,
      group: "Memory",
      keywords: f.value,
      tier: "amber",
      run: () => s.deleteFact(f.id),
    })
  }

  return out
}

export function allCommands(): Command[] {
  return [...staticCommands(), ...derivedCommands()]
}
