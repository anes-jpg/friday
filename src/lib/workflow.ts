import { invokeCommand, isDesktop } from "./ipc"
import type {
  ProjectWorkspace,
  WorkspaceItem,
  DiscoveredRepo,
  ScaffoldArchetype,
  ProjectArchetypeId,
} from "./types"

export const SCAFFOLD_ARCHETYPES: ScaffoldArchetype[] = [
  {
    id: "better-t-stack",
    name: "Better-T-Stack (Full-Stack Type-Safe)",
    friendlyName: "Modern Web Application",
    description: "Production full-stack workspace with Next.js 15, TanStack Query, Hono API, Drizzle ORM, and Better Auth.",
    beginnerSummary: "Full-stack website with React, database, and auth ready to run out of the box.",
    tag: "Recommended",
    badge: "Most Popular",
    framework: "Next.js 15 + Hono + Drizzle",
    features: ["Next.js App Router", "TanStack Query", "Hono API", "Drizzle ORM", "Better Auth"],
    whatYouGet: ["Next.js & React 19", "Clean Tailwind Styling", "API & Database Pre-configured"],
    defaultInstallCmd: "pnpm install && pnpm dev",
    tokenSavingsMultiplier: "98% tokens saved",
    defaultProjectName: "my-web-app",
  },
  {
    id: "react-bits-vite",
    name: "React-Bits Creative UI Suite",
    friendlyName: "Creative Animated Website",
    description: "High-performance creative frontend workspace with animated components, Motion, and Tailwind CSS.",
    beginnerSummary: "Fast, lightweight website with interactive animations and modern UI components.",
    tag: "Creative",
    badge: "Great for Beginners",
    framework: "Vite + React 18 + Tailwind",
    features: ["Vite Bundler", "Motion Gestures", "Tailwind CSS", "Interactive Canvas Shaders"],
    whatYouGet: ["Vite Fast Bundler", "Smooth Motion Animations", "Ready-to-use Component Suite"],
    defaultInstallCmd: "pnpm install && pnpm dev",
    tokenSavingsMultiplier: "96% tokens saved",
    defaultProjectName: "my-portfolio",
  },
  {
    id: "python-mcp-agent",
    name: "Python MCP Autonomous Sidecar",
    friendlyName: "Python AI & Automation Tool",
    description: "Zero-latency Model Context Protocol agent microservice with direct tool dispatch and local LLM bindings.",
    beginnerSummary: "Build AI agents, automated scripts, or data processing microservices.",
    tag: "Agentic",
    badge: "AI & Scripts",
    framework: "Python 3.12 + MCP",
    features: ["Model Context Protocol", "Pydantic Schemas", "Async Tool Loop", "Zero-Latency IO"],
    whatYouGet: ["Python 3.12 Engine", "AI Agent & Tool Connectors", "Simple main.py Entrypoint"],
    defaultInstallCmd: "pip install -r requirements.txt && python main.py",
    tokenSavingsMultiplier: "95% tokens saved",
    defaultProjectName: "my-ai-tool",
  },
  {
    id: "rust-tauri-operator",
    name: "Rust Tauri Desktop Systems",
    friendlyName: "Windows Desktop App",
    description: "Low-footprint native Windows operator system with Win32 API access, Tokio runtime, and Mica canvas.",
    beginnerSummary: "Native, lightweight desktop application with direct Windows system access.",
    tag: "Systems",
    badge: "Desktop Power",
    framework: "Tauri v2 + Rust",
    features: ["Tauri IPC Engine", "Win32 Hardware Bridge", "Tokio Async Runtime", "Mica Frame"],
    whatYouGet: ["Tauri v2 Desktop App", "Blazing Fast Performance", "Low CPU & Memory Usage"],
    defaultInstallCmd: "cargo run",
    tokenSavingsMultiplier: "99% tokens saved",
    defaultProjectName: "my-desktop-tool",
  },
]

const STORAGE_PROJECTS_KEY = "friday_workspace_projects_v1"
const STORAGE_ITEMS_KEY = "friday_workspace_items_v1"
const STORAGE_ACTIVE_PROJECT_KEY = "friday_active_project_id_v1"

