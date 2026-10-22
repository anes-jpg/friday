/** Typed wrappers over Tauri's `invoke()` and event bus — §09 `lib/ipc.ts`.
 *
 * Combines full native Tauri 2 invokeCommand with Claude's event system
 * and graceful browser fallback.
 */

import type { Mode } from "./types"

export const isDesktop =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window || "__TAURI_IPC__" in window)

function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

export function normalizeIpcArgs(args?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!args) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    result[key] = value
    const camel = toCamelCase(key)
    if (camel !== key) {
      result[camel] = value
    }
  }
  return result
}

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const normalized = normalizeIpcArgs(args)
  if (isDesktop) {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<T>(cmd, normalized)
  }

  console.log(`[IPC:BrowserFallback] invoke("${cmd}")`, normalized)

  if (cmd === "capture_screen") {
    return {
      status: "captured",
      target: (args?.target as string) || "active_window",
      app: "Visual Studio Code",
      title: "friday — src/lib/store.ts",
      width: 1920,
      height: 1080,
      data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      timestamp: Date.now(),
    } as unknown as T
  }
  if (cmd === "screen_ocr") {
    return {
      status: "ok",
      text: "FRIDAY Desktop Operator // Active Code Session",
      lines: [
        "FRIDAY Desktop Operator",
        "// Active Code Session",
        "export const ocrScreen = () => ...",
      ],
      title: "friday — src/lib/ipc.ts",
      app: "Visual Studio Code",
      width: 1920,
      height: 1080,
      timestamp: Date.now(),
    } as unknown as T
  }
  if (cmd === "list_windows") {
    return [
      { hwnd: 1001, title: "friday — Visual Studio Code", process_name: "Code.exe", pid: 1420, is_active: true },
      { hwnd: 1002, title: "FRIDAY — Windows Desktop Assistant", process_name: "friday.exe", pid: 8840, is_active: false },
      { hwnd: 1003, title: "Terminal — powershell", process_name: "WindowsTerminal.exe", pid: 3290, is_active: false },
    ] as unknown as T
  }
  if (
    cmd === "focus_window" ||
    cmd === "set_window_state" ||
    cmd === "set_active_thread" ||
    cmd === "delete_thread" ||
    cmd === "rename_thread" ||
    cmd === "toggle_thread_pin"
  ) {
    return true as unknown as T
  }
  if (cmd === "get_active_thread") {
    return "t-1" as unknown as T
  }
  if (cmd === "get_threads") {
    return [
      {
        id: "t-1",
        title: "Quarterly numbers pull",
        created_at: Math.floor((Date.now() - 4 * 60_000) / 1000),
        updated_at: Math.floor((Date.now() - 4 * 60_000) / 1000),
        pinned: true,
      },
    ] as unknown as T
  }
  if (cmd === "create_thread") {
    const title = (args?.title as string) || "New session"
    const id = (args?.id as string) || `t-${Date.now()}`
    const nowSec = Math.floor(Date.now() / 1000)
    return {
      id,
      title,
      created_at: nowSec,
      updated_at: nowSec,
      pinned: false,
      message_count: 0,
    } as unknown as T
  }
  if (cmd === "inspect_cursor_element") {
    return {
      name: "Visual Studio Code Editor",
      control_type: "Edit",
      window_title: "friday — src/lib/store.ts",
      process_name: "Code.exe",
      pid: 1420,
      x: 840,
      y: 420,
      bounds: [240, 60, 1400, 960],
    } as unknown as T
  }
  if (cmd === "inspect_focused_app") {
    return {
      window_title: "friday — Visual Studio Code",
      process_name: "Code.exe",
      pid: 1420,
      bounds: [0, 0, 1920, 1080],
      cursor_pos: [840, 420],
      element_name: "Editor Pane",
    } as unknown as T
  }
  if (cmd === "get_overwatch_interjections") {
    return [] as unknown as T
  }
  if (cmd === "dismiss_overwatch_interjection") {
    return true as unknown as T
  }
  if (cmd === "inspect_clipboard_for_overwatch") {
    return null as unknown as T
  }
  if (cmd === "dispatch_legion_swarm") {
    const goal = (args?.directive as string) || "Swarm Directive"
    return {
      id: `legion-${Date.now()}`,
      goal,
      nodes: [
        { id: "node-scout", role: "Scout", status: "Completed", task: "External intelligence survey", output: "0 hazards detected", latency_ms: 45, dependencies: [] },
        { id: "node-architect", role: "Architect", status: "Completed", task: "Module dependency graph synthesis", output: "AST mapped", latency_ms: 60, dependencies: ["node-scout"] },
        { id: "node-sentinel", role: "Sentinel", status: "Completed", task: "Constitutional law verification", output: "0 unwraps, strict One-Signal", latency_ms: 30, dependencies: ["node-architect"] },
        { id: "node-operator", role: "Operator", status: "Completed", task: "Desktop actuation staging", output: "Ready", latency_ms: 50, dependencies: ["node-sentinel"] },
      ],
      start_time: Date.now() - 185,
      total_duration_ms: 185,
      completed: true,
    } as unknown as T
  }
  if (cmd === "get_legion_status") {
    return null as unknown as T
  }
  if (cmd === "get_episodic_timeline" || cmd === "search_episodic_timeline") {
    return [
      {
        id: "ep-1",
        app_name: "Code.exe",
        window_title: "friday — src/lib/store.ts",
        file_path: "src/lib/store.ts",
        git_branch: "master",
        summary: "Overhauled voice state and MapLibre cartography",
        created_at: Math.floor(Date.now() / 1000) - 300,
        duration_secs: 300,
      },
    ] as unknown as T
  }
  if (cmd === "record_episodic_event") {
    return {
      id: `ep-${Date.now()}`,
      app_name: (args?.appName as string) || "System",
      window_title: (args?.windowTitle as string) || "Desktop",
      created_at: Math.floor(Date.now() / 1000),
      duration_secs: 0,
      summary: (args?.summary as string) || "Active work",
    } as unknown as T
  }
  if (cmd === "get_messages") {
    return [] as unknown as T
  }
  if (cmd === "add_message") {
    const nowMs = Date.now()
    return {
      id: `msg-${nowMs}`,
      thread_id: (args?.threadId as string) || (args?.thread_id as string) || "t-1",
      role: (args?.role as string) || "user",
      say: (args?.say as string) || undefined,
      show: (args?.show as string) || undefined,
      latency_ms: undefined,
      created_at: Math.floor(nowMs / 1000),
    } as unknown as T
  }
  if (cmd === "search_code" || cmd === "rrf_search") {
    return [
      {
        file: "src/agent/beast.rs",
        line: 42,
        span: [1200, 1280] as [number, number],
        score: 0.96,
        why: "Matches AST and trigram search query with reciprocal rank fusion",
        symbol: "BeastSearcher::rrf_search",
        content: "pub fn rrf_search(&self, query: &str) -> Vec<Hit>",
      },
    ] as unknown as T
  }
  if (cmd === "find_symbols") {
    return [
      {
        name: "BeastSearcher",
        kind: "struct",
        file: "src/agent/beast.rs",
        line: 18,
      },
    ] as unknown as T
  }
  if (cmd === "code_chunk") {
    return [
      {
        file: (args?.path as string) || "src/agent/beast.rs",
        start_line: 1,
        end_line: 50,
        text: "pub struct BeastSearcher { ... }",
        tokens: ["pub", "struct", "BeastSearcher"],
      },
    ] as unknown as T
  }
  if (cmd === "review_diff") {
    return {
      files_count: 1,
      files: [],
      bundles: [{ name: "Core Engine", files: ["src-tauri/src/agent/beast.rs"], total_additions: 45, total_deletions: 2 }],
    } as unknown as T
  }
  if (cmd === "review_scan") {
    return {
      findings_count: 0,
      findings: [],
    } as unknown as T
  }

  return null as unknown as T
}

