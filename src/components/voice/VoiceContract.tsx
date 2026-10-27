import { useEffect, useState } from "react"
import { useFriday, useActiveThread, sendChatMessage } from "@/lib/store"
import { SpeechReadiness } from "./SpeechReadiness"

export function VoiceContract() {
  const utterance = useFriday((s) => s.utterance)
  const orb = useFriday((s) => s.orb)
  const thread = useActiveThread()
  const [elapsed, setElapsed] = useState(0)
  const [undoError, setUndoError] = useState<string | null>(null)
  useEffect(() => {
    if (utterance.doing === null) return
    const start = performance.now()
    const timer = setInterval(() => setElapsed(performance.now() - start), 250)
    return () => clearInterval(timer)
  }, [utterance.doing, utterance.heard])
  if (!utterance.heard && !utterance.partial) return <SpeechReadiness/>
  const activeStep = utterance.doing === null ? null : utterance.plan[utterance.doing]
  const lastMessage = thread?.messages.at(-1)
  const undoable = Boolean((lastMessage?.toolCalls ?? lastMessage?.tool_calls)?.some((call) => call.undoable && call.status === "ok"))
  return (
    <details className="voice-contract" open={orb === "listening" || utterance.doing !== null}>
      <SpeechReadiness/>
      <summary className="cursor-pointer instrument-label">Instruction / {utterance.result ? "Result" : orb === "listening" ? "Listening" : "In progress"}</summary>
      <div className="voice-contract-row"><span>Heard</span><div><input aria-label="Edit heard instruction" value={utterance.partial || utterance.heard} onChange={(event) => useFriday.getState().setHeard(event.target.value)} /><button type="button" className="quiet-action mt-2 py-1 text-xs" disabled={orb !== "idle"} onClick={() => void sendChatMessage(useFriday.getState().utterance.heard)}>Send edited instruction</button></div></div>
      <div className="voice-contract-row"><span>Plan</span><ol>{utterance.plan.map((step) => <li key={step.id}><i className={`risk-point is-${step.tier}`} /><span>{step.label}</span><small className="text-[hsl(var(--muted))]">{step.status}</small></li>)}</ol></div>
      <div className="voice-contract-row"><span>Doing</span><span>{activeStep ? `${activeStep.label} · ${(elapsed / 1000).toFixed(1)}s` : "No action running"}</span></div>
      <div className="voice-contract-row"><span>Result</span><div>{utterance.result?.say ?? "Waiting for the result"}{undoable && <button type="button" className="quiet-action ml-2" onClick={() => { setUndoError(null); void useFriday.getState().undoLastAction().catch((error: unknown) => setUndoError(String(error))) }}>Undo</button>}</div></div>
      {undoError && <p role="alert" className="settings-notice is-error">{undoError}</p>}
    </details>
  )
}
