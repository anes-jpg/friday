import type { ConsoleTab } from "@/lib/store"
export type WorkspaceGroup = "talk" | "work" | "monitor" | "library" | "settings"
export const workspaceRoutes: Record<WorkspaceGroup, { id: ConsoleTab; label: string }[]> = {
  talk: [{ id: "chat", label: "Conversation" }],
  work: [{ id: "projects", label: "Projects" }, { id: "automations", label: "Automations" }, { id: "browser", label: "Browser" }, { id: "beast", label: "Code search" }, { id: "review", label: "Review" }, { id: "delphi", label: "Utilities" }],
  monitor: [{ id: "map", label: "Map" }, { id: "cameras", label: "Cameras" }, { id: "recordings", label: "Recordings" }, { id: "alerts", label: "Activity" }],
  library: [{ id: "memory", label: "Memory" }, { id: "skills", label: "Skills" }, { id: "audit", label: "Audit" }],
  settings: [{ id: "settings", label: "Settings" }],
}
export function groupForRoute(tab: ConsoleTab): WorkspaceGroup {
  for (const group of Object.keys(workspaceRoutes) as WorkspaceGroup[]) {
    if (workspaceRoutes[group].some((route) => route.id === tab)) return group
  }
  return tab === "hud" ? "monitor" : tab === "models" ? "settings" : "talk"
}
