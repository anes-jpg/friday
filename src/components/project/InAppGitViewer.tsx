import React, { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  FileDiff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { DiffViewer } from "@/components/ui/DiffViewer"
import type { ProjectGitDiffInfo } from "@/lib/types"
import { getProjectGitDiff, commitProjectChanges } from "@/lib/workflow"

interface InAppGitViewerProps {
  projectPath: string
  projectName: string
  onAskFriday?: (prompt: string) => void
}

export const InAppGitViewer: React.FC<InAppGitViewerProps> = ({
  projectPath,
  projectName,
  onAskFriday,
}) => {
  const [gitInfo, setGitInfo] = useState<ProjectGitDiffInfo>({
    branch: "main",
    diff: "",
    modified_files: [],
    has_changes: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [commitMessage, setCommitMessage] = useState("")
  const [isCommitting, setIsCommitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const refreshGit = async () => {
    setIsLoading(true)
    try {
      const res = await getProjectGitDiff(projectPath)
      setGitInfo(res)
      if (res.modified_files.length > 0 && !selectedFile) {
        setSelectedFile(res.modified_files[0] || null)
      }
    } catch {
      toast.error("Failed to query git status")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshGit()
  }, [projectPath])

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitMessage.trim()) return

    setIsCommitting(true)
    try {
      const res = await commitProjectChanges(projectPath, commitMessage.trim())
      if (res.success) {
        toast.success(`Committed changes: "${commitMessage.trim()}"`)
        setCommitMessage("")
        await refreshGit()
      } else {
        toast.error(`Commit failed: ${res.stderr || "Unknown git error"}`)
      }
    } catch {
      toast.error("Failed to commit changes")
    } finally {
      setIsCommitting(false)
    }
  }

  const handleTriggerAiReview = () => {
    if (!gitInfo.diff) {
      toast.info("No uncommitted changes to review.")
      return
    }

    const reviewPrompt = `[Project: ${projectName} at ${projectPath}] Branch: ${gitInfo.branch}\nPlease perform an automated code review on the following git diff. Check for constitutional compliance (Surface Law, One-Signal Law, Sub-Frame Law), safety flaws, and edge cases:\n\n${gitInfo.diff.slice(0, 1500)}`

    if (onAskFriday) {
      onAskFriday(reviewPrompt)
      toast.success("Dispatched code review request to FRIDAY!")
    } else {
      toast.info("Code review prompt queued for FRIDAY.")
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(var(--canvas))] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col h-full min-h-[360px]">
      {/* ── Toolbar Header ─────────────────────────────────────────────── */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[hsl(var(--canvas))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-[hsl(var(--signal))]" />
          <span className="font-mono text-xs font-semibold text-white">In-App Git & Diff Review</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[hsl(var(--signal))] font-semibold">
            {gitInfo.branch}
          </span>
          <span className="font-mono text-[10px] text-white/40">
            {gitInfo.modified_files.length} modified files
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerAiReview}
            disabled={!gitInfo.has_changes}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer",
              gitInfo.has_changes
                ? "bg-[hsl(var(--signal))/0.15] text-[hsl(var(--signal))] border border-[hsl(var(--signal))/0.3] hover:bg-[hsl(var(--signal))] hover:text-black"
                : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
            )}
          >
            <ShieldCheck className="size-3" />
            FRIDAY Code Review
          </button>

          <button
            type="button"
            onClick={refreshGit}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Refresh Git Status"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Main Body: 2 Columns ───────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Modified Files & Commit Box */}
        <div className="w-48 border-r border-white/[0.08] bg-[hsl(var(--canvas))] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Changed Files ({gitInfo.modified_files.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {gitInfo.modified_files.length > 0 ? (
              gitInfo.modified_files.map((file) => {
                const isSelected = selectedFile === file
                return (
                  <div
                    key={file}
                    onClick={() => setSelectedFile(file)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors font-mono",
                      isSelected
                        ? "bg-[hsl(var(--signal))/0.12] text-white border border-[hsl(var(--signal))/0.3]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <FileDiff className="size-3.5 text-amber-400 flex-shrink-0" />
                    <span className="truncate flex-1 text-[11px]">{file}</span>
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-white/30 font-mono text-xs space-y-1">
                <CheckCircle2 className="size-6 mx-auto text-[hsl(var(--success))]/50 mb-1" />
                <div>Working tree clean.</div>
                <div className="text-[10px] text-white/20">No uncommitted changes detected.</div>
              </div>
            )}
          </div>

          {/* In-App Commit Box */}
          <form
            onSubmit={handleCommit}
            className="p-3 border-t border-white/[0.06] bg-[hsl(var(--canvas))] space-y-2"
          >
            <input
              type="text"
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={!gitInfo.has_changes || isCommitting}
              className="w-full px-3 py-1.5 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
            />
            <button
              type="submit"
              disabled={!commitMessage.trim() || !gitInfo.has_changes || isCommitting}
              className={cn(
                "w-full py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                commitMessage.trim() && gitInfo.has_changes && !isCommitting
                  ? "bg-[hsl(var(--signal))] text-black hover:opacity-90"
                  : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
              )}
            >
              <GitCommit className="size-3.5" />
              {isCommitting ? "Committing..." : "Commit in FRIDAY"}
            </button>
          </form>
        </div>

        {/* Right Column: Unified Diff Viewer */}
        <div className="flex-1 flex flex-col bg-[hsl(var(--canvas))] overflow-hidden p-4">
          {gitInfo.diff ? (
            <div className="flex-1 overflow-auto rounded-xl border border-white/[0.08] bg-[hsl(var(--canvas))] p-2">
              <DiffViewer
                filename={selectedFile || `${gitInfo.branch} Diff`}
                diff={gitInfo.diff}
                className="border-none bg-transparent"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-white/30 space-y-2">
              <GitPullRequest className="size-10 text-white/10" />
              <p className="font-mono text-xs">No pending diffs to inspect.</p>
              <p className="text-[11px] text-white/20 font-sans max-w-sm">
                Make code changes in the In-App Code Studio, and your live git diff will stream here instantly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
