import React, { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronRight,
  Square,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ProjectScript, ProjectCommandResult } from "@/lib/types"
import { executeProjectCommand, detectProjectScripts } from "@/lib/workflow"

interface InAppTerminalProps {
  projectPath: string
  projectName: string
}

interface LogEntry {
  id: string
  command: string
  timestamp: string
  result?: ProjectCommandResult
  isRunning?: boolean
}

export const InAppTerminal: React.FC<InAppTerminalProps> = ({
  projectPath,
  projectName,
}) => {
  const [scripts, setScripts] = useState<ProjectScript[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [inputCommand, setInputCommand] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    detectProjectScripts(projectPath).then((sc) => {
      if (mounted) setScripts(sc)
    })
    return () => {
      mounted = false
    }
  }, [projectPath])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const runCommand = async (cmdToRun: string) => {
    const clean = cmdToRun.trim()
    if (!clean || isRunning) return

    setIsRunning(true)
    const logId = `log-${Date.now()}`
    const timeStr = new Date().toLocaleTimeString()

    setLogs((prev) => [
      ...prev,
      {
        id: logId,
        command: clean,
        timestamp: timeStr,
        isRunning: true,
      },
    ])

    setHistory((prev) => [clean, ...prev.filter((c) => c !== clean)])
    setHistoryIndex(-1)
    setInputCommand("")

    try {
      const res = await executeProjectCommand(projectPath, clean)
      setLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId
            ? { ...entry, isRunning: false, result: res }
            : entry
        )
      )
      if (res.exit_code === 0) {
        toast.success(`Completed "${clean}" in ${res.duration_ms}ms`)
      } else {
        toast.error(`"${clean}" exited with code ${res.exit_code}`)
      }
    } catch (e) {
      setLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId
            ? {
                ...entry,
                isRunning: false,
                result: {
                  exit_code: 1,
                  stdout: "",
                  stderr: String(e),
                  duration_ms: 0,
                },
              }
            : entry
        )
      )
    } finally {
      setIsRunning(false)
    }
  }

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runCommand(inputCommand)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1
        setHistoryIndex(nextIdx)
        setInputCommand(history[nextIdx] || "")
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1
        setHistoryIndex(nextIdx)
        setInputCommand(history[nextIdx] || "")
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInputCommand("")
      }
    }
  }

  const handleCopyLog = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.info("Copied output to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearTerminal = () => {
    setLogs([])
    toast.info("Terminal cleared")
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(var(--canvas))] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col h-full min-h-[360px]">
      {/* ── Toolbar & Script Chips ─────────────────────────────────────── */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[hsl(var(--canvas))] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="size-4 text-[hsl(var(--signal))]" />
          <span className="font-mono text-xs font-semibold text-white">In-App Terminal & Scripts</span>
          <span className="font-mono text-[10px] text-white/40 truncate max-w-xs">
            {projectPath}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearTerminal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Clear
          </button>
        </div>
      </div>

      {/* ── 1-Click Package Script Chips ──────────────────────────────── */}
      {scripts.length > 0 && (
        <div className="px-4 py-2.5 border-b border-white/[0.04] bg-[hsl(var(--canvas))] flex items-center gap-2 overflow-x-auto">
          <span className="font-mono text-[10px] uppercase text-white/40 tracking-wider font-semibold flex-shrink-0">
            Detected Scripts:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {scripts.map((sc) => (
              <button
                key={sc.name}
                type="button"
                disabled={isRunning}
                onClick={() => runCommand(sc.command)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer",
                  sc.category === "dev"
                    ? "bg-[hsl(var(--signal))/0.15] text-[hsl(var(--signal))] border border-[hsl(var(--signal))/0.3] hover:bg-[hsl(var(--signal))] hover:text-black"
                    : sc.category === "build"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                    : sc.category === "test"
                    ? "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] border border-[hsl(var(--line))]"
                    : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 text-white"
                )}
              >
                <Play className="size-2.5 fill-current" />
                {sc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Terminal Output Stream ────────────────────────────────────── */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-[12px] bg-[hsl(var(--canvas))] space-y-4">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/30 space-y-2">
            <TerminalIcon className="size-10 text-white/10" />
            <p className="font-mono text-xs">Ready for execution. Run a script above or type a command below.</p>
            <p className="text-[11px] text-white/20 font-sans">
              All commands run directly in {projectName} with full stdout/stderr capture and zero external windows.
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-white/[0.06] bg-[hsl(var(--canvas))] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.04] text-[11px] text-white/50">
                <div className="flex items-center gap-2">
                  <span className="text-[hsl(var(--signal))] font-bold">$</span>
                  <span className="text-white font-medium">{log.command}</span>
                  {log.isRunning && (
                    <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--signal))] font-semibold">
                      <span className="size-1.5 rounded-full bg-[hsl(var(--signal))] animate-ping" />
                      Running...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">{log.timestamp}</span>
                  {log.result && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded border font-semibold",
                        log.result.exit_code === 0
                          ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      )}
                    >
                      exit: {log.result.exit_code} ({log.result.duration_ms}ms)
                    </span>
                  )}
                  {log.result && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyLog(
                          `${log.result?.stdout || ""}\n${log.result?.stderr || ""}`,
                          log.id
                        )
                      }
                      className="p-1 rounded text-white/40 hover:text-white"
                      title="Copy Output"
                    >
                      {copiedId === log.id ? (
                        <Check className="size-3 text-[hsl(var(--success))]" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 leading-relaxed whitespace-pre-wrap select-text">
                {log.result?.stdout && (
                  <div className="text-white/80">{log.result.stdout}</div>
                )}
                {log.result?.stderr && (
                  <div className="text-red-400/90 mt-1">{log.result.stderr}</div>
                )}
                {log.isRunning && (
                  <div className="text-white/40 animate-pulse">Executing in {projectPath}...</div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* ── Interactive Command Line Prompt ───────────────────────────── */}
      <form
        onSubmit={handleInputSubmit}
        className="p-3 border-t border-white/[0.08] bg-[hsl(var(--canvas))] flex items-center gap-2"
      >
        <span className="font-mono text-xs font-bold text-[hsl(var(--signal))] pl-1">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder={
            isRunning
              ? "Command running in background..."
              : `Enter PowerShell command (e.g. dir, git status, pnpm test)...`
          }
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          className="flex-1 px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
        />
        <button
          type="submit"
          disabled={!inputCommand.trim() || isRunning}
          className={cn(
            "px-4 py-2 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
            inputCommand.trim() && !isRunning
              ? "bg-[hsl(var(--signal))] text-black hover:opacity-90"
              : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
          )}
        >
          <Play className="size-3 fill-current" />
          Run
        </button>
      </form>
    </div>
  )
}
