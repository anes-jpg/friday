import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Command, MapPin, Layers, Mic, Square, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BlockReveal } from "@/components/ui/block-reveal"
import { Kbd } from "@/components/ui/kbd"
import { useFriday, type ConsoleTab } from "@/lib/store"
import { useSettings } from "@/lib/settings"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { PiperEngineStatus, PiperSpeakResult } from "@/lib/piper"

const steps = [
  { label: "Connect", icon: Command, title: "Give FRIDAY a working model.", description: "Configure your endpoint, model name, and credentials in Settings. Local and remote OpenAI-compatible providers are supported; speech stays local." },
  { label: "Discover", icon: MapPin, title: "Find a business. Build from facts.", description: "Pick a business, then get its Google details with one button. FRIDAY reads the matching Maps listing, closes its research window, and expands a business dossier through ASCII blocks. Review the branch and carry its sourced details into a website project. No paid API key is needed." },
  { label: "Build", icon: Layers, title: "Choose the stack and the pieces.", description: "Open a project's Builder to choose portable HTML, React components, or a Dioramas scene. Inspect the free source references and attach selected blocks to an implementation request." },
  { label: "Remember", icon: Command, title: "Keep the context with the work.", description: "Memory connects saved facts and their sources. Project notes, checkpoints, analytics, telemetry, and run history keep decisions and real outcomes visible." },
  { label: "Speak & stop", icon: Mic, title: "Your voice. Your control.", description: "Hold Space to speak in the desktop bar, then release. Follow Heard, Plan, Doing, and Result. Review sensitive changes before confirming; interrupt whenever you need to." },
] as const

