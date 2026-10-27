import { invokeCommand, isDesktop } from "./ipc"

export interface PlaceProvenance { source: string; fetchedAt: number; cached: boolean; stale: boolean }
interface NativePlaceData { data: unknown; source: string; fetched_at: number; cached: boolean; stale: boolean }
const provenance = new WeakMap<object, PlaceProvenance>()
export function sourceFor(data: unknown): PlaceProvenance | undefined { return data && typeof data === "object" ? provenance.get(data) : undefined }
export function withPlaceSources<T extends object>(items: T[], data: unknown): Array<T & { provenance?: PlaceProvenance }> {
  const source=sourceFor(data)
  return items.map(item=>({ ...item, ...(source ? { provenance: source } : {}) }))
}
export async function placeJson(url: string, signal: AbortSignal, body?: string, timeout = 12_000): Promise<unknown> {
  signal.throwIfAborted()
  if (isDesktop) {
    const requestId=crypto.randomUUID()
    const abort=()=>{void invokeCommand("cancel_place_request", { requestId }).catch(()=>{})}
    signal.addEventListener("abort", abort, { once: true })
    try {
      const result=await invokeCommand<NativePlaceData>("get_place_data", { requestId, url, body })
      signal.throwIfAborted()
      if (result.data && typeof result.data === "object") provenance.set(result.data, { source:result.source, fetchedAt:result.fetched_at, cached:result.cached, stale:result.stale })
      return result.data
    } finally { signal.removeEventListener("abort", abort) }
  }
  const response=await fetch(url, { signal:AbortSignal.any([signal, AbortSignal.timeout(timeout)]), ...(body ? { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({data:body}).toString() } : {}) })
  if (!response.ok) throw new Error(`Place service is unavailable (${response.status}). Try again.`)
  const data: unknown=await response.json()
  if (data && typeof data === "object") provenance.set(data, { source:new URL(url).hostname, fetchedAt:Date.now(), cached:false, stale:false })
  return data
}
