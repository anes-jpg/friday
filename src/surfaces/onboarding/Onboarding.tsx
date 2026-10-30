import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, BookOpen, Code2, Command, FolderOpen, ListTodo, MapPin, Mic, Square, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useFriday, type ConsoleTab } from "@/lib/store"
import { useSettings } from "@/lib/settings"
import { completeGuide, deferGuide, readGuideStep, rememberGuideStep } from "@/lib/onboarding"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { PiperEngineStatus, PiperSpeakResult } from "@/lib/piper"

const steps = [
  { label: "Your goal", icon: ListTodo, title: "Start with what you need.", description: "Build something, research a question, or organize everyday work. Start anywhere; you can return to this guide from Settings." },
  { label: "Your model", icon: Command, title: "Choose the model that suits you.", description: "Use a local or remote OpenAI-compatible provider. You control the endpoint, model name, credentials, and budget in Settings." },
  { label: "Your context", icon: FolderOpen, title: "Bring only what the work needs.", description: "A workspace can start with just a name. Add a folder, instructions, references, tasks, or notes whenever they become useful." },
  { label: "Voice & control", icon: Mic, title: "Speak, review, and interrupt.", description: "Hold Alt+Shift to speak, then release. Tap it to toggle listening; Escape interrupts the current turn. Speech runs locally, and typed requests go to the same chosen model provider." },
  { label: "Start working", icon: ArrowRight, title: "Make your first move.", description: "Create a workspace for an ongoing goal or open a conversation for a quick request. Saved notes and checkpoints help you pick up where you left off." },
] as const
const goals = [
  { icon: Code2, title: "Build or change software", detail: "Plan an app, connect existing code, or review a change." },
  { icon: BookOpen, title: "Research a question", detail: "Collect references, compare sources, and save findings." },
  { icon: ListTodo, title: "Plan everyday work", detail: "Keep tasks, notes, and next steps around your own goal." },
] as const

