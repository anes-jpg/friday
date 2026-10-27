import React, { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Search,
  X,
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  PanelLeftClose,
  MessageSquare,
  Check,
  Clock,
} from "lucide-react"
import { useFriday } from "@/lib/store"
import type { Thread } from "@/lib/types"
import { Button } from "@/components/ui/button"

export interface ChatHistorySidebarProps {
  open: boolean
  onClose: () => void
  onNewChat: () => void
  className?: string
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Just now"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "Recently"
  const diffMs = Math.max(0, Date.now() - d.getTime())
  if (diffMs < 60_000) return "Just now"
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

interface GroupedSections {
  pinned: Thread[]
  today: Thread[]
  yesterday: Thread[]
  previous7Days: Thread[]
  older: Thread[]
}

function groupThreads(threads: Thread[], query: string): GroupedSections {
  const cleanQ = query.trim().toLowerCase()
  const filtered = cleanQ
    ? threads.filter((t) => {
        if (t.title.toLowerCase().includes(cleanQ)) return true
        return (t.messages || []).some((m) =>
          (m.content || m.say || m.show || "").toLowerCase().includes(cleanQ)
        )
      })
    : threads

  const groups: GroupedSections = {
    pinned: [],
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  const startOfYesterday = startOfToday - oneDayMs
  const startOf7Days = startOfToday - 6 * oneDayMs

  for (const t of filtered) {
    if (t.pinned) {
      groups.pinned.push(t)
      continue
    }
    const rawDate = t.updated_at || t.updatedAt
    const parsedDate = rawDate ? new Date(rawDate).getTime() : now.getTime()
    const tDate = isNaN(parsedDate) ? now.getTime() : parsedDate
    if (tDate >= startOfToday) {
      groups.today.push(t)
    } else if (tDate >= startOfYesterday) {
      groups.yesterday.push(t)
    } else if (tDate >= startOf7Days) {
      groups.previous7Days.push(t)
    } else {
      groups.older.push(t)
    }
  }

  return groups
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  open,
  onClose,
  onNewChat,
  className = "",
}) => {
  const threads = useFriday((s) => s.threads)
  const activeThreadId = useFriday((s) => s.activeThreadId)
  const setActiveThread = useFriday((s) => s.setActiveThread)
  const renameThread = useFriday((s) => s.renameThread)
  const deleteThread = useFriday((s) => s.deleteThread)
  const toggleThreadPin = useFriday((s) => s.toggleThreadPin)

  const [searchQuery, setSearchQuery] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const grouped = useMemo(
    () => groupThreads(threads, searchQuery),
    [threads, searchQuery]
  )

  const hasAnyThreads = threads.length > 0
  const totalFilteredCount =
    grouped.pinned.length +
    grouped.today.length +
    grouped.yesterday.length +
    grouped.previous7Days.length +
    grouped.older.length

  const handleStartRename = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(thread.id)
    setRenameValue(thread.title)
    setDeletingId(null)
  }

  const handleCommitRename = (threadId: string) => {
    if (renameValue.trim()) {
      renameThread(threadId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
  }

  const handleStartDelete = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(threadId)
    setRenamingId(null)
  }

  const handleConfirmDelete = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteThread(threadId)
    setDeletingId(null)
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(null)
  }

