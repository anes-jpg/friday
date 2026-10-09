import React, { useState, useRef, useEffect } from "react"
import { useFriday, useActiveThread, sendChatMessage, stopNativeVoice } from "@/lib/store"
import { ToolCallCard } from "./ToolCallCard"
import { FridayEmptyState } from "@/components/ui/empty"
import { FridayOrb } from "@/components/orb"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Mic, Paperclip, Send, Square, Bot, Sparkles, Terminal, Code2,
  Check, ShieldAlert, Layers, FileText, X, Maximize2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Message, PendingPlanBackend } from "@/lib/types"

function formatMessageTime(msg: { timestamp?: unknown; created_at?: unknown; time?: unknown }): string {
  const raw = msg.timestamp ?? msg.created_at ?? msg.time
  if (!raw) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  let d: Date
  if (typeof raw === "number") {
    d = new Date(raw > 1e11 ? raw : raw * 1000)
  } else {
    d = new Date(String(raw))
  }
  return isNaN(d.getTime())
    ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function parseMessageDisplay(msg: Message): { sayText: string; showContent: string } {
  let sayText = (msg.say || "").trim()
  let showContent = (msg.show || (msg.content && msg.content !== msg.say ? msg.content : "")).trim()

  // 1. Remove <think>...</think> tags if present
  sayText = sayText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  showContent = showContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()

  // 2. Detect unparsed JSON in showContent or sayText: e.g. {"say": ..., "show": ...}
  const rawCandidate = showContent || sayText
  if ((rawCandidate.startsWith("{") || rawCandidate.includes('"show":')) && rawCandidate.includes('"say"')) {
    try {
      const firstBrace = rawCandidate.indexOf("{")
      const lastBrace = rawCandidate.lastIndexOf("}")
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonSlice = rawCandidate.slice(firstBrace, lastBrace + 1)
        const parsed = JSON.parse(jsonSlice)
        if (parsed.say && !sayText) sayText = String(parsed.say).trim()
        if (parsed.show) showContent = String(parsed.show).trim()
      }
    } catch {
      const sayMatch = rawCandidate.match(/"say"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
      const showMatch = rawCandidate.match(/"show"\s*:\s*"([\s\S]*?)"\s*}/) || rawCandidate.match(/"show"\s*:\s*"([\s\S]*)"/)
      if (sayMatch && !sayText) sayText = sayMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"')
      if (showMatch) showContent = showMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
    }
  }

  // 3. Unescape literal \n, \t, \" if show was stringified
  showContent = showContent.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"')

  // 4. Strip stray residual JSON prefixes if showContent still starts with {"say"
  if (showContent.startsWith('{"say":') || showContent.startsWith('{"show":')) {
    const sMatch = showContent.match(/"show"\s*:\s*"([\s\S]*)"/)
    if (sMatch) {
      showContent = sMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
    }
  }

  // 5. Normalize collapsed markdown tables where rows were joined with | |
  if (showContent.includes("| |") || showContent.includes("||")) {
    showContent = showContent.replace(/\|\s*\|\s*/g, "|\n|")
  }
  // Ensure markdown tables have empty lines before them for remarkGfm parsing
  showContent = showContent.replace(/([^\n])\n(\|[^\n]+\|\n\|[-:\s|]+\|)/g, "$1\n\n$2")

  // 6. If showContent starts with or equals sayText, avoid repeating it
  const cleanSay = sayText.trim()
  if (cleanSay) {
    if (showContent === cleanSay || showContent === `### Result\n${cleanSay}`) {
      showContent = ""
    } else if (showContent.startsWith(cleanSay)) {
      showContent = showContent.slice(cleanSay.length).trim()
    } else if (showContent.toLowerCase().startsWith(cleanSay.toLowerCase())) {
      showContent = showContent.slice(cleanSay.length).trim()
    }
  }

  return { sayText, showContent }
}

interface InteractivePlanCardProps {
  plan: PendingPlanBackend
  onConfirm: (planId: string) => void
  onCancel: (planId: string) => void
}