export const showBar = () => invokeCommand("show_bar")
export const hideBar = () => invokeCommand("hide_bar")
export const showConsole = () => invokeCommand("show_console")
export const resizeBar = (height: number) => invokeCommand("resize_bar", { height: Math.round(height) })
export const setClickThrough = (ignore: boolean) => invokeCommand("set_click_through", { ignore })

export type FridayEvent =
  | { kind: "kill-switch" }
  | { kind: "bar-summoned" }
  | { kind: "bar-blur" }
  | { kind: "mode"; mode: Mode }
  | { kind: "mic"; action: string }
  | { kind: "automations"; action: string }
  | { kind: "shortcuts-failed"; lost: string[] }

const EVENT_MAP: Record<string, (payload: unknown) => FridayEvent> = {
  "friday://kill-switch": () => ({ kind: "kill-switch" }),
  "friday://bar-summoned": () => ({ kind: "bar-summoned" }),
  "friday://bar-blur": () => ({ kind: "bar-blur" }),
  "friday://mode": (p) => ({ kind: "mode", mode: p as Mode }),
  "friday://mic": (p) => ({ kind: "mic", action: String(p) }),
  "friday://automations": (p) => ({ kind: "automations", action: String(p) }),
  "friday://shortcuts-failed": (p) => ({
    kind: "shortcuts-failed",
    lost: Array.isArray(p) ? p.map(String) : [],
  }),
}

