import type { ComponentType } from "react"
import {
  Bot, BookOpen, BrainCircuit, Chrome, FileCheck2, KeyRound,
  MessageSquareText, ScrollText, Settings2, Sparkles, TimerReset,
  Search, Terminal, FolderKanban,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { FridayOrb } from "@/components/orb"

export type ConsoleRoute =
  | "chat" | "browser" | "automations" | "memory" | "review"
  | "skills" | "audit" | "settings" | "beast" | "delphi" | "projects"

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>

type RailItem = {
  id: ConsoleRoute
  label: string
  shortcut?: string
  icon: Icon
}

const primaryItems: RailItem[] = [
  { id: "chat", label: "Chat", shortcut: "1", icon: MessageSquareText },
  { id: "projects", label: "Project Mode", shortcut: "P", icon: FolderKanban },
  { id: "browser", label: "Browser", shortcut: "2", icon: Chrome },
  { id: "automations", label: "Automations", shortcut: "3", icon: TimerReset },
  { id: "memory", label: "Memory", shortcut: "4", icon: BrainCircuit },
  { id: "review", label: "Review", shortcut: "5", icon: FileCheck2 },
  { id: "skills", label: "Skills", shortcut: "6", icon: Sparkles },
  { id: "beast", label: "Beast Code", shortcut: "B", icon: Search },
  { id: "delphi", label: "Delphi Tools", shortcut: "D", icon: Terminal },
  { id: "audit", label: "Audit Log", shortcut: "7", icon: ScrollText },
  { id: "settings", label: "Settings", shortcut: ",", icon: Settings2 },
]

function RailButton({
  item,
  active,
  onSelect,
}: {
  item: RailItem
  active: boolean
  onSelect: (route: ConsoleRoute) => void
}) {
  const Icon = item.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onClick={() => onSelect(item.id)}
          className={cn(
            "grid size-10 place-items-center rounded-full text-white/70",
            "transition-[background-color,color,transform] duration-150",
            "hover:bg-white/10 hover:text-white active:scale-[.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            active && "bg-[hsl(var(--surface))] text-black hover:bg-[hsl(var(--surface))] hover:text-black",
          )}
        >
          <Icon aria-hidden className="size-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="flex items-center gap-3">
        <span>{item.label}</span>
        {item.shortcut && <kbd className="font-instrument text-[10px] opacity-55">{item.shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Rail({
  active,
  onSelect,
  healthy = true,
  onOpenVoice,
  onOpenDocs,
}: {
  active: ConsoleRoute
  onSelect: (route: ConsoleRoute) => void
  healthy?: boolean
  onOpenVoice?: () => void
  onOpenDocs?: () => void
}) {
  return (
    <TooltipProvider delayDuration={450}>
      <nav
        aria-label="FRIDAY console"
        className="flex h-full w-16 shrink-0 flex-col items-center bg-black px-3 py-3 text-white select-none z-20"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Open FRIDAY voice bar"
              onClick={onOpenVoice}
              className="mb-4 grid size-11 place-items-center rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal))]"
            >
              <FridayOrb size={28} dotSize={1.2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <span>FRIDAY Voice Bar</span>
          </TooltipContent>
        </Tooltip>

        <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar py-1">
          {primaryItems.map((item) => (
            <RailButton
              key={item.id}
              item={item}
              active={active === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenDocs}
                aria-label="Documentation"
                className="grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <BookOpen aria-hidden className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <span>Documentation</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                role="status"
                aria-label={healthy ? "System healthy" : "System degraded"}
                className="relative grid size-10 place-items-center rounded-full border border-white/15 cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <KeyRound aria-hidden className="size-[18px] text-white/75" />
                <span
                  className={cn(
                    "absolute right-1 top-1 size-2 rounded-full ring-2 ring-black",
                    healthy ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <span>{healthy ? "System Online · Local Models Ready" : "System Degraded · Offline Mode"}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
}