/** A resumable guide shared by the modal and standalone surface. */
export function Onboarding({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(() => readGuideStep(steps.length))
  const [audition, setAudition] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechId = useRef(0)
  const playbackActive = useRef(false)
  const profiles = useSettings(state => state.saved.profiles)
  const activeId = useSettings(state => state.saved.activeProfileId)
  const loaded = useSettings(state => state.loaded)
  const settingsError = useSettings(state => state.error)
  const profile = profiles.find(item => item.id === activeId)
  const voice = useQuery({ queryKey: ["onboarding-voice-status"], enabled: isDesktop, queryFn: () => invokeCommand<PiperEngineStatus>("get_piper_engine_status"), retry: false })
  const current = steps[step]
  const complete = () => {
    try { completeGuide(); onDone?.() }
    catch (failure) { setError(`Could not save guide completion: ${String(failure)}. Keep this window open and try again.`) }
  }
  const leave = (tab?: ConsoleTab, create = false) => {
    try {
      deferGuide()
      if (create) sessionStorage.setItem("friday-open-work-record", JSON.stringify({ view: "overview", create: true }))
      if (tab) useFriday.getState().setTab(tab)
      if (create) window.dispatchEvent(new CustomEvent("friday:open-work-record", { detail: { view: "overview", create: true } }))
      onDone?.()
    } catch (failure) { setError(`Could not save your place: ${String(failure)}. Try again.`) }
  }
  const stop = async () => {
    speechId.current++
    playbackActive.current = false
    setAudition(false)
    try { await useFriday.getState().bargeIn(); setNotice("Playback interrupted.") }
    catch (failure) { setError(`Could not stop playback: ${String(failure)}`) }
  }
  const changeStep = (next: number) => { if (audition) void stop(); setStep(next) }
  const play = async () => {
    const id = ++speechId.current
    playbackActive.current = true
    setAudition(true); setError(null); setNotice(null)
    useFriday.getState().setOrb("speaking")
    try {
      const result = await invokeCommand<PiperSpeakResult>("piper_speak", { text: "I'm ready to help you make something useful. You can interrupt me whenever you need to.", style: "calm", speed: useFriday.getState().voicePace })
      if (speechId.current !== id) return
      if (!result.success || result.sample_count <= 0) throw new Error("Local speech returned no audio. Check the voice model in Settings.")
      setNotice("The local engine returned audio. Check that you heard the sample.")
    } catch (failure) { if (speechId.current === id) setError(String(failure)) }
    finally { if (speechId.current === id) { playbackActive.current = false; setAudition(false); useFriday.getState().setOrb("idle") } }
  }
  useEffect(() => {
    setNotice(null); setError(null)
    try { rememberGuideStep(step) }
    catch (failure) { setError(`Could not save your guide progress: ${String(failure)}`) }
    document.getElementById("guide-heading")?.focus()
  }, [step])
  useEffect(() => () => {
    if (playbackActive.current) { speechId.current++; void useFriday.getState().bargeIn().catch(failure => console.warn("Could not stop guide playback", failure)) }
  }, [])
  return <div className="friday-guide">
    <aside><span className="wordmark" translate="no">FRIDAY.</span><p className="instrument-label">Make it yours</p>
      <nav aria-label="Guide steps">{steps.map((item, index) => <button key={item.label} type="button" aria-current={step === index ? "step" : undefined} onClick={() => changeStep(index)}><item.icon size={16} aria-hidden="true" /><span>{item.label}</span><small>{String(index + 1).padStart(2, "0")}</small></button>)}</nav>
      <p>Your goals. Your provider.<br />Local speech. You stay in control.</p>
    </aside>
    <div className="guide-body">
      <header><span className="instrument-label">Step {step + 1} of {steps.length} · Optional guide</span><Button id="guide-later" variant="ghost" size="sm" onClick={() => leave()}>Do this later</Button></header>
      <div key={step} className="guide-content">
        <current.icon size={24} aria-hidden="true" /><h1 id="guide-heading" tabIndex={-1}>{current.title}</h1><p>{current.description}</p>
        {step === 0 && <>
          <div className="guide-goals">{goals.map(goal => <button type="button" key={goal.title} onClick={() => leave("projects", true)}><goal.icon size={20} aria-hidden="true" /><span><strong>{goal.title}</strong><small>{goal.detail}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>
          <button type="button" className="guide-secondary-action" onClick={() => leave("map")}><MapPin size={16} aria-hidden="true" />Find a business on the map<ArrowRight size={16} aria-hidden="true" /></button>
          <p className="guide-note">These are starting points. Presets, local folders, and voice are optional.</p>
        </>}
        {step === 1 && <>
          <dl className="guide-readiness"><dt>Saved provider</dt><dd>{loaded && profile ? `${profile.name} · ${profile.model}` : settingsError ? "Settings need attention" : "Loading saved settings…"}</dd><dt>Connection</dt><dd>Saved settings do not prove connectivity. Test the connection in Settings before sending work.</dd><dt>Flexibility</dt><dd>Save multiple providers and choose a different one for each workspace.</dd></dl>
          {settingsError && <p className="project-error" role="alert">{settingsError}</p>}
          <Button variant="outline" onClick={() => leave("settings")}>Open provider settings<ArrowRight size={16} aria-hidden="true" /></Button><p className="guide-note">Your place in this guide is saved while you configure your provider.</p>
        </>}
        {step === 2 && <>
          <ol className="guide-flow"><li><strong>Set your own goal.</strong> Start blank or use an editable preset. Choose any response language.</li><li><strong>Add relevant context.</strong> Connect an existing folder in Windows, paste reference links, or write instructions. Planning works without a folder.</li><li><strong>Keep what matters.</strong> Save notes, pin sources, and record a checkpoint for next time.</li></ol>
          <div className="guide-voice-actions"><Button variant="outline" onClick={() => leave("projects", true)}>Create a workspace<ArrowRight size={16} aria-hidden="true" /></Button><Button variant="ghost" onClick={() => leave("memory")}>Explore Memory</Button></div><p className="guide-note">Only include files and sources you want used. Context sent to a model follows the provider you choose.</p>
        </>}
        {step === 3 && <>
          <dl className="guide-contract">{[["Heard", "Check or edit your words"], ["Plan", "Review the next steps"], ["Doing", "Follow the active action"], ["Result", "See changes and available undo"]].map(([label, description]) => <div key={label}><dt>{label}</dt><dd>{description}</dd></div>)}</dl>
          <p className="guide-note">Read-only steps run directly. Changes can require a preview; sensitive actions require an explicit “confirm”. Open commands with <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>.</p>
          <p className="guide-note" role="status">{!isDesktop ? "Voice playback and microphone recognition are available in the Windows app. You can keep working with text here." : voice.isPending ? "Checking the local speech engine…" : voice.data?.ready ? "Local speech engine reports ready. Try a sample below." : "Set up a local voice in Settings, then check again."}</p>
          {voice.isError && <p className="project-error" role="alert">Speech status unavailable: {voice.error.message}</p>}
          <div className="guide-voice-actions"><Button variant="outline" disabled={!isDesktop || !voice.data?.ready || audition} onClick={() => void play()}><Volume2 size={16} aria-hidden="true" />{audition ? "Playing sample…" : "Test local voice"}</Button><Button variant="outline" disabled={!audition} onClick={() => void stop()}><Square size={16} aria-hidden="true" />Interrupt</Button>{isDesktop && !voice.data?.ready && <Button variant="ghost" onClick={() => void voice.refetch()}>Check again</Button>}</div><p className="guide-note">The sample checks playback only. It does not measure microphone accuracy or end-to-end latency.</p>
        </>}
        {step === 4 && <>
          <div className="guide-goals"><button type="button" onClick={() => leave("projects", true)}><FolderOpen size={20} aria-hidden="true" /><span><strong>Create your first workspace</strong><small>Save a goal and add context when you need it.</small></span><ArrowRight size={16} aria-hidden="true" /></button><button type="button" onClick={() => leave("chat")}><Command size={20} aria-hidden="true" /><span><strong>Open a conversation</strong><small>Ask a question or describe a quick task.</small></span><ArrowRight size={16} aria-hidden="true" /></button></div><p className="guide-note">Use Work for tasks and checkpoints, Memory for saved facts, and Run history for actual outcomes. All settings remain editable.</p>
        </>}
      </div>
      {error && <p role="alert" className="project-error">{error}</p>}{notice && <p role="status" className="guide-note">{notice}</p>}
      <footer><Button variant="ghost" disabled={step === 0} onClick={() => changeStep(step - 1)}>Back</Button><span>{current.label}</span><Button variant="outline" onClick={step === steps.length - 1 ? complete : () => changeStep(step + 1)}>{step === steps.length - 1 ? "Finish guide" : `Next: ${steps[step + 1].label}`}<ArrowRight size={16} aria-hidden="true" /></Button></footer>
    </div>
  </div>
}
export default Onboarding