  const handleTogglePin = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    toggleThreadPin(threadId)
  }

  const renderSection = (title: string, items: Thread[]) => {
    if (items.length === 0) return null

    return (
      <div key={title} className="space-y-1">
        <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted))] select-none flex items-center justify-between">
          <span>{title}</span>
          <span className="tabular-nums text-[9px] opacity-60">({items.length})</span>
        </div>
        <div className="space-y-0.5">
          {items.map((thread) => {
            const isActive = thread.id === activeThreadId
            const isRenaming = renamingId === thread.id
            const isDeleting = deletingId === thread.id
            const messageCount = thread.messages?.length ?? thread.message_count ?? 0

            return (
              <div
                key={thread.id}
                onClick={() => {
                  if (!isRenaming && !isDeleting) {
                    setActiveThread(thread.id)
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      onClose()
                    }
                  }
                }}
                className={`group relative flex flex-col rounded-lg px-2.5 py-2 transition-all duration-150 cursor-pointer select-none border ${
                  isActive
                    ? "bg-[hsl(var(--surface-raised))] border-black/15 dark:border-white/15 shadow-xs"
                    : "border-transparent hover:bg-black/5 dark:hover:bg-white/[0.04] text-[hsl(var(--ink))]"
                }`}
              >
                {/* Active Indicator & Top row */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* One-Signal Law: Accent only signifies active thread */}
                    {isActive ? (
                      <span
                        className="size-1.5 rounded-full bg-[hsl(var(--ink))] shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <MessageSquare
                        className="size-3 text-[hsl(var(--muted))] shrink-0 opacity-70 group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    )}

                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation()
                              handleCommitRename(thread.id)
                            }
                            if (e.key === "Escape") {
                              e.stopPropagation()
                              handleCancelRename()
                            }
                          }}
                          className="flex-1 min-w-0 bg-black/10 dark:bg-black/40 border border-[hsl(var(--signal))]/50 rounded px-1.5 py-0.5 text-xs text-[hsl(var(--ink))] outline-none font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => handleCommitRename(thread.id)}
                          className="p-1 rounded text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/10"
                          title="Save title"
                          aria-label="Save title"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="p-1 rounded text-[hsl(var(--muted))] hover:bg-black/10 dark:hover:bg-white/10"
                          title="Cancel"
                          aria-label="Cancel"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`truncate text-xs font-sans ${
                          isActive ? "font-semibold text-[hsl(var(--ink))]" : "font-normal text-[hsl(var(--ink))]/90"
                        }`}
                        title={thread.title}
                      >
                        {thread.title}
                      </span>
                    )}
                  </div>

                  {/* Actions on hover or focus (when not renaming/deleting) */}
                  {!isRenaming && !isDeleting && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(thread.id, e)}
                        className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                          thread.pinned ? "text-[hsl(var(--ink))]" : "text-[hsl(var(--muted))]"
                        }`}
                        title={thread.pinned ? "Unpin session" : "Pin session"}
                        aria-label={thread.pinned ? "Unpin session" : "Pin session"}
                      >
                        {thread.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(thread, e)}
                        className="p-1 rounded text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title="Rename session"
                        aria-label="Rename session"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleStartDelete(thread.id, e)}
                        className="p-1 rounded text-[hsl(var(--muted))] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete session"
                        aria-label="Delete session"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-row: Time & message count */}
                {!isRenaming && !isDeleting && (
                  <div className="flex items-center justify-between text-[10px] font-mono text-[hsl(var(--muted))] mt-1 pl-3.5">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-2.5 opacity-60" aria-hidden="true" />
                      <span>{formatRelativeTime(thread.updated_at)}</span>
                    </span>
                    {messageCount > 0 && (
                      <span className="tabular-nums opacity-75">
                        {messageCount} {messageCount === 1 ? "turn" : "turns"}
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Delete Confirmation */}
                {isDeleting && (
                  <div
                    className="mt-2 pt-2 border-t border-rose-500/20 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-rose-400 font-mono">Delete chat?</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelDelete}
                        className="h-6 px-2 text-[10px] font-mono"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={(e) => handleConfirmDelete(thread.id, e)}
                        className="h-6 px-2 text-[10px] font-mono bg-rose-500 text-white hover:bg-rose-600"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-20 transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="chat-history-sidebar"
            initial={prefersReducedMotion ? { opacity: 0 } : { x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: -16, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`w-[280px] h-full flex flex-col border-r border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] overflow-hidden shrink-0 select-none z-30 md:relative fixed inset-y-0 left-0 shadow-2xl md:shadow-none ${className}`}
          >
            <div className="w-[280px] h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-black/10 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink))]">
                    Conversations
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/5 dark:bg-white/5 text-[hsl(var(--muted))] tabular-nums">
                    {threads.length}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  title="Close sidebar (Ctrl+H)"
                  aria-label="Close sidebar"
                  className="text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>

              {/* + New Chat CTA */}
              <div className="p-3 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={onNewChat}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 hover:bg-black/5 dark:hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-pointer group text-xs text-[hsl(var(--ink))] font-medium shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="size-3.5 text-[hsl(var(--muted))] group-hover:text-[hsl(var(--ink))] transition-colors" />
                    <span>New Chat</span>
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/30 border border-black/10 dark:border-white/10 text-[10px] font-mono text-[hsl(var(--muted))] group-hover:text-[hsl(var(--ink))]">
                    Ctrl+N
                  </kbd>
                </button>
              </div>

            {/* Search Input */}
            <div className="px-3 pb-2 shrink-0">
              <div className="relative flex items-center">
                <Search className="size-3.5 absolute left-2.5 text-[hsl(var(--muted))] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 focus:border-black/30 dark:focus:border-white/30 rounded-lg pl-8 pr-7 py-1.5 text-xs text-[hsl(var(--ink))] placeholder:text-[hsl(var(--muted))] outline-none font-sans transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Chronological Thread List */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2">
              {!hasAnyThreads ? (
                <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted))] font-sans leading-relaxed">
                  No conversations yet. Start a new session with the button above.
                </div>
              ) : totalFilteredCount === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted))] font-sans leading-relaxed">
                  No matching conversations found for &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <>
                  {renderSection("Pinned", grouped.pinned)}
                  {renderSection("Today", grouped.today)}
                  {renderSection("Yesterday", grouped.yesterday)}
                  {renderSection("Previous 7 Days", grouped.previous7Days)}
                  {renderSection("Older", grouped.older)}
                </>
              )}
            </div>
          </div>
        </motion.aside>
      </>
    )}
  </AnimatePresence>
  )
}

export default ChatHistorySidebar
