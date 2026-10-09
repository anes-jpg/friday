import React, { useEffect, useState } from "react"
import { useFridayStore, ConsoleTab } from "@/lib/store"
import { invokeCommand } from "@/lib/ipc"
import { AtmosphericField } from "@/components/layout/AtmosphericField"
import { Rail, type ConsoleRoute } from "./Rail"
import { ChatTab } from "./ChatTab"
import { BeastTab } from "./BeastTab"
import { BrowserTab } from "./BrowserTab"
import { ReviewTab } from "./ReviewTab"
import { DelphiTab } from "./DelphiTab"
import { AutomationsTab } from "./AutomationsTab"
import { SkillsTab } from "./SkillsTab"
import { MemoryTab } from "./MemoryTab"
import { AuditTab } from "./AuditTab"
import { SettingsTab } from "./SettingsTab"
import { ProjectsTab } from "./ProjectsTab"
import { AudioSpectrumVisualizer } from "@/components/telemetry/AudioSpectrumVisualizer"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { motion, AnimatePresence } from "motion/react"
import { Minus, Square, X, Copy } from "lucide-react"
import { FridayOrb } from "@/components/orb"
import { cn } from "@/lib/utils"

export const Console: React.FC = () => {
  const {
    tab,
    setTab,
    connectivity,
  } = useFridayStore()

  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const isMax = await invokeCommand<boolean>("app_is_maximized")
        setIsMaximized(!!isMax)
      } catch {
        try {
          const win = getCurrentWebviewWindow()
          setIsMaximized(await win.isMaximized())
        } catch {}
      }
    }
    checkMaximized()
  }, [])

  const handleMinimize = () => {
    invokeCommand("app_minimize").catch(() => {
      getCurrentWebviewWindow().minimize().catch(() => {})
    })
  }

  const handleToggleMaximize = async () => {
    try {
      const isMax = await invokeCommand<boolean>("app_toggle_maximize")
      setIsMaximized(!!isMax)
    } catch {
      try {
        const win = getCurrentWebviewWindow()
        await win.toggleMaximize()
        setIsMaximized(await win.isMaximized())
      } catch {}
    }
  }

  const handleClose = () => {
    invokeCommand("app_close").catch(() => {
      getCurrentWebviewWindow().close().catch(() => {})
    })
  }

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, a, input, select, textarea")) {
      invokeCommand("app_start_dragging").catch(() => {
        getCurrentWebviewWindow().startDragging().catch(() => {})
      })
    }
  }

  const isHealthy = connectivity !== "offline"

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[hsl(var(--canvas))] p-2 sm:p-3 select-none">
      {/* Outer Atmospheric Halftone World */}
      <AtmosphericField />

      {/* Main Crisp Shell: Hard Instrument */}
      <section className="friday-shell-shadow relative z-10 flex h-full overflow-hidden rounded-[var(--radius-shell)] border border-white/20 dark:border-white/10 bg-[hsl(var(--surface))]">
        {/* Canonical 64px Black Instrument Rail */}
        <Rail
          active={tab as ConsoleRoute}
          onSelect={(r) => setTab(r as ConsoleTab)}
          healthy={isHealthy}
        />

        {/* Content Canvas */}
        <div className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--surface))]">
          {/* Integrated Titlebar / Drag Region */}
          <header
            data-tauri-drag-region
            onMouseDown={handleHeaderMouseDown}
            onDoubleClick={handleToggleMaximize}
            className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-black/10 dark:border-white/10 px-4 cursor-default select-none bg-[hsl(var(--surface))]"
          >
            <div className="flex items-center gap-2.5 pointer-events-none">
              <FridayOrb size={22} className="shrink-0" />
              <span className="font-instrument text-[10px] font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted))]">
                FRIDAY // DESKTOP_OPERATOR
              </span>
              <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-black/15 dark:border-white/15 text-[hsl(var(--muted))] uppercase">
                {tab}
              </span>
            </div>

            {/* Audio Spectrum Visualizer (Capped, 30fps) */}
            <div className="hidden md:flex items-center w-48 pointer-events-none">
              <AudioSpectrumVisualizer height={18} barCount={24} className="w-full opacity-80" />
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMinimize}
                aria-label="Minimize"
                className="grid size-8 place-items-center text-[hsl(var(--muted))] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[hsl(var(--ink))] transition-colors rounded-[var(--radius-control)]"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? "Restore" : "Maximize"}
                className="grid size-8 place-items-center text-[hsl(var(--muted))] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[hsl(var(--ink))] transition-colors rounded-[var(--radius-control)]"
              >
                {isMaximized ? <Copy className="size-3 rotate-180" /> : <Square className="size-3" />}
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="grid size-8 place-items-center text-[hsl(var(--muted))] hover:bg-red-500 hover:text-white transition-colors rounded-[var(--radius-control)]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </header>

          {/* Tab Content Surface */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section className="min-w-0 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full w-full flex flex-col min-h-0"
                >
                  {tab === "chat" && <ChatTab />}
                  {tab === "browser" && <BrowserTab />}
                  {tab === "automations" && <AutomationsTab />}
                  {tab === "memory" && <MemoryTab />}
                  {tab === "review" && <ReviewTab />}
                  {tab === "skills" && <SkillsTab />}
                  {tab === "audit" && <AuditTab />}
                  {tab === "settings" && <SettingsTab />}
                  {tab === "beast" && <BeastTab />}
                  {tab === "delphi" && <DelphiTab />}
                  {tab === "projects" && <ProjectsTab />}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
