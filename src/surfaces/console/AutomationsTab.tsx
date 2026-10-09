import React, { useState, useMemo } from "react"
import { useFridayStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { MetricInstrument } from "@/components/tremor/KpiCard"
import { Clock, Play, Plus, X, TimerReset, Calendar, ListFilter, LayoutGrid } from "lucide-react"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { SubscriptionCalendar, type SubscriptionDay } from "@/components/schedule/SubscriptionCalendar"

export const AutomationsTab: React.FC = () => {
  const { automations, toggleAutomation, addAutomation, runAutomationNow } = useFridayStore()
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"split" | "calendar" | "list">("split")

  // Form state
  const [name, setName] = useState("")
  const [triggerExpr, setTriggerExpr] = useState("0 9 * * 1-5")
  const [actionSummary, setActionSummary] = useState("")

  // Calendar state
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 9, 1)) // October 2026

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const monthName = monthNames[currentDate.getMonth()]
  const year = currentDate.getFullYear()

  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const days: SubscriptionDay[] = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()

    const firstDay = new Date(y, m, 1)
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7 // Monday = 0 ... Sunday = 6
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const daysInPrevMonth = new Date(y, m, 0).getDate()

    const result: SubscriptionDay[] = []

    // 1. Previous month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      result.push({
        date: daysInPrevMonth - i,
        isMuted: true,
      })
    }

    // 2. Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const indicators: React.ReactNode[] = []
      const logos: React.ReactNode[] = []

      if (d === 5 || d === 12 || d === 19 || d === 26) {
        indicators.push(
          <span key="purple" className="size-1 rounded-full bg-[#a855f7]" title="Weekly Maintenance" />
        )
      }
      if (d % 3 === 0) {
        indicators.push(
          <span key="yellow" className="size-1 rounded-full bg-[#facc15]" title="Telemetry Sync" />
        )
      }
      if (d === 1 || d === 15 || d === 28) {
        indicators.push(
          <span key="orange" className="size-1 rounded-full bg-[#fa6a2e]" title="Scheduled Task" />
        )
      }

      if (d === 28) {
        logos.push(<span key="logo" className="text-[10px] select-none">⚡</span>)
      } else if (d === 15) {
        logos.push(<span key="logo" className="text-[10px] select-none">🔄</span>)
      } else if (d === 3) {
        logos.push(<span key="logo" className="text-[10px] select-none">📦</span>)
      }

      result.push({
        date: d,
        isMuted: false,
        indicators: indicators.length > 0 ? indicators : undefined,
        isLogo: logos.length > 0 ? logos : undefined,
      })
    }

    // 3. Next month leading days to complete grid
    const targetLength = result.length > 35 ? 42 : 35
    for (let d = 1; result.length < targetLength; d++) {
      result.push({
        date: d,
        isMuted: true,
      })
    }

    return result
  }, [currentDate])

  const handleTriggerNow = async (id: string, autoName: string) => {
    setTriggeringId(id)
    try {
      if (isDesktop) {
        await invokeCommand("trigger_automation", { id })
      }
      runAutomationNow(id)
      toast.success(`Executed "${autoName}"`)
    } catch (err) {
      toast.error(`Execution failed: ${String(err)}`)
    } finally {
      setTriggeringId(null)
    }
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Please provide an automation name")
      return
    }
    if (!triggerExpr.trim()) {
      toast.error("Please provide a cron or schedule trigger")
      return
    }

    addAutomation({
      name: name.trim(),
      trigger: { type: "cron", expr: triggerExpr.trim(), tz: "local" },
      triggerExpr: triggerExpr.trim(),
      actionSummary: actionSummary.trim() || "Automated scheduled task",
      enabled: true,
      last_run: undefined,
    })

    toast.success(`Automation "${name.trim()}" created`)
    setName("")
    setTriggerExpr("0 9 * * 1-5")
    setActionSummary("")
    setIsModalOpen(false)
  }

  const activeCount = automations.filter((a) => a.enabled).length

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-y-auto select-none">
      {/* Standard Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <TimerReset className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Task Schedule & Automations
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              RUST WORKER
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Cron schedules, automated triggers, and background tasks running in native worker loop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 p-0.5 bg-black/5 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
                viewMode === "split"
                  ? "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] shadow-xs"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
              )}
              title="Split View"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
                viewMode === "calendar"
                  ? "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] shadow-xs"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
              )}
              title="Calendar View"
            >
              <Calendar className="size-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] shadow-xs"
                  : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
              )}
              title="Task List View"
            >
              <ListFilter className="size-3.5" />
              <span className="hidden sm:inline">Jobs</span>
            </button>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="bg-[hsl(var(--ink))] text-[hsl(var(--surface))] hover:opacity-90 font-instrument text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" />
            New Automation
          </Button>
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      {viewMode === "calendar" ? (
        <div className="flex flex-col items-center justify-center py-4">
          <SubscriptionCalendar
            month={monthName}
            year={year}
            days={days}
            monthlyTotal={142}
            subscriptionsCount={automations.length}
            newCount={activeCount}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onScheduleTask={(t) => {
              addAutomation({
                name: t.name,
                triggerExpr: t.cron,
                trigger: { type: "cron", expr: t.cron, tz: "local" },
                actionSummary: "Scheduled job via calendar",
                enabled: true,
                last_run: undefined,
              })
              toast.success(`Scheduled job "${t.name}"`)
            }}
          />
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-6">
          {/* KPI Instruments */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricInstrument
              label="Active Jobs"
              value={String(activeCount)}
              detail={<span className="text-[hsl(var(--signal))] font-instrument">{automations.length} total</span>}
            />
            <MetricInstrument
              label="Executed (24h)"
              value="142"
              detail={<span className="text-[hsl(var(--success))] font-instrument">99.6% pass</span>}
            />
            <MetricInstrument
              label="Failure Rate"
              value="0.4%"
              detail={<span className="text-[hsl(var(--muted))] font-instrument">within budget</span>}
            />
          </div>

          {/* Rows over Cards for Recurring Jobs */}
          <div className="rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 border-b border-black/10 dark:border-white/10 font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))]">
              <span className="col-span-4">State & Name</span>
              <span className="col-span-3">Trigger / Cron</span>
              <span className="col-span-3">Last Result</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5">
              {automations.map((auto) => (
                <div
                  key={auto.id}
                  className={cn(
                    "grid grid-cols-12 items-center px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                    !auto.enabled && "opacity-60"
                  )}
                >
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        auto.enabled ? "bg-[hsl(var(--signal))]" : "bg-[hsl(var(--muted))]"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--ink))] truncate">{auto.name}</p>
                      <p className="text-xs text-[hsl(var(--muted))] truncate">{auto.actionSummary}</p>
                    </div>
                  </div>

                  <div className="col-span-3 font-instrument text-xs text-[hsl(var(--muted))]">
                    {auto.triggerExpr || (auto.trigger?.type === "cron" ? auto.trigger.expr : "Event")}
                  </div>

                  <div className="col-span-3 font-instrument text-xs text-[hsl(var(--muted))]">
                    {auto.last_run ? new Date(auto.last_run).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never executed"}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleTriggerNow(auto.id, auto.name)}
                      disabled={triggeringId === auto.id}
                      title="Run now"
                      aria-label="Run automation now"
                      className="grid size-7 place-items-center rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 hover:border-[hsl(var(--signal))] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] transition-colors cursor-pointer"
                    >
                      <Play className={cn("size-3.5 fill-current", triggeringId === auto.id && "animate-spin text-[hsl(var(--signal))]")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAutomation(auto.id)}
                      aria-label={auto.enabled ? "Disable automation" : "Enable automation"}
                      className={cn(
                        "px-2.5 py-1 rounded-[var(--radius-control)] font-instrument text-[10px] font-semibold transition-colors cursor-pointer border",
                        auto.enabled
                          ? "bg-[hsl(var(--signal))]/10 border-[hsl(var(--signal))]/30 text-[hsl(var(--signal))]"
                          : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-[hsl(var(--muted))]"
                      )}
                    >
                      {auto.enabled ? "ACTIVE" : "PAUSED"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Split View: Calendar on Right / Column on Left */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-6">
            {/* KPI Instruments */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricInstrument
                label="Active Jobs"
                value={String(activeCount)}
                detail={<span className="text-[hsl(var(--signal))] font-instrument">{automations.length} total</span>}
              />
              <MetricInstrument
                label="Executed (24h)"
                value="142"
                detail={<span className="text-[hsl(var(--success))] font-instrument">99.6% pass</span>}
              />
              <MetricInstrument
                label="Failure Rate"
                value="0.4%"
                detail={<span className="text-[hsl(var(--muted))] font-instrument">within budget</span>}
              />
            </div>

            {/* Recurring Jobs Table */}
            <div className="rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 border-b border-black/10 dark:border-white/10 font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))]">
                <span className="col-span-4">State & Name</span>
                <span className="col-span-3">Trigger / Cron</span>
                <span className="col-span-3">Last Result</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/5">
                {automations.map((auto) => (
                  <div
                    key={auto.id}
                    className={cn(
                      "grid grid-cols-12 items-center px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                      !auto.enabled && "opacity-60"
                    )}
                  >
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          auto.enabled ? "bg-[hsl(var(--signal))]" : "bg-[hsl(var(--muted))]"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--ink))] truncate">{auto.name}</p>
                        <p className="text-xs text-[hsl(var(--muted))] truncate">{auto.actionSummary}</p>
                      </div>
                    </div>

                    <div className="col-span-3 font-instrument text-xs text-[hsl(var(--muted))]">
                      {auto.triggerExpr || (auto.trigger?.type === "cron" ? auto.trigger.expr : "Event")}
                    </div>

                    <div className="col-span-3 font-instrument text-xs text-[hsl(var(--muted))]">
                      {auto.last_run ? new Date(auto.last_run).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never executed"}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerNow(auto.id, auto.name)}
                        disabled={triggeringId === auto.id}
                        title="Run now"
                        aria-label="Run automation now"
                        className="grid size-7 place-items-center rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 hover:border-[hsl(var(--signal))] text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] transition-colors cursor-pointer"
                      >
                        <Play className={cn("size-3.5 fill-current", triggeringId === auto.id && "animate-spin text-[hsl(var(--signal))]")} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAutomation(auto.id)}
                        aria-label={auto.enabled ? "Disable automation" : "Enable automation"}
                        className={cn(
                          "px-2.5 py-1 rounded-[var(--radius-control)] font-instrument text-[10px] font-semibold transition-colors cursor-pointer border",
                          auto.enabled
                            ? "bg-[hsl(var(--signal))]/10 border-[hsl(var(--signal))]/30 text-[hsl(var(--signal))]"
                            : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-[hsl(var(--muted))]"
                        )}
                      >
                        {auto.enabled ? "ACTIVE" : "PAUSED"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Subscription Calendar */}
          <div className="xl:col-span-5 2xl:col-span-4 flex justify-center xl:justify-end">
            <SubscriptionCalendar
              month={monthName}
              year={year}
              days={days}
              monthlyTotal={142}
              subscriptionsCount={automations.length}
              newCount={activeCount}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onScheduleTask={(t) => {
                addAutomation({
                  name: t.name,
                  triggerExpr: t.cron,
                  trigger: { type: "cron", expr: t.cron, tz: "local" },
                  actionSummary: "Scheduled job via calendar",
                  enabled: true,
                  last_run: undefined,
                })
                toast.success(`Scheduled job "${t.name}"`)
              }}
            />
          </div>
        </div>
      )}

      {/* Creation Modal / Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-[hsl(var(--surface-raised))] border border-black/15 dark:border-white/15 rounded-[var(--radius-panel)] friday-shell-shadow overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-[var(--radius-control)] bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))]">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-[hsl(var(--ink))] text-sm">
                    Create New Automation
                  </h3>
                  <span className="font-instrument text-[10px] text-[hsl(var(--muted))]">
                    Background scheduler running in Rust worker loop
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close dialog"
                className="p-1 rounded-[var(--radius-control)] hover:bg-black/5 dark:hover:bg-white/10 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block font-instrument text-[10px] uppercase tracking-wider text-[hsl(var(--muted))] mb-1">
                  Automation Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Workspace Review"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                />
              </div>

              <div>
                <label className="block font-instrument text-[10px] uppercase tracking-wider text-[hsl(var(--muted))] mb-1">
                  Schedule Expression (Cron)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0 9 * * 1-5"
                  value={triggerExpr}
                  onChange={(e) => setTriggerExpr(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-instrument bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                />
              </div>

              <div>
                <label className="block font-instrument text-[10px] uppercase tracking-wider text-[hsl(var(--muted))] mb-1">
                  Action Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the automated action"
                  value={actionSummary}
                  onChange={(e) => setActionSummary(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[hsl(var(--ink))] text-[hsl(var(--surface))] hover:opacity-90 font-instrument text-xs"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutomationsTab
