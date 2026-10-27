import type { Automation } from "./types"
export interface SavedAutomation {
  id: string; name: string; trigger_type: string; trigger_expr: string; action_tool: string
  action_args: string; enabled: boolean; last_run: number | null; next_run: number | null; last_result: string | null
  timezone?: string
  schedule?: { kind: "once" | "daily" | "weekdays"; time: string; date: string | null } | null
}
export function automationFromSaved(saved: SavedAutomation): Automation {
  return {
    id: saved.id, name: saved.name, trigger: saved.trigger_type === "event" ? { type: "event", on: saved.trigger_expr } : { type: "cron", expr: saved.trigger_expr, tz: saved.timezone || "UTC" },
    triggerExpr: saved.trigger_expr, actionTool: saved.action_tool, actionArgs: saved.action_args,
    actionSummary: saved.action_tool === "notify.toast" ? "Send a reminder" : saved.action_tool === "system.info" ? "Check system" : saved.action_tool === "window.list" ? "List windows" : saved.action_tool,
    enabled: saved.enabled, last_run: saved.last_run == null ? undefined : new Date(saved.last_run * 1000).toISOString(),
    next_run: saved.next_run == null ? undefined : new Date(saved.next_run * 1000).toISOString(), lastResult: saved.last_result, history: [],
  }
}
