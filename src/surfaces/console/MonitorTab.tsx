import React, { useEffect, useRef, useState, lazy } from "react"
import { Camera, Plus, Video, Maximize2, Minimize2, Play, Pause, Circle, Square, Trash2, ArrowUpRight, Download, X, Search } from "lucide-react"
import { useFriday, type ConsoleTab } from "@/lib/store"
import { useMonitoring, cameraStream, recordingBlob, type CameraSource, type Recording } from "@/lib/monitoring"
import { cn } from "@/lib/utils"
const GodsEyeSurface = lazy(() => import("@/surfaces/os/GodsEyeSurface").then((module) => ({ default: module.GodsEyeSurface })))

function CameraPreview({ source, focused, onFocus }: { source: CameraSource; focused: boolean; onFocus: () => void }) {
  const status = useMonitoring((s) => s.statuses[source.id] ?? "paused")
  const error = useMonitoring((s) => s.errors[source.id])
  const recording = useMonitoring((s) => s.recordings.find((recording) => recording.sourceId === source.id && recording.state === "recording"))
  const video = useRef<HTMLVideoElement>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  useEffect(() => {
    if (video.current && source.kind === "webcam") video.current.srcObject = cameraStream(source.id) ?? null
  }, [status, source.id, source.kind])
  useEffect(() => () => { useMonitoring.getState().disconnect(source.id) }, [source.id])
  const connected = status === "live" || status === "connecting"
  return (
    <article className={cn("camera-preview", focused && "is-focused")}>
      <header><div><h3>{source.name}</h3><span className="instrument-label">{source.kind === "webcam" ? "Local webcam" : "Web feed"}</span></div><button type="button" aria-label={focused ? "Return to camera grid" : `Focus ${source.name}`} onClick={onFocus}>{focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></header>
      <div className="camera-image">
        {connected ? <video ref={video} autoPlay playsInline muted src={source.kind === "web" ? source.url : undefined} onPlaying={() => useMonitoring.getState().setStatus(source.id, "live")} onError={() => useMonitoring.getState().setStatus(source.id, "error", "Feed could not play. Check the URL, format, and connection.")} onEnded={() => { useMonitoring.getState().disconnect(source.id); useMonitoring.getState().event(source, "Feed ended") }} /> : <div className="camera-placeholder"><Camera size={32} strokeWidth={1} /><span>{status === "error" ? "Connection unavailable" : "Preview paused"}</span><small>{error || "Connect when you are ready. Camera audio is off."}</small><button type="button" className="quiet-action" onClick={() => void useMonitoring.getState().connect(source.id)}>{status === "error" ? "Reconnect" : "Connect camera"}</button></div>}
        {status === "connecting" && <span className="camera-connection-status" role="status">Connecting…</span>}
      </div>
      <footer><span className={cn("camera-state", recording && "is-recording")}><i />{recording ? "Recording" : status === "live" ? "Preview connected" : status}</span><div>
        {connected && <button type="button" disabled={Boolean(recording)} aria-label={`Pause ${source.name}`} onClick={() => useMonitoring.getState().disconnect(source.id)}><Pause size={15} /></button>}
        <button type="button" disabled={source.kind !== "webcam" || status !== "live"} className={cn(recording && "is-recording")} aria-label={recording ? `Stop recording ${source.name}` : `Record ${source.name}`} onClick={async () => { setActionError(null); try { if (recording) useMonitoring.getState().stopRecording(source.id); else await useMonitoring.getState().record(source.id) } catch (error) { setActionError(String(error)) } }}>{recording ? <Square size={14} /> : <Circle size={14} />}</button>
      </div></footer>
      {actionError && <p className="camera-error" role="alert">{actionError}</p>}
    </article>
  )
}
export function MonitorTab({ view }: { view?: ConsoleTab }) {
  const storeTab = useFriday((s) => s.tab)
  const tab = view ?? storeTab
  const { sources, recordings, events, error, hydrate } = useMonitoring()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<CameraSource["kind"]>("webcam")
  const [url, setUrl] = useState("")
  const [focused, setFocused] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ name: string; url: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busyRecording, setBusyRecording] = useState<string | null>(null)
  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url) }, [playing])
  const storedBytes = recordings.reduce((sum, recording) => sum + recording.bytes, 0)
  const openRecording = async (recording: Recording, download = false) => {
    setBusyRecording(recording.id); setFormError(null)
    try {
      const blob = await recordingBlob(recording.id)
      const url = URL.createObjectURL(blob)
      if (download) {
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = `FRIDAY-${recording.startedAt.replace(/[:.]/g, "-")}.webm`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setPlaying({ name: recording.name, url })
    } catch (error) { setFormError(String(error)) }
    finally { setBusyRecording(null) }
  }
  if (tab === "map" || tab === "hud") return <GodsEyeSurface />
  return (
    <div className="monitor-workspace">
      <header className="monitor-heading"><div><span className="instrument-label">Monitor / {tab === "alerts" ? "Activity" : tab}</span><h1 className="page-heading">{tab === "cameras" ? "Your eyes on the room." : tab === "recordings" ? "Recorded moments." : "What happened."}</h1><p>{tab === "cameras" ? "Connect your own cameras. Recording starts only when you ask." : tab === "recordings" ? `${recordings.length} recordings · ${(storedBytes / 1024 ** 3).toFixed(2)} GB stored on this device` : "Camera connections, recording events, and errors."}</p></div>
        {tab === "cameras" ? <button type="button" className="primary-action" onClick={() => setAdding(true)}><Plus size={16} />Add camera</button> : <div className="settings-search mb-0"><Search size={15} /><input aria-label="Search monitoring history" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" /></div>}
      </header>
      {(error || formError) && <p className="settings-notice is-error mb-6" role="alert">{formError || error}</p>}
      {tab === "cameras" && (sources.length ? <div className={cn("camera-grid", focused && "is-focused")}>{sources.filter((source) => !focused || source.id === focused).map((source) => <CameraPreview key={source.id} source={source} focused={focused === source.id} onFocus={() => setFocused(focused === source.id ? null : source.id)} />)}</div> : <div className="monitor-empty"><Video size={40} strokeWidth={1} /><h2>No cameras connected.</h2><p>Add a webcam or a browser-playable web feed. Your camera stays off until you connect it.</p><button type="button" className="quiet-action" onClick={() => setAdding(true)}>Add your first camera <ArrowUpRight size={16} /></button></div>)}
      {tab === "cameras" && sources.length > 0 && <div className="camera-source-list"><span className="instrument-label">Sources</span>{sources.map((source) => <div key={source.id}><span>{source.name}</span><small>{source.kind === "webcam" ? "Local webcam" : source.url}</small>{deleting === source.id ? <div className="flex gap-2"><button type="button" onClick={() => { try { useMonitoring.getState().removeSource(source.id); setDeleting(null) } catch (error) { setFormError(String(error)) } }}>Remove</button><button type="button" onClick={() => setDeleting(null)}>Cancel</button></div> : <button type="button" aria-label={`Remove ${source.name}`} onClick={() => setDeleting(source.id)}><Trash2 size={14} /></button>}</div>)}</div>}
      {tab === "recordings" && <div className="monitor-timeline">{recordings.filter((recording) => recording.name.toLowerCase().includes(query.toLowerCase())).map((recording) => <article key={recording.id}><div className="timeline-time">{new Date(recording.startedAt).toLocaleDateString()}<small>{new Date(recording.startedAt).toLocaleTimeString()}</small></div><div className="timeline-description"><strong>{recording.name}</strong><small>{recording.state} · {(recording.bytes / 1024 ** 2).toFixed(1)} MB{recording.state === "interrupted" ? " · recovered after interrupted recording" : ""}</small></div><div className="timeline-actions">{recording.state === "recording" ? <button type="button" aria-label="Stop recording" onClick={() => useMonitoring.getState().stopRecording(recording.sourceId)}><Square size={16} /></button> : <><button type="button" disabled={busyRecording === recording.id} aria-label={`Play ${recording.name}`} onClick={() => void openRecording(recording)}><Play size={16} /></button><button type="button" disabled={busyRecording === recording.id} aria-label={`Export ${recording.name}`} onClick={() => void openRecording(recording, true)}><Download size={16} /></button>{deleting === recording.id ? <><button type="button" onClick={async () => { try { await useMonitoring.getState().deleteRecording(recording.id); setDeleting(null) } catch (error) { setFormError(String(error)) } }}>Delete</button><button type="button" onClick={() => setDeleting(null)}>Cancel</button></> : <button type="button" aria-label={`Delete ${recording.name}`} onClick={() => setDeleting(recording.id)}><Trash2 size={16} /></button>}</>}</div></article>)}{!recordings.length && <div className="monitor-empty"><Circle size={32} strokeWidth={1} /><h2>No recordings yet.</h2><p>Start a manual recording from a connected webcam. Recordings remain here until you delete them.</p></div>}</div>}
      {tab === "alerts" && <div className="monitor-timeline">{events.filter((event) => (event.name + event.message).toLowerCase().includes(query.toLowerCase())).map((event) => <article key={event.id}><div className="timeline-time">{new Date(event.time).toLocaleDateString()}<small>{new Date(event.time).toLocaleTimeString()}</small></div><div className="timeline-description"><strong>{event.name}</strong><small className={cn(event.level === "error" && "text-rose-300")}>{event.message}</small></div><button type="button" className="quiet-action" onClick={() => { useFriday.getState().setTab("cameras"); setFocused(event.sourceId) }}>View source <ArrowUpRight size={14} /></button></article>)}{!events.length && <div className="monitor-empty"><h2>No monitoring activity yet.</h2><p>Camera connections and recording events will appear here.</p></div>}</div>}
      {adding && <div className="monitor-modal" role="dialog" aria-modal="true" aria-labelledby="add-camera-title"><form onSubmit={(event) => { event.preventDefault(); try { useMonitoring.getState().addSource({ id: crypto.randomUUID(), name: name.trim(), kind, url: url.trim() }); setAdding(false); setName(""); setUrl(""); setFormError(null) } catch (error) { setFormError(String(error)) } }}><header><h2 id="add-camera-title" className="page-heading">Add camera</h2><button type="button" aria-label="Close add camera" onClick={() => setAdding(false)}><X size={18} /></button></header><label className="settings-field">Name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Desk camera" /></label><label className="settings-field">Source<select value={kind} onChange={(event) => setKind(event.target.value as CameraSource["kind"])}><option value="webcam">Local webcam</option><option value="web">Web video feed</option></select></label>{kind === "web" && <label className="settings-field">Video URL<input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://camera.example/feed.webm" /><small>Use MP4, WebM, or another format your WebView can play. RTSP and authenticated IP cameras need native media ingestion.</small></label>}{formError && <p className="settings-notice" role="alert">{formError}</p>}<button type="submit" className="primary-action mt-4">Add camera</button></form></div>}
      {playing && <div className="monitor-modal" role="dialog" aria-modal="true" aria-label="Recording playback"><div className="recording-player"><header><h2>{playing.name}</h2><button type="button" aria-label="Close recording playback" onClick={() => setPlaying(null)}><X size={18} /></button></header><video src={playing.url} controls autoPlay /></div></div>}
    </div>
  )
}
