import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw, ArrowUpRight, Download } from "lucide-react"
import { MetricInstrument } from "@/components/tremor/KpiCard"
import { SegmentedTracker } from "@/components/tremor/Tracker"
import { useProjects } from "@/lib/projects"
import { useFriday } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { ipcGetHardwareVitals } from "@/lib/telemetry"
import type { RunRecord } from "@/lib/workspace-native"
import { taskSnapshot, runAnalytics, formatDuration } from "@/lib/task-analytics"
import { openWorkRecord } from "@/lib/work-navigation"
import { RunHistoryView } from "./RunHistoryView"

export function OperationsTab({ view }: { view: "analytics" | "history" | "telemetry" }) {
  const projects = useProjects(state => state.projects)
  const items = useProjects(state => state.items)
  const loadError = useProjects(state => state.loadError)
  const latency = useFriday(state => state.latency)
  const orb = useFriday(state => state.orb)
  const [days, setDays] = useState(7)
  const [projectId, setProjectId] = useState("")
  const history = useQuery({ queryKey: ["run-history", "operations", projectId], enabled: isDesktop, queryFn: () => invokeCommand<RunRecord[]>("get_run_history", { projectId: projectId || null, threadId: null }), refetchInterval: 10_000, refetchIntervalInBackground: false })
  const hardware = useQuery({ queryKey: ["hardware-vitals"], enabled: isDesktop && view === "telemetry", queryFn: ipcGetHardwareVitals, refetchInterval: 5000, refetchIntervalInBackground: false })
  const runs = history.data ?? []
  const scopedItems = useMemo(() => projectId ? items.filter(item => item.projectId === projectId) : items, [items, projectId])
  const now = new Date()
  const snapshot = taskSnapshot(scopedItems, now)
  const analytics = runAnalytics(runs, days, now)
  const maxRuns = Math.max(1, ...analytics.buckets.map(bucket => bucket.total))
  const title = view === "analytics" ? "Task analytics" : view === "history" ? "Run history" : "System telemetry"
  const refresh = async () => { await Promise.allSettled([history.refetch(), view === "telemetry" ? hardware.refetch() : Promise.resolve(), useProjects.getState().hydrate(true)]) }
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), projectId: projectId || null, runs }, null, 2)], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url; anchor.download = `friday-run-history-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="operations-workspace">
    <header className="records-heading"><div><span className="instrument-label">FRIDAY / Operations</span><h1 className="page-heading">{title}</h1><p>{view === "analytics" ? "Your work, measured from saved records." : view === "telemetry" ? "Local system readings and measured voice latency." : "Plans, approvals, outcomes, and interruptions."}</p></div><div className="operations-actions"><button type="button" className="quiet-action" disabled={history.isFetching || hardware.isFetching} onClick={() => void refresh()}><RefreshCw size={14} />Refresh</button>{view === "history" && <button type="button" className="quiet-action" disabled={!runs.length} onClick={exportHistory}><Download size={14} />Export JSON</button>}</div></header>
    <div className="operations-toolbar"><label>Project<select aria-label="Filter operations by project" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">All projects</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{view === "analytics" && <div className="operations-range" aria-label="Run analytics period">{[7, 30].map(period => <button type="button" key={period} aria-pressed={days === period} onClick={() => setDays(period)}>{period} days</button>)}</div>}<span className="instrument-label">{isDesktop ? "Recorded locally" : "Browser preview"}</span></div>
    {loadError && <p className="settings-notice is-error" role="alert">{loadError}</p>}
    {history.isError && <p className="settings-notice is-error" role="alert">Run history could not be read: {history.error.message}</p>}
    {!isDesktop && <p className="records-note">Native run history and hardware readings are available in the Windows app. Task counts use your saved workspace.</p>}
    {view === "analytics" && <>
      <div className="operations-metrics"><MetricInstrument label="Tasks completed" value={`${snapshot.done} / ${snapshot.total}`} detail="Current snapshot" /><MetricInstrument label="In progress" value={String(snapshot.active)} detail={`${snapshot.todo} still to do`} /><MetricInstrument label="Overdue" value={String(snapshot.overdue)} detail="Open tasks past their due date" /><MetricInstrument label="Run completion rate" value={analytics.successRate === null ? "—" : `${analytics.successRate}%`} detail={`${analytics.completed} of ${analytics.finished} finished runs`} /></div>
      <div className="operations-grid"><section className="operations-panel"><header><div><span className="instrument-label">Run volume / {days} days</span><h2>{analytics.total} recorded runs</h2></div><span>Median elapsed {formatDuration(analytics.median)}</span></header>
        <svg viewBox="0 0 640 184" className="operations-chart" role="img" aria-label={`Run counts for the last ${days} days: ${analytics.buckets.map(bucket => `${new Date(bucket.date).toLocaleDateString()}: ${bucket.total}`).join(", ")}`}><line x1="16" y1="152" x2="624" y2="152" className="chart-baseline" />{analytics.buckets.map((bucket, index) => { const width = 608 / days; const height = bucket.total / maxRuns * 120; return <g key={bucket.date}><rect x={16 + index * width + 3} y={152 - height} width={Math.max(2, width - 6)} height={height} rx="2" className="chart-bar"><title>{`${new Date(bucket.date).toLocaleDateString()}: ${bucket.total} runs, ${bucket.completed} completed`}</title></rect>{(days === 7 || index % 5 === 0) && <text x={16 + index * width + width / 2} y="174" textAnchor="middle">{new Date(bucket.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>}</g>})}</svg>
        {!analytics.total && <p className="records-note">No runs recorded in this period. Send a project request to start tracking execution.</p>}<p className="operations-footnote">Completion rate includes completed, failed, cancelled, and interrupted runs. Elapsed time includes approval waits. History is limited to the latest 200 runs for the selected project.</p></section>
        <section className="operations-panel"><header><div><span className="instrument-label">Current workload</span><h2>Across your projects</h2></div></header><ul className="operations-projects">{projects.filter(project => !projectId || project.id === projectId).map(project => { const count = taskSnapshot(items.filter(item => item.projectId === project.id), now); return <li key={project.id}><button type="button" onClick={() => openWorkRecord(project.id, "tasks")}><span><strong>{project.name}</strong><small>{count.done} completed · {count.active} in progress · {count.overdue} overdue</small></span><ArrowUpRight size={16} /></button><SegmentedTracker label={`${count.done} of ${count.total} tasks completed`} segments={Array.from({ length: 20 }, (_, index) => ({ id: `${project.id}-${index}`, label: `${count.done} of ${count.total} complete`, tone: count.total && index < Math.round(count.done / count.total * 20) ? "success" : "idle" }))} /></li>})}</ul>{!projects.length && <p className="records-note">Create a project and save tasks to measure your workload.</p>}</section></div>
    </>}
    {view === "history" && <RunHistoryView runs={runs} pending={history.isLoading} reload={async () => { await history.refetch() }} />}
    {view === "telemetry" && <>
      {hardware.isError && <p role="alert" className="settings-notice is-error">Hardware readings unavailable: {hardware.error.message}</p>}
      <div className="operations-metrics"><MetricInstrument label="CPU utilization" value={hardware.data?.cpu_percent == null ? "—" : `${hardware.data.cpu_percent.toFixed(1)}%`} detail="Local machine" /><MetricInstrument label="Memory used" value={hardware.data?.ram_used_mb == null ? "—" : `${(hardware.data.ram_used_mb / 1024).toFixed(1)} GB`} detail={hardware.data?.ram_total_mb == null ? "No reading" : `${(hardware.data.ram_total_mb / 1024).toFixed(1)} GB total`} /><MetricInstrument label="GPU temperature" value={hardware.data?.gpu.temperature_c == null ? "—" : `${hardware.data.gpu.temperature_c}°C`} detail={hardware.data?.gpu.name || "No reading"} /><MetricInstrument label="Operator" value={orb} detail={hardware.dataUpdatedAt ? `Updated ${new Date(hardware.dataUpdatedAt).toLocaleTimeString()}` : "Waiting for native readings"} /></div>
      <div className="operations-grid"><section className="operations-panel"><header><div><span className="instrument-label">Voice pipeline</span><h2>Rolling p95 latency</h2></div></header><ul className="operations-readings">{latency.map(stage => <li key={stage.key} className={stage.value !== null && stage.value > stage.budget ? "is-over-budget" : undefined}><span>{stage.label}</span><strong>{stage.value === null ? "—" : `${stage.value} ms`}</strong><small>{stage.value !== null && stage.value > stage.budget ? "Over budget · " : ""}Budget {stage.budget} ms</small></li>)}</ul><p className="operations-footnote">Stage timings show the rolling p95 of up to 100 measured samples per stage in this session. Unmeasured stages remain blank.</p></section><section className="operations-panel"><header><div><span className="instrument-label">Execution tracker</span><h2>Latest recorded runs</h2></div></header>{runs.length ? <SegmentedTracker label="Latest run outcomes" segments={runs.slice(0, 32).reverse().map(run => ({ id: run.id, label: `${run.utterance.slice(0, 80)}: ${run.status}`, tone: run.status === "completed" ? "success" : run.status === "failed" ? "danger" : ["queued", "running"].includes(run.status) ? "active" : "warning" }))} /> : <p className="records-note">No runs recorded yet.</p>}<button type="button" className="quiet-action" onClick={() => useFriday.getState().setTab("history")}>Open run history<ArrowUpRight size={14} /></button></section></div>
    </>}
  </section>
}
