import { useEffect, useState } from "react"
import { useSettings, type ProviderProfile, type DesktopSettings } from "@/lib/settings"
import { useFriday, speakWithNativeVoice, stopNativeVoice } from "@/lib/store"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { ipcGetPiperStatus } from "@/lib/piper"
import { PIPER_VOICES } from "@/lib/kokoro"
import { useWindowMode } from "@/lib/window-mode"
import { Plus, Search, ArrowUpRight, Eye, EyeOff, Trash2, Check, RefreshCw, Play, Square, Monitor, Mic, Server, Volume2, Shield, Camera, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { SettingsHealth } from "./SettingsHealth"

const speechVoices = Array.from(new Map(Object.values(PIPER_VOICES).map((voice) => [voice.id, voice])).values())

const categories = [
  { id: "providers", label: "Providers", icon: Server, description: "Endpoints, models, API mode, credentials and fallback" },
  { id: "voice", label: "Voice", icon: Volume2, description: "Local speech, voice and delivery" },
  { id: "listening", label: "Listening", icon: Mic, description: "Wake word, microphone and sensitivity" },
  { id: "appearance", label: "Appearance", icon: Monitor, description: "Theme, motion, fullscreen and control room" },
  { id: "monitoring", label: "Monitoring", icon: Camera, description: "Camera preview limits, recording storage and retention" },
  { id: "security", label: "Privacy & spend", icon: Shield, description: "Credentials, confirmations and daily spend" },
  { id: "diagnostics", label: "Diagnostics", icon: Activity, description: "Hardware and local service readiness" },
] as const
type Category = typeof categories[number]["id"]
const presets: Record<string, { name: string; baseUrl: string }> = {
  custom: { name: "Custom provider", baseUrl: "" }, openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" }, agentrouter: { name: "AgentRouter", baseUrl: "https://agentrouter.org/v1" },
  ollama: { name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" }, lmstudio: { name: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
  glm: { name: "GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
}
function FormRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <div className="settings-row"><div><span className="settings-row-title">{title}</span>{description && <p>{description}</p>}</div><div className="settings-row-control">{children}</div></div>
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("settings-switch", checked && "is-on")}><span /></button>
}
export function SettingsTab() {
  const { draft, saved, keys, loaded, loading, saving, error, hydrate, edit, setKey, save, discard } = useSettings()
  const [category, setCategory] = useState<Category>("providers")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(draft.activeProfileId)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connection, setConnection] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [auditioning, setAuditioning] = useState(false)
  const [diagnostics, setDiagnostics] = useState<{ piper: boolean | null; hardware: string | null }>({ piper: null, hardware: null })
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  useEffect(() => { void hydrate() }, [hydrate])
  const profile = draft.profiles.find((item) => item.id === selected) ?? draft.profiles[0]
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || Object.keys(keys).length > 0
  const update = (patch: Partial<DesktopSettings>) => { setSavedNotice(false); edit((current) => ({ ...current, ...patch })) }
  const updateProfile = (patch: Partial<ProviderProfile>) => {
    setConnection(null); setSavedNotice(false)
    edit((current) => ({ ...current, profiles: current.profiles.map((item) => item.id === profile.id ? { ...item, ...patch } : item) }))
  }
  const addProvider = () => {
    const id = crypto.randomUUID()
    const added: ProviderProfile = { id, name: "New provider", baseUrl: "", model: "", lightModel: "", apiMode: "chat", hasKey: false, fallback: false }
    update({ profiles: [...draft.profiles, added] }); setSelected(id); setConnection(null)
  }
  const test = async () => {
    setTesting(true); setConnection(null)
    try {
      if (!isDesktop) throw new Error("Connection tests require the Windows app.")
      const message = await invokeCommand<string>("test_provider_profile", { profile, apiKey: keys[profile.id] })
      setConnection({ ok: true, message })
    } catch (error) { setConnection({ ok: false, message: String(error) }) }
    finally { setTesting(false) }
  }
  const checkDiagnostics = async () => {
    setDiagnosticError(null)
    const results = await Promise.allSettled([
      ipcGetPiperStatus(),
      isDesktop ? invokeCommand<{ cpu_percent: number; ram_used_mb: number; ram_total_mb: number; gpu: { name: string } }>("get_hardware_vitals") : Promise.reject(new Error("Hardware diagnostics require the Windows app.")),
    ])
    setDiagnostics({ piper: results[0].status === "fulfilled" ? results[0].value.ready : false, hardware: results[1].status === "fulfilled" ? `${results[1].value.gpu.name} · ${Math.round(results[1].value.ram_used_mb / 1024)} / ${Math.round(results[1].value.ram_total_mb / 1024)} GB RAM` : null })
    if (results[1].status === "rejected") setDiagnosticError(String(results[1].reason))
  }
  const visibleCategories = categories.filter((item) => (item.label + " " + item.description).toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="settings-workspace">
      <aside className="settings-index">
        <div className="settings-index-title"><span className="instrument-label">Workspace preferences</span><h1 className="page-heading">Settings</h1></div>
        <div className="settings-search"><Search size={15} /><input aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a setting" /></div>
        <nav aria-label="Settings categories">{visibleCategories.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={id === category ? "page" : undefined} onClick={() => setCategory(id)} className={cn(id === category && "is-selected")}><Icon size={16} /><span>{label}</span></button>)}</nav>
        {visibleCategories.length === 0 && <p className="settings-index-note">No settings found. Try “voice” or “models”.</p>}
        <div className="settings-index-note">Changes stay in your draft until you save.{!isDesktop && <p>Browser preview · credentials and native services require Windows.</p>}</div>
      </aside>
      <div className="settings-main">
        <div className="settings-scroll">
          <header className="settings-page-title"><span className="instrument-label">Settings / {categories.find((item) => item.id === category)?.label}</span><h2 className="page-heading">{categories.find((item) => item.id === category)?.label}</h2><p>{categories.find((item) => item.id === category)?.description}.</p></header>
          {loading && <p role="status">Reading saved settings…</p>}
          {category === "providers" && profile && (
            <div className="provider-layout">
              <div className="provider-index">
                <div className="provider-index-header"><span className="instrument-label">{draft.profiles.length} providers</span><button type="button" aria-label="Add provider" title="Add provider" onClick={addProvider}><Plus size={16} /></button></div>
                {draft.profiles.map((item) => <button type="button" key={item.id} aria-pressed={profile.id === item.id} className={cn("provider-item", profile.id === item.id && "is-selected")} onClick={() => { setSelected(item.id); setConnection(null); setRemoving(false) }}><span>{item.name}</span><small>{item.model || "Choose a model"}</small>{item.id === draft.activeProfileId && <small className="provider-current">Current</small>}</button>)}
                <button type="button" className="quiet-action mt-4 w-full" onClick={addProvider}><Plus size={15} />Add provider</button>
              </div>
              <section className="provider-detail" aria-label="Provider details">
                <div className="provider-detail-title"><h3>{profile.name}</h3><button type="button" className="quiet-action" onClick={() => update({ activeProfileId: profile.id })} disabled={draft.activeProfileId === profile.id}>{draft.activeProfileId === profile.id ? <><Check size={14} />Current provider</> : "Use this provider"}</button></div>
                <label className="settings-field">Start from a preset<select aria-label="Provider preset" defaultValue="custom" onChange={(event) => { const preset = presets[event.target.value]; updateProfile({ name: preset.name, baseUrl: preset.baseUrl }) }}>{Object.entries(presets).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select></label>
                <label className="settings-field">Display name<input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} /></label>
                <label className="settings-field">Base URL<input type="url" spellCheck={false} value={profile.baseUrl} placeholder="https://your-provider.example/v1" onChange={(event) => updateProfile({ baseUrl: event.target.value })} /><small>Any OpenAI-compatible local or remote endpoint.</small></label>
                <div className="settings-field-pair">
                  <label className="settings-field">API mode<select value={profile.apiMode} onChange={(event) => updateProfile({ apiMode: event.target.value as ProviderProfile["apiMode"] })}><option value="chat">Chat Completions</option><option value="responses">Responses</option></select></label>
                  <label className="settings-field">Exact model ID<input spellCheck={false} value={profile.model} onChange={(event) => updateProfile({ model: event.target.value, lightModel: profile.lightModel === profile.model || !profile.lightModel ? event.target.value : profile.lightModel })} placeholder="Model ID from your provider" /></label>
                </div>
                <label className="settings-field">Lightweight model ID<input spellCheck={false} value={profile.lightModel} onChange={(event) => updateProfile({ lightModel: event.target.value })} /><small>Used for simpler instructions. IDs are sent exactly as entered.</small></label>
                <label className="settings-field">API key<div className="settings-secret"><input type={showKey ? "text" : "password"} value={keys[profile.id] ?? ""} autoComplete="new-password" spellCheck={false} placeholder={profile.hasKey ? "Stored · enter a replacement" : "Optional for local endpoints"} onChange={(event) => setKey(profile.id, event.target.value)} /><button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><small>{isDesktop ? "Stored in Windows Credential Manager per provider." : "API keys can be saved in the Windows app."}</small></label>
                <FormRow title="Allow fallback" description="Use this profile if the current provider fails. Its own credentials are used."><Toggle label="Allow provider fallback" checked={profile.fallback} onChange={(fallback) => updateProfile({ fallback })} /></FormRow>
                <div className="provider-detail-actions"><button type="button" className="quiet-action" disabled={testing} onClick={() => void test()}><RefreshCw size={14} />{testing ? "Testing…" : "Test connection"}</button>{draft.profiles.length > 1 && <button type="button" className="quiet-action" onClick={() => setRemoving(!removing)}><Trash2 size={14} />Remove</button>}</div>
                {removing && <div className="settings-notice"><p>Remove {profile.name} from your profiles?</p><button type="button" className="quiet-action mt-2" onClick={() => { const profiles = draft.profiles.filter((item) => item.id !== profile.id); update({ profiles, activeProfileId: draft.activeProfileId === profile.id ? profiles[0].id : draft.activeProfileId }); setSelected(profiles[0].id); setRemoving(false) }}>Remove provider</button></div>}
                {connection && <p role="status" className={cn("settings-notice", !connection.ok && "is-error")}>{connection.message}</p>}
              </section>
            </div>
          )}
          {category === "voice" && <div className="settings-section">
            <FormRow title="Voice" description="Speech stays on your device. A voice must be installed before it can speak."><select aria-label="Speech voice" value={draft.voice.profile} onChange={(event) => update({ voice: { ...draft.voice, profile: event.target.value } })}>{speechVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></FormRow>
            <FormRow title="Delivery" description="The character of spoken responses."><select aria-label="Speech delivery" value={draft.voice.style} onChange={(event) => update({ voice: { ...draft.voice, style: event.target.value as DesktopSettings["voice"]["style"] } })}><option value="calm">Calm</option><option value="tactical">Direct</option><option value="whisper">Quiet</option><option value="witty">Conversational</option></select></FormRow>
            <FormRow title="Local speech endpoint" description="Only loopback endpoints are accepted."><input aria-label="Local speech endpoint" value={draft.voice.endpoint} onChange={(event) => update({ voice: { ...draft.voice, endpoint: event.target.value } })} /></FormRow>
            <button type="button" className="quiet-action mt-6" disabled={!isDesktop} onClick={() => { if (auditioning) { stopNativeVoice(); setAuditioning(false) } else { setAuditioning(true); speakWithNativeVoice("I'm here. What are we working on?", () => setAuditioning(false)) } }}>{auditioning ? <Square size={14} /> : <Play size={14} />}{auditioning ? "Stop preview" : "Preview saved voice"}</button>
            <p className="settings-help">Preview uses your saved voice. Save the draft to apply a new voice.</p>
          </div>}
          {category === "listening" && <div className="settings-section">
            <FormRow title="Wake-word listening" description="A real wake-word detector is not connected in this candidate."><span>Unavailable / disabled</span></FormRow>
            <FormRow title="Push to talk" description="Hold Alt+Shift to speak. Tap to toggle. Escape interrupts the current turn."><kbd>Alt + Shift</kbd></FormRow>
            <p className="settings-help">Enabling a preference does not confirm the speech models are ready. Check Diagnostics for service readiness.</p>
          </div>}
          {category === "appearance" && <div className="settings-section">
            <FormRow title="Theme"><select aria-label="Theme" value={draft.appearance.theme} onChange={(event) => update({ appearance: { ...draft.appearance, theme: event.target.value as "dark" | "bright" } })}><option value="dark">Dark</option><option value="bright">Light</option></select></FormRow>
            <FormRow title="Reduce motion" description="Remove movement and artificial delays. Your operating-system preference also applies."><Toggle label="Reduce motion" checked={draft.appearance.reducedMotion} onChange={(reducedMotion) => update({ appearance: { ...draft.appearance, reducedMotion } })} /></FormRow>
            <FormRow title="Fullscreen" description="Keep the current workspace and use the whole display."><button type="button" className="quiet-action" onClick={() => void useWindowMode.getState().toggleFullscreen()}>Toggle <kbd>F11</kbd></button></FormRow>
            <FormRow title="Spatial control room" description="Open the map and spatial tools. Exiting restores your previous fullscreen state."><button type="button" className="quiet-action" onClick={() => window.dispatchEvent(new CustomEvent("friday:trigger-hud-boot"))}>Open <ArrowUpRight size={14} /></button></FormRow>
            <FormRow title="Startup" description="Quiet readiness check. No startup sound or decorative loading percentage."><span className="instrument-label">Sound off</span></FormRow>
          </div>}
          {category === "monitoring" && <div className="settings-section">
            <FormRow title="Simultaneous previews" description="Additional cameras stay paused until you focus them."><select aria-label="Simultaneous camera previews" value={draft.monitoring.previewLimit} onChange={(event) => update({ monitoring: { ...draft.monitoring, previewLimit: Number(event.target.value) } })}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} {value === 1 ? "preview" : "previews"}</option>)}</select></FormRow>
            <FormRow title="Recording storage limit" description="Stop new recordings when this limit is reached."><div className="settings-unit-input"><input type="number" aria-label="Recording storage limit" min="1" max="1000" value={draft.monitoring.storageLimitGb} onChange={(event) => update({ monitoring: { ...draft.monitoring, storageLimitGb: Number(event.target.value) } })} /><span>GB</span></div></FormRow>
            <FormRow title="Recording" description="Recording starts manually. Camera audio is off. Manual recordings are kept until you delete them."><span className="instrument-label">Manual</span></FormRow>
            <button type="button" className="quiet-action mt-6" onClick={() => useFriday.getState().setTab("cameras")}>Manage cameras <ArrowUpRight size={14} /></button>
          </div>}
          {category === "security" && <div className="settings-section">
            <FormRow title="Daily spend cap" description="Saved as your budget preference. Provider billing remains the authority for actual spend."><div className="settings-unit-input"><span>$</span><input aria-label="Daily spend cap" type="number" min="0" step="0.5" value={draft.dailySpendCapUsd} onChange={(event) => update({ dailySpendCapUsd: Number(event.target.value) })} /></div></FormRow>
            <FormRow title="Credentials" description="Each provider owns its key. Saved keys are never returned to the interface."><span className="instrument-label">Windows Credential Manager</span></FormRow>
            <FormRow title="Action confirmation" description="Routine actions run directly. Sensitive actions require a preview; high-risk actions require “confirm”."><span className="instrument-label">Three tiers</span></FormRow>
            <FormRow title="Mobile access" description="Remote access is optional. No gateway is started by this interface."><span className="instrument-label">Off</span></FormRow>
          </div>}
          {category === "diagnostics" && <div className="settings-section">
            <SettingsHealth />
            <button type="button" className="quiet-action" onClick={() => void checkDiagnostics()}><RefreshCw size={14} />Check services</button>
            <FormRow title="Local speech engine"><span>{diagnostics.piper === null ? "Not checked" : diagnostics.piper ? "Ready" : "Unavailable"}</span></FormRow>
            <FormRow title="Hardware"><span>{diagnostics.hardware ?? "Not checked"}</span></FormRow>
            {diagnosticError && <p className="settings-notice" role="status">{diagnosticError}</p>}
            <button type="button" className="quiet-action mt-6" onClick={() => window.dispatchEvent(new CustomEvent("friday:open-onboarding"))}>Open setup guide</button>
          </div>}
        </div>
        <footer className="settings-save-bar"><div aria-live="polite">{error ? <span className="settings-save-error">{error}</span> : savedNotice ? "Changes saved" : dirty ? "Unsaved changes" : loaded ? "All changes saved" : "Settings not loaded"}</div><div className="flex gap-2"><button type="button" className="quiet-action" disabled={!dirty || saving} onClick={() => { discard(); setSavedNotice(false) }}>Discard</button><button type="button" className="primary-action" disabled={!dirty || saving || loading} onClick={async () => { if (await save()) setSavedNotice(true) }}>{saving ? "Saving…" : "Save changes"}</button></div></footer>
      </div>
    </div>
  )
}
export default SettingsTab
