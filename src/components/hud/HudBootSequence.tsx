import { useEffect, useState } from "react"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { ipcGetPiperStatus } from "@/lib/piper"
import { useFriday } from "@/lib/store"

export interface HudBootSequenceProps { onComplete: () => void; onSkip?: () => void }
type Check = { label: string; state: "checking" | "ready" | "unavailable"; detail: string }
export function HudBootSequence({ onComplete, onSkip }: HudBootSequenceProps) {
  const [checks, setChecks] = useState<Check[]>([
    { label: "Workspace", state: "checking", detail: "Opening saved context" },
    { label: "Reasoning", state: "checking", detail: "Reading provider configuration" },
    { label: "Voice", state: "checking", detail: "Checking local speech engine" },
  ])
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    const update = (index: number, state: Check["state"], detail: string) => {
      if (!cancelled) setChecks((current) => current.map((check, i) => i === index ? { ...check, state, detail } : check))
    }
    const check = async () => {
      await Promise.allSettled([
        (isDesktop ? useFriday.getState().loadFactsFromBackend().then(() => update(0, "ready", "Saved context loaded")).catch(() => update(0, "unavailable", "Saved context could not be loaded")) : Promise.resolve(update(0, "unavailable", "Saved context requires Windows"))),
        (async () => {
          if (!isDesktop) { update(1, "unavailable", "Browser preview — provider not connected"); return }
          try {
            const settings = await invokeCommand<{ heavyModel: string }>("get_glm_settings")
            update(1, "ready", `${settings.heavyModel} configured · connection not tested`)
          } catch { update(1, "unavailable", "Configure a provider in Settings") }
        })(),
        ipcGetPiperStatus().then((status) => update(2, status.ready ? "ready" : "unavailable", status.ready ? "Local speech engine ready" : "Local speech engine unavailable")).catch(() => update(2, "unavailable", "Local speech engine unavailable")),
      ])
    }
    void check()
    return () => { cancelled = true }
  }, [attempt])
  const checking = checks.some((check) => check.state === "checking")
  return (
    <div className="boot-screen" role="dialog" aria-modal="true" aria-labelledby="boot-title">
      <div className="boot-composition">
        <div className="boot-graphic"><AsciiLoader variant="core" active={checking} label={checking ? "Restoring your workspace" : "Workspace checks complete"} detail="CONTEXT / WORK / VOICE" /></div>
        <div className="boot-content">
          <span className="instrument-label">FRIDAY / Control room</span>
          <h1 id="boot-title">CONTROL<br />ROOM.</h1>
          <p>Workspace · live map · activity</p>
          <div className="boot-checks" aria-live="polite">
            {checks.map((check) => <div key={check.label}><span className={`boot-check-point is-${check.state}`} /><span>{check.label}</span><small>{check.detail}</small></div>)}
          </div>
          <div className="boot-actions">
            <button type="button" className="primary-action" disabled={checking} autoFocus onClick={onComplete}>{checking ? "Checking workspace…" : "Open control room"}</button>
            <button type="button" className="quiet-action" onClick={() => { setChecks(current => current.map(check => ({ ...check, state: "checking" }))); setAttempt(value => value + 1) }} disabled={checking}>Check again</button>
            {onSkip && <button type="button" className="quiet-action" onClick={onSkip}>Back to workspace</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
