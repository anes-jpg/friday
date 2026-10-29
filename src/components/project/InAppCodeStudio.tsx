import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  FileCheck2,
  AlertCircle,
  X,
  Code2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Capture } from "@/lib/daily-work"
import type { ProjectFileNode } from "@/lib/types"
import {
  inspectProjectTree,
  readProjectFile,
  writeProjectFile,
  createProjectFileOrDir,
  deleteProjectPath,
} from "@/lib/workflow"

interface InAppCodeStudioProps {
  projectPath: string
  projectName: string
  onAskFriday?: (prompt: string, source?: Partial<Capture>) => void
}

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".tsx") || lower.endsWith(".ts") || lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".rs") || lower.endsWith(".py")) {
    return <FileCode className="size-3.5 text-blue-400" />
  }
  if (lower.endsWith(".json")) {
    return <FileJson className="size-3.5 text-amber-400" />
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return <FileText className="size-3.5 text-[hsl(var(--success))]" />
  }
  return <File className="size-3.5 text-white/50" />
}

export const InAppCodeStudio: React.FC<InAppCodeStudioProps> = ({
  projectPath,
  projectName,
  onAskFriday,
}) => {
  const [nodes, setNodes] = useState<ProjectFileNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Active open file state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>("")
  const [fileContent, setFileContent] = useState<string>("")
  const [originalContent, setOriginalContent] = useState<string>("")
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Creation dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createIsDir, setCreateIsDir] = useState(false)

  // Quick prompt for FRIDAY to edit
  const [showPromptBox, setShowPromptBox] = useState(false)
  const [fridayPrompt, setFridayPrompt] = useState("")

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = selectedFilePath !== null && fileContent !== originalContent

  const refreshTree = async () => {
    if (!projectPath) return
    setIsLoadingTree(true)
    try {
      const tree = await inspectProjectTree(projectPath, 3)
      setNodes(tree)
      // Auto-open first few top-level folders
      const initialExpanded = new Set<string>()
      tree.forEach((n) => {
        if (n.is_dir) initialExpanded.add(n.path)
      })
      setExpandedPaths(initialExpanded)
    } catch {
      toast.error("Could not load project files")
    } finally {
      setIsLoadingTree(false)
    }
  }

  useEffect(() => {
    refreshTree()
  }, [projectPath])

  // Select and open file
  const handleOpenFile = async (node: ProjectFileNode) => {
    if (node.is_dir) {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(node.path)) next.delete(node.path)
        else next.add(node.path)
        return next
      })
      return
    }

    if (isDirty) {
      const confirmDiscard = window.confirm("You have unsaved changes in the current file. Discard them?")
      if (!confirmDiscard) return
    }

    setIsLoadingFile(true)
    try {
      const content = await readProjectFile(node.path)
      setSelectedFilePath(node.path)
      setSelectedFileName(node.name)
      setFileContent(content)
      setOriginalContent(content)
    } catch {
      toast.error(`Failed to read file ${node.name}`)
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Save file to disk
  const handleSaveFile = async () => {
    if (!selectedFilePath) return
    setIsSaving(true)
    try {
      await writeProjectFile(selectedFilePath, fileContent)
      setOriginalContent(fileContent)
      toast.success(`Saved "${selectedFileName}" to disk`)
    } catch {
      toast.error(`Failed to save ${selectedFileName}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (isDirty) {
          handleSaveFile()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDirty, selectedFilePath, fileContent])

  // Create new file / folder
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return

    const fullPath = `${projectPath}\\${createName.trim()}`
    try {
      await createProjectFileOrDir(fullPath, createIsDir)
      toast.success(`Created ${createIsDir ? "folder" : "file"} "${createName.trim()}"`)
      setCreateName("")
      setShowCreateDialog(false)
      await refreshTree()
      if (!createIsDir) {
        setSelectedFilePath(fullPath)
        setSelectedFileName(createName.trim())
        setFileContent("")
        setOriginalContent("")
      }
    } catch {
      toast.error("Failed to create item")
    }
  }

  // Delete active file
  const handleDeleteCurrent = async () => {
    if (!selectedFilePath) return
    const ok = window.confirm(`Permanently delete ${selectedFileName}?`)
    if (!ok) return

    try {
      await deleteProjectPath(selectedFilePath)
      toast.success(`Deleted ${selectedFileName}`)
      setSelectedFilePath(null)
      setSelectedFileName("")
      setFileContent("")
      setOriginalContent("")
      await refreshTree()
    } catch {
      toast.error("Failed to delete file")
    }
  }

  // Submit task/edit to FRIDAY
  const handleSendPromptToFriday = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fridayPrompt.trim()) return

    const directive = fridayPrompt.trim()
    if (onAskFriday) {
      onAskFriday(directive, { title: selectedFileName || "Selected code", path: selectedFilePath || undefined, text: fileContent, sourceKind: "file" })
      setShowPromptBox(false)
      setFridayPrompt("")
      toast.success("Dispatched edit instruction to FRIDAY!")
    } else {
      toast.info(`FRIDAY prompt queued: ${fridayPrompt.trim()}`)
      setShowPromptBox(false)
      setFridayPrompt("")
    }
  }

  // Render tree node recursively
  const renderNode = (node: ProjectFileNode, depth = 0) => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedFilePath === node.path

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => handleOpenFile(node)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={cn(
            "flex items-center gap-2 py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-colors group",
            isSelected
              ? "bg-[hsl(var(--signal))/0.12] text-white font-medium border border-[hsl(var(--signal))/0.3]"
              : "text-white/70 hover:text-white hover:bg-white/[0.04]"
          )}
        >
          {node.is_dir ? (
            <>
              {isExpanded ? (
                <ChevronDown className="size-3 text-white/40" />
              ) : (
                <ChevronRight className="size-3 text-white/40" />
              )}
              {isExpanded ? (
                <FolderOpen className="size-3.5 text-amber-400/90 flex-shrink-0" />
              ) : (
                <Folder className="size-3.5 text-amber-400/70 flex-shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-3" />
              {getFileIcon(node.name)}
            </>
          )}

          <span className="truncate flex-1 font-mono text-[11px]">{node.name}</span>

          {node.size_bytes !== undefined && (
            <span className="text-[9px] font-mono text-white/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {node.size_bytes > 1024 ? `${(node.size_bytes / 1024).toFixed(1)}k` : `${node.size_bytes}b`}
            </span>
          )}
        </div>

        {node.is_dir && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Calculate line numbers
  const linesCount = fileContent.split("\n").length

  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(var(--canvas))] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col h-full min-h-[360px]">
      {/* ── Studio Top Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-[hsl(var(--canvas))]">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-[hsl(var(--signal))]" />
          <span className="font-mono text-xs font-semibold text-white">In-App Code Studio</span>
          <span className="font-mono text-[10px] text-white/40 truncate max-w-md">
            {projectPath}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateIsDir(false)
              setShowCreateDialog(true)
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <Plus className="size-3" />
            New File
          </button>
          <button
            type="button"
            onClick={refreshTree}
            disabled={isLoadingTree}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Refresh Files"
          >
            <RefreshCw className={cn("size-3.5", isLoadingTree && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Studio Body: 2 Columns ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: File Tree Explorer */}
        <div className="w-48 border-r border-white/[0.08] bg-[hsl(var(--canvas))] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Project Explorer
            </span>
            <span className="font-mono text-[10px] text-white/30">{nodes.length} root items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {nodes.length > 0 ? (
              nodes.map((node) => renderNode(node))
            ) : (
              <div className="p-4 text-center font-mono text-xs text-white/30">
                {isLoadingTree ? "Scanning codebase..." : "No files detected."}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Code Editor & Viewer */}
        <div className="flex-1 flex flex-col bg-[hsl(var(--canvas))] overflow-hidden">
          {selectedFilePath ? (
            <>
              {/* Active File Tab Bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[hsl(var(--canvas))]">
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(selectedFileName)}
                  <span className="font-mono text-xs font-semibold text-white truncate">
                    {selectedFileName}
                  </span>
                  {isDirty && (
                    <span className="size-2 rounded-full bg-[hsl(var(--signal))] animate-pulse" title="Unsaved changes" />
                  )}
                  <span className="text-[10px] font-mono text-white/40 truncate">
                    ({linesCount} lines • {fileContent.length} bytes)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Ask FRIDAY Button */}
                  <button
                    type="button"
                    onClick={() => setShowPromptBox((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold bg-white/5 hover:bg-[hsl(var(--signal))/0.15] text-[hsl(var(--signal))] border border-[hsl(var(--signal))/0.3] transition-colors cursor-pointer"
                  >
                    <Sparkles className="size-3" />
                    Ask FRIDAY to Edit
                  </button>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveFile}
                    disabled={!isDirty || isSaving}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer",
                      isDirty
                        ? "bg-[hsl(var(--signal))] text-black hover:opacity-90 shadow-sm"
                        : "bg-white/5 text-white/40 border border-white/5 cursor-not-allowed"
                    )}
                  >
                    <Save className="size-3" />
                    {isSaving ? "Saving..." : "Save (Ctrl+S)"}
                  </button>

                  {/* Delete File */}
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="p-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Ask FRIDAY Prompt Box */}
              <AnimatePresence>
                {showPromptBox && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSendPromptToFriday}
                    className="p-3 border-b border-white/[0.08] bg-[hsl(var(--canvas))] flex items-center gap-2"
                  >
                    <Sparkles className="size-4 text-[hsl(var(--signal))] flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={`Tell FRIDAY what changes to make in ${selectedFileName}...`}
                      value={fridayPrompt}
                      onChange={(e) => setFridayPrompt(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold bg-[hsl(var(--signal))] text-black hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Instruct FRIDAY
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPromptBox(false)}
                      className="p-1.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Monospace Code Editor Area */}
              <div className="flex-1 flex overflow-hidden font-mono text-[12px] bg-[hsl(var(--canvas))]">
                {/* Line Numbers Gutter */}
                <div className="w-12 py-3 select-none text-right pr-3 font-mono text-white/20 bg-[hsl(var(--canvas))] border-r border-white/[0.06] overflow-hidden leading-[20px]">
                  {Array.from({ length: linesCount }, (_, i) => (
                    <div key={i + 1}>{i + 1}</div>
                  ))}
                </div>

                {/* Textarea Code Input */}
                <div className="flex-1 relative overflow-auto">
                  <textarea
                    ref={textareaRef}
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full p-3 font-mono text-white/90 bg-transparent resize-none focus:outline-none leading-[20px] whitespace-pre tab-4 selection:bg-[hsl(var(--signal))/0.25]"
                    placeholder="Empty file..."
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <FileCode className="size-12 text-white/15 mb-3" />
              <h4 className="font-mono text-sm font-semibold text-white/70">
                Select a file from the explorer to view & edit
              </h4>
              <p className="text-xs text-white/40 max-w-sm mt-1 font-sans">
                Browse code, edit components, and ask FRIDAY to execute refactors directly inside this window with zero VS Code reliance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create New Item Modal ────────────────────────────────────────── */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateItem}
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-[hsl(var(--canvas))] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">
                Create in {projectName}
              </span>
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <label className="flex items-center gap-1.5 text-white/70 cursor-pointer">
                <input
                  type="radio"
                  checked={!createIsDir}
                  onChange={() => setCreateIsDir(false)}
                  name="createType"
                />
                File
              </label>
              <label className="flex items-center gap-1.5 text-white/70 cursor-pointer">
                <input
                  type="radio"
                  checked={createIsDir}
                  onChange={() => setCreateIsDir(true)}
                  name="createType"
                />
                Folder
              </label>
            </div>

            <input
              type="text"
              placeholder={createIsDir ? "e.g. components or utils" : "e.g. ProductGrid.tsx"}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                className="px-3 py-1.5 rounded-xl font-mono text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl font-mono text-xs font-semibold bg-[hsl(var(--signal))] text-black hover:opacity-90 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
