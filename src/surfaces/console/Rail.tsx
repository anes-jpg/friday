import { MessageSquareText, FolderKanban, Radar, Library, Settings2, MicOff, Mic } from "lucide-react"
import { useFriday, type ConsoleTab } from "@/lib/store"
import { cn } from "@/lib/utils"
import { ContourCore } from "@/components/orb/ContourCore"
import { groupForRoute, workspaceRoutes, type WorkspaceGroup } from "./navigation"

export type ConsoleRoute = ConsoleTab
const destinations = [
  { id: "talk", label: "Talk", icon: MessageSquareText },
  { id: "work", label: "Work", icon: FolderKanban },
  { id: "monitor", label: "Monitor", icon: Radar },
  { id: "library", label: "Library", icon: Library },
] as const

export function Rail({ active, onSelect }: { active: ConsoleRoute; onSelect: (route: ConsoleRoute) => void }) {
  const group = groupForRoute(active)
  const muted = useFriday((s) => s.micMuted)
  const chooseGroup = (next: WorkspaceGroup) => {
    const remembered = sessionStorage.getItem(`friday-route-${next}`)
    onSelect(workspaceRoutes[next].find((route) => route.id === remembered)?.id ?? workspaceRoutes[next][0].id)
  }
  return (
    <nav aria-label="FRIDAY workspaces" className="instrument-rail">
      <button type="button" className="rail-core" aria-label="Open Talk" onClick={() => chooseGroup("talk")}><ContourCore /></button>
      <div className="rail-destinations">
        {destinations.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-label={label} aria-current={group === id ? "page" : undefined} className={cn("rail-destination", group === id && "is-selected")} onClick={() => chooseGroup(id)}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="rail-utilities">
        <button type="button" aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} title={muted ? "Microphone muted" : "Mute microphone"} className="rail-destination" onClick={() => useFriday.getState().toggleMic()}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}<span>{muted ? "Muted" : "Mic"}</span>
        </button>
        <button type="button" aria-label="Settings" aria-current={group === "settings" ? "page" : undefined} className={cn("rail-destination", group === "settings" && "is-selected")} onClick={() => onSelect("settings")}><Settings2 size={19} /><span>Settings</span></button>
      </div>
    </nav>
  )
}
