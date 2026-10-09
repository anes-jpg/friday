/** Console · right rail — the context inspector.
 *
 * §01 S3: "you should be able to see exactly what she was given." Which facts
 * were retrieved, which were pinned, how much of the window they used, and what
 * the network looked like when she asked. If she answers wrongly, this is the
 * screen that tells you whether it was the model or the retrieval.
 */

import { AlertTriangle, Wifi, WifiOff } from "lucide-react"
import { NumberTicker } from "@/components/magic/number-ticker"
import { Progress } from "@/components/ui/progress"
import { TremorBadge } from "@/components/tremor/Badge"
import { cn, ms } from "@/lib/utils"
import { useActiveThread, useFriday } from "@/lib/store"

const CONTEXT_WINDOW = 128_000

export function Inspector() {
  const facts = useFriday((s) => s.facts)
  const connectivity = useFriday((s) => s.connectivity)
  const screenContext = useFriday((s) => s.screenContext)
  const captureActiveScreen = useFriday((s) => s.captureActiveScreen)
  const runningWindows = useFriday((s) => s.runningWindows)
  const refreshWindows = useFriday((s) => s.refreshWindows)
  const focusAppWindow = useFriday((s) => s.focusAppWindow)
  const thread = useActiveThread()

  const last = thread?.messages[thread.messages.length - 1]
  const used = last?.usage?.prompt ?? 0
  const pinned = facts.filter((f) => f.pinned)
  const recalled = facts.filter((f) => !f.pinned).slice(0, 3)
  const promptPct = Math.min(100, (used / CONTEXT_WINDOW) * 100)

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] select-none">
      <div className="flex shrink-0 items-center justify-between border-b border-black/10 dark:border-white/10 px-3 py-3">
        <span className="font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))]">Context Inspector</span>
        <TremorBadge
          variant={connectivity === "offline" ? "error" : connectivity === "slow" ? "warning" : "neutral"}
          className="text-[10px]"
        >
          {connectivity.toUpperCase()}
        </TremorBadge>
      </div>

      <div className="space-y-5 px-3 py-4">
        {/* Connectivity card */}
        <div
          className={cn(
            "flex items-start gap-2 rounded-[var(--radius-control)] border px-2.5 py-2",
            connectivity === "offline"
              ? "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/[0.05]"
              : "border-black/10 dark:border-white/10 bg-[hsl(var(--surface))]"
          )}
        >
          {connectivity === "offline" ? (
            <WifiOff className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--warning))]" />
          ) : (
            <Wifi className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--muted))]" />
          )}
          <p className="text-xs text-[hsl(var(--ink))]/80 leading-relaxed">
            {connectivity === "offline"
              ? "Offline. Local models, system, dictation and automations all still work — only cloud reasoning is suspended."
              : connectivity === "slow"
                ? "Network is slow. Latency budget exceeded."
                : "Online. Operating over low-latency neural routing."}
          </p>
        </div>

        <Block title="Context Window">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-[hsl(var(--muted))] font-instrument">Prompt Usage</span>
            <span className="tabular-nums font-instrument text-xs text-[hsl(var(--ink))]">
              <NumberTicker value={used} className="text-[hsl(var(--ink))]" /> tok
            </span>
          </div>
          <Progress value={promptPct} className="mt-1.5 h-1.5 w-full bg-black/10 dark:bg-white/10" />
          <div className="mt-1 flex items-center justify-between font-instrument text-[10px] text-[hsl(var(--muted))] tabular-nums">
            <span>of {(CONTEXT_WINDOW / 1000).toFixed(0)}k cap</span>
            <span>{last?.usage ? `TTFT ${ms(last.usage.ttft_ms)}` : `${promptPct.toFixed(1)}%`}</span>
          </div>
        </Block>

        <Block title={`Pinned Facts · ${pinned.length}`}>
          {pinned.length === 0 && <Empty>Nothing pinned to active prompt.</Empty>}
          {pinned.map((f) => (
            <FactRow key={f.id} subject={f.subject} value={f.value} confidence={f.confidence} />
          ))}
        </Block>

        <Block title={`Recalled for this Turn · ${recalled.length}`}>
          {recalled.length === 0 && <Empty>Nothing retrieved for this context.</Empty>}
          {recalled.map((f) => (
            <FactRow key={f.id} subject={f.subject} value={f.value} confidence={f.confidence} />
          ))}
        </Block>

        {/* Screen Perception Block */}
        <Block title="Visual Screen Context">
          {screenContext?.captured && screenContext.dataUrl ? (
            <div className="rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] p-2 space-y-2">
              <div className="relative rounded overflow-hidden border border-black/15 dark:border-white/15 max-h-36 bg-black">
                <img
                  src={screenContext.dataUrl}
                  alt={screenContext.title || "Active Screen"}
                  className="w-full h-auto object-cover"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-instrument bg-black/80 text-[hsl(var(--signal))]">
                  {screenContext.width}×{screenContext.height}
                </span>
              </div>
              <div className="text-[10px] font-instrument text-[hsl(var(--muted))] truncate">
                <span className="text-[hsl(var(--ink))] font-medium">{screenContext.app || "Window"}:</span>{" "}
                {screenContext.title || "Active Display"}
              </div>
              <button
                type="button"
                onClick={() => captureActiveScreen()}
                className="w-full py-1 px-2 rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 text-[10px] font-instrument text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] bg-[hsl(var(--surface-raised))] transition-colors cursor-pointer"
              >
                Refresh Frame
              </button>
            </div>
          ) : (
            <div className="rounded-[var(--radius-control)] border border-dashed border-black/15 dark:border-white/15 p-2.5 text-center space-y-2">
              <p className="text-xs text-[hsl(var(--muted))] font-instrument">No active screen captured</p>
              <button
                type="button"
                onClick={() => captureActiveScreen()}
                className="py-1 px-2.5 rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 text-[10px] font-instrument text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] bg-[hsl(var(--surface-raised))] transition-colors cursor-pointer"
              >
                Capture Active Window
              </button>
            </div>
          )}
        </Block>

        {/* Running Windows Block */}
        <Block title={`Running Applications · ${runningWindows.length}`}>
          <div className="flex items-center justify-between pb-1">
            <span className="font-instrument text-[10px] text-[hsl(var(--muted))]">Desktop Apps</span>
            <button
              type="button"
              onClick={() => refreshWindows()}
              className="font-instrument text-[10px] text-[hsl(var(--signal))] hover:underline cursor-pointer"
            >
              Scan
            </button>
          </div>
          {runningWindows.length === 0 ? (
            <Empty>Click Scan to enumerate open windows.</Empty>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {runningWindows.slice(0, 6).map((w) => (
                <div
                  key={w.hwnd}
                  onClick={() => focusAppWindow(w.title)}
                  className={`flex items-center justify-between p-1.5 rounded text-[10px] font-instrument border cursor-pointer transition-all ${
                    w.isActive
                      ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/10 text-[hsl(var(--ink))]"
                      : "border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:border-black/20"
                  }`}
                >
                  <span className="truncate max-w-[170px]">{w.title}</span>
                  <span className="text-[9px] text-[hsl(var(--muted))]">{w.processName}</span>
                </div>
              ))}
            </div>
          )}
        </Block>

        {last?.tool_calls?.some((c) => c.from_untrusted) && (
          <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/[0.05] px-2.5 py-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--warning))]" />
            <p className="text-xs text-[hsl(var(--ink))]/80 leading-relaxed">
              This turn read content from outside the machine. Everything it produced
              was fenced as data, and any tool call it suggested was escalated to an
              explicit confirmation.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 font-instrument text-[10px] text-[hsl(var(--muted))] uppercase tracking-wider">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[hsl(var(--muted))]/70 font-instrument py-1">{children}</p>
}

function FactRow({
  subject,
  value,
  confidence,
}: {
  subject: string
  value: string
  confidence: number
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] px-2.5 py-2 transition-colors hover:border-black/20 dark:hover:border-white/20">
      <div className="flex items-center justify-between gap-1">
        <p className="font-instrument text-[10px] text-[hsl(var(--muted))] truncate">{subject}</p>
        <span className="font-instrument text-[10px] text-[hsl(var(--muted))] tabular-nums">
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[hsl(var(--ink))] line-clamp-2 leading-snug">{value}</p>
      <Progress value={confidence * 100} className="mt-2 h-1 w-full bg-black/10 dark:bg-white/10" />
    </div>
  )
}
