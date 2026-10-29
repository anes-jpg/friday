import { useEffect, useState } from "react"
import { useDailyWork } from "@/lib/daily-work"
import { useProjects } from "@/lib/projects"
import { useFriday } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { QuickCapture } from "./QuickCapture"
import { WorkspaceSearch } from "./WorkspaceSearch"
import { RoutineEditor } from "./RoutineEditor"
import { ReminderEditor } from "@/surfaces/console/ReminderEditor"

export function DailyWorkHost() {
  const { preferences, ready, reminderDraft } = useDailyWork()
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    void (async () => {
      await useProjects.getState().hydrate()
      await useDailyWork.getState().hydrate()
      if (disposed || !useDailyWork.getState().ready) return
      const saved = useDailyWork.getState().preferences
      sessionStorage.setItem("friday-work-view", saved.restoreView ? saved.previousWorkView : "today")
      useFriday.getState().setTab(saved.restoreView ? saved.previousView : "projects")
      useDailyWork.setState({ launchReady: true })
    })()
    return () => { disposed = true }
  }, [])
  useEffect(() => {
    if (!ready) return
    const open = () => { useDailyWork.getState().openCapture(useDailyWork.getState().draft); if (isDesktop) void invokeCommand("show_console").catch(failure => setShortcutError(String(failure))) }
    const key = (event: KeyboardEvent) => {
      const parts = preferences.shortcut.toLowerCase().split("+")
      if (event.ctrlKey === parts.includes("ctrl") && event.altKey === parts.includes("alt") && event.shiftKey === parts.includes("shift") && (event.code.toLowerCase() === parts.at(-1) || event.key.toLowerCase() === parts.at(-1))) { event.preventDefault(); open() }
    }
    window.addEventListener("keydown", key)
    let disposed = false; let unregister: (() => Promise<void>) | undefined
    if (isDesktop) void (async () => {
      try {
        const shortcut = await import("@tauri-apps/plugin-global-shortcut")
        await shortcut.register(preferences.shortcut, event => { if (event.state === "Pressed") open() })
        if (disposed) await shortcut.unregister(preferences.shortcut)
        else unregister = () => shortcut.unregister(preferences.shortcut)
        setShortcutError(null)
      } catch (failure) { setShortcutError(`Quick capture shortcut is unavailable: ${String(failure)}. Rebind it in Settings → Daily workflow.`) }
    })()
    return () => { disposed = true; window.removeEventListener("keydown", key); if (unregister) void unregister().catch(() => {}) }
  }, [ready, preferences.shortcut])
  return <>{shortcutError && <p role="alert" className="work-shortcut-error">{shortcutError}</p>}<QuickCapture /><WorkspaceSearch /><RoutineEditor />{reminderDraft && <ReminderEditor initial={reminderDraft} onClose={() => useDailyWork.setState({ reminderDraft: undefined })} onSaved={async () => useDailyWork.setState({ reminderDraft: undefined })} />}</>
}
