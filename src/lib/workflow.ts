import { invokeCommand, isDesktop } from "./ipc"
import type {
  ProjectWorkspace,
  WorkspaceItem,
  DiscoveredRepo,
  ScaffoldArchetype,
  ProjectArchetypeId,
  ProjectFileNode,
  ProjectCommandResult,
  ProjectScript,
  ProjectGitDiffInfo,
  ProjectMetadata,
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
    name: "FRIDAY Desktop Operator",
    directive: "Intelligent, voice-first Windows desktop controller and developer workstation.",
    rootPath: "C:\\Users\\anesx\\Desktop\\friday",
    archetype: "rust-tauri-operator",
    framework: "Tauri v2 + Rust",
    packageManager: "pnpm",
    status: "active",
    priority: "critical",
    tags: ["Core", "Windows", "Rust", "Voice"],
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
  const meta = await inspectProjectMetadata(targetPath)

  const newWorkspace: ProjectWorkspace = {
    id: projectId,
    name: cleanName,
    directive: meta?.description || `${archetype.friendlyName || archetype.name} workspace at ${targetPath}`,
    rootPath: targetPath,
    archetype: archetypeId,
    framework: meta?.framework || archetype.framework,
    packageManager: meta?.packageManager || "npm",
    status: "active",
    priority: "high",
    tags: [archetype.framework.split(" ")[0] || "Code", "Active"],
    metadata: meta || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save to persistent storage
  const allProjects = loadProjectWorkspaces()
  saveProjectWorkspaces([newWorkspace, ...allProjects])
  setActiveProjectId(newWorkspace.id)

  // Seed REAL actionable tasks for this project
  const pkgCmd = meta?.packageManager || "npm"
  const initialTasks: WorkspaceItem[] = [
    {
      id: `task-${Date.now()}-1`,
      projectId: newWorkspace.id,
      type: "task",
      title: `Run dev server (${pkgCmd} run dev)`,
      description: `Execute development server in ${targetPath} to view local preview.`,
      status: "todo",
      priority: "high",
      riskTier: "green",
      dueDate: "Today",
      tag: "Run Script",
    },
    {
      id: `task-${Date.now()}-2`,
      projectId: newWorkspace.id,
      type: "task",
      title: "Inspect codebase in In-App Code Studio",
      description: "Review App.tsx, configuration files, and package dependencies inside FRIDAY.",
      status: "todo",
      priority: "medium",
      riskTier: "green",
      dueDate: "Today",
      tag: "Code Studio",
    },
  ]

  const allItems = loadWorkspaceItems()
  saveWorkspaceItems([...initialTasks, ...allItems])

  return newWorkspace
}

/** Imports an existing desktop repository into the FRIDAY workspace ledger. */
export async function importDiscoveredRepo(repo: DiscoveredRepo): Promise<ProjectWorkspace> {
  const projectId = `proj-${repo.name.toLowerCase().replace(/\s+/g, "-")}`
  const meta = await inspectProjectMetadata(repo.path)

  const newWorkspace: ProjectWorkspace = {
    id: projectId,
    name: meta?.name || repo.name,
    directive: meta?.description || `Local repository at ${repo.path}`,
    rootPath: repo.path,
    framework: meta?.framework || repo.framework,
    packageManager: meta?.packageManager || repo.packageManager || "npm",
    status: "active",
    priority: "high",
    tags: [meta?.framework || repo.framework, (meta?.packageManager || repo.packageManager || "npm").toUpperCase()],
    metadata: meta || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const allProjects = loadProjectWorkspaces()
  saveProjectWorkspaces([newWorkspace, ...allProjects.filter((p) => p.id !== newWorkspace.id)])
  setActiveProjectId(newWorkspace.id)

  // Seed real tasks from detected project metadata
  const initialTasks = meta
    ? generateRealTasksFromMetadata(newWorkspace.id, meta, repo.path)
    : []

  if (initialTasks.length > 0) {
    const allItems = loadWorkspaceItems()
    saveWorkspaceItems([...initialTasks, ...allItems])
  }

  return newWorkspace
}

/** Generates real, functional tasks, goals, and milestones directly from on-disk project metadata. */
export function generateRealTasksFromMetadata(
  projectId: string,
  meta: ProjectMetadata,
  rootPath: string
): WorkspaceItem[] {
  const tasks: WorkspaceItem[] = []
  const now = Date.now()
  const pkgCmd = meta.packageManager || "npm"

  // 1. Script-based actionable tasks
  if (meta.scripts && meta.scripts.length > 0) {
    const devScript = meta.scripts.find(
      (s) => s.name === "dev" || s.name === "start" || s.name === "serve"
    )
    if (devScript) {
      tasks.push({
        id: `task-${now}-dev`,
        projectId,
        type: "task",
        title: `Run dev server (${pkgCmd} run ${devScript.name})`,
        description: `Execute development server for ${meta.name} on local port.`,
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "Today",
        tag: "Terminal",
      })
    }

    const buildScript = meta.scripts.find((s) => s.name === "build")
    if (buildScript) {
      tasks.push({
        id: `task-${now}-build`,
        projectId,
        type: "task",
        title: `Build production bundle (${pkgCmd} run ${buildScript.name})`,
        description: `Compile type-checked production bundle and assets in ${meta.name}.`,
        status: "todo",
        priority: "medium",
        riskTier: "green",
        dueDate: "Today",
        tag: "Build",
      })
    }

    const lintOrTest = meta.scripts.find(
      (s) => s.name === "lint" || s.name === "test" || s.name === "check"
    )
    if (lintOrTest) {
      tasks.push({
        id: `task-${now}-verify`,
        projectId,
        type: "task",
        title: `Run code verification (${pkgCmd} run ${lintOrTest.name})`,
        description: `Validate lint rules and unit test specifications across the codebase.`,
        status: "todo",
        priority: "medium",
        riskTier: "green",
        dueDate: "Tomorrow",
        tag: "Verify",
      })
    }
  }

  // 2. Git task if repo is not yet initialized
  if (!meta.gitBranch) {
    tasks.push({
      id: `task-${now}-git`,
      projectId,
      type: "task",
      title: "Initialize Git repository for project",
      description: "Initialize version control to track file diffs and commit changes in FRIDAY.",
      status: "todo",
      priority: "high",
      riskTier: "green",
      dueDate: "Today",
      tag: "Git",
    })
  }

  // 3. Code Studio inspection task
  tasks.push({
    id: `task-${now}-inspect`,
    projectId,
    type: "task",
    title: `Review ${meta.name} codebase architecture`,
    description: `Inspect ${meta.totalFilesCount} files and ${meta.dependenciesCount} dependencies in In-App Code Studio.`,
    status: "todo",
    priority: "medium",
    riskTier: "green",
    dueDate: "This Week",
    tag: "Code Studio",
  })

  // 4. Goal & Milestone
  tasks.push({
    id: `goal-${now}-launch`,
    projectId,
    type: "goal",
    title: `${meta.name} Production Readiness`,
    description: `Verify and deliver all features for ${meta.name} with clean build and zero regressions.`,
    status: "todo",
    progress: 0,
    tag: "Goal",
  })

  tasks.push({
    id: `milestone-${now}-delivery`,
    projectId,
    type: "milestone",
    title: `${meta.framework} MVP Landed`,
    status: "todo",
    dueDate: "Upcoming",
    tag: "Milestone",
  })

  return tasks
}

/** AI & Deterministic Task Decomposition: parses project directive or objective into actionable tasks, goals, and milestones. */
export function decomposeDirectiveIntoTasks(
  projectId: string,
  directive: string,
  projectName?: string,
  customObjective?: string
): WorkspaceItem[] {
  const cleanDirective = directive.trim()
  const cleanName = (projectName || "").toLowerCase()
  const obj = (customObjective || "").trim()
  const now = Date.now()

  // Case 1: Custom Objective specified by user
  if (obj) {
    return [
      {
        id: `task-${now}-obj-1`,
        projectId,
        type: "task",
        title: `Architect implementation plan: ${obj.slice(0, 50)}`,
        description: `Define component structure, interfaces, and safety constraints for ${obj}.`,
        status: "todo",
        priority: "critical",
        riskTier: "green",
        dueDate: "Today",
        tag: "Plan",
      },
      {
        id: `task-${now}-obj-2`,
        projectId,
        type: "task",
        title: `Implement core logic and modules for: ${obj.slice(0, 45)}`,
        description: "Write type-safe functions, integrate state management, and ensure zero runtime errors.",
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "Tomorrow",
        tag: "Feature",
      },
      {
        id: `task-${now}-obj-3`,
        projectId,
        type: "task",
        title: `Run automated tests and verify diffs for: ${obj.slice(0, 40)}`,
        description: "Verify bundle compiles cleanly and test cases pass without regressions.",
        status: "todo",
        priority: "medium",
        riskTier: "green",
        dueDate: "This Week",
        tag: "Verify",
      },
      {
        id: `goal-${now}-obj-1`,
        projectId,
        type: "goal",
        title: `Complete Objective: ${obj.slice(0, 40)}`,
        description: `Full implementation and test coverage for: ${obj}`,
        status: "todo",
        progress: 0,
        tag: "Objective",
      },
    ]
  }

  // Case 2: Specific Project Domain: E-Commerce / Protein (e.g. "foxxon protein")
  if (cleanName.includes("protein") || cleanDirective.toLowerCase().includes("protein") || cleanDirective.toLowerCase().includes("shop")) {
    return [
      {
        id: `task-${now}-prot-1`,
        projectId,
        type: "task",
        title: "Model protein catalogue schemas and nutrition taxonomy",
        description: "Define product attributes: whey isolate vs concentrate, flavor profiles, amino acid ratios, and serving sizes.",
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "Today",
        tag: "Data Model",
      },
      {
        id: `task-${now}-prot-2`,
        projectId,
        type: "task",
        title: "Build responsive product showcase grid with filter drawer",
        description: "Implement interactive filters for dietary preferences (vegan, lactose-free, gluten-free), flavors, and price brackets.",
        status: "todo",
        priority: "critical",
        riskTier: "green",
        dueDate: "Tomorrow",
        tag: "UI / UX",
      },
      {
        id: `task-${now}-prot-3`,
        projectId,
        type: "task",
        title: "Implement persistent shopping cart & rapid checkout flow",
        description: "Configure local cart synchronization with quantity toggles, promo code engine, and order summary totals.",
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "This Week",
        tag: "Checkout",
      },
      {
        id: `task-${now}-prot-4`,
        projectId,
        type: "task",
        title: "Audit inventory API integration and order tracking hooks",
        description: "Connect real-time stock availability, backorder notifications, and customer receipt generation.",
        status: "todo",
        priority: "medium",
        riskTier: "amber",
        dueDate: "Next Week",
        tag: "API",
      },
      {
        id: `task-${now}-prot-5`,
        projectId,
        type: "task",
        title: "Execute performance audit & lighthouse image optimization",
        description: "Compress high-resolution tub packaging assets into WebP and verify 60fps scrolling on mobile devices.",
        status: "todo",
        priority: "medium",
        riskTier: "green",
        dueDate: "Next Week",
        tag: "Performance",
      },
      {
        id: `goal-${now}-prot-1`,
        projectId,
        type: "goal",
        title: "Storefront MVP Launch Ready",
        description: "Fully interactive product discovery, cart, and streamlined checkout experience.",
        status: "todo",
        progress: 0,
        tag: "Storefront",
      },
      {
        id: `goal-${now}-prot-2`,
        projectId,
        type: "goal",
        title: "Sub-100ms Page Load & Checkout Latency",
        description: "Optimized server responses and instant client-side cart calculations.",
        status: "todo",
        progress: 0,
        tag: "Latency",
      },
      {
        id: `milestone-${now}-prot-1`,
        projectId,
        type: "milestone",
        title: "Product Grid & Dietary Filtering Complete",
        status: "todo",
        dueDate: "Oct 18, 2026",
        tag: "Milestone",
      },
      {
        id: `milestone-${now}-prot-2`,
        projectId,
        type: "milestone",
        title: "Payment Processing & Production Launch",
        status: "todo",
        dueDate: "Oct 28, 2026",
        tag: "Milestone",
      },
    ]
  }

  // Case 3: Desktop Operator / Voice / Rust System
  if (cleanDirective.toLowerCase().includes("voice") || cleanDirective.toLowerCase().includes("tauri") || cleanDirective.toLowerCase().includes("rust")) {
    return [
      {
        id: `task-${now}-sys-1`,
        projectId,
        type: "task",
        title: "Optimize audio pipeline streaming & VAD endpointer",
        description: "Ensure non-verbal acoustic acknowledgement under 150ms and zero CPU burn in idle state.",
        status: "todo",
        priority: "critical",
        riskTier: "green",
        dueDate: "Today",
        tag: "Voice",
      },
      {
        id: `task-${now}-sys-2`,
        projectId,
        type: "task",
        title: "Enforce zero unwrap in Rust backend and add integration tests",
        description: "Replace any remaining unwrap calls with robust Result<T, String> error propagation.",
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "Tomorrow",
        tag: "Safety",
      },
      {
        id: `task-${now}-sys-3`,
        projectId,
        type: "task",
        title: "Complete in-app code editor & terminal script runner",
        description: "Full self-contained developer workstation with zero external IDE dependencies.",
        status: "todo",
        priority: "high",
        riskTier: "green",
        dueDate: "This Week",
        tag: "Console",
      },
      {
        id: `goal-${now}-sys-1`,
        projectId,
        type: "goal",
        title: "Constitutional Safety & Sub-Frame Latency Compliance",
        description: "100% adherence to Surface Law, One-Signal Law, and Sub-Frame Law.",
        status: "todo",
        progress: 0,
        tag: "Constitution",
      },
      {
        id: `milestone-${now}-sys-1`,
        projectId,
        type: "milestone",
        title: "Self-Contained Standalone Desktop Release",
        status: "todo",
        dueDate: "Oct 25, 2026",
        tag: "Release",
      },
    ]
  }

  // Default Standard Full-Stack Web / App Roadmap
  return [
    {
      id: `task-${now}-1`,
      projectId,
      type: "task",
      title: `Architect system scaffolding for: ${cleanDirective.slice(0, 48)}`,
      description: "Establish baseline components, configuration, environment variables, and build tools.",
      status: "todo",
      priority: "critical",
      riskTier: "green",
      dueDate: "Today",
      tag: "Architecture",
    },
    {
      id: `task-${now}-2`,
      projectId,
      type: "task",
      title: "Implement primary data models and typed contracts",
      description: "Define strongly-typed interfaces, database schemas, and validation boundaries.",
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
      title: "Develop user interface components with dark-mode styling",
      description: "Craft responsive view layouts with fluid motion and keyboard accessibility.",
      status: "todo",
      priority: "high",
      riskTier: "green",
      dueDate: "This Week",
      tag: "Frontend",
    },
    {
      id: `task-${now}-4`,
      projectId,
      type: "task",
      title: "Execute automated code review and diff verification",
      description: "Verify clean compilation, test coverage, and constitutional performance gates.",
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
      description: `Successful delivery of: ${cleanDirective}`,
      status: "todo",
      progress: 0,
      tag: "Goal",
    },
    {
      id: `milestone-${now}-1`,
      projectId,
      type: "milestone",
      title: "Core Architecture & Scaffolding Landed",
      status: "todo",
      dueDate: "Oct 20, 2026",
      tag: "Milestone",
    },
  ]
}

/* ── In-App Developer Workstation Helpers ───────────────────────────────────── */

/** Queries real on-disk project metadata via Tauri backend IPC. */
export async function inspectProjectMetadata(path: string): Promise<ProjectMetadata | null> {
  if (isDesktop) {
    try {
      const res = await invokeCommand<ProjectMetadata>("inspect_project_metadata", { path })
      if (res && typeof res.name === "string") {
        return res
      }
    } catch (e) {
      console.warn("[FRIDAY Workflow] inspect_project_metadata error:", e)
    }
  }
  return null
}

/** Initializes a git repository in the project root path. */
export async function initProjectGit(path: string): Promise<string> {
  if (isDesktop) {
    try {
      return await invokeCommand<string>("init_project_git", { path })
    } catch (e) {
      throw e
    }
  }
  return "Initialized Git repository"
}

/** Recursively reads the project directory tree for the In-App Code Studio. */
export async function inspectProjectTree(rootPath: string, maxDepth = 3): Promise<ProjectFileNode[]> {
  if (isDesktop) {
    try {
      const nodes = await invokeCommand<ProjectFileNode[]>("inspect_project_tree", {
        path: rootPath,
        maxDepth,
      })
      if (Array.isArray(nodes)) return nodes
    } catch (e) {
      console.warn("[FRIDAY Workflow] inspect_project_tree IPC error:", e)
    }
  }

  // Fallback placeholder tree for offline/browser mode
  return [
    {
      name: "src",
      path: `${rootPath}\\src`,
      is_dir: true,
      children: [
        { name: "App.tsx", path: `${rootPath}\\src\\App.tsx`, is_dir: false, size_bytes: 4200 },
        { name: "index.css", path: `${rootPath}\\src\\index.css`, is_dir: false, size_bytes: 1850 },
        { name: "main.tsx", path: `${rootPath}\\src\\main.tsx`, is_dir: false, size_bytes: 850 },
      ],
    },
    { name: "package.json", path: `${rootPath}\\package.json`, is_dir: false, size_bytes: 1420 },
    { name: "README.md", path: `${rootPath}\\README.md`, is_dir: false, size_bytes: 2300 },
  ]
}

/** Reads a project file from disk. */
export async function readProjectFile(filePath: string): Promise<string> {
  if (isDesktop) {
    try {
      const text = await invokeCommand<string>("read_project_file", { path: filePath })
      if (typeof text === "string") return text
    } catch (e) {
      console.warn("[FRIDAY Workflow] read_project_file IPC error:", e)
      throw e
    }
  }
  return `// Offline mock content for ${filePath}\nexport default function App() {\n  return <div>Loaded in FRIDAY In-App Editor</div>;\n}`
}

/** Writes a file to disk directly from FRIDAY's In-App Editor. */
export async function writeProjectFile(filePath: string, content: string): Promise<boolean> {
  if (isDesktop) {
    try {
      return await invokeCommand<boolean>("write_project_file", { path: filePath, content })
    } catch (e) {
      console.error("[FRIDAY Workflow] write_project_file IPC error:", e)
      throw e
    }
  }
  return true
}

/** Creates a new file or directory inside the active project. */
export async function createProjectFileOrDir(targetPath: string, isDir: boolean): Promise<boolean> {
  if (isDesktop) {
    try {
      return await invokeCommand<boolean>("create_project_file_or_dir", { path: targetPath, isDir })
    } catch (e) {
      console.error("[FRIDAY Workflow] create_project_file_or_dir error:", e)
      throw e
    }
  }
  return true
}

/** Deletes a file or directory in the active project. */
export async function deleteProjectPath(targetPath: string): Promise<boolean> {
  if (isDesktop) {
    try {
      return await invokeCommand<boolean>("delete_project_path", { path: targetPath })
    } catch (e) {
      console.error("[FRIDAY Workflow] delete_project_path error:", e)
      throw e
    }
  }
  return true
}

/** Executes a terminal command in the project directory using the In-App Terminal runner. */
export async function executeProjectCommand(
  projectPath: string,
  command: string
): Promise<ProjectCommandResult> {
  if (isDesktop) {
    try {
      return await invokeCommand<ProjectCommandResult>("execute_project_command", {
        projectPath,
        command,
      })
    } catch (e) {
      return {
        exit_code: 1,
        stdout: "",
        stderr: String(e),
        duration_ms: 0,
      }
    }
  }
  return {
    exit_code: 0,
    stdout: `[FRIDAY In-App Terminal Sim]\nExecuted '${command}' in ${projectPath}\nDone in 42ms.`,
    stderr: "",
    duration_ms: 42,
  }
}

/** Retrieves git diff and modified files for the active project. */
export async function getProjectGitDiff(projectPath: string): Promise<ProjectGitDiffInfo> {
  if (isDesktop) {
    try {
      const res = await invokeCommand<ProjectGitDiffInfo>("get_project_git_diff", { projectPath })
      if (res && typeof res.branch === "string") return res
    } catch (e) {
      console.warn("[FRIDAY Workflow] get_project_git_diff IPC error:", e)
    }
  }
  return {
    branch: "main",
    diff: "",
    modified_files: [],
    has_changes: false,
  }
}

/** Commits git changes from FRIDAY's In-App Git Viewer. */
export async function commitProjectChanges(
  projectPath: string,
  message: string
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  if (isDesktop) {
    try {
      return await invokeCommand<{ success: boolean; stdout: string; stderr: string }>(
        "commit_project_changes",
        { projectPath, message }
      )
    } catch (e) {
      return { success: false, stdout: "", stderr: String(e) }
    }
  }
  return { success: true, stdout: "[Sim] Committed in offline mode", stderr: "" }
}

/** Detects runnable package scripts from package.json or Cargo.toml in the project root. */
export async function detectProjectScripts(rootPath: string): Promise<ProjectScript[]> {
  try {
    const meta = await inspectProjectMetadata(rootPath)
    const pm = meta?.packageManager || "npm"

    if (meta?.scripts && meta.scripts.length > 0) {
      return meta.scripts.map((s) => {
        let category: ProjectScript["category"] = "other"
        const lower = s.name.toLowerCase()
        if (lower.includes("dev") || lower.includes("start") || lower.includes("serve")) category = "dev"
        else if (lower.includes("build")) category = "build"
        else if (lower.includes("test")) category = "test"
        else if (lower.includes("lint") || lower.includes("check")) category = "lint"
        return {
          name: s.name,
          command: `${pm} run ${s.name}`,
          category,
        }
      })
    }

    const pkgText = await readProjectFile(`${rootPath}\\package.json`)
    const parsed = JSON.parse(pkgText)
    if (parsed.scripts && typeof parsed.scripts === "object") {
      const result: ProjectScript[] = []
      for (const [name, cmd] of Object.entries(parsed.scripts)) {
        if (typeof cmd === "string") {
          let category: ProjectScript["category"] = "other"
          if (name.includes("dev") || name.includes("start")) category = "dev"
          else if (name.includes("build")) category = "build"
          else if (name.includes("test")) category = "test"
          else if (name.includes("lint")) category = "lint"
          result.push({ name, command: `${pm} run ${name}`, category })
        }
      }
      return result
    }
  } catch {}

  // Fallback defaults if no package.json or unreadable
  return [
    { name: "dev", command: "npm run dev", category: "dev" },
    { name: "build", command: "npm run build", category: "build" },
    { name: "test", command: "npm test", category: "test" },
    { name: "status", command: "git status", category: "other" },
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Sanitize any corrupt tasks stuck in 'in-progress' status
        return parsed.map((item: WorkspaceItem) => ({
          ...item,
          status: item.status === "in-progress" ? "todo" : item.status,
        }))
      }
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
