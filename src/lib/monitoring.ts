import { create } from "zustand"
import { useSettings } from "./settings"

export interface CameraSource { id: string; name: string; kind: "webcam" | "web"; url: string; deviceId?: string }
export interface Recording { id: string; sourceId: string; name: string; startedAt: string; endedAt?: string; bytes: number; mimeType: string; state: "recording" | "saved" | "interrupted" }
export interface MonitorEvent { id: string; sourceId: string; name: string; time: string; message: string; level: "info" | "error" }
export type CameraStatus = "paused" | "connecting" | "live" | "error"
const streams = new Map<string, MediaStream>()
const recorders = new Map<string, MediaRecorder>()
const recordingsForSource = new Map<string, string>()
let database: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("friday-monitoring", 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("recordings", { keyPath: "id" })
      request.result.createObjectStore("chunks", { keyPath: "id" })
      request.result.createObjectStore("events", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = null; reject(request.error) }
  })
  return database
}
async function readAll<T>(table: string): Promise<T[]> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const request = database.transaction(table).objectStore(table).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}
async function writeRow(table: string, value: object): Promise<void> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(table, "readwrite")
    tx.objectStore(table).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
function loadSources(): CameraSource[] {
  try {
    const sources: unknown = JSON.parse(localStorage.getItem("friday-camera-sources-v1") ?? "[]")
    if (!Array.isArray(sources)) return []
    return sources.filter((source: unknown): source is CameraSource => typeof source === "object" && source !== null && "id" in source && "name" in source && "kind" in source && "url" in source && typeof source.id === "string" && typeof source.name === "string" && ["webcam", "web"].includes(String(source.kind)) && typeof source.url === "string")
  } catch { return [] }
}
interface MonitoringStore {
  sources: CameraSource[]; statuses: Record<string, CameraStatus>; errors: Record<string, string>
  recordings: Recording[]; events: MonitorEvent[]; error: string | null
  hydrate: () => Promise<void>; addSource: (source: CameraSource) => void; removeSource: (id: string) => void
  connect: (id: string) => Promise<void>; disconnect: (id: string) => void; setStatus: (id: string, status: CameraStatus, error?: string) => void
  record: (id: string) => Promise<void>; stopRecording: (id: string) => void; deleteRecording: (id: string) => Promise<void>
  event: (source: CameraSource, message: string, level?: "info" | "error") => void
}
export function cameraStream(id: string): MediaStream | undefined { return streams.get(id) }
export const useMonitoring = create<MonitoringStore>((set, get) => ({
  sources: loadSources(), statuses: {}, errors: {}, recordings: [], events: [], error: null,
  hydrate: async () => {
    try {
      const [recordings, events] = await Promise.all([readAll<Recording>("recordings"), readAll<MonitorEvent>("events")])
      const recovered = recordings.map((recording) => recording.state === "recording" && !recorders.has(recording.sourceId) ? { ...recording, state: "interrupted" as const } : recording)
      await Promise.all(recovered.filter((recording) => recording.state === "interrupted").map((recording) => writeRow("recordings", recording)))
      set({ recordings: recovered, events: events.sort((a, b) => b.time.localeCompare(a.time)), error: null })
    } catch (error) { set({ error: `Monitoring history could not be read: ${String(error)}` }) }
  },
  addSource: (source) => {
    if (!source.name.trim()) throw new Error("Give the camera a name.")
    if (source.kind === "web") {
      const url = new URL(source.url)
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Use a browser-playable HTTP or HTTPS video feed. RTSP requires native camera ingestion.")
      if (url.username || url.password) throw new Error("Camera passwords must not be included in a saved URL.")
    }
    const sources = [...get().sources, source]
    localStorage.setItem("friday-camera-sources-v1", JSON.stringify(sources))
    set({ sources }); get().event(source, "Camera added")
  },
  removeSource: (id) => {
    if (recorders.has(id)) throw new Error("Stop recording before removing this camera.")
    get().disconnect(id)
    const sources = get().sources.filter((source) => source.id !== id)
    localStorage.setItem("friday-camera-sources-v1", JSON.stringify(sources))
    set({ sources })
  },
  event: (source, message, level = "info") => {
    const event: MonitorEvent = { id: crypto.randomUUID(), sourceId: source.id, name: source.name, time: new Date().toISOString(), message, level }
    set({ events: [event, ...get().events].slice(0, 500) })
    void writeRow("events", event).catch((error: unknown) => set({ error: `Activity could not be saved: ${String(error)}` }))
  },
  setStatus: (id, status, error) => {
    set({ statuses: { ...get().statuses, [id]: status }, errors: { ...get().errors, [id]: error ?? "" } })
    const source = get().sources.find((source) => source.id === id)
    if (source && error) get().event(source, error, "error")
  },
  connect: async (id) => {
    const source = get().sources.find((source) => source.id === id)
    if (!source || get().statuses[id] === "live" || get().statuses[id] === "connecting") return
    const count = Object.values(get().statuses).filter((status) => status === "live" || status === "connecting").length
    if (count >= useSettings.getState().saved.monitoring.previewLimit) {
      get().setStatus(id, "error", "Preview limit reached. Pause a camera or increase the limit in Settings.")
      return
    }
    get().setStatus(id, "connecting")
    if (source.kind === "web") return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true, audio: false })
      // Camera can be disconnected while the permission prompt is pending.
      if (get().statuses[id] !== "connecting") { stream.getTracks().forEach((track) => track.stop()); return }
      streams.set(id, stream)
      stream.getVideoTracks().forEach((track) => { track.onended = () => { get().stopRecording(id); get().setStatus(id, "error", "Camera disconnected. Check the device and reconnect.") } })
      get().setStatus(id, "live"); get().event(source, "Preview connected")
    } catch (error) { get().setStatus(id, "error", `Camera could not connect: ${String(error)}`) }
  },
  disconnect: (id) => {
    if (recorders.has(id)) return
    streams.get(id)?.getTracks().forEach((track) => { track.onended = null; track.stop() })
    streams.delete(id); get().setStatus(id, "paused")
  },
  record: async (id) => {
    if (recorders.has(id)) return
    const source = get().sources.find((source) => source.id === id)
    const stream = streams.get(id)
    if (!source || !stream) throw new Error("Connect a webcam before recording. Web feed recording requires native media ingestion.")
    if (!window.MediaRecorder) throw new Error("Recording is unavailable in this WebView.")
    const capacity = useSettings.getState().saved.monitoring.storageLimitGb * 1024 ** 3
    if (get().recordings.reduce((sum, recording) => sum + recording.bytes, 0) >= capacity) throw new Error("Recording storage limit reached. Delete recordings or increase the limit.")
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error("This device does not support WebM recording.")
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 })
    const recording: Recording = { id: crypto.randomUUID(), sourceId: id, name: source.name, startedAt: new Date().toISOString(), bytes: 0, mimeType, state: "recording" }
    await writeRow("recordings", recording)
    recorders.set(id, recorder); recordingsForSource.set(id, recording.id)
    set({ recordings: [recording, ...get().recordings] })
    let index = 0
    let saving: Promise<void> = Promise.resolve()
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return
      const chunkIndex = index++
      saving = saving.then(async () => {
        recording.bytes += event.data.size
        const database = await db()
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(["chunks", "recordings"], "readwrite")
          tx.objectStore("chunks").put({ id: `${recording.id}/${chunkIndex}`, recordingId: recording.id, index: chunkIndex, blob: event.data })
          tx.objectStore("recordings").put(recording)
          tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
        })
        set({ recordings: get().recordings.map((item) => item.id === recording.id ? { ...recording } : item) })
        if (get().recordings.reduce((sum, item) => sum + item.bytes, 0) >= capacity) { get().stopRecording(id); get().event(source, "Recording stopped at the storage limit") }
      }).catch((error: unknown) => { get().stopRecording(id); get().event(source, `Recording could not be saved: ${String(error)}`, "error") })
    }
    recorder.onerror = () => { get().stopRecording(id); get().event(source, "Recording failed. Check available storage and reconnect the camera.", "error") }
    recorder.onstop = () => {
      void saving.then(async () => {
        recording.state = "saved"; recording.endedAt = new Date().toISOString()
        await writeRow("recordings", recording)
        set({ recordings: get().recordings.map((item) => item.id === recording.id ? { ...recording } : item) })
        get().event(source, "Recording saved")
      }).catch((error: unknown) => set({ error: `Recording could not be finalized: ${String(error)}` }))
      recorders.delete(id); recordingsForSource.delete(id)
    }
    recorder.start(1000); get().event(source, "Manual recording started")
  },
  stopRecording: (id) => { const recorder = recorders.get(id); if (recorder && recorder.state !== "inactive") recorder.stop() },
  deleteRecording: async (id) => {
    const recording = get().recordings.find((item) => item.id === id)
    if (recording?.state === "recording") throw new Error("Stop the recording before deleting it.")
    const database = await db()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["recordings", "chunks"], "readwrite")
      tx.objectStore("recordings").delete(id)
      const cursor = tx.objectStore("chunks").openCursor()
      cursor.onsuccess = () => { const current = cursor.result; if (current) { if ((current.value as { recordingId: string }).recordingId === id) current.delete(); current.continue() } }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
    })
    set({ recordings: get().recordings.filter((item) => item.id !== id) })
  },
}))
export async function recordingBlob(id: string): Promise<Blob> {
  const database = await db()
  const chunks = await new Promise<{ index: number; blob: Blob }[]>((resolve, reject) => {
    const result: { index: number; blob: Blob }[] = []
    const request = database.transaction("chunks").objectStore("chunks").openCursor(IDBKeyRange.bound(id + "/", id + "/\uffff"))
    request.onsuccess = () => { const cursor = request.result; if (cursor) { result.push(cursor.value as { index: number; blob: Blob }); cursor.continue() } else resolve(result) }
    request.onerror = () => reject(request.error)
  })
  if (!chunks.length) throw new Error("This recording has no saved video data.")
  const recording = useMonitoring.getState().recordings.find((item) => item.id === id)
  return new Blob(chunks.sort((a, b) => a.index - b.index).map((chunk) => chunk.blob), { type: recording?.mimeType ?? "video/webm" })
}