/** Shared feature guide for the modal and standalone surface. */
export function Onboarding({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0)
  const [audition, setAudition] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechId = useRef(0)
  const profiles = useSettings(state => state.saved.profiles)
  const activeId = useSettings(state => state.saved.activeProfileId)
  const loaded = useSettings(state => state.loaded)
  const profile = profiles.find(item => item.id === activeId)
  const voice = useQuery({ queryKey: ["onboarding-voice-status"], enabled: isDesktop, queryFn: () => invokeCommand<PiperEngineStatus>("get_piper_engine_status"), retry: false })
  const current = steps[step]
  const complete = () => {
    try { localStorage.setItem("friday_onboarded_v1_0", "true"); localStorage.setItem("friday_onboarded", "true") }
    catch (failure) { setError(`Could not save guide completion: ${String(failure)}`); return }
    onDone?.()
  }
  const open = (tab: ConsoleTab) => { useFriday.getState().setTab(tab); complete() }
  const stop = async () => {
    speechId.current++
    setAudition(false)
    try { await useFriday.getState().bargeIn(); setNotice("Stop request completed. Check that playback has stopped.") }
    catch (failure) { setError(`Could not stop playback: ${String(failure)}`) }
  }
  const play = async () => {
    const id = ++speechId.current
    setAudition(true); setError(null); setNotice(null)
    useFriday.getState().setOrb("speaking")
    try {
      const result = await invokeCommand<PiperSpeakResult>("piper_speak", { text: "I'm ready to help you make something useful. You can interrupt me whenever you need to.", style: "calm", speed: useFriday.getState().voicePace })
      if (speechId.current !== id) return
      if (!result.success || result.sample_count <= 0) throw new Error("Local speech returned no audio. Check the voice model in Settings.")
      setNotice("The local speech engine returned audio. Confirm that you heard it.")
    } catch (failure) { if (speechId.current === id) setError(String(failure)) }
    finally { if (speechId.current === id) { setAudition(false); useFriday.getState().setOrb("idle") } }
  }
  useEffect(() => () => { if (speechId.current) { speechId.current++; void useFriday.getState().bargeIn().catch(() => {}) } }, [])
  return <div className="friday-guide"><aside><span className="wordmark">FRIDAY.</span><p className="instrument-label">Workspace guide</p><nav aria-label="Guide steps">{steps.map((item, index) => <button key={item.label} type="button" aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><item.icon size={16} /><span>{item.label}</span><small>{String(index + 1).padStart(2, "0")}</small></button>)}</nav><p>Public sources. Local speech.<br />A workspace around your goals.</p></aside>
    <div className="guide-body"><header><span className="instrument-label">{String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span><Button variant="ghost" size="sm" onClick={complete}>Finish guide</Button></header>
      <BlockReveal key={step} className="guide-content"><current.icon size={24} /><h1>{current.title}</h1><p>{current.description}</p>
        {step === 0 && <><dl className="guide-readiness"><dt>Provider</dt><dd>{loaded && profile ? `${profile.name} · ${profile.model}` : "Open Settings to configure a provider"}</dd><dt>Connection</dt><dd>Test the saved connection in Settings before sending work.</dd><dt>Local voice</dt><dd>{!isDesktop ? "Available in the Windows app" : voice.isPending ? "Checking local engine…" : voice.data?.ready ? "Local engine reports ready" : voice.isError ? `Status unavailable: ${voice.error.message}` : "Local model needs setup"}</dd></dl><Button variant="outline" onClick={() => open("settings")}>Open provider settings<ArrowRight size={16} /></Button></>}
        {step === 1 && <><ol className="guide-flow"><li>Find and select a business in your city using map filters or Google discovery.</li><li>Choose Get Google business details. Its Maps window closes after capture and this panel expands into an ASCII-revealed dossier.</li><li>Check the branch, save its sourced contacts, and choose Build website.</li></ol><p className="guide-note">For businesses with the same name, select the correct branch in Google Maps, then press Capture selected listing in FRIDAY. Missing details remain visible for owner review.</p><Button variant="outline" onClick={() => open("map")}>Open business map<ArrowRight size={16} /></Button></>}
        {step === 2 && <><div className="guide-stack-options"><span>Portable HTML<small>One file, immediate file preview</small></span><span>React & TypeScript<small>Reusable UI, local development preview</small></span><span>Dioramas<small>Procedural or supplied assets, with motion fallbacks</small></span></div><p className="guide-note">Builder kits contain inspectable starters and documentation. FRIDAY still needs a configured model and a working folder to implement and check the actual files.</p><Button variant="outline" onClick={() => open("projects")}>Open Work<ArrowRight size={16} /></Button></>}
        {step === 3 && <><ol className="guide-flow"><li>Inspect and edit saved facts in Memory.</li><li>Pin sources and save a checkpoint before leaving a project.</li><li>Use run history to see completed actions, failures, and interrupted work.</li></ol><Button variant="outline" onClick={() => open("memory")}>Open Memory<ArrowRight size={16} /></Button></>}
        {step === 4 && <><div className="guide-contract">{["Heard", "Plan", "Doing", "Result"].map(label => <span key={label}>{label}</span>)}</div><p className="guide-note">Read-only steps run directly. Changes may require a preview; sensitive actions require an explicit confirmation. The command palette opens with <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>.</p><div className="guide-voice-actions"><Button variant="outline" disabled={!isDesktop || audition} onClick={() => void play()}><Volume2 size={16} />Test local voice</Button><Button variant="outline" onClick={() => void stop()}><Square size={16} />Interrupt</Button></div><p className="guide-note">This audition tests local playback. It does not measure end-to-end voice latency or microphone recognition.</p></>}
      </BlockReveal>
      {error && <p role="alert" className="project-error">{error}</p>}{notice && <p role="status" className="guide-note">{notice}</p>}
      <footer><Button variant="ghost" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Back</Button><span>{current.label}</span><Button variant="outline" onClick={step === steps.length - 1 ? complete : () => setStep(value => value + 1)}>{step === steps.length - 1 ? "Start working" : "Continue"}<ArrowRight size={16} /></Button></footer>
    </div></div>
}
export default Onboarding
