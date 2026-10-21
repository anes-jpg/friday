import React, { useState, useEffect, useRef } from "react"
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
  Terminal,
  GitBranch,
  Play,
  Settings,
  Trash2,
  Wrench,
  ShieldCheck,
  FolderOpen,
  Square,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  WatermelonBentoCard,
  WatermelonSegmentedTabs,
  InlineMarkdownText,
  AnimatedTaskRow,
} from "./BenchoWatermelonPrimitives"
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
import { InAppCodeStudio } from "@/components/project/InAppCodeStudio"
import { InAppTerminal } from "@/components/project/InAppTerminal"
import { InAppGitViewer } from "@/components/project/InAppGitViewer"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type {
  ProjectWorkspace,
  WorkspaceItem,
  DiscoveredRepo,
  ProjectArchetypeId,
  RiskTier,
  ProjectTabSubView,
  ProjectMetadata,
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
  inspectProjectMetadata,
  initProjectGit,
  executeProjectCommand,
  generateRealTasksFromMetadata,
} from "@/lib/workflow"

export const ProjectsTab: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWorkspace[]>(() => loadProjectWorkspaces())
  const [activeProjectId, setActiveId] = useState<string>(() => getActiveProjectId())
  const [items, setItems] = useState<WorkspaceItem[]>(() => loadWorkspaceItems())
  const [discoveredRepos, setDiscoveredRepos] = useState<DiscoveredRepo[]>([])
  const [showReposShelf, setShowReposShelf] = useState<boolean>(false)
  const [isScanningRepos, setIsScanningRepos] = useState<boolean>(false)

  // Sub-navigation view: roadmap | code | terminal | git | settings
  const [activeSubView, setActiveSubView] = useState<ProjectTabSubView>("roadmap")

  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [inlineTaskText, setInlineTaskText] = useState("")

  // Autonomous execution tracking & cancellation
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null)
  const executionAbortControllerRef = useRef<AbortController | null>(null)

  // Real on-disk project metadata state
  const [liveMeta, setLiveMeta] = useState<ProjectMetadata | null>(null)
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false)
  const [isInitializingGit, setIsInitializingGit] = useState<boolean>(false)

  // Scaffolding & Quick Create Modals
  const [scaffoldModalOpen, setScaffoldModalOpen] = useState<boolean>(false)
  const [scaffoldMode, setScaffoldMode] = useState<"templates" | "ai" | "import">("templates")
  const [selectedArchetype, setSelectedArchetype] = useState<ProjectArchetypeId>("better-t-stack")
  const [scaffoldName, setScaffoldName] = useState<string>("")
  const [scaffoldDir, setScaffoldDir] = useState<string>("")
  const [scaffoldPackageManager, setScaffoldPackageManager] = useState<"pnpm" | "bun" | "npm">("pnpm")
  const [scaffoldDirective, setScaffoldDirective] = useState<string>("")
  const [tstackPreset, setTstackPreset] = useState<"fullstack" | "api" | "spa">("fullstack")
  const [aiIdeaPrompt, setAiIdeaPrompt] = useState<string>("")
  const [importFolderPath, setImportFolderPath] = useState<string>("")
  const [importFramework, setImportFramework] = useState<string>("React + Vite")
  const [isScaffolding, setIsScaffolding] = useState<boolean>(false)

  // Custom Objective Modal
  const [customObjectiveModalOpen, setCustomObjectiveModalOpen] = useState(false)
  const [customObjectiveText, setCustomObjectiveText] = useState("")

  const [quickCreateType, setQuickCreateType] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState("")
  const [quickDesc, setQuickDesc] = useState("")

  // Active project resolution
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || {
      id: "proj-1",
      name: "FRIDAY Desktop Operator",
      directive: "Intelligent, voice-first Windows desktop controller and developer workstation.",
      rootPath: "C:\\Users\\anesx\\Desktop\\friday",
      framework: "Tauri v2 + Rust",
      status: "active" as const,
      priority: "critical" as const,
      tags: ["Core", "Windows", "Voice", "Rust"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

  // Fetch real on-disk metadata whenever active project changes
  useEffect(() => {
    if (!activeProject.rootPath) {
      setLiveMeta(null)
      return
    }
    let isMounted = true
    setIsLoadingMeta(true)
    inspectProjectMetadata(activeProject.rootPath)
      .then((meta) => {
        if (isMounted) {
          setLiveMeta(meta)
          setIsLoadingMeta(false)
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingMeta(false)
      })
    return () => {
      isMounted = false
    }
  }, [activeProject.id, activeProject.rootPath])

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

  // Calculate project progress dynamically from tasks (strictly 0% if 0 tasks completed)
  const projectTasks = projectItems.filter((it) => it.type === "task")
  const completedTasksCount = projectTasks.filter((it) => it.status === "done").length
  const totalTasksCount = projectTasks.length
  const progressPercent =
    totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : activeProject.status === "completed"
      ? 100
      : 0

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

  // Stop currently executing task
  const handleStopTaskExecution = (taskId: string) => {
    if (executionAbortControllerRef.current) {
      executionAbortControllerRef.current.abort()
      executionAbortControllerRef.current = null
    }
    setExecutingTaskId(null)
    setItems((prev) =>
      prev.map((it) => (it.id === taskId ? { ...it, status: "todo" } : it))
    )
    toast.info("Task execution stopped.")
  }

  // Autonomous Task Execution with FRIDAY (supports scripts & agent directives)
  const handleRunWithFriday = async (item: WorkspaceItem) => {
    if (executingTaskId) {
      toast.warning("Another task is currently executing.")
      return
    }

    setExecutingTaskId(item.id)
    const abortCtrl = new AbortController()
    executionAbortControllerRef.current = abortCtrl

    toast.info(`FRIDAY is executing: "${item.title}"...`)

    // Detect if this is an executable npm/pnpm script task
    const isScriptTask =
      item.tag === "Terminal" ||
      item.tag === "Build" ||
      item.title.toLowerCase().includes("run dev") ||
      item.title.toLowerCase().includes("build")

    // Safety timeout: auto-release after 25s
    const timeoutId = setTimeout(() => {
      if (executionAbortControllerRef.current === abortCtrl) {
        executionAbortControllerRef.current = null
        setExecutingTaskId(null)
        toast.warning("Task execution reached timeout limit (25s). Check In-App Terminal.")
      }
    }, 25000)

    try {
      if (isScriptTask && activeProject.rootPath) {
        let cmd = ""
        const match = item.title.match(/\(([^)]+)\)/)
        if (match && match[1]) {
          cmd = match[1]
        } else if (item.title.toLowerCase().includes("dev")) {
          const pm = liveMeta?.packageManager || "npm"
          cmd = `${pm} run dev`
        } else if (item.title.toLowerCase().includes("build")) {
          const pm = liveMeta?.packageManager || "npm"
          cmd = `${pm} run build`
        }

        if (cmd) {
          toast.info(`Running '${cmd}' in In-App Terminal runner...`)
          const result = await executeProjectCommand(activeProject.rootPath, cmd)
          if (abortCtrl.signal.aborted) return

          if (result.exit_code === 0) {
            setItems((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, status: "done" } : it))
            )
            toast.success(`'${cmd}' completed successfully!`)
          } else {
            toast.error(
              `Script exited with code ${result.exit_code}: ${
                result.stderr.slice(0, 100) || "Check terminal for error"
              }`
            )
            setActiveSubView("terminal")
          }
          return
        }
      }

      // Voice/agent directive dispatch
      const directivePrompt = `[Project: ${activeProject.name} at ${activeProject.rootPath || ""}] Execute task: ${item.title}. Details: ${item.description || "Implement and verify changes."}`
      if (isDesktop) {
        await invokeCommand("submit_utterance", { utterance: directivePrompt, mode: "command" })
      }

      if (abortCtrl.signal.aborted) return

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "done" } : it))
      )
      toast.success(`FRIDAY completed: "${item.title}"!`)
    } catch (e) {
      if (!abortCtrl.signal.aborted) {
        toast.error(`Execution error: ${e}`)
      }
    } finally {
      clearTimeout(timeoutId)
      if (executionAbortControllerRef.current === abortCtrl) {
        executionAbortControllerRef.current = null
        setExecutingTaskId(null)
      }
    }
  }

  // 1-Click Git Initialization for projects without git repo
  const handleInitGit = async () => {
    if (!activeProject.rootPath) return
    setIsInitializingGit(true)
    try {
      const res = await initProjectGit(activeProject.rootPath)
      toast.success(res || "Git initialized successfully!")
      const fresh = await inspectProjectMetadata(activeProject.rootPath)
      if (fresh) setLiveMeta(fresh)
    } catch (e) {
      toast.error(`Failed to initialize git: ${e}`)
    } finally {
      setIsInitializingGit(false)
    }
  }

  // 1-Click Codebase Inspection & Real Task Generation
  const handleInspectAndGenerateTasks = async () => {
    if (!activeProject.rootPath) {
      toast.error("No project root path found")
      return
    }
    toast.info(`Inspecting codebase at ${activeProject.rootPath}...`)
    try {
      const meta = await inspectProjectMetadata(activeProject.rootPath)
      if (!meta) {
        toast.error("Could not inspect project metadata")
        return
      }
      setLiveMeta(meta)
      const realTasks = generateRealTasksFromMetadata(activeProject.id, meta, activeProject.rootPath)
      setItems((prev) => {
        const otherProjectsItems = prev.filter(
          (it) => it.projectId && it.projectId !== activeProject.id
        )
        return [...realTasks, ...otherProjectsItems]
      })
      toast.success(`Generated ${realTasks.length} real tasks from ${meta.name} codebase!`)
    } catch (e) {
      toast.error(`Inspection error: ${e}`)
    }
  }

  // Ask FRIDAY callback for InAppCodeStudio and InAppGitViewer
  const handleAskFridayPrompt = async (prompt: string) => {
    toast.info("Dispatched instruction to FRIDAY...")
    try {
      if (isDesktop) {
        await invokeCommand("submit_utterance", { utterance: prompt, mode: "command" })
      }
      toast.success("FRIDAY accepted task directive!")
    } catch (e) {
      toast.error(`FRIDAY execution error: ${e}`)
    }
  }

  const handleCreateNewType = (typeLabel: string) => {
    const lower = typeLabel.toLowerCase()
    if (lower === "project") {
      setScaffoldMode("templates")
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

  // Adjust goal progress
  const handleAdvanceGoalProgress = (goalId: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === goalId) {
          const current = it.progress || 0
          const next = Math.min(100, Math.max(0, current + delta))
          return { ...it, progress: next, status: next === 100 ? "done" : "in-progress" }
        }
        return it
      })
    )
  }

  // Toggle milestone status
  const toggleMilestoneStatus = (milestoneId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === milestoneId) {
          const next = it.status === "done" ? "in-progress" : "done"
          return { ...it, status: next }
        }
        return it
      })
    )
  }

  // Scaffolding execution
  const handleExecuteScaffold = async (e: React.FormEvent) => {
    e.preventDefault()

    if (scaffoldMode === "ai") {
      if (!aiIdeaPrompt.trim()) {
        toast.error("Please describe your project idea")
        return
      }
      setIsScaffolding(true)
      try {
        const cleanIdea = aiIdeaPrompt.trim()
        const synthName = cleanIdea.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, "-") || "ai-project"
        const created = await scaffoldProjectWorkspace("better-t-stack", synthName)
        created.directive = `Deliver ${cleanIdea} with high fidelity and automated operator verification.`
        setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
        setActiveId(created.id)
        setScaffoldModalOpen(false)
        setAiIdeaPrompt("")
        // Decompose initial roadmap
        const seedTasks = decomposeDirectiveIntoTasks(created.id, created.directive, created.name, cleanIdea)
        setItems((prev) => [...seedTasks, ...prev])
        toast.success(`Generated project "${created.name}" and initialized roadmap!`)
      } catch {
        toast.error("Failed to generate AI project")
      } finally {
        setIsScaffolding(false)
      }
      return
    }

    if (scaffoldMode === "import") {
      if (!importFolderPath.trim()) {
        toast.error("Please provide a folder path on your computer")
        return
      }
      setIsScaffolding(true)
      try {
        const folderName = importFolderPath.trim().split(/[\\/]/).pop() || "imported-project"
        const meta = await inspectProjectMetadata(importFolderPath.trim())
        const imported: ProjectWorkspace = {
          id: `proj-${folderName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: meta?.name || folderName,
          directive: meta?.description || `Local repository at ${importFolderPath.trim()}`,
          rootPath: importFolderPath.trim(),
          framework: meta?.framework || importFramework,
          packageManager: meta?.packageManager || "npm",
          status: "active",
          priority: "high",
          tags: [meta?.framework || importFramework, "Local"],
          metadata: meta || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setProjects((prev) => [imported, ...prev.filter((p) => p.id !== imported.id)])
        setActiveId(imported.id)
        setActiveProjectId(imported.id)
        setScaffoldModalOpen(false)
        setImportFolderPath("")
        if (meta) {
          const realTasks = generateRealTasksFromMetadata(imported.id, meta, importFolderPath.trim())
          setItems((prev) => [...realTasks, ...prev])
        }
        toast.success(`Connected "${imported.name}" to FRIDAY!`)
      } catch (e) {
        toast.error(`Import failed: ${e}`)
      } finally {
        setIsScaffolding(false)
      }
      return
    }

    if (!scaffoldName.trim()) {
      toast.error("Please provide a project name")
      return
    }

    setIsScaffolding(true)
    try {
      const created = await scaffoldProjectWorkspace(
        selectedArchetype,
        scaffoldName.trim(),
        scaffoldDir.trim() || undefined,
        scaffoldPackageManager,
        scaffoldDirective
      )
      setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
      setActiveId(created.id)
      setActiveProjectId(created.id)
      setScaffoldModalOpen(false)
      setScaffoldName("")
      setScaffoldDir("")
      setScaffoldDirective("")
      if (selectedArchetype === "better-t-stack") {
        toast.success(
          `Better-T-Stack initialized! The rest is left for FRIDAY to take care of.`
        )
      } else {
        toast.success(
          `Project "${created.name}" is ready! You can now edit code and run scripts in FRIDAY.`
        )
      }
    } catch {
      toast.error("Failed to create project workspace")
    } finally {
      setIsScaffolding(false)
    }
  }

  const handleImportRepo = async (repo: DiscoveredRepo) => {
    try {
      const imported = await importDiscoveredRepo(repo)
      setProjects((prev) => [imported, ...prev.filter((p) => p.id !== imported.id)])
      setActiveId(imported.id)
      setActiveProjectId(imported.id)
      toast.success(`Connected "${repo.name}" to FRIDAY! You can now manage it with zero VS Code reliance.`)
    } catch (e) {
      toast.error(`Failed to import repository: ${e}`)
    }
  }

  // Decompose Directive / Initialize Roadmap
  const handleDecomposeTasks = () => {
    const generated = decomposeDirectiveIntoTasks(
      activeProject.id,
      activeProject.directive,
      activeProject.name
    )
    setItems((prev) => [...generated, ...prev])
    toast.success(`Generated ${generated.length} custom tasks & milestones for "${activeProject.name}"!`)
  }

  // Custom Objective Decomposition
  const handleCustomDecompose = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customObjectiveText.trim()) return

    const generated = decomposeDirectiveIntoTasks(
      activeProject.id,
      activeProject.directive,
      activeProject.name,
      customObjectiveText.trim()
    )
    setItems((prev) => [...generated, ...prev])
    toast.success(`Added ${generated.length} tasks for: "${customObjectiveText.trim()}"`)
    setCustomObjectiveText("")
    setCustomObjectiveModalOpen(false)
  }

  // Delete project
  const handleDeleteProject = (projId: string) => {
    if (projects.length <= 1) {
      toast.error("Cannot delete the only remaining workspace")
      return
    }
    const ok = window.confirm(`Remove workspace "${activeProject.name}" from FRIDAY? (Local files will remain safe).`)
    if (!ok) return

    setProjects((prev) => prev.filter((p) => p.id !== projId))
    const remaining = projects.filter((p) => p.id !== projId)
    if (remaining[0]) {
      setActiveId(remaining[0].id)
      setActiveProjectId(remaining[0].id)
    }
    toast.success("Workspace removed from FRIDAY")
    setActiveSubView("roadmap")
  }

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
            Full-stack in-app developer environment. Edit code, run scripts, and manage tasks with zero VS Code reliance.
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
                    Manage in FRIDAY
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
      <WatermelonBentoCard className="p-6 mb-6">
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
              <InlineMarkdownText text={liveMeta?.description || activeProject.directive} />
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

            {/* In-App Developer Tooling Quick Launchers */}
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setActiveSubView("code")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer",
                  activeSubView === "code"
                    ? "bg-[hsl(var(--signal))] text-black border-transparent"
                    : "border-white/15 bg-white/5 hover:border-[hsl(var(--signal))] hover:text-[hsl(var(--signal))] text-white"
                )}
              >
                <Code2 className="size-3.5" />
                In-App Code Studio
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView("terminal")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer",
                  activeSubView === "terminal"
                    ? "bg-[hsl(var(--signal))] text-black border-transparent"
                    : "border-white/15 bg-white/5 hover:border-[hsl(var(--signal))] hover:text-[hsl(var(--signal))] text-white"
                )}
              >
                <Terminal className="size-3.5" />
                Run Scripts / Terminal
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView("git")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer",
                  activeSubView === "git"
                    ? "bg-[hsl(var(--signal))] text-black border-transparent"
                    : "border-white/15 bg-white/5 hover:border-[hsl(var(--signal))] hover:text-[hsl(var(--signal))] text-white"
                )}
              >
                <GitBranch className="size-3.5" />
                Git Changes & Diff
              </button>

              <button
                type="button"
                onClick={handleInspectAndGenerateTasks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border border-[hsl(var(--signal))/0.3] bg-[hsl(var(--signal))/0.08] hover:bg-[hsl(var(--signal))/0.2] text-[hsl(var(--signal))] transition-colors cursor-pointer"
                title="Scan project files and generate real development tasks based on package scripts and git status"
              >
                <Sparkles className="size-3.5 text-current" />
                Inspect & Generate Tasks
              </button>

              <button
                type="button"
                onClick={() => setCustomObjectiveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border border-white/10 bg-white/[0.02] hover:bg-white/5 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <Sparkles className="size-3.5 text-[hsl(var(--signal))]" />
                Decompose Objective
              </button>

              {activeProject.rootPath && (
                <span className="font-mono text-[10px] text-white/40 truncate max-w-xs ml-auto">
                  Path: {activeProject.rootPath}
                </span>
              )}
            </div>
          </div>

          {/* Real On-Disk Project Telemetry */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2.5 border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-3 lg:pt-0 lg:pl-6">
            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">Package Manager</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-xs text-[hsl(var(--signal))] font-semibold">
                  {liveMeta?.packageManager || activeProject.packageManager || "npm"}
                </span>
                {liveMeta && (
                  <span className="font-mono text-[10px] text-white/50">
                    ({liveMeta.dependenciesCount} deps · {liveMeta.devDependenciesCount} dev)
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">Git Status</span>
              {liveMeta?.gitBranch ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <GitBranch className="size-3 text-white/60" />
                  <span className="font-mono text-xs text-white/85 font-medium">
                    {liveMeta.gitBranch}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[9px] px-1.5 py-0.2 rounded border",
                      liveMeta.uncommittedChangesCount > 0
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-white/10 bg-white/5 text-white/50"
                    )}
                  >
                    {liveMeta.uncommittedChangesCount > 0
                      ? `${liveMeta.uncommittedChangesCount} modified`
                      : "clean"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[11px] text-white/50">No Git repository</span>
                  <button
                    type="button"
                    onClick={handleInitGit}
                    disabled={isInitializingGit}
                    className="font-mono text-[9px] px-2 py-0.5 rounded border border-[hsl(var(--signal))/0.3] bg-[hsl(var(--signal))/0.1] text-[hsl(var(--signal))] hover:bg-[hsl(var(--signal))] hover:text-black font-semibold transition-colors cursor-pointer"
                  >
                    {isInitializingGit ? "Initing..." : "Init Git"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="block font-mono text-[10px] text-white/40 uppercase">Codebase Scope</span>
              <span className="font-mono text-xs text-white/80 font-medium block mt-0.5">
                {liveMeta ? `${liveMeta.totalFilesCount} files tracked` : "Local Workspace"}
              </span>
              {liveMeta?.lastModified && (
                <span className="font-mono text-[10px] text-white/40 block">
                  Last active: {liveMeta.lastModified}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Real Runnable Package Scripts */}
        {liveMeta?.scripts && liveMeta.scripts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-white/40 uppercase mr-1">Package Scripts:</span>
            {liveMeta.scripts.map((sc) => (
              <button
                key={sc.name}
                type="button"
                onClick={() => {
                  setActiveSubView("terminal")
                  toast.info(`Opening In-App Terminal for '${liveMeta.packageManager || "npm"} run ${sc.name}'`)
                }}
                className="font-mono text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:border-[hsl(var(--signal))/0.4] hover:bg-[hsl(var(--signal))/0.1] text-white/85 hover:text-[hsl(var(--signal))] transition-colors cursor-pointer flex items-center gap-1.5"
                title={sc.command}
              >
                <Play className="size-2.5 text-[hsl(var(--signal))]" />
                {sc.name}
              </button>
            ))}
          </div>
        )}
      </WatermelonBentoCard>

      {/* ======================================================== */}
      {/* 4. Sub-View Segmented Switcher                           */}
      {/* ======================================================== */}
      <div className="mb-5 pb-3 border-b border-white/[0.08]">
        <WatermelonSegmentedTabs<ProjectTabSubView>
          tabs={[
            { id: "roadmap", label: "📋 Roadmap & Tasks", badge: projectTasks.length },
            { id: "code", label: "💻 Code Studio & Files" },
            { id: "terminal", label: "⚡ Terminal & Scripts" },
            { id: "git", label: "🔀 Git & Diff Review" },
            { id: "settings", label: "⚙️ Project Settings" },
          ]}
          activeTab={activeSubView}
          onChange={(tab) => setActiveSubView(tab as ProjectTabSubView)}
        />
      </div>

      {/* ======================================================== */}
      {/* 5. Sub-View Dynamic Content Router                       */}
      {/* ======================================================== */}

      {/* ── SUB-VIEW: IN-APP CODE STUDIO ─────────────────────── */}
      {activeSubView === "code" && (
        <InAppCodeStudio
          projectPath={activeProject.rootPath || `C:\\Users\\anesx\\Desktop\\${activeProject.name}`}
          projectName={activeProject.name}
          onAskFriday={handleAskFridayPrompt}
        />
      )}

      {/* ── SUB-VIEW: IN-APP TERMINAL ────────────────────────── */}
      {activeSubView === "terminal" && (
        <InAppTerminal
          projectPath={activeProject.rootPath || `C:\\Users\\anesx\\Desktop\\${activeProject.name}`}
          projectName={activeProject.name}
        />
      )}

      {/* ── SUB-VIEW: IN-APP GIT VIEWER ──────────────────────── */}
      {activeSubView === "git" && (
        <InAppGitViewer
          projectPath={activeProject.rootPath || `C:\\Users\\anesx\\Desktop\\${activeProject.name}`}
          projectName={activeProject.name}
          onAskFriday={handleAskFridayPrompt}
        />
      )}

      {/* ── SUB-VIEW: PROJECT SETTINGS ───────────────────────── */}
      {activeSubView === "settings" && (
        <div className="rounded-2xl border border-white/10 bg-[#161719] p-6 max-w-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div>
              <h4 className="font-semibold text-white text-base">Project Settings</h4>
              <p className="text-xs text-white/50">Manage workspace configurations and directives.</p>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteProject(activeProject.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Remove Workspace
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-white/50 mb-1">Project Name</label>
              <input
                type="text"
                value={activeProject.name}
                onChange={(e) => {
                  const val = e.target.value
                  setProjects((prev) =>
                    prev.map((p) => (p.id === activeProject.id ? { ...p, name: val } : p))
                  )
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-white/50 mb-1">Local Directory Path</label>
              <input
                type="text"
                value={activeProject.rootPath || ""}
                onChange={(e) => {
                  const val = e.target.value
                  setProjects((prev) =>
                    prev.map((p) => (p.id === activeProject.id ? { ...p, rootPath: val } : p))
                  )
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-white/50 mb-1">Directive / Mission</label>
              <textarea
                rows={3}
                value={activeProject.directive}
                onChange={(e) => {
                  const val = e.target.value
                  setProjects((prev) =>
                    prev.map((p) => (p.id === activeProject.id ? { ...p, directive: val } : p))
                  )
                }}
                className="w-full px-3 py-2 text-xs font-sans bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW: ROADMAP & TASKS (DEFAULT) ──────────────── */}
      {activeSubView === "roadmap" && (
        <>
          {/* Empty Roadmap Callout (e.g. for newly selected projects like foxxon protein) */}
          {projectItems.length === 0 && (
            <div className="mb-6 rounded-2xl border border-[hsl(var(--signal))/0.3] bg-[hsl(var(--signal))/0.04] p-5 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="size-6 text-[hsl(var(--signal))] flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white text-sm">
                    Initialize Roadmap with FRIDAY
                  </h4>
                  <p className="text-xs text-white/60 mt-0.5">
                    This project has no active ledger items yet. Let FRIDAY automatically generate tailored architectural tasks, goals, and milestones for {activeProject.name}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDecomposeTasks}
                className="px-4 py-2 rounded-xl font-mono text-xs font-semibold bg-[hsl(var(--signal))] text-black hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Sparkles className="size-3.5" />
                Initialize Tasks Now
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
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

          {/* Main Workspace Ledger: Tasks (Left 2 cols) & Goals/Milestones (Right col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Actionable Tasks */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                    Actionable Tasks ({pendingTasks.length} Pending / {completedTasks.length} Completed)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleInspectAndGenerateTasks}
                      className="font-mono text-[10px] px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:border-[hsl(var(--signal))/0.4] hover:bg-[hsl(var(--signal))/0.1] text-white/80 hover:text-[hsl(var(--signal))] transition-colors cursor-pointer flex items-center gap-1"
                      title="Inspect project files and generate real development tasks based on package scripts"
                    >
                      <Sparkles className="size-2.5 text-[hsl(var(--signal))]" />
                      Inspect & Generate Real Tasks
                    </button>
                    <span className="font-mono text-[10px] text-white/40">
                      {progressPercent}% RESOLVED
                    </span>
                  </div>
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

                {/* Task Item Rows with "Run with FRIDAY" Bridge */}
                <div className="space-y-2">
                  {filteredItems.map((item) => {
                    const isRunning = executingTaskId === item.id

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all",
                          item.status === "done"
                            ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                            : isRunning
                            ? "border-[hsl(var(--signal))/0.4] bg-[hsl(var(--signal))/0.05] shadow-[0_0_15px_-3px_hsl(var(--signal)/0.2)]"
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
                          ) : isRunning ? (
                            <div className="size-4 rounded-full border-2 border-[hsl(var(--signal))] border-t-transparent animate-spin" />
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
                              <InlineMarkdownText text={item.title} />
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
                              <InlineMarkdownText text={item.description} />
                            </p>
                          )}
                        </div>

                        {/* Run / Stop with FRIDAY autonomous action */}
                        {item.status !== "done" && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isRunning ? (
                              <button
                                type="button"
                                onClick={() => handleStopTaskExecution(item.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all cursor-pointer shadow-sm animate-pulse"
                                title="Stop active task execution"
                              >
                                <Square className="size-2.5 fill-current" />
                                Stop
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRunWithFriday(item)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-semibold bg-white/5 hover:bg-[hsl(var(--signal))/0.15] text-white/70 hover:text-[hsl(var(--signal))] border border-white/10 hover:border-[hsl(var(--signal))/0.3] transition-all cursor-pointer"
                                title="Instruct FRIDAY to execute this task"
                              >
                                <Sparkles className="size-2.5 text-[hsl(var(--signal))]" />
                                Run with FRIDAY
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 font-mono text-[10px] text-white/40 flex-shrink-0">
                          {item.dueDate && <span>{item.dueDate}</span>}
                        </div>
                      </div>
                    )
                  })}

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
              {/* Strategic Goals Card */}
              <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                    Strategic Goals ({goalsList.length})
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
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mb-2">
                        <div
                          className="h-full bg-[hsl(var(--signal))] rounded-full transition-all duration-300"
                          style={{ width: `${g.progress || 0}%` }}
                        />
                      </div>
                      {/* Interactive Progress Advancer */}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdvanceGoalProgress(g.id, 25)}
                          className="px-2 py-0.5 rounded font-mono text-[9px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                        >
                          +25%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceGoalProgress(g.id, 100)}
                          className="px-2 py-0.5 rounded font-mono text-[9px] bg-[hsl(var(--signal))/0.15] text-[hsl(var(--signal))] hover:bg-[hsl(var(--signal))] hover:text-black cursor-pointer font-semibold"
                        >
                          Achieved ✓
                        </button>
                      </div>
                    </div>
                  ))}

                  {goalsList.length === 0 && (
                    <div className="py-4 text-center font-mono text-[11px] text-white/30">
                      No strategic goals defined.
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Milestones Card */}
              <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="font-mono text-xs uppercase text-white/60 tracking-wider font-semibold">
                    Delivery Milestones ({milestonesList.length})
                  </span>
                  <Flag className="size-3.5 text-white/40" />
                </div>

                <div className="space-y-2.5">
                  {milestonesList.map((m) => (
                    <div key={m.id} className="p-2.5 rounded-xl border border-white/[0.06] bg-[#141517]/60">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-white/80 truncate">{m.title}</span>
                        <button
                          type="button"
                          onClick={() => toggleMilestoneStatus(m.id)}
                          className="text-white/40 hover:text-[hsl(var(--signal))] cursor-pointer"
                        >
                          {m.status === "done" ? (
                            <CheckCircle2 className="size-3.5 text-[hsl(var(--signal))]" />
                          ) : (
                            <Circle className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-white/40">
                        <span>Due {m.dueDate || "TBD"}</span>
                        <span className={cn(
                          "capitalize font-semibold",
                          m.status === "done" ? "text-[hsl(var(--signal))]" : "text-amber-400/80"
                        )}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {milestonesList.length === 0 && (
                    <div className="py-4 text-center font-mono text-[11px] text-white/30">
                      No milestones set.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* 6. Custom Objective Modal                                */}
      {/* ======================================================== */}
      {customObjectiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <form
            onSubmit={handleCustomDecompose}
            className="w-full max-w-lg bg-[#18191B] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[hsl(var(--signal))]" />
                <h3 className="font-semibold text-white text-sm">
                  Decompose Objective with FRIDAY
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomObjectiveModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Enter any feature, bugfix, or architectural goal you want to achieve in {activeProject.name}. FRIDAY will break it down into actionable tasks.
            </p>

            <textarea
              rows={3}
              required
              autoFocus
              placeholder="e.g. Implement user authentication with Google OAuth and session cookies..."
              value={customObjectiveText}
              onChange={(e) => setCustomObjectiveText(e.target.value)}
              className="w-full p-3 text-xs font-sans bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomObjectiveModalOpen(false)}
                className="px-4 py-2 text-xs font-mono text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-mono font-semibold rounded-xl bg-[hsl(var(--signal))] text-black hover:opacity-90 cursor-pointer"
              >
                Generate Tasks
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. Next-Gen Project Creation Studio Modal                */}
      {/* ======================================================== */}
      {scaffoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#18191B] border border-white/20 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-5 text-[hsl(var(--signal))]" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    Create New Project Workspace
                  </h3>
                  <p className="text-xs text-white/50 font-sans">
                    Scaffold a template, generate from an idea, or connect a local directory
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

            {/* Creation Mode Tabs */}
            <div className="flex border-b border-white/10 bg-[#141517]">
              {[
                { id: "templates", label: "Starter Templates" },
                { id: "ai", label: "AI Idea Generator" },
                { id: "import", label: "Connect Local Folder" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setScaffoldMode(t.id as "templates" | "ai" | "import")}
                  className={cn(
                    "flex-1 py-3 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer",
                    scaffoldMode === t.id
                      ? "border-[hsl(var(--signal))] text-white bg-white/[0.02]"
                      : "border-transparent text-white/50 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleExecuteScaffold} className="p-6 space-y-5">
              {/* Mode 1: Starter Templates */}
              {scaffoldMode === "templates" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-2 font-sans">
                      Choose a Starting Template
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
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
                              <span
                                className={cn(
                                  "text-[9px] font-mono px-2 py-0.5 rounded-full font-medium",
                                  isSelected
                                    ? "bg-[hsl(var(--signal))] text-black"
                                    : "bg-white/10 text-[hsl(var(--signal))]"
                                )}
                              >
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

                    {/* T-Stack Specific Configuration */}
                    {selectedArchetype === "better-t-stack" && (
                      <div className="p-3.5 rounded-xl border border-[hsl(var(--signal))/0.3] bg-[hsl(var(--signal))/0.04] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wider text-white/70 font-semibold flex items-center gap-1.5">
                            <Sparkles className="size-3 text-emerald-400" /> Better-T-Stack Configuration
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400">Zero Tokens Burned</span>
                        </div>

                        {/* Preset Flavors */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "fullstack", label: "Full-Stack (Default)", desc: "Next.js 15 + Hono + Drizzle + Auth" },
                            { id: "api", label: "API & Microservice", desc: "Hono API + Drizzle ORM + Zod" },
                            { id: "spa", label: "Client SPA", desc: "React 19 + TanStack Query + Tailwind" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setTstackPreset(f.id as "fullstack" | "api" | "spa")}
                              className={cn(
                                "p-2 rounded-lg border text-left cursor-pointer transition-all",
                                tstackPreset === f.id
                                  ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))/0.15] text-white"
                                  : "border-white/10 bg-black/20 text-white/60 hover:text-white hover:border-white/20"
                              )}
                            >
                              <div className="text-[11px] font-semibold truncate leading-tight">{f.label}</div>
                              <div className="text-[9px] text-white/50 truncate leading-tight mt-0.5">{f.desc}</div>
                            </button>
                          ))}
                        </div>

                        {/* Package Manager */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-white/50 shrink-0">Package Manager:</span>
                          <div className="flex items-center gap-1.5 flex-1">
                            {(["pnpm", "bun", "npm"] as const).map((pm) => (
                              <button
                                key={pm}
                                type="button"
                                onClick={() => setScaffoldPackageManager(pm)}
                                className={cn(
                                  "flex-1 py-1 px-2 rounded-md font-mono text-[10px] transition-all cursor-pointer uppercase font-medium",
                                  scaffoldPackageManager === pm
                                    ? "bg-white text-black font-semibold shadow-xs"
                                    : "bg-white/[0.04] border border-white/10 text-white/60 hover:text-white"
                                )}
                              >
                                {pm} {pm === "pnpm" && "★"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Directive for FRIDAY */}
                        <div>
                          <label className="block text-[10px] font-mono text-white/60 mb-1">
                            Directive (What should FRIDAY build for you?)
                          </label>
                          <input
                            type="text"
                            value={scaffoldDirective}
                            onChange={(e) => setScaffoldDirective(e.target.value)}
                            placeholder="e.g. E-commerce store with product cards, cart drawer, and checkout..."
                            className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1 font-sans">
                          Project Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. my-tstack-app"
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
                  </>
              )}

              {/* Mode 2: AI Idea Generator */}
              {scaffoldMode === "ai" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1 font-sans">
                      Describe Your Project Idea in Plain English
                    </label>
                    <p className="text-xs text-white/50 mb-3">
                      Tell FRIDAY what you want to create. She will configure the architecture, stack, name, and seed your development roadmap.
                    </p>
                    <textarea
                      rows={4}
                      required
                      placeholder="e.g. Build a nutrition and supplement tracking app with calorie counters, barcode lookups, and dark mode UI..."
                      value={aiIdeaPrompt}
                      onChange={(e) => setAiIdeaPrompt(e.target.value)}
                      className="w-full p-3 text-xs font-sans bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--signal))]"
                    />
                  </div>
                </div>
              )}

              {/* Mode 3: Connect Local Folder */}
              {scaffoldMode === "import" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1 font-sans">
                      Folder Path on Disk
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. C:\Users\anesx\Desktop\my-custom-project"
                      value={importFolderPath}
                      onChange={(e) => setImportFolderPath(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1 font-sans">
                      Framework / Technology Tag
                    </label>
                    <select
                      value={importFramework}
                      onChange={(e) => setImportFramework(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-[hsl(var(--signal))]"
                    >
                      <option value="React + Vite">React + Vite</option>
                      <option value="Next.js">Next.js</option>
                      <option value="Tauri + Rust">Tauri + Rust</option>
                      <option value="Python / MCP">Python / MCP</option>
                      <option value="Node.js">Node.js</option>
                      <option value="Generic Codebase">Generic Codebase</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-white/40 font-sans">
                  Zero VS Code needed • Runs entirely inside FRIDAY
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
                    {isScaffolding
                      ? "Configuring..."
                      : scaffoldMode === "ai"
                      ? "Synthesize Project"
                      : scaffoldMode === "import"
                      ? "Connect Project"
                      : "Create Project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. Quick Create Item Modal (Task, Goal, etc.)            */}
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
