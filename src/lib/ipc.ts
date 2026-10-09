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
  if (cmd === "focus_window" || cmd === "set_window_state" || cmd === "set_active_thread") {
    return true as unknown as T
  }
  if (cmd === "get_active_thread") {
    return "t-1" as unknown as T
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