export async function onFriday(handler: (e: FridayEvent) => void): Promise<() => void> {
  if (!isDesktop) return () => {}
  try {
    const { listen } = await import("@tauri-apps/api/event")
    const unlisten = await Promise.all(
      Object.entries(EVENT_MAP).map(([name, map]) =>
        listen(name, (e) => handler(map(e.payload)))
      )
    )
    return () => unlisten.forEach((fn) => fn())
  } catch {
    return () => {}
  }
}

export function surfaceLabel(): "bar" | "console" | "onboarding" {
  if (typeof window === "undefined") return "console"
  const hash = window.location.hash.replace(/^#/, "")
  if (hash === "bar" || hash === "console" || hash === "onboarding") return hash

  const search = new URLSearchParams(window.location.search)
  const surfaceParam = search.get("surface")
  if (surfaceParam === "bar" || surfaceParam === "console" || surfaceParam === "onboarding") return surfaceParam

  const label = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
    ?.__TAURI_INTERNALS__?.metadata?.currentWindow?.label
  if (label === "console" || label === "main") return "console"
  return "console"
}

export interface BackendFact {
  id: string
  content: string
  confidence: number
  source_message_id?: string
  created_at: number
}

export const getBackendFacts = () => invokeCommand<BackendFact[]>("get_facts")
export const addBackendFact = (content: string, confidence?: number) =>
  invokeCommand<BackendFact>("add_fact", { content, confidence })
export const deleteBackendFact = (id: string) => invokeCommand<boolean>("delete_fact", { id })

// --- Beast & Delphi Code / File Intelligence ---
export interface CodeHit {
  file: string
  line: number
  span: [number, number]
  score: number
  why: string
  symbol?: string
  content?: string
}

export type CodeSearchResult = CodeHit

export interface SymbolHit {
  name: string
  kind: string
  file: string
  line: number
}

export type SymbolInfo = SymbolHit

export interface FileContentResult {
  path: string
  lines_returned: number
  truncated: boolean
  content: string
}

export interface DirEntry {
  name: string
  is_dir: boolean
}

export interface MediaProbeResult {
  file_name: string
  file_size_bytes: number
  extension: string
  mime_type: string
  is_audio: boolean
  is_video: boolean
  is_image: boolean
}

export const searchCode = (query: string, maxResults?: number, literal?: boolean) =>
  invokeCommand<CodeHit[]>("search_code", { query, maxResults, literal })

export const findSymbols = (query: string, maxResults?: number) =>
  invokeCommand<SymbolHit[]>("find_symbols", { query, maxResults })

export const rrfSearch = (query: string) =>
  invokeCommand<CodeHit[]>("rrf_search", { query })

export const readFileContent = (path: string, maxLines?: number) =>
  invokeCommand<FileContentResult>("read_file_content", { path, maxLines })

export const listDirectory = (path: string) =>
  invokeCommand<DirEntry[]>("list_directory", { path })

export const processText = (action: "json_pretty" | "json_minify" | "uuid" | "jwt_decode", input: string) =>
  invokeCommand<{ result?: string; uuid?: string; payload?: unknown }>("process_text", { action, input })

export const probeMedia = (path: string) =>
  invokeCommand<MediaProbeResult>("probe_media", { path })

export interface BrowserActionElement {
  node: number
  role: string
  label: string
  kind: "click" | "fill" | "select"
  value: string
  rect: { x: number; y: number; w: number; h: number }
  checked?: boolean
  disabled: boolean
}

export interface BrowserSnapshot {
  url: string
  title: string
  text_content: string
  actions: BrowserActionElement[]
  elapsed_ms: number
}

export interface ActionExecutionResult {
  success: boolean
  action_taken: string
  node: number
  message: string
  new_value?: string
}

export interface DiffLine {
  line_type: "Context" | "Added" | "Removed"
  content: string
  old_line_num?: number
  new_line_num?: number
}

export interface DiffHunk {
  header: string
  old_start: number
  old_lines: number
  new_start: number
  new_lines: number
  lines: DiffLine[]
}

export interface DiffFile {
  old_path: string
  new_path: string
  status: "Added" | "Modified" | "Deleted" | "Renamed"
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

export interface ReviewFinding {
  file: string
  line: number
  severity: "Info" | "Warning" | "Error"
  rule: string
  message: string
  suggestion?: string
}

export interface CodeChunk {
  file: string
  start_line: number
  end_line: number
  text: string
  tokens: string[]
}

export const browserSnapshot = (url: string) =>
  invokeCommand<BrowserSnapshot>("browser_snapshot", { url })

export const browserAction = (node: number, action: "click" | "fill" | "select", text?: string) =>
  invokeCommand<ActionExecutionResult>("browser_action", { node, action, text })

export const reviewDiff = () =>
  invokeCommand<{ files_count: number; files: DiffFile[]; bundles: { name: string; files: string[]; total_additions: number; total_deletions: number }[] }>("review_diff")

export const reviewScan = () =>
  invokeCommand<{ findings_count: number; findings: ReviewFinding[] }>("review_scan")

export const codeChunk = (path: string) =>
  invokeCommand<CodeChunk[]>("code_chunk", { path })

export interface ScreenCaptureData {
  status: string
  target: string
  app: string
  title: string
  width: number
  height: number
  data_url: string
  timestamp: number
  error?: string
}

export interface WindowInfo {
  hwnd: number
  title: string
  process_name: string
  pid: number
  is_active: boolean
}

export const captureScreen = (target?: "active_window" | "full_screen") =>
  invokeCommand<ScreenCaptureData>("capture_screen", { target })

export const listWindows = () =>
  invokeCommand<WindowInfo[]>("list_windows")

export const focusWindow = (query: string) =>
  invokeCommand<boolean>("focus_window", { query })

export const setWindowState = (query: string, state: "minimize" | "maximize" | "restore") =>
  invokeCommand<boolean>("set_window_state", { query, state })

export interface ScreenOcrData {
  status: string
  text: string
  lines: string[]
  title: string
  app: string
  width?: number
  height?: number
  timestamp: number
  error?: string
}

export const ocrScreen = (target?: "active_window" | "full_screen") =>
  invokeCommand<ScreenOcrData>("screen_ocr", { target })

export const getActiveThread = () =>
  invokeCommand<string>("get_active_thread")

export const setActiveThread = (threadId: string) =>
  invokeCommand<boolean>("set_active_thread", { threadId })

export interface BackendThread {
  id: string
  title: string
  created_at: number
  updated_at: number
  pinned: boolean
  message_count?: number
}

export interface BackendMessage {
  id: string
  thread_id: string
  role: string
  say?: string
  show?: string
  latency_ms?: number
  created_at: number
}

export const ipcGetThreads = () =>
  invokeCommand<BackendThread[]>("get_threads")

export const ipcCreateThread = (title?: string, id?: string) =>
  invokeCommand<BackendThread>("create_thread", { title, id })

export const ipcDeleteThread = (threadId: string) =>
  invokeCommand<boolean>("delete_thread", { threadId })

export const ipcRenameThread = (threadId: string, title: string) =>
  invokeCommand<boolean>("rename_thread", { threadId, title })

export const ipcToggleThreadPin = (threadId: string) =>
  invokeCommand<boolean>("toggle_thread_pin", { threadId })

export const ipcGetMessages = (threadId: string) =>
  invokeCommand<BackendMessage[]>("get_messages", { threadId })

export const ipcAddMessage = (threadId: string, role: string, say?: string, show?: string) =>
  invokeCommand<BackendMessage>("add_message", { threadId, role, say, show })

// ── Phase 2: UIA Perception, Overwatch, Legion Swarm & Episodic Recall ─────

import type {
  UiCursorElement,
  FocusedAppSnapshot,
  OverwatchInterjection,
  LegionSwarmPlan,
  DbEpisodicEvent,
} from "./bindings"

export const ipcInspectCursorElement = () =>
  invokeCommand<UiCursorElement>("inspect_cursor_element")

export const ipcInspectFocusedApp = () =>
  invokeCommand<FocusedAppSnapshot>("inspect_focused_app")

export const ipcGetOverwatchInterjections = () =>
  invokeCommand<OverwatchInterjection[]>("get_overwatch_interjections")

export const ipcDismissOverwatchInterjection = (id: string) =>
  invokeCommand<boolean>("dismiss_overwatch_interjection", { id })

export const ipcInspectClipboardForOverwatch = (text: string) =>
  invokeCommand<OverwatchInterjection | null>("inspect_clipboard_for_overwatch", { text })

export const ipcDispatchLegionSwarm = (directive: string) =>
  invokeCommand<LegionSwarmPlan>("dispatch_legion_swarm", { directive })

export const ipcGetLegionStatus = () =>
  invokeCommand<LegionSwarmPlan | null>("get_legion_status")

export const ipcGetEpisodicTimeline = (limit = 50, sinceTs?: number) =>
  invokeCommand<DbEpisodicEvent[]>("get_episodic_timeline", { limit, sinceTs })

export const ipcSearchEpisodicTimeline = (query: string) =>
  invokeCommand<DbEpisodicEvent[]>("search_episodic_timeline", { query })

export const ipcRecordEpisodicEvent = (data: {
  appName: string
  windowTitle: string
  filePath?: string
  gitBranch?: string
  summary?: string
}) =>
  invokeCommand<DbEpisodicEvent | null>("record_episodic_event", data)

export const ipcActuateUiaElement = (elementId: string, action: string, val?: string) =>
  invokeCommand<boolean>("actuate_uia_element", { elementId, action, val })

export const ipcTerminateProcessSocket = (pid: number, processName: string) =>
  invokeCommand<boolean>("terminate_process_socket", { pid, processName })