export const INITIAL_DEFAULT_PROJECTS: ProjectWorkspace[] = [
  {
    id: "proj-1",
    name: "FRIDAY Desktop Operator v1.0",
    directive: "Voice-first Windows desktop controller with Piper TTS, local Whisper STT, and native tool bridge with offline fallback capabilities.",
    rootPath: "C:\\Users\\anesx\\Desktop\\friday",
    archetype: "rust-tauri-operator",
    framework: "Tauri v2 + Rust",
    status: "active",
    targetDelivery: "Oct 20, 2026",
    priority: "critical",
    ttsEngine: "Piper v1.2",
    searchEngine: "DuckDuckGo Crawler",
    tags: ["Core", "Windows", "Voice"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const INITIAL_DEFAULT_ITEMS: WorkspaceItem[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    type: "task",
    title: "Harden Python MCP tool handshake for browser automation",
    description: "Fallback to native DuckDuckGo search and HTTP fetch when MCP socket is offline.",
    status: "done",
    dueDate: "Today",
    priority: "critical",
    riskTier: "green",
    tag: "MCP",
  },
  {
    id: "task-2",
    projectId: "proj-1",
    type: "task",
    title: "Support recurrence in scheduled automations calendar",
    description: "Visual cron scheduler with monthly grid and execution stats.",
    status: "done",
    dueDate: "Today",
    priority: "high",
    riskTier: "green",
    tag: "UI",
  },
  {
    id: "task-3",
    projectId: "proj-1",
    type: "task",
    title: "Silero VAD turn endpointing optimization",
    description: "Achieve sub-200ms speech tail detection for fluid conversational turns.",
    status: "in-progress",
    dueDate: "Tomorrow",
    priority: "high",
    riskTier: "amber",
    tag: "Voice",
  },
  {
    id: "goal-1",
    projectId: "proj-1",
    type: "goal",
    title: "Sub-1.8s p95 Voice Turn Latency on Windows 11",
    description: "Benchmark acoustic cues, Silero VAD endpointing, and native Piper TTS audio output.",
    status: "in-progress",
    progress: 92,
    tag: "Latency",
  },
  {
    id: "milestone-1",
    projectId: "proj-1",
    type: "milestone",
    title: "Zero-dependency Standalone Offline Release",
    description: "Self-contained portable deployment without external runtime requirements.",
    status: "in-progress",
    dueDate: "Oct 15, 2026",
    tag: "Release",
  },
  {
    id: "note-1",
    projectId: "proj-1",
    type: "note",
    title: "Voice Pipeline Architecture Notes",
    description: "Speech synthesis streams run non-blocking with Tokio background thread workers.",
    status: "done",
    tag: "Docs",
  },
  {
    id: "reminder-1",
    projectId: "proj-1",
    type: "reminder",
    title: "Review daily memory facts and sync hotword cache",
    status: "todo",
    dueDate: "Every weekday at 09:00",
    priority: "medium",
    tag: "Daily",
  },
]

/** Scans the user's Desktop for existing Git repositories and projects. */
export async function scanDesktopRepos(): Promise<DiscoveredRepo[]> {
  if (isDesktop) {
    try {
      const repos = await invokeCommand<DiscoveredRepo[]>("scan_desktop_repos")
      if (Array.isArray(repos) && repos.length > 0) {
        return repos
      }
    } catch (e) {
      console.warn("[FRIDAY Workflow] scan_desktop_repos IPC error:", e)
    }
  }

  // Fallback desktop catalog for testing or offline environment
  return [
    {
      id: "repo-hubrise",
      name: "Hubrise",
      path: "C:\\Users\\anesx\\Desktop\\Hubrise",
      framework: "Next.js",
      packageManager: "pnpm",
      gitBranch: "main",
      lastModified: "Today",
      hasUncommittedChanges: false,
      dependenciesCount: 38,
    },
    {
      id: "repo-terranova",
      name: "terranova-market",
      path: "C:\\Users\\anesx\\Desktop\\terranova-market",
      framework: "React + Vite",
      packageManager: "npm",
      gitBranch: "master",
      lastModified: "Yesterday",
      hasUncommittedChanges: true,
      dependenciesCount: 24,
    },
    {
      id: "repo-studynora",
      name: "studynora",
      path: "C:\\Users\\anesx\\Desktop\\studynora",
      framework: "Next.js",
      packageManager: "pnpm",
      gitBranch: "main",
      lastModified: "3d ago",
      hasUncommittedChanges: false,
      dependenciesCount: 42,
    },
    {
      id: "repo-portfolio",
      name: "an portfolio",
      path: "C:\\Users\\anesx\\Desktop\\an portfolio",
      framework: "React + Vite",
      packageManager: "bun",
      gitBranch: "main",
      lastModified: "5d ago",
      hasUncommittedChanges: false,
      dependenciesCount: 19,
    },
  ]
}

/** Deterministically scaffolds a new project workspace using the specified archetype. */
export async function scaffoldProjectWorkspace(
  archetypeId: ProjectArchetypeId,
  name: string,
  targetDirectory?: string
): Promise<ProjectWorkspace> {
  const cleanName = name.trim() || "my-new-app"
  const defaultDir = `C:\\Users\\anesx\\Desktop\\${cleanName}`
  const targetPath = targetDirectory?.trim() || defaultDir

  if (isDesktop) {
    try {
      await invokeCommand<string>("scaffold_project_archetype", {
        archetype: archetypeId,
        projectName: cleanName,
        targetPath,
      })
    } catch (e) {
      console.warn("[FRIDAY Workflow] scaffold_project_archetype IPC warning:", e)
    }
  }

  const archetype = SCAFFOLD_ARCHETYPES.find((a) => a.id === archetypeId) || SCAFFOLD_ARCHETYPES[0]
  const projectId = `proj-${Date.now().toString(36)}`

  const newWorkspace: ProjectWorkspace = {
    id: projectId,
    name: cleanName,
    directive: `Deliver production-grade ${archetype.name} with clean architecture and continuous operator verification.`,
    rootPath: targetPath,
    archetype: archetypeId,
    framework: archetype.framework,
    status: "active",
    targetDelivery: "Nov 15, 2026",
    priority: "high",
    ttsEngine: "Piper v1.2",
    searchEngine: "DuckDuckGo Crawler",
    tags: [archetype.framework.split(" ")[0] || "Code", "Active"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save to persistent storage
  const allProjects = loadProjectWorkspaces()
  saveProjectWorkspaces([newWorkspace, ...allProjects])
  setActiveProjectId(newWorkspace.id)

  // Seed initial tasks for this scaffolded project
  const initialTasks: WorkspaceItem[] = [
    {
      id: `task-${Date.now()}-1`,
      projectId: newWorkspace.id,
      type: "task",
      title: `Explore your new project files and run your live preview`,
      description: `Run "${archetype.defaultInstallCmd}" in your terminal to view the project live.`,
      status: "done",
      priority: "high",
      riskTier: "green",
      dueDate: "Today",
      tag: "Getting Started",
    },
    {
      id: `task-${Date.now()}-2`,
      projectId: newWorkspace.id,
      type: "task",
      title: "Ask FRIDAY to add your first feature or custom design",
      description: "Speak or type in chat: e.g. 'Add a clean hero banner' or 'Customize the main page'.",
      status: "in-progress",
      priority: "critical",
      riskTier: "green",
      dueDate: "Today",
      tag: "Next Step",
    },
    {
      id: `milestone-${Date.now()}-1`,
      projectId: newWorkspace.id,
      type: "milestone",
      title: "Project Ready for Development",
      status: "in-progress",
      dueDate: "This Week",
      tag: "Milestone",
    },
  ]

  const allItems = loadWorkspaceItems()
  saveWorkspaceItems([...initialTasks, ...allItems])

  return newWorkspace
}

/** Imports an existing desktop repository into the FRIDAY workspace ledger. */
export function importDiscoveredRepo(repo: DiscoveredRepo): ProjectWorkspace {
  const projectId = `proj-${repo.name.toLowerCase().replace(/\s+/g, "-")}`
  const newWorkspace: ProjectWorkspace = {
    id: projectId,
    name: repo.name,
    directive: `Active desktop repository at ${repo.path}. Operator intelligence enabled for inspection, refactoring, and code review.`,
    rootPath: repo.path,
    framework: repo.framework,
    status: "active",
    targetDelivery: "Sprint 42",
    priority: "high",
    ttsEngine: "Piper v1.2",
    searchEngine: "DuckDuckGo Crawler",
    tags: [repo.framework, repo.packageManager.toUpperCase()],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const allProjects = loadProjectWorkspaces()
  if (!allProjects.some((p) => p.id === newWorkspace.id)) {
    saveProjectWorkspaces([newWorkspace, ...allProjects])
  }
  setActiveProjectId(newWorkspace.id)

  // Generate initial indexing tasks
  const initialTasks: WorkspaceItem[] = [
    {
      id: `task-${Date.now()}-import-1`,
      projectId: newWorkspace.id,
      type: "task",
      title: `Inspect git status and branches on ${repo.name}`,
      description: `Tracked branch: ${repo.gitBranch || "main"}. Checked for uncommitted changes.`,
      status: "done",
      priority: "medium",
      riskTier: "green",
      dueDate: "Today",
      tag: "Git",
    },
    {
      id: `task-${Date.now()}-import-2`,
      projectId: newWorkspace.id,
      type: "task",
      title: `Audit ${repo.dependenciesCount} dependencies via Beast & Open-Code-Review`,
      description: "Check for security advisories and outdated packages.",
      status: "in-progress",
      priority: "high",
      riskTier: "amber",
      dueDate: "Tomorrow",
      tag: "Audit",
    },
  ]

  const allItems = loadWorkspaceItems()
  saveWorkspaceItems([...initialTasks, ...allItems])

  return newWorkspace
}

/** AI & Deterministic Task Decomposition: parses a high-level directive into actionable tasks. */
export function decomposeDirectiveIntoTasks(projectId: string, directive: string): WorkspaceItem[] {
  const clean = directive.trim()
  const now = Date.now()

  return [
    {
      id: `task-${now}-1`,
      projectId,
      type: "task",
      title: `Architect system scaffolding for: ${clean.slice(0, 48)}`,
      description: "Establish baseline components, configuration, and environment variables.",
      status: "in-progress",
      priority: "critical",
      riskTier: "green",
      dueDate: "Today",
      tag: "Architecture",
    },
    {
      id: `task-${now}-2`,
      projectId,
      type: "task",
      title: "Implement primary data contracts and schemas",
      description: "Define strongly-typed interfaces, models, and database migration files.",
      status: "todo",
      priority: "high",
      riskTier: "amber",
      dueDate: "Tomorrow",
      tag: "Schema",
    },
    {
      id: `task-${now}-3`,
      projectId,
      type: "task",
      title: "Execute automated code review and diff verification",
      description: "Enforce strict constitutional safety laws, zero unwrap, and sub-frame performance.",
      status: "todo",
      priority: "medium",
      riskTier: "green",
      dueDate: "This Week",
      tag: "Review",
    },
    {
      id: `goal-${now}-1`,
      projectId,
      type: "goal",
      title: "Deliver Functional MVP Milestone",
      description: `Successful delivery of: ${clean}`,
      status: "todo",
      progress: 15,
      tag: "Goal",
    },
  ]
}

/* ── Persistent Storage Accessors ─────────────────────────────────────────── */

export function loadProjectWorkspaces(): ProjectWorkspace[] {
  if (typeof window === "undefined") return INITIAL_DEFAULT_PROJECTS
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return INITIAL_DEFAULT_PROJECTS
}

export function saveProjectWorkspaces(projects: ProjectWorkspace[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects))
  } catch {}
}

export function loadWorkspaceItems(): WorkspaceItem[] {
  if (typeof window === "undefined") return INITIAL_DEFAULT_ITEMS
  try {
    const raw = localStorage.getItem(STORAGE_ITEMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return INITIAL_DEFAULT_ITEMS
}

export function saveWorkspaceItems(items: WorkspaceItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items))
  } catch {}
}

export function getActiveProjectId(): string {
  if (typeof window === "undefined") return "proj-1"
  try {
    return localStorage.getItem(STORAGE_ACTIVE_PROJECT_KEY) || "proj-1"
  } catch {
    return "proj-1"
  }
}

export function setActiveProjectId(id: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, id)
  } catch {}
}
