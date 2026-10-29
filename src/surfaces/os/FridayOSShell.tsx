import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { OSStatusBar, type OSSurfaceMode } from "./OSStatusBar"
import { OSDock } from "./OSDock"
import { GodsEyeSurface } from "./GodsEyeSurface"
import { OverwatchWhisperToast, type OverwatchToastItem, type OverwatchCategory } from "./OverwatchWhisperToast"
import { Console } from "@/surfaces/console/Console"
import { OperationsTab } from "@/surfaces/console/OperationsTab"
import { ipcGetHardwareVitals } from "@/lib/telemetry"
import { isDesktop, ipcGetOverwatchInterjections, ipcDismissOverwatchInterjection } from "@/lib/ipc"
import { useFridayStore } from "@/lib/store"
import type { ConsoleTab } from "@/lib/store"

export { type OSSurfaceMode }
export interface FridayOSShellProps { onExitFullscreen?: () => void }
export function workspaceMode(tab: ConsoleTab): OSSurfaceMode {
  return tab === "map" ? "godseye" : tab === "projects" || tab === "analytics" ? "legion" : tab === "history" ? "history" : "console"
}

/** Both native shells use the same workspace and route store. */
export function FridayOSShell({ onExitFullscreen }: FridayOSShellProps) {
  const tab = useFridayStore(state => state.tab)
  const [activeMode, setActiveMode] = useState<OSSurfaceMode>(() => workspaceMode(tab))
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [overwatchEnabled, setOverwatchEnabled] = useState(true)
  const [overwatchItems, setOverwatchItems] = useState<OverwatchToastItem[]>([])
  const models = useFridayStore(state => state.aiModels)
  const modelId = useFridayStore(state => state.activeModelId)
  const hardware = useQuery({ queryKey: ["hardware-vitals"], enabled: isDesktop, queryFn: ipcGetHardwareVitals, refetchInterval: 5000, refetchIntervalInBackground: false })
  const changeMode = (mode: OSSurfaceMode) => {
    setActiveMode(mode)
    useFridayStore.getState().setTab(mode === "godseye" ? "map" : mode === "legion" ? "projects" : mode === "history" ? "history" : "chat")
  }
  useEffect(() => { setActiveMode(workspaceMode(tab)) }, [tab])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="combobox"]')) return
      if (event.key === "Escape" || (event.altKey && event.key === "Enter")) { event.preventDefault(); onExitFullscreen?.() }
      if (event.ctrlKey && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault()
        changeMode((["console", "godseye", "legion", "history"] as const)[Number(event.key) - 1])
      }
      if (event.ctrlKey && event.key.toLowerCase() === "i") { event.preventDefault(); setInspectorOpen(open => !open) }
    }
    const mode = (event: Event) => { if (event instanceof CustomEvent) changeMode(event.detail as OSSurfaceMode) }
    const work = () => setActiveMode("legion")
    window.addEventListener("keydown", keydown)
    window.addEventListener("friday:os-mode", mode)
    window.addEventListener("friday:open-work-record", work)
    return () => {
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("friday:os-mode", mode)
      window.removeEventListener("friday:open-work-record", work)
    }
  }, [onExitFullscreen])
  useEffect(() => {
    if (!isDesktop || !overwatchEnabled) return
    let mounted = true
    const sync = async () => {
      try {
        const items = await ipcGetOverwatchInterjections()
        if (mounted) setOverwatchItems(items.map(item => ({ id: item.id, category: item.category.toLowerCase() as OverwatchCategory, title: item.title, summary: item.summary, suggestion: item.suggestion, codeSnippet: item.code_snippet, timestamp: item.timestamp })))
      } catch { /* Retain acknowledged notifications during transient IPC failure. */ }
    }
    void sync()
    const timer = setInterval(() => void sync(), 5000)
    return () => { mounted = false; clearInterval(timer) }
  }, [overwatchEnabled])
  const dismiss = async (id: string) => {
    try { await ipcDismissOverwatchInterjection(id); setOverwatchItems(items => items.filter(item => item.id !== id)) } catch { /* Retain notification so dismissal can be retried. */ }
  }
  return <div className="control-room-shell">
    <OSStatusBar activeMode={activeMode} onModeChange={changeMode} isFullscreen onToggleFullscreen={() => onExitFullscreen?.()} overwatchEnabled={overwatchEnabled} onToggleOverwatch={() => setOverwatchEnabled(value => !value)} isInspectorOpen={inspectorOpen} onToggleInspector={() => setInspectorOpen(value => !value)} cpuPercent={hardware.data?.cpu_percent ?? undefined} ramMb={hardware.data?.ram_used_mb ?? undefined} activeModelName={models.find(model => model.id === modelId)?.name ?? "Select a provider"} />
    <main className="control-room-stage">
      {activeMode === "godseye" ? <GodsEyeSurface /> : <Console embedded />}
      {inspectorOpen && <aside className="workspace-inspector" aria-label="System inspector"><button type="button" className="quiet-action inspector-close" aria-label="Close inspector" onClick={() => setInspectorOpen(false)}><X size={16} /></button><OperationsTab view="telemetry" /></aside>}
    </main>
    {overwatchEnabled && <OverwatchWhisperToast items={overwatchItems} onDismiss={dismiss} />}
    <OSDock activeMode={activeMode === "unified" ? "console" : activeMode} onModeChange={changeMode} isFullscreen onToggleFullscreen={() => onExitFullscreen?.()} />
  </div>
}
