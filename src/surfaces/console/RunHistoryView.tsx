import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { RunRecord, RunEvent } from "@/lib/workspace-native"

export function RunHistoryView({ runs, pending, error, reload }: { runs: RunRecord[]; pending: boolean; error?: string; reload?: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const selected = runs.find(run => run.id === selectedId)
  const events = useQuery({ queryKey: ["run-events", selectedId], enabled: isDesktop && Boolean(selectedId), queryFn: () => invokeCommand<RunEvent[]>("get_run_events", { runId: selectedId }), refetchInterval: selected && ["queued", "running", "awaiting_confirmation"].includes(selected.status) ? 2000 : false })
  const receipt = useQuery({ queryKey: ["run-receipt", selectedId], enabled: isDesktop && Boolean(selectedId), queryFn: () => invokeCommand<string | null>("get_run_receipt", { runId: selectedId }) })
  const reconcile = useQuery({ queryKey: ["reconcile-actions"], enabled: isDesktop, queryFn: () => invokeCommand<Array<{ id: string; run_id: string; tool: string; status: string }>>("get_reconcile_actions") })
  const undo = async () => {
    if (!receipt.data) return
    setActionError(null)
    try { await invokeCommand("undo_action", { receiptId: receipt.data }); await receipt.refetch() }
    catch (failure) { setActionError(String(failure instanceof Error ? failure.message : failure)) }
  }
  const cancelRun = async () => {
    if (!selected) return
    setActionError(null)
    try { await invokeCommand("cancel_run", { runId: selected.id }); await events.refetch(); await reload?.() }
    catch (failure) { setActionError(String(failure instanceof Error ? failure.message : failure)) }
  }
  return <section className="project-items-view"><header><div><h3>Run history</h3><p>Recorded plans, approvals, execution outcomes, and interruptions.</p></div></header>{pending && <p role="status">Opening run history…</p>}{error && <p role="alert" className="project-error">{error}</p>}{!runs.length && !pending && <Empty><EmptyHeader><EmptyTitle>No runs yet</EmptyTitle><EmptyDescription>Send a project request to create a recorded run.</EmptyDescription></EmptyHeader></Empty>}
{(reconcile.data?.length ?? 0) > 0 && <p role="status">Reconciliation required: {reconcile.data?.length} interrupted or uncertain action(s) need review.</p>}<ul className="today-rows">{runs.map(run => <li key={run.id}><button type="button" onClick={() => setSelectedId(run.id)} aria-pressed={selectedId === run.id}><span><strong>{run.utterance.slice(0, 120)}</strong><small>{run.status.replaceAll("_", " ")} · {new Date(run.created_at).toLocaleString()}</small></span></button></li>)}</ul>{selected && <section className="run-inspector"><h4>Execution details</h4><dl><dt>Provider at start</dt><dd>{selected.provider_profile_id || "Unavailable"}</dd><dt>Conversation</dt><dd>{selected.thread_id}</dd><dt>Status</dt><dd>{selected.status.replaceAll("_", " ")}</dd></dl>{selected.status === "interrupted" && <p>Check the affected resources before retrying. Uncertain actions are never replayed automatically.</p>}{events.isError && <p role="alert">{events.error.message}</p>}<ol className="run-events">{events.data?.map(event => <li key={event.sequence}><small>{event.sequence} · {new Date(event.timestamp).toLocaleTimeString()} · {event.status.replaceAll("_", " ")}</small><pre>{JSON.stringify(event.detail, null, 2)}</pre></li>)}</ol>{receipt.data && <Button variant="outline" onClick={() => void undo()}>Undo saved file action</Button>}
{selected && ["queued", "running", "awaiting_confirmation"].includes(selected.status) && <Button variant="outline" onClick={() => void cancelRun()}>Cancel run</Button>}{actionError && <p role="alert" className="project-error">{actionError}</p>}</section>}</section>
}
