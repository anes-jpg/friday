import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  FolderKanban,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Search,
  Plus,
  ArrowUpRight,
  X,
  Target,
  Flag,
  FileText,
  Calendar,
  Zap,
  Activity,
  Layers,
  Check,
  AlertCircle,
  TrendingUp,
  FolderGit2,
  ChevronDown,
  Hammer,
  Code2,
  Box,
  Cpu,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  CreateNewDisclosure,
  HugeiconsIcon,
  Folder01Icon,
  TaskEdit01Icon,
  NoteIcon,
  Award01Icon,
  Flag02Icon,
  Calendar04Icon,
} from "@/components/project/CreateNewDisclosure"
import type {
  ProjectWorkspace,
  WorkspaceItem,
  DiscoveredRepo,
  ProjectArchetypeId,
  RiskTier,
} from "@/lib/types"
import {
  SCAFFOLD_ARCHETYPES,
  loadProjectWorkspaces,
  saveProjectWorkspaces,
  loadWorkspaceItems,
  saveWorkspaceItems,
  getActiveProjectId,
  setActiveProjectId,
  scanDesktopRepos,
  scaffoldProjectWorkspace,
  importDiscoveredRepo,
  decomposeDirectiveIntoTasks,
} from "@/lib/workflow"

export const ProjectsTab: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWorkspace[]>(() => loadProjectWorkspaces())
  const [activeProjectId, setActiveId] = useState<string>(() => getActiveProjectId())
  const [items, setItems] = useState<WorkspaceItem[]>(() => loadWorkspaceItems())
  const [discoveredRepos, setDiscoveredRepos] = useState<DiscoveredRepo[]>([])
  const [showReposShelf, setShowReposShelf] = useState<boolean>(true)
  const [isScanningRepos, setIsScanningRepos] = useState<boolean>(false)

  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [inlineTaskText, setInlineTaskText] = useState("")

  // Scaffolding & Quick Create Modals
  const [scaffoldModalOpen, setScaffoldModalOpen] = useState<boolean>(false)
  const [selectedArchetype, setSelectedArchetype] = useState<ProjectArchetypeId>("better-t-stack")
  const [scaffoldName, setScaffoldName] = useState<string>("")
  const [scaffoldDir, setScaffoldDir] = useState<string>("")
  const [isScaffolding, setIsScaffolding] = useState<boolean>(false)

  const [quickCreateType, setQuickCreateType] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState("")
  const [quickDesc, setQuickDesc] = useState("")

  // Ensure an active project exists
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || {
      id: "proj-1",
      name: "FRIDAY Desktop Operator v1.0",
      directive: "Voice-first Windows desktop controller with Piper TTS, local Whisper STT, and native tool bridge.",
      rootPath: "C:\\Users\\anesx\\Desktop\\friday",
      framework: "Tauri v2 + Rust",
      status: "active" as const,
      targetDelivery: "Oct 20, 2026",
      priority: "critical" as const,
      ttsEngine: "Piper v1.2",
      searchEngine: "DuckDuckGo Crawler",
      tags: ["Core", "Windows", "Voice"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

  // Scan desktop repositories on mount
  useEffect(() => {
    let mounted = true
    setIsScanningRepos(true)
    scanDesktopRepos()
      .then((repos) => {
        if (mounted) {
          setDiscoveredRepos(repos)
          setIsScanningRepos(false)
        }
      })
      .catch(() => {
        if (mounted) setIsScanningRepos(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Sync projects and items to storage on modification
  useEffect(() => {
    saveProjectWorkspaces(projects)
  }, [projects])

  useEffect(() => {
    saveWorkspaceItems(items)
  }, [items])

  const handleSelectProject = (id: string) => {
    setActiveId(id)
    setActiveProjectId(id)
    toast.info(`Switched active workspace to "${projects.find((p) => p.id === id)?.name || id}"`)
  }

  // Filter items by active project and search query
  const projectItems = items.filter(
    (item) => !item.projectId || item.projectId === activeProject.id
  )

  const filteredItems = projectItems.filter((item) => {
    if (activeFilter !== "all" && item.type !== activeFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.tag && item.tag.toLowerCase().includes(q))
    )
  })

  // Calculate project progress dynamically from tasks
  const projectTasks = projectItems.filter((it) => it.type === "task")
  const completedTasksCount = projectTasks.filter((it) => it.status === "done").length
  const totalTasksCount = projectTasks.length
  const progressPercent =
    totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : activeProject.status === "completed"
      ? 100
      : 35

  const toggleTaskStatus = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const nextStatus = it.status === "done" ? "todo" : "done"
          toast.success(`Task "${it.title}" marked as ${nextStatus}`)
          return { ...it, status: nextStatus }
        }
        return it
      })
    )
  }

  const handleCreateNewType = (typeLabel: string) => {
    const lower = typeLabel.toLowerCase()
    if (lower === "project") {
      setScaffoldModalOpen(true)
    } else {
      setQuickCreateType(lower)
    }
  }

  const handleInlineAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inlineTaskText.trim()) return

    const newTask: WorkspaceItem = {
      id: `task-${Date.now()}`,
      projectId: activeProject.id,
      type: "task",
      title: inlineTaskText.trim(),
      status: "todo",
      dueDate: "Today",
      priority: "high",
      riskTier: "green",
      tag: "Active",
    }

    setItems((prev) => [newTask, ...prev])
    toast.success(`Task added to ${activeProject.name}`)
    setInlineTaskText("")
  }

  const handleSaveQuickItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTitle.trim() || !quickCreateType) return

    const typeMap: Record<string, WorkspaceItem["type"]> = {
      task: "task",
      note: "note",
      goal: "goal",
      milestone: "milestone",
      reminder: "reminder",
    }

    const itemType = typeMap[quickCreateType] || "task"

    const newItem: WorkspaceItem = {
      id: `${itemType}-${Date.now()}`,
      projectId: activeProject.id,
      type: itemType,
      title: quickTitle.trim(),
      description: quickDesc.trim() || undefined,
      status: "todo",
      dueDate: itemType === "reminder" ? "Tomorrow 09:00" : "Upcoming",
      tag: "Active",
      riskTier: itemType === "task" ? "green" : undefined,
      progress: itemType === "goal" ? 0 : undefined,
    }

    setItems((prev) => [newItem, ...prev])
    toast.success(`Created new ${quickCreateType}: "${quickTitle.trim()}"`)
    setQuickTitle("")
    setQuickDesc("")
    setQuickCreateType(null)
  }

  const handleExecuteScaffold = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scaffoldName.trim()) {
      toast.error("Please provide a project name")
      return
    }

    setIsScaffolding(true)
    try {
      const created = await scaffoldProjectWorkspace(
        selectedArchetype,
        scaffoldName.trim(),
        scaffoldDir.trim() || undefined
      )
      setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
      setActiveId(created.id)
      setScaffoldModalOpen(false)
      setScaffoldName("")
      setScaffoldDir("")
      toast.success(
        `Project "${created.name}" is ready! You can now ask FRIDAY to build features or inspect files.`
      )
    } catch {
      toast.error("Failed to create project workspace")
    } finally {
      setIsScaffolding(false)
    }
  }

  const handleImportRepo = (repo: DiscoveredRepo) => {
    const imported = importDiscoveredRepo(repo)
    setProjects((prev) => [imported, ...prev.filter((p) => p.id !== imported.id)])
    setActiveId(imported.id)
    toast.success(`Connected "${repo.name}" to FRIDAY! You can now ask FRIDAY to review code or build features.`)
  }

  const handleDecomposeTasks = () => {
    const generated = decomposeDirectiveIntoTasks(activeProject.id, activeProject.directive)
    setItems((prev) => [...generated, ...prev])
    toast.success(`Generated ${generated.length} actionable tasks from project directive!`)
  }

  const activeProjectsCount = projects.length
  const pendingTasks = projectTasks.filter((t) => t.status !== "done")
  const completedTasks = projectTasks.filter((t) => t.status === "done")
  const goalsList = projectItems.filter((i) => i.type === "goal")
  const milestonesList = projectItems.filter((i) => i.type === "milestone")

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 bg-[hsl(var(--surface))]">
      {/* ======================================================== */}
      {/* 1. Header Bar: Workspace Initiatives + Switcher + Create */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <FolderKanban className="size-5 text-[hsl(var(--signal))]" />
              Workspace Projects
            </h2>
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[hsl(var(--signal))] font-semibold">
              ACTIVE
            </span>
          </div>
          <p className="text-xs text-white/55 tracking-normal mt-0.5 font-sans">
            Manage your codebases, track development tasks, and collaborate with FRIDAY.
          </p>
        </div>

        {/* Project Selector & Create Action */}
        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <select
              aria-label="Active Project"
              value={activeProject.id}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="appearance-none font-mono text-xs text-white/90 bg-[#161719] border border-white/15 rounded-xl px-4 py-2 pr-9 hover:border-white/25 focus:outline-none focus:border-[hsl(var(--signal))] cursor-pointer transition-colors shadow-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#161719] text-white">
                  {p.name} {p.id === activeProject.id ? "• Active" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 text-white/50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <CreateNewDisclosure
            onSelectItem={handleCreateNewType}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Auto-Discovered Desktop Repositories Shelf           */}
      {/* ======================================================== */}
      {discoveredRepos.length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-[#141517]/80 p-4 backdrop-blur-md shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <FolderGit2 className="size-4 text-[hsl(var(--signal))]" />
              <span className="font-sans text-xs font-semibold text-white/90">
                Projects on Your Desktop ({discoveredRepos.length})
              </span>
              <span className="font-mono text-[10px] text-white/40">
                • 1-Click Connect
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReposShelf((prev) => !prev)}
              className="font-mono text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              {showReposShelf ? "Collapse [-]" : "Expand [+]"}
            </button>
          </div>

          {showReposShelf && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {discoveredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:border-white/20 hover:bg-white/[0.04] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-xs text-white truncate max-w-[140px]">
                        {repo.name}
                      </span>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[hsl(var(--signal))]">
                        {repo.framework}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-white/40 truncate mb-2" title={repo.path}>
                      {repo.path}
                    </p>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-white/50 mb-3">
                      <span>Pkg: {repo.packageManager}</span>
                      <span>•</span>
                      <span>Branch: {repo.gitBranch || "main"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleImportRepo(repo)}
                    className="w-full text-center py-1.5 px-2 rounded-lg font-mono text-[10px] font-semibold border border-white/10 bg-white/5 hover:bg-[hsl(var(--signal))] hover:text-black hover:border-transparent text-white/80 transition-all cursor-pointer"
                  >
                    Open in FRIDAY
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Primary Engine Directive Hero Card (Dynamic)         */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-white/15 bg-[#18191B] p-5 mb-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[hsl(var(--signal))]" />
            <span className="font-mono text-[10px] tracking-wider uppercase font-semibold text-white/60">
              PRIMARY ENGINE DIRECTIVE
            </span>
            <span className="font-mono text-[10px] text-white/40">
              ID: {activeProject.id.toUpperCase()}
            </span>
            {activeProject.framework && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">
                {activeProject.framework}
              </span>
            )}
          </div>
          <span className="font-mono text-xs font-semibold text-[hsl(var(--signal))]">
            {progressPercent}% PROGRESS
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold tracking-tight text-white">
              {activeProject.name}
            </h3>
            <p className="text-xs text-white/70 mt-1.5 leading-relaxed max-w-3xl">
              {activeProject.directive}
            </p>

            {/* Precision Progress Bar */}
            <div className="mt-4">
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--signal))] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Action Bar for Active Directive */}
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleDecomposeTasks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border border-white/15 bg-white/5 hover:border-[hsl(var(--signal))] hover:text-[hsl(var(--signal))] text-white transition-colors cursor-pointer"
              >
                <Sparkles className="size-3.5 text-[hsl(var(--signal))]" />
                Decompose Directive into Tasks
              </button>
              {activeProject.rootPath && (
                <span className="font-mono text-[10px] text-white/40 truncate max-w-sm">
                  Path: {activeProject.rootPath}
                </span>
              )}
            </div>
          </div>

          {/* Terse Monospace Metrics */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-3 lg:pt-0 lg:pl-6">
            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">TTS Engine</span>
              <span className="font-mono text-xs text-white/80 font-medium">
                {activeProject.ttsEngine || "Piper v1.2"}
              </span>
            </div>
            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">Search Fallback</span>
              <span className="font-mono text-xs text-[hsl(var(--signal))] font-medium">
                {activeProject.searchEngine || "DuckDuckGo Crawler"}
              </span>
            </div>
            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">Target Delivery</span>
              <span className="font-mono text-xs text-white/80 font-medium">
                {activeProject.targetDelivery || "Sprint 42"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Search & Filter Bar                                   */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          {[
            { id: "all", label: "All Items" },
            { id: "task", label: `Tasks (${projectTasks.length})` },
            { id: "goal", label: `Goals (${goalsList.length})` },
            { id: "milestone", label: `Milestones (${milestonesList.length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer",
                activeFilter === f.id
                  ? "bg-white/15 text-white font-semibold border border-white/20"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter initiatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs font-mono bg-black/30 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))] w-48 sm:w-64"
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. Main Workspace Ledger Content                         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Actionable Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
              <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                Actionable Tasks ({pendingTasks.length} Pending / {completedTasks.length} Completed)
              </span>
              <span className="font-mono text-[10px] text-white/40">
                {progressPercent}% RESOLVED
              </span>
            </div>

            {/* Inline Add Task Form */}
            <form onSubmit={handleInlineAddTask} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add actionable task for FRIDAY..."
                value={inlineTaskText}
                onChange={(e) => setInlineTaskText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-mono font-semibold rounded-lg bg-[hsl(var(--signal))] text-black hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" />
                Add Task
              </button>
            </form>

            {/* Task Item Rows */}
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all",
                    item.status === "done"
                      ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleTaskStatus(item.id)}
                    className="mt-0.5 text-white/40 hover:text-[hsl(var(--signal))] transition-colors cursor-pointer"
                    aria-label={`Toggle ${item.title}`}
                  >
                    {item.status === "done" ? (
                      <CheckCircle2 className="size-4 text-[hsl(var(--signal))]" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium text-white truncate",
                          item.status === "done" && "line-through text-white/50"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.tag && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded border border-white/10 bg-white/5 text-white/60">
                          {item.tag}
                        </span>
                      )}
                      {item.priority === "critical" && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded border border-red-500/30 bg-red-500/10 text-red-400">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px] text-white/40">
                    {item.dueDate && <span>{item.dueDate}</span>}
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="py-8 text-center font-mono text-xs text-white/30">
                  No items matching filter in this workspace.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Strategic Goals & Milestones */}
        <div className="space-y-4">
          {/* Goals Card */}
          <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
              <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                Strategic Goals
              </span>
              <Target className="size-3.5 text-[hsl(var(--signal))]" />
            </div>

            <div className="space-y-3">
              {goalsList.map((g) => (
                <div key={g.id} className="p-3 rounded-xl border border-white/[0.06] bg-[#141517]/60">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-white/80">{g.title}</span>
                    <span className="font-mono text-[10px] text-[hsl(var(--signal))] font-semibold">
                      {g.progress || 0}%
                    </span>
                  </div>
                  {g.description && (
                    <p className="text-[11px] text-white/50 mb-2 leading-relaxed">
                      {g.description}
                    </p>
                  )}
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[hsl(var(--signal))] rounded-full"
                      style={{ width: `${g.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones Card */}
          <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
              <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                Delivery Milestones
              </span>
              <Flag className="size-3.5 text-white/40" />
            </div>

            <div className="space-y-2.5">
              {milestonesList.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl border border-white/[0.06] bg-[#141517]/60">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-white/80 truncate">{m.title}</span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-white/40">
                    <span>Due {m.dueDate || "TBD"}</span>
                    <span className="text-[hsl(var(--signal))] capitalize">{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. Project Scaffolding Studio Modal (Better-T-Stack etc.) */}
      {/* ======================================================== */}
      {scaffoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#18191B] border border-white/20 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-5 text-[hsl(var(--signal))]" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    Create New Project
                  </h3>
                  <p className="text-xs text-white/50 font-sans">
                    Choose a beginner-friendly template to initialize your workspace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScaffoldModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteScaffold} className="p-6 space-y-5">
              {/* Archetype Selector Matrix */}
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2 font-sans">
                  Choose a Starting Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SCAFFOLD_ARCHETYPES.map((arch) => {
                    const isSelected = selectedArchetype === arch.id
                    return (
                      <div
                        key={arch.id}
                        onClick={() => {
                          setSelectedArchetype(arch.id)
                          if (!scaffoldName || scaffoldName.startsWith("my-")) {
                            setScaffoldName(arch.defaultProjectName || "my-app")
                          }
                        }}
                        className={cn(
                          "p-3.5 rounded-xl border text-left cursor-pointer transition-all",
                          isSelected
                            ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))/0.10] shadow-[0_0_15px_-3px_hsl(var(--signal)/0.3)]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-white">
                            {arch.friendlyName || arch.name}
                          </span>
                          <span className={cn(
                            "text-[9px] font-mono px-2 py-0.5 rounded-full font-medium",
                            isSelected
                              ? "bg-[hsl(var(--signal))] text-black"
                              : "bg-white/10 text-[hsl(var(--signal))]"
                          )}>
                            {arch.badge || arch.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed mb-2 line-clamp-2">
                          {arch.beginnerSummary || arch.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(arch.whatYouGet || arch.features.slice(0, 2)).map((feature, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-white/70 font-mono">
                              ✓ {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Name & Directory Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1 font-sans">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. my-portfolio"
                    value={scaffoldName}
                    onChange={(e) => setScaffoldName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1 font-sans">
                    Location on Your PC (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to Desktop/projectName"
                    value={scaffoldDir}
                    onChange={(e) => setScaffoldDir(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-white/40 font-sans">
                  Ready in seconds • All files stored locally on your PC
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScaffoldModalOpen(false)}
                    className="px-4 py-2 text-xs text-white/60 hover:text-white font-sans cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isScaffolding}
                    className="px-5 py-2 text-xs font-semibold rounded-lg bg-[hsl(var(--signal))] text-black hover:opacity-90 font-sans transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {isScaffolding ? "Creating Project..." : "Create Project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. Quick Create Item Modal (Task, Goal, etc.)            */}
      {/* ======================================================== */}
      {quickCreateType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-[#1C1E1D] border border-white/15 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white text-sm capitalize">
                New {quickCreateType}
              </h3>
              <button
                type="button"
                onClick={() => setQuickCreateType(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickItem} className="p-5 space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-white/50 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={`e.g. My new ${quickCreateType}`}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-white/50 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional details or context for FRIDAY"
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setQuickCreateType(null)}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--signal))] text-black hover:opacity-90 cursor-pointer font-mono transition-opacity"
                >
                  Save {quickCreateType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectsTab
