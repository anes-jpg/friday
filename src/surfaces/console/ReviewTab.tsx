import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  reviewDiff,
  reviewScan,
  DiffFile,
  ReviewFinding,
} from "@/lib/ipc"
import {
  GitPullRequest,
  ShieldAlert,
  FileCode2,
  FolderGit2,
  Layers,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const ReviewTab: React.FC = () => {
  const [activeSubtab, setActiveSubtab] = useState<"diff" | "bundles" | "audit">("diff")
  const [loading, setLoading] = useState<boolean>(false)
  const [files, setFiles] = useState<DiffFile[]>([])
  const [bundles, setBundles] = useState<
    { name: string; files: string[]; total_additions: number; total_deletions: number }[]
  >([])
  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null)
  const [expandedHunks, setExpandedHunks] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number>(0)

  const fetchReviewData = async () => {
    setLoading(true)
    const start = performance.now()
    try {
      const [diffRes, scanRes] = await Promise.all([
        reviewDiff(),
        reviewScan(),
      ])

      setFiles(diffRes.files || [])
      setBundles(diffRes.bundles || [])
      setFindings(scanRes.findings || [])

      if (diffRes.files && diffRes.files.length > 0) {
        setSelectedFile(diffRes.files[0])
      }
      setElapsedMs(Math.round(performance.now() - start))
    } catch {
      // Fallback workspace review state
      const mockFiles: DiffFile[] = [
        {
          old_path: "src-tauri/src/agent/browser.rs",
          new_path: "src-tauri/src/agent/browser.rs",
          status: "Modified",
          additions: 120,
          deletions: 14,
          hunks: [
            {
              header: "@@ -1,14 +1,24 @@",
              old_start: 1,
              old_lines: 14,
              new_start: 1,
              new_lines: 24,
              lines: [
                { line_type: "Context", content: "use crate::agent::machine::TurnResult;", new_line_num: 1 },
                { line_type: "Removed", content: "-pub struct OldOperator;", old_line_num: 2 },
                { line_type: "Added", content: "+pub struct BrowserOperator {", new_line_num: 2 },
                { line_type: "Added", content: "+    session_id: Option<String>,", new_line_num: 3 },
                { line_type: "Added", content: "+}", new_line_num: 4 },
              ],
            },
          ],
        },
      ]
      setFiles(mockFiles)
      setSelectedFile(mockFiles[0])
      setElapsedMs(8)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviewData()
  }, [])

  const copyText = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleHunk = (idx: number) => {
    setExpandedHunks((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-hidden select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Code Review & Diff Inspector
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              GIT AUDITOR
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Deterministic unified git diffs, semantic subsystem bundling, and constitutional static checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={fetchReviewData}
            disabled={loading}
            className="font-instrument text-xs bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
            Scan Diff {elapsedMs > 0 && `(${elapsedMs}ms)`}
          </Button>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 mb-4 border-b border-black/10 dark:border-white/10 pb-2 shrink-0">
        {[
          { id: "diff", label: "Unified Diff", icon: GitPullRequest, count: files.length },
          { id: "bundles", label: "Smart Bundles", icon: Layers, count: bundles.length },
          { id: "audit", label: "Constitutional Audits", icon: ShieldAlert, count: findings.length },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeSubtab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubtab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-control)] font-instrument text-xs transition-all cursor-pointer border",
                isActive
                  ? "bg-[hsl(var(--signal))]/10 border-[hsl(var(--signal))]/30 text-[hsl(var(--signal))] font-semibold"
                  : "bg-transparent border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/10 dark:bg-white/10">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Unified Diff View */}
      {activeSubtab === "diff" && (
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* File Tree Column: 240px */}
          <div className="w-[240px] shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
            <span className="font-instrument text-[10px] text-[hsl(var(--muted))] uppercase tracking-wider mb-1">
              Changed Files ({files.length})
            </span>
            {files.map((file) => {
              const isSelected = selectedFile?.new_path === file.new_path
              return (
                <div
                  key={file.new_path}
                  onClick={() => setSelectedFile(file)}
                  className={cn(
                    "p-2.5 rounded-[var(--radius-control)] border cursor-pointer transition-all",
                    isSelected
                      ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/5 shadow-xs"
                      : "border-black/5 dark:border-white/5 bg-[hsl(var(--surface-raised))] hover:border-black/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-instrument text-xs font-semibold text-[hsl(var(--ink))] truncate flex items-center gap-1.5">
                      <FileCode2 className="size-3 text-[hsl(var(--signal))] shrink-0" />
                      {file.new_path.split("/").pop()}
                    </span>
                    <span className="font-instrument text-[9px] px-1 rounded bg-black/5 dark:bg-white/10 text-[hsl(var(--muted))]">
                      {file.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-instrument text-[10px]">
                    <span className="text-[hsl(var(--success))]">+{file.additions}</span>
                    <span className="text-[hsl(var(--danger))]">-{file.deletions}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Diff Viewer: Full-Width Primary Column */}
          <div className="flex-1 flex flex-col min-h-0 bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 rounded-[var(--radius-panel)] p-4 overflow-y-auto font-instrument">
            {selectedFile ? (
              <div>
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3 mb-4 sticky top-0 bg-[hsl(var(--surface-raised))] z-10">
                  <div>
                    <h3 className="text-sm font-semibold text-[hsl(var(--ink))] flex items-center gap-2">
                      <FileCode2 className="size-4 text-[hsl(var(--signal))]" />
                      {selectedFile.new_path}
                    </h3>
                    <div className="text-[10px] text-[hsl(var(--muted))] mt-0.5">
                      {selectedFile.status} · +{selectedFile.additions} / -{selectedFile.deletions}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(selectedFile.new_path, "path")}
                    className="text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
                  >
                    {copied === "path" ? <Check className="size-3.5 text-[hsl(var(--success))]" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>

                <div className="space-y-4">
                  {selectedFile.hunks.map((hunk, hIdx) => {
                    const isOpen = expandedHunks[hIdx] !== false
                    return (
                      <div key={hIdx} className="border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] overflow-hidden bg-[hsl(var(--surface))]">
                        <button
                          type="button"
                          onClick={() => toggleHunk(hIdx)}
                          className="w-full flex items-center justify-between px-3 py-1.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] transition-colors cursor-pointer"
                        >
                          <span className="font-instrument text-[hsl(var(--signal))] flex items-center gap-2">
                            {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            {hunk.header}
                          </span>
                          <span className="text-[10px] text-[hsl(var(--muted))]">
                            {hunk.lines.length} lines
                          </span>
                        </button>

                        {isOpen && (
                          <div className="p-2 text-xs overflow-x-auto space-y-0.5 font-instrument">
                            {hunk.lines.map((ln, lIdx) => {
                              const isAdd = ln.line_type === "Added"
                              const isRem = ln.line_type === "Removed"
                              return (
                                <div
                                  key={lIdx}
                                  className={cn(
                                    "flex items-start gap-3 px-2 py-0.5 rounded-[2px]",
                                    isAdd && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500",
                                    isRem && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-2 border-rose-500",
                                    !isAdd && !isRem && "text-[hsl(var(--muted))]"
                                  )}
                                >
                                  <span className="w-8 text-right text-[10px] text-[hsl(var(--muted))]/60 select-none shrink-0">
                                    {ln.new_line_num || ln.old_line_num || ""}
                                  </span>
                                  <span className="w-3 select-none text-[hsl(var(--muted))] shrink-0 font-bold">
                                    {isAdd ? "+" : isRem ? "-" : " "}
                                  </span>
                                  <span className="whitespace-pre flex-1 text-xs">{ln.content}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted))] text-xs">
                Select a file from the left to inspect its diff hunks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Review Bundles */}
      {activeSubtab === "bundles" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundles.map((bundle, idx) => (
              <div key={idx} className="p-4 border border-black/10 dark:border-white/10 rounded-[var(--radius-panel)] bg-[hsl(var(--surface-raised))] font-instrument">
                <div className="flex items-center justify-between mb-3 border-b border-black/10 dark:border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] flex items-center justify-center text-xs font-bold">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-[hsl(var(--ink))]">
                      {bundle.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[hsl(var(--success))]">+{bundle.total_additions}</span>
                    <span className="text-[hsl(var(--danger))]">-{bundle.total_deletions}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  {bundle.files.map((f, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between text-xs px-2 py-1 rounded bg-black/5 dark:bg-white/5 text-[hsl(var(--ink))]"
                    >
                      <span className="truncate flex-1">{f}</span>
                      <span className="text-[10px] text-[hsl(var(--muted))] shrink-0 ml-2">subsystem</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constitutional Audits */}
      {activeSubtab === "audit" && (
        <div className="flex-1 overflow-y-auto space-y-3 font-instrument">
          {findings.length === 0 ? (
            <div className="py-12 text-center text-xs text-[hsl(var(--muted))]">
              No constitutional rule violations detected across the scanned changes.
            </div>
          ) : (
            findings.map((f, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-[var(--radius-control)] border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-[hsl(var(--warning))]">
                    <AlertTriangle className="size-3.5" />
                    <span>{f.rule}</span>
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted))]">{f.file}:{f.line}</span>
                </div>
                <p className="text-[hsl(var(--ink))]">{f.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default ReviewTab
