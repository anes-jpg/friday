import { invokeCommand, isDesktop } from "./ipc"
import type { MapPlace } from "./places"
import { parseSavedPlaces } from "./places"

export interface NativeWorkspace {
  version: number
  projects: unknown[]
  items: unknown[]
  places: unknown[]
  collections: unknown[]
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
export function queueWorkspaceWrite(write: () => Promise<void>, onError: (error: Error) => void) {
  pendingWrites = pendingWrites.then(write).catch(failure => {
    const error = failure instanceof Error ? failure : new Error(String(failure))
    onError(error)
    throw error
  })
  // Retain rejection for dependent sends while reporting it in the originating UI.
  void pendingWrites.catch(() => {})
}
export function flushWorkspaceWrites() { return pendingWrites }
export function nativeSave(kind: "project" | "item" | "place" | "collection", record: unknown) {
  return invokeCommand<void>("workspace_save", { kind, record })
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
