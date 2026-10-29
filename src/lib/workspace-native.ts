import { invokeCommand, isDesktop } from "./ipc"
import type { MapPlace } from "./places"
import { parseSavedPlaces } from "./places"

export interface NativeWorkspace {
  version: number
  projects: unknown[]
  items: unknown[]
  places: unknown[]
  collections: unknown[]
  captures?: unknown[]
  routines?: unknown[]
  resumes?: unknown[]
  activeId: string | null
}
export interface SavedCollection { id: string; name: string; placeIds: string[] }
export interface RunRecord {
  id: string; request_id: string | null; thread_id: string; project_id: string | null
  provider_profile_id: string | null; utterance: string; status: string; created_at: number; updated_at: number
}
export type RunStatus = "queued" | "running" | "awaiting_confirmation" | "completed" | "failed" | "cancelled" | "interrupted"
export interface RunEvent {
  run_id: string; sequence: number; timestamp: number; step: string | null
  status: RunStatus; detail: Record<string, unknown>
}

let pendingWrites: Promise<void> = Promise.resolve()
let lastQueueError: Error | null = null
export function queueWorkspaceWrite(write: () => Promise<void>, onError: (error: Error) => void) {
  // Audit F04: a single failed write must not poison the queue. The chain heals
  // before the next write attaches, so later saves still run after earlier
  // failures; the originating UI still gets the error via its report callback.
  pendingWrites = pendingWrites
    .catch(() => {})
    .then(write)
    .catch(failure => {
      lastQueueError = failure instanceof Error ? failure : new Error(String(failure))
      onError(lastQueueError)
    })
  void pendingWrites.catch(() => {})
}
export function flushWorkspaceWrites(): Promise<void> {
  // Resolves only once the queue has drained, then surfaces the most recent
  // failure exactly once so callers (e.g. chat submission) see that persisted
  // state may be stale instead of assuming everything saved.
  return pendingWrites.then(() => {
    if (lastQueueError) {
      const error = lastQueueError
      lastQueueError = null
      throw error
    }
  })
}
export function nativeSave(kind: "project" | "item" | "place" | "collection" | "capture" | "routine" | "resume", record: unknown) {
  return invokeCommand<void>("workspace_save", { kind, record })
}
/** Serialize durable saves with the legacy write queue, while returning this save's failure. */
export function durableWorkspaceWrite(write: () => Promise<void>): Promise<void> {
  const operation = pendingWrites.catch(() => {}).then(write)
  pendingWrites = operation.catch(() => {})
  return operation
}
export function nativeDelete(kind: string, id: string) { return invokeCommand<boolean>("workspace_delete", { kind, id }) }
export async function importBrowserWorkspace(projects: unknown[], items: unknown[]) {
  const keys = ["friday-project-workspace-v2", "friday_workspace_projects_v1", "friday_workspace_items_v1", "friday_active_project_id_v1", "friday-saved-places"]
  const originals = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))
  const places = parseSavedPlaces(JSON.parse(originals["friday-saved-places"] || "[]"))
  await invokeCommand<boolean>("workspace_import", { import: { sourceId: "browser-workspace-v2", originals, projects, items, places } })
  return invokeCommand<NativeWorkspace>("workspace_snapshot")
}
export async function readNativePlaces(): Promise<MapPlace[]> {
  if (!isDesktop) return parseSavedPlaces(JSON.parse(localStorage.getItem("friday-saved-places") || "[]"))
  const snapshot = await invokeCommand<NativeWorkspace>("workspace_snapshot")
  return parseSavedPlaces(snapshot.places)
}
