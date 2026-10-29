import React, { lazy, useEffect, useState } from "react"
import { useFridayStore } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { AtmosphericField } from "@/components/layout/AtmosphericField"
import { Rail } from "./Rail"
import { ChatTab } from "./ChatTab"
import { groupForRoute, workspaceRoutes } from "./navigation"
import { Minus, Square, X, Copy, Maximize2, Scan, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWindowMode } from "@/lib/window-mode"
import { useDailyWork } from "@/lib/daily-work"
import { BlockReveal } from "@/components/ui/block-reveal"

const BeastTab = lazy(() => import("./BeastTab").then((m) => ({ default: m.BeastTab })))
const BrowserTab = lazy(() => import("./BrowserTab").then((m) => ({ default: m.BrowserTab })))
const ReviewTab = lazy(() => import("./ReviewTab").then((m) => ({ default: m.ReviewTab })))
const DelphiTab = lazy(() => import("./DelphiTab").then((m) => ({ default: m.DelphiTab })))
const AutomationsTab = lazy(() => import("./AutomationsTab").then((m) => ({ default: m.AutomationsTab })))
const SkillsTab = lazy(() => import("./SkillsTab").then((m) => ({ default: m.SkillsTab })))
const MemoryTab = lazy(() => import("./MemoryTab").then((m) => ({ default: m.MemoryTab })))
const AuditTab = lazy(() => import("./AuditTab").then((m) => ({ default: m.AuditTab })))
const SettingsTab = lazy(() => import("./SettingsTab").then((m) => ({ default: m.SettingsTab })))
const ProjectsTab = lazy(() => import("./ProjectsTab").then((m) => ({ default: m.ProjectsTab })))
const MonitorTab = lazy(() => import("./MonitorTab").then((m) => ({ default: m.MonitorTab })))
const OperationsTab = lazy(() => import("./OperationsTab").then((m) => ({ default: m.OperationsTab })))

export interface ConsoleProps { embedded?: boolean }
export const Console: React.FC<ConsoleProps> = ({ embedded = false }) => {
  const tab = useFridayStore((s) => s.tab)
  const launchReady = useDailyWork(state => state.launchReady)
  const setTab = useFridayStore((s) => s.setTab)
  const orb = useFridayStore((s) => s.orb)
  const muted = useFridayStore((s) => s.micMuted)
  const wakeWord = useFridayStore((s) => s.wakeWord.enabled)
  const group = groupForRoute(tab)
  const [isMaximized, setIsMaximized] = useState(false)
  const fullscreen = useWindowMode((s) => s.fullscreen)
  const groupLabel = group[0].toUpperCase() + group.slice(1)
  useEffect(() => { sessionStorage.setItem(`friday-route-${group}`, tab) }, [group, tab])
  useEffect(() => {
    const daily = useDailyWork.getState()
    if (launchReady && daily.ready && daily.preferences.previousView !== tab) void daily.savePreferences({ previousView: tab }).catch(failure => console.warn("Could not save the launch view", failure))
  }, [tab, launchReady])
  useEffect(() => {
    if (!embedded && isDesktop) void invokeCommand<boolean>("app_is_maximized").then(setIsMaximized).catch(() => {})
  }, [embedded])
  const maximize = async () => {
    if (!isDesktop) return
    try { setIsMaximized(await invokeCommand<boolean>("app_toggle_maximize")) } catch (error) { console.warn(error) }
  }
  const drag = (event: React.MouseEvent<HTMLElement>) => {
    if (isDesktop && !embedded && event.button === 0 && !(event.target as HTMLElement).closest("button, input, a, select")) void invokeCommand("app_start_dragging").catch(() => {})
  }
  const status = orb === "idle" ? muted ? "Microphone muted" : isDesktop ? wakeWord ? "Wake word enabled" : "Push to talk" : "Desktop preview" : orb === "thinking" ? "Thinking" : orb === "speaking" ? "Speaking" : "Listening"
  return (
    <main className={cn("friday-workspace", embedded && "is-embedded")}>
      <AtmosphericField className="workspace-atmosphere" />
      <Rail active={tab} onSelect={setTab} />
      <div className="workspace-body">
        {!embedded && (
          <header className="workspace-header" data-tauri-drag-region onMouseDown={drag} onDoubleClick={maximize}>
            <div className="workspace-identity"><span className="wordmark">FRIDAY<span className="wordmark-dot">.</span></span><span className="workspace-divider" /><span className="workspace-name">{groupLabel}</span></div>
            <div className="workspace-status"><span className={cn("status-point", orb !== "idle" && "is-active")} /><span>{status}</span></div>
            <div className="window-actions">
              <button type="button" aria-label="Open command palette" title="Commands (Ctrl+K)" onClick={() => useFridayStore.getState().setPalette(true)}><Search size={16} /></button>
              <button type="button" aria-label="Enter spatial control room" title="Control room (Ctrl+Shift+F11)" onClick={() => window.dispatchEvent(new CustomEvent("friday:trigger-hud-boot"))}><Scan size={16} /></button>
              <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title="Fullscreen (F11)" onClick={() => void useWindowMode.getState().toggleFullscreen()}><Maximize2 size={15} /></button>
              {isDesktop && <>
                <button type="button" aria-label="Minimize" onClick={() => void invokeCommand("app_minimize")}><Minus size={16} /></button>
                <button type="button" aria-label={isMaximized ? "Restore" : "Maximize"} onClick={() => void maximize()}>{isMaximized ? <Copy size={13} /> : <Square size={13} />}</button>
                <button type="button" className="window-close" aria-label="Close" onClick={() => void invokeCommand("app_close")}><X size={16} /></button>
              </>}
            </div>
          </header>
        )}
        {workspaceRoutes[group].length > 1 && (
          <nav className="workspace-local-nav" aria-label={`${groupLabel} views`}>
            {workspaceRoutes[group].map((route) => <button type="button" key={route.id} aria-current={tab === route.id ? "page" : undefined} className={cn(tab === route.id && "is-selected")} onClick={() => setTab(route.id)}>{route.label}</button>)}
          </nav>
        )}
        <section className="workspace-content" data-workspace-tab={tab} aria-label={groupLabel}>
          <div className="workspace-route" key={group === "monitor" ? "monitor" : tab}><React.Suspense fallback={<BlockReveal loading label="Opening workspace" lines={8} className="workspace-loading" />}>
            {tab === "chat" && <ChatTab />}
            {tab === "browser" && <BrowserTab />}
            {tab === "automations" && <AutomationsTab />}
            {tab === "memory" && <MemoryTab />}
            {tab === "review" && <ReviewTab />}
            {tab === "skills" && <SkillsTab />}
            {tab === "audit" && <AuditTab />}
            {(tab === "settings" || tab === "models") && <SettingsTab />}
            {tab === "beast" && <BeastTab />}
            {tab === "delphi" && <DelphiTab />}
            {tab === "projects" && <ProjectsTab />}
            {(tab === "analytics" || tab === "history" || tab === "telemetry") && <OperationsTab view={tab} />}
            {group === "monitor" && tab !== "telemetry" && <MonitorTab />}
          </React.Suspense></div>
        </section>
      </div>
    </main>
  )
}