function InteractivePlanCard({ plan, onConfirm, onCancel }: InteractivePlanCardProps) {
  const isRed = String(plan.tier).toLowerCase() === "red"

  return (
    <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] space-y-3.5">
      {/* Tier Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full ${
              isRed ? "bg-rose-500 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink))]">
            {isRed ? "Critical Confirmation Required" : "Plan Awaiting Confirmation"}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase ${
            isRed
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
          }`}
        >
          {String(plan.tier).toUpperCase()} TIER
        </span>
      </div>

      {/* Utterance heard */}
      {plan.heard && (
        <div className="text-xs text-[hsl(var(--muted))] font-mono">
          <span className="text-[hsl(var(--ink))]/50">Target: </span>
          <span className="text-[hsl(var(--ink))] font-sans italic">"{plan.heard}"</span>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-1.5 rounded-xl bg-black/20 dark:bg-black/30 border border-black/10 dark:border-white/5 p-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted))] mb-1.5 flex items-center gap-1.5">
          <Layers className="size-3" />
          <span>Execution Steps ({plan.steps.length})</span>
        </div>
        <div className="space-y-2">
          {plan.steps.map((step, idx) => {
            const stepTier = String(step.tier).toLowerCase()
            const tierDotColor =
              stepTier === "red"
                ? "bg-rose-500"
                : stepTier === "amber"
                ? "bg-amber-400"
                : "bg-emerald-400"

            return (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-xs text-[hsl(var(--ink))]"
              >
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-[hsl(var(--muted))]">
                    {idx + 1}.
                  </span>
                  <span className={`size-1.5 rounded-full ${tierDotColor}`} />
                </div>
                <div className="flex-1 font-mono text-[11px] leading-relaxed break-all">
                  {step.description}
                </div>
                {step.completed && (
                  <span className="text-[10px] text-[hsl(var(--signal))] font-mono shrink-0">
                    Done
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Diff preview if present */}
      {plan.diff && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted))] flex items-center gap-1.5">
            <FileText className="size-3" />
            <span>Diff Preview</span>
          </div>
          <pre className="max-h-36 overflow-x-auto overflow-y-auto rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-tight text-white/90 border border-white/5">
            {plan.diff}
          </pre>
        </div>
      )}

      {/* Confirmation Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-black/10 dark:border-white/10">
        <div className="text-[11px] text-[hsl(var(--muted))] font-mono">
          {isRed ? "Spoken confirmation: 'confirm'" : "Spoken confirmation: 'go ahead'"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCancel(plan.id)}
            className="h-8 px-3 rounded-lg text-xs font-mono text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] cursor-pointer"
          >
            <X className="size-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onConfirm(plan.id)}
            className={`h-8 px-3.5 rounded-lg text-xs font-mono font-medium cursor-pointer transition-colors ${
              isRed
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                : "bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm"
            }`}
          >
            {isRed ? (
              <>
                <ShieldAlert className="size-3.5 mr-1.5" />
                Confirm Action
              </>
            ) : (
              <>
                <Check className="size-3.5 mr-1.5" />
                Go Ahead
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function FridayComposer({
  value,
  onValueChange,
  onSubmit,
  onVoice,
  onStop,
  busy,
  expanded = false,
  onToggleExpanded,
}: {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onVoice: () => void
  onStop: () => void
  busy: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim() && !busy) onSubmit()
      }}
      className="rounded-[18px] border border-black/10 bg-[hsl(var(--surface-raised))] p-2 shadow-[0_12px_36px_rgba(0,0,0,.10)] dark:border-white/10"
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (value.trim() && !busy) onSubmit()
          }
          if (event.key === "Escape" && busy) onStop()
        }}
        rows={1}
        aria-label="Message FRIDAY"
        placeholder="Ask FRIDAY or speak with Alt+Shift"
        className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 text-sm text-[hsl(var(--ink))] placeholder:text-[hsl(var(--muted))]"
      />
      <div className="flex items-center justify-between border-t border-black/10 px-1 pt-2 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach file">
            <Paperclip aria-hidden className="size-4 text-[hsl(var(--muted))]" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onVoice} aria-label="Start voice input">
            <Mic aria-hidden className="size-4 text-[hsl(var(--muted))]" />
          </Button>
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              title={expanded ? "Expanded Mode: detailed breakdown with full tables" : "Concise Mode: brief, direct answer"}
              aria-label={expanded ? "Expanded mode enabled" : "Expanded mode disabled"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-colors cursor-pointer select-none ${
                expanded
                  ? "border-[hsl(var(--signal))]/50 bg-[hsl(var(--signal))]/15 text-[hsl(var(--signal))]"
                  : "border-black/10 dark:border-white/10 bg-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <Maximize2 className="size-3" />
              <span>Expanded</span>
              {expanded && <span className="size-1.5 rounded-full bg-[hsl(var(--signal))] animate-pulse" />}
            </button>
          )}
        </div>
        <Button
          type={busy ? "button" : "submit"}
          size="icon-sm"
          onClick={busy ? onStop : undefined}
          aria-label={busy ? "Stop response" : "Send message"}
          disabled={!busy && !value.trim()}
          className="rounded-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black cursor-pointer"
        >
          {busy ? <Square aria-hidden className="size-3.5 fill-current" /> : <Send aria-hidden className="size-3.5" />}
        </Button>
      </div>
    </form>
  )
}

export const ChatTab: React.FC = () => {
  const activeThread = useActiveThread()
  const partialText = useFriday((s) => s.utterance?.partial || "")
  const orbState = useFriday((s) => s.orb)
  const [inputText, setInputText] = useState("")
  const [expandedMode, setExpandedMode] = useState(false)
  const threadMessages = activeThread?.messages || []
  const busy = orbState === "thinking" || orbState === "speaking"
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [threadMessages.length, busy, partialText])

  const handleSend = () => {
    if (!inputText.trim()) return
    sendChatMessage(inputText, expandedMode)
    setInputText("")
  }

  const handleVoiceToggle = () => {
    const s = useFriday.getState()
    if (s.orb === "listening") {
      s.stopVoiceCapture?.()
      stopNativeVoice()
    } else {
      s.startVoiceCapture?.()
    }
  }

  const quickPrompts = [
    { label: "Audit repository", cmd: "Review git diff for constitution violations and unwrap" },
    { label: "Search codebase", cmd: "Search codebase for AgentCore" },
    { label: "Inspect screen", cmd: "What is on my screen right now?" },
    { label: "Check status", cmd: "Give me an operational health status report" },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[hsl(var(--surface))]">
      {/* Messages area with editorial column layout */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[760px] w-full space-y-6">
          {/* Subtle Operating Surface Header */}
          {threadMessages.length > 0 && (
            <div className="flex items-center gap-2 pb-2 border-b border-black/10 dark:border-white/[0.08] text-[11px] font-mono text-[hsl(var(--muted))] select-none">
              <FridayOrb size={12} dotSize={1.2} />
              <span className="tracking-wider uppercase font-semibold text-[hsl(var(--ink))]">OPERATING SURFACE</span>
              <span>·</span>
              <span>{threadMessages.length} {threadMessages.length === 1 ? "turn" : "turns"}</span>
            </div>
          )}
          {threadMessages.length === 0 ? (
            <FridayEmptyState
              icon={
                <div className="relative flex items-center justify-center p-3 rounded-full border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
                  <FridayOrb size={52} dotSize={1.25} className="text-[hsl(var(--signal))] drop-shadow-[0_0_24px_hsl(var(--signal)/0.6)]" />
                </div>
              }
              title="FRIDAY Operating Surface"
              description="A calm, private intelligence instrument. Press Alt+Shift to speak or type an instruction."
              actions={
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInputText(qp.cmd)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] transition-colors cursor-pointer"
                    >
                      <Sparkles className="size-3 text-[hsl(var(--signal))]" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              }
            />
          ) : (
            threadMessages.map((msg: Message) => {
              if (msg.role === "assistant") {
                const { sayText, showContent } = parseMessageDisplay(msg)
                const calls = msg.toolCalls || msg.tool_calls
                const plan = msg.pendingPlan || msg.pending_plan
                // NEVER render an empty assistant card while thinking or if blank
                if (!sayText && !showContent && (!calls || calls.length === 0) && !plan) {
                  return null
                }
              }

              return (
                <article
                  key={msg.id}
                  className={`flex flex-col space-y-1.5 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* 10px mono role/time header */}
                  <div className="flex items-center justify-between w-full font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))] select-none">
                    <div className="flex items-center gap-2">
                      {msg.role !== "user" && <FridayOrb size={13} dotSize={1.2} className="mr-0.5 shrink-0" />}
                      <span className={msg.role === "user" ? "text-[hsl(var(--ink))]" : "text-[hsl(var(--signal))]"}>
                        {msg.role === "user" ? "Operator" : "FRIDAY"}
                      </span>
                      <span>·</span>
                      <span>{formatMessageTime(msg)}</span>
                      {msg.latency_ms && (
                        <>
                          <span>·</span>
                          <span className="text-[hsl(var(--muted))]">{msg.latency_ms}ms</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Message Body */}
                  {msg.role === "user" ? (
                    <div className="max-w-[85%] rounded-[14px] bg-[hsl(var(--surface-raised))] border-l-2 border-l-[hsl(var(--signal))] border border-black/10 dark:border-white/10 px-4 py-3 text-sm leading-relaxed text-[hsl(var(--ink))] shadow-xs whitespace-pre-wrap">
                      {msg.content || msg.say}
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-raised))]/40 backdrop-blur-sm p-4 md:p-5 shadow-[0_12px_32px_-15px_rgba(0,0,0,0.5)] space-y-3.5">
                      {(() => {
                        const { sayText, showContent } = parseMessageDisplay(msg)
                        const calls = msg.toolCalls || msg.tool_calls
                        const hasCalls = Boolean(calls && calls.length > 0)

                        return (
                          <>
                            {sayText && (
                              <div className={`flex items-start gap-3 ${showContent ? "pb-3.5 border-b border-white/[0.08]" : ""}`}>
                                <div className="mt-0.5 shrink-0 p-1 rounded-full bg-[hsl(var(--signal))]/10 border border-[hsl(var(--signal))]/20 text-[hsl(var(--signal))]">
                                  <FridayOrb size={14} dotSize={1.2} />
                                </div>
                                <div className="flex-1 text-[14.5px] leading-relaxed text-[hsl(var(--ink))] font-normal tracking-[-0.005em]">
                                  {sayText}
                                </div>
                              </div>
                            )}

                            {showContent && (
                              <div className="space-y-3 text-[13.5px] leading-relaxed text-[hsl(var(--ink))]/90 font-sans">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    h1: ({ children }) => (
                                      <h1 className="mt-4 mb-2 text-[16px] font-semibold tracking-tight text-[hsl(var(--ink))] border-b border-white/[0.06] pb-1.5 flex items-center gap-2">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="mt-3.5 mb-1.5 text-[14px] font-semibold tracking-tight text-[hsl(var(--ink))]">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="mt-3 mb-1 text-[11px] font-mono uppercase tracking-[0.08em] text-[hsl(var(--signal))] font-semibold">
                                        {children}
                                      </h3>
                                    ),
                                    p: ({ children }) => (
                                      <p className="mb-2.5 text-[13px] leading-relaxed text-[hsl(var(--ink))]/90 last:mb-0">
                                        {children}
                                      </p>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="my-2.5 ml-4 list-disc space-y-1.5 text-[13px] text-[hsl(var(--ink))]/90 marker:text-[hsl(var(--signal))]">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="my-2.5 ml-4 list-decimal space-y-1.5 text-[13px] text-[hsl(var(--ink))]/90 marker:text-[hsl(var(--signal))] marker:font-mono">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="leading-relaxed pl-1">{children}</li>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-semibold text-white">{children}</strong>
                                    ),
                                    blockquote: ({ children }) => (
                                      <blockquote className="my-3 border-l-2 border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/5 px-3.5 py-2 rounded-r-lg text-[12.5px] text-[hsl(var(--muted))] italic">
                                        {children}
                                      </blockquote>
                                    ),
                                    table: ({ children }) => (
                                      <div className="my-3 w-full overflow-x-auto rounded-xl border border-white/10 bg-black/40 shadow-sm">
                                        <table className="w-full text-left text-xs border-collapse font-sans min-w-[500px]">
                                          {children}
                                        </table>
                                      </div>
                                    ),
                                    thead: ({ children }) => (
                                      <thead className="border-b border-white/10 bg-white/5 uppercase tracking-wider text-[10.5px] font-mono text-[hsl(var(--muted))]">
                                        {children}
                                      </thead>
                                    ),
                                    th: ({ children }) => (
                                      <th className="px-3.5 py-2.5 font-semibold text-[hsl(var(--ink))] whitespace-nowrap">
                                        {children}
                                      </th>
                                    ),
                                    td: ({ children }) => (
                                      <td className="px-3.5 py-2 border-t border-white/5 text-[hsl(var(--ink))]/90 whitespace-normal leading-relaxed text-[12px]">
                                        {children}
                                      </td>
                                    ),
                                    tr: ({ children }) => (
                                      <tr className="hover:bg-white/[0.03] transition-colors even:bg-white/[0.015]">
                                        {children}
                                      </tr>
                                    ),
                                    code: ({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
                                      if (inline) {
                                        return (
                                          <code className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-white/10 text-[hsl(var(--signal))] border border-white/5" {...props}>
                                            {children}
                                          </code>
                                        )
                                      }
                                      return (
                                        <div className="my-3 rounded-xl border border-white/10 bg-black/50 p-3.5 overflow-x-auto font-mono text-xs shadow-inner">
                                          <code className={className} {...props}>{children}</code>
                                        </div>
                                      )
                                    },
                                    hr: () => <hr className="my-3.5 border-t border-white/[0.08]" />,
                                  }}
                                >
                                  {showContent}
                                </ReactMarkdown>
                              </div>
                            )}

                            {/* Tool lifecycle cards */}
                            {hasCalls && (
                              <div className="mt-2 space-y-2">
                                {calls!.map((tc) => (
                                  <ToolCallCard key={tc.id} call={tc} />
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()}

                    {/* Interactive Plan Confirmation Card */}
                    {(() => {
                      const plan = msg.pendingPlan || msg.pending_plan
                      if (!plan) return null
                      return (
                        <InteractivePlanCard
                          plan={plan}
                          onConfirm={(planId) => {
                            useFriday.getState().confirmPendingPlan?.(planId)
                          }}
                          onCancel={(planId) => {
                            useFriday.getState().cancelPendingPlan?.(planId)
                          }}
                        />
                      )
                    })()}
                  </div>
                )}
              </article>
            )})
          )}

          {/* Live Hearing/Transcription Banner with Animated Waiting Orb */}
          {(orbState === "listening" || partialText.length > 0) && (
            <div className="rounded-[14px] border border-[hsl(var(--signal))]/40 bg-[hsl(var(--surface-raised))] p-3 flex items-center justify-between text-xs font-mono shadow-xs">
              <div className="flex items-center gap-2.5 text-[hsl(var(--signal))] min-w-0">
                <FridayOrb size={22} state="waiting" dotSize={1.25} />
                <span className="font-semibold uppercase tracking-wider shrink-0 text-[11px]">HEARING:</span>
                <span className="text-[hsl(var(--ink))] truncate font-sans italic">
                  "{partialText || "Listening for command..."}"
                </span>
              </div>
              {partialText && (
                <button
                  type="button"
                  onClick={() => {
                    sendChatMessage(partialText)
                    useFriday.getState().setPartial("")
                    useFriday.getState().setOrb("thinking")
                  }}
                  className="px-2.5 py-1 rounded bg-[hsl(var(--signal))]/15 hover:bg-[hsl(var(--signal))]/25 text-[hsl(var(--signal))] border border-[hsl(var(--signal))]/30 text-[10px] font-mono cursor-pointer shrink-0 ml-2"
                >
                  Execute
                </button>
              )}
            </div>
          )}

          {/* Live Reasoning/Thinking Banner with Animated Twins Orb */}
          {busy && (
            <div className="rounded-[14px] border border-[hsl(var(--signal))]/40 bg-[hsl(var(--surface-raised))] p-3.5 flex items-center gap-3 text-xs font-mono shadow-xs">
              <FridayOrb size={26} state="reasoning" variant="twins" dotSize={1.25} />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider text-[hsl(var(--signal))] text-[11px]">
                    FRIDAY REASONING
                  </span>
                  <span className="size-1 rounded-full bg-[hsl(var(--signal))] animate-pulse" />
                </div>
                <span className="text-[hsl(var(--muted))] text-[11px] font-sans truncate">
                  Evaluating intent, checking tools, and streaming neural response…
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer fixed at bottom with breathing room */}
      <div className="p-4 border-t border-black/10 dark:border-white/10 bg-[hsl(var(--surface))]">
        <div className="mx-auto max-w-[760px] w-full">
          <FridayComposer
            value={inputText}
            onValueChange={setInputText}
            onSubmit={handleSend}
            onVoice={handleVoiceToggle}
            onStop={() => {
              stopNativeVoice()
            }}
            busy={busy}
            expanded={expandedMode}
            onToggleExpanded={() => setExpandedMode((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  )
}

export default ChatTab
