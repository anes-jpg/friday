import { Mic, Send, Square, Volume2, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VoiceUiState } from "@/lib/types"
import { FridayOrb } from "@/components/orb"

const copy = {
  idle: "Ask FRIDAY",
  arming: "Opening microphone…",
  listening: "Listening",
  endpointing: "Got it",
  thinking: "Thinking",
  tool: "Working",
  confirmation: "Confirmation required",
  speaking: "Speaking",
  interrupted: "Stopped",
  offline: "Offline",
  error: "Something went wrong",
} as const

function primaryText(state: VoiceUiState) {
  if (state.kind === "listening") return state.partial || copy.listening
  if (state.kind === "endpointing" || state.kind === "thinking") return state.transcript
  if (state.kind === "tool") return state.target ? `${state.name} · ${state.target}` : state.name
  if (state.kind === "confirmation") return state.title
  if (state.kind === "speaking") return state.text
  if (state.kind === "offline") return state.reason
  if (state.kind === "error") return state.message
  return copy[state.kind]
}

export function VoiceBar({
  state,
  onStart,
  onStop,
  onOpenConsole,
}: {
  state: VoiceUiState
  onStart: () => void
  onStop: () => void
  onOpenConsole: () => void
}) {
  const active = !["idle", "interrupted", "offline", "error"].includes(state.kind)
  const canStop = ["arming", "listening", "endpointing", "thinking", "tool", "speaking"].includes(state.kind)
  const rms = state.kind === "listening" || state.kind === "speaking" ? state.rms : 0

  return (
    <section
      aria-label="FRIDAY voice assistant"
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-black px-3 py-2 text-white",
        "shadow-[0_18px_55px_rgba(0,0,0,.24)] select-none",
        state.kind === "confirmation" && "items-start py-3",
      )}
    >
      <button
        type="button"
        onClick={active ? onStop : onStart}
        aria-label={active ? "Stop FRIDAY" : "Talk to FRIDAY"}
        className="relative grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.06] focus-visible:ring-2 focus-visible:ring-white transition-colors hover:bg-white/10"
      >
        {active ? (
          <FridayOrb
            size={24}
            dotSize={1.2}
            state={
              state.kind === "thinking"
                ? "reasoning"
                : state.kind === "speaking"
                ? "working"
                : state.kind === "tool"
                ? "working"
                : "waiting"
            }
          />
        ) : (
          <>
            <span
              aria-hidden
              className="absolute size-3 rounded-full bg-[hsl(var(--signal))] transition-transform duration-100 motion-reduce:transition-none"
              style={{ transform: `scale(${1 + Math.min(1, rms) * 0.65})` }}
            />
            {state.kind === "offline" ? (
              <WifiOff className="relative size-4" />
            ) : (
              <Mic className="relative size-4 mix-blend-difference" />
            )}
          </>
        )}
      </button>

      <button type="button" onClick={onOpenConsole} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-md px-1">
        <span className="font-instrument block text-[9px] uppercase tracking-[.11em] text-white/45">
          {copy[state.kind]}
        </span>
        <span className="block truncate text-sm text-white/90">{primaryText(state)}</span>
      </button>

      {state.kind === "thinking" && (
        <span className="font-instrument text-[10px] text-white/45">{(state.elapsedMs / 1000).toFixed(1)}s</span>
      )}

      <button
        type="button"
        onClick={canStop ? onStop : onStart}
        aria-label={canStop ? "Stop" : "Start listening"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-black hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal))] transition-all active:scale-95"
      >
        {canStop ? (
          <Square aria-hidden className="size-3.5 fill-current" />
        ) : state.kind === "speaking" ? (
          <Volume2 aria-hidden className="size-4" />
        ) : (
          <Send aria-hidden className="size-4" />
        )}
      </button>
    </section>
  )
}
