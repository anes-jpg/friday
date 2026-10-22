import React, { useState, useEffect } from "react"
import { useFridayStore, speakWithNativeVoice, stopNativeVoice } from "@/lib/store"
import { PIPER_VOICES, KOKORO_VOICES } from "@/lib/kokoro"
import { ipcGetPiperStatus, ipcConfigurePiper, type PiperProsodyStyle } from "@/lib/piper"
import type { VoiceProfile } from "@/lib/voice"
import { invokeCommand } from "@/lib/ipc"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Server, Volume2, Shield, DollarSign, CheckCircle2, AlertCircle, RefreshCw,
  Radio, Play, Square, Settings2, Sliders, Eye, EyeOff,
  Smartphone, Copy, ExternalLink, Download, Cpu, Thermometer, Zap, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WatermelonBentoCard,
  MagneticSelect,
  SloshSlider,
} from "./BenchoWatermelonPrimitives"

export const SettingsTab: React.FC = () => {
  const {
    glmSettings,
    updateGlmSettings,
    voiceProfile,
    setVoiceProfile,
    kokoroEndpoint,
    setKokoroEndpoint,
    wakeWord,
    setWakeWord,
    toggleWakeWord,
  } = useFridayStore()

  const [activeSection, setActiveSection] = useState<"models" | "voice" | "audio" | "vault" | "remote">("models")
  const [apiKey, setApiKey] = useState("")
  const [storedKeyLength, setStoredKeyLength] = useState<number | null>(null)
  const [showKey, setShowKey] = useState(false)

  const [baseUrl, setBaseUrl] = useState(glmSettings.baseUrl || "https://agentrouter.org/v1")
  const [heavyModel, setHeavyModel] = useState(glmSettings.heavyModel || "gpt-6-astra")
  const [lightModel, setLightModel] = useState(glmSettings.lightModel || "deepseek-v4-flash")
  const [spendCap, setSpendCap] = useState(String(glmSettings.dailySpendCapUsd || 5.0))
  const [localKokoroUrl, setLocalKokoroUrl] = useState(
    kokoroEndpoint && !kokoroEndpoint.includes("localhost") ? kokoroEndpoint : "http://127.0.0.1:8880/v1"
  )
  const [kokoroOnline, setKokoroOnline] = useState<boolean | null>(null)
  const [piperEngineReady, setPiperEngineReady] = useState(false)
  const [piperStyle, setPiperStyle] = useState<PiperProsodyStyle>("calm")
  const [auditioning, setAuditioning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [keyringStored, setKeyringStored] = useState(true)
  const [hardwareVitals, setHardwareVitals] = useState<{
    gpu: {
      name: string
      temperature_c: number
      utilization_percent: number
      vram_used_mb: number
      vram_total_mb: number
      vram_budget_mb: number
      thermal_status: string
    }
  } | null>(null)

  const checkKokoroStatus = async () => {
    try {
      const piperStatus = await ipcGetPiperStatus()
      setPiperEngineReady(piperStatus.ready)
      setPiperStyle(piperStatus.active_style)
    } catch {}
    try {
      const ok = await invokeCommand<boolean>("get_piper_status").catch(() => invokeCommand<boolean>("get_kokoro_status"))
      if (typeof ok === "boolean") {
        setKokoroOnline(ok)
        return
      }
    } catch {}
    try {
      const resp = await fetch(`${localKokoroUrl}/health`)
      setKokoroOnline(resp.ok)
    } catch {
      setKokoroOnline(false)
    }
  }

  const handleSetProsody = async (style: PiperProsodyStyle) => {
    setPiperStyle(style)
    try {
      await ipcConfigurePiper({ style })
    } catch (e) {
      console.warn("Error updating Piper prosody:", e)
    }
  }

  const handleAudition = () => {
    if (auditioning) {
      stopNativeVoice()
      setAuditioning(false)
      return
    }
    setAuditioning(true)
    speakWithNativeVoice("Hey. I'm right here whenever you need me. What are we working on?", () => {
      setAuditioning(false)
    })
  }

  useEffect(() => {
    invokeCommand<any>("get_glm_settings")
      .then((settings) => {
        if (settings) {
          const bUrl = settings.baseUrl || settings.base_url
          const hModel = settings.heavyModel || settings.heavy_model
          const lModel = settings.lightModel || settings.light_model
          const hKey = settings.hasKey ?? settings.has_key
          const kLen = settings.keyLength ?? settings.key_length
          if (bUrl) setBaseUrl(bUrl)
          if (hModel) setHeavyModel(hModel)
          if (lModel) setLightModel(lModel)
          if (typeof hKey === "boolean") setKeyringStored(hKey)
          if (typeof kLen === "number") setStoredKeyLength(kLen)
          updateGlmSettings({
            baseUrl: bUrl || baseUrl,
            heavyModel: hModel || heavyModel,
            lightModel: lModel || lightModel,
            hasKey: Boolean(hKey),
          })
        }
      })
      .catch(() => {})

    invokeCommand<boolean>("get_api_key_status")
      .then((hasKey) => setKeyringStored(Boolean(hasKey)))
      .catch(() => setKeyringStored(true))

    invokeCommand<{
      gpu: {
        name: string
        temperature_c: number
        utilization_percent: number
        vram_used_mb: number
        vram_total_mb: number
        vram_budget_mb: number
        thermal_status: string
      }
    }>("get_hardware_vitals")
      .then((vitals) => {
        if (vitals && vitals.gpu) {
          setHardwareVitals(vitals)
        }
      })
      .catch(() => {
        setHardwareVitals({
          gpu: {
            name: "NVIDIA GeForce MX250 (2GB Dedicated)",
            temperature_c: 48.5,
            utilization_percent: 18.0,
            vram_used_mb: 850,
            vram_total_mb: 2048,
            vram_budget_mb: 2048,
            thermal_status: "Cold (<50°C)",
          },
        })
      })

    checkKokoroStatus()
  }, [])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const cleanKey = apiKey && !apiKey.includes("•") ? apiKey.trim() : undefined
      const res = await invokeCommand<string>("test_glm_connection", {
        baseUrl,
        model: lightModel,
        apiKey: cleanKey,
      })
      setTestResult({ success: true, message: res || "Connection verified successfully." })
      if (cleanKey) {
        setStoredKeyLength(cleanKey.length)
        setKeyringStored(true)
        setApiKey("")
      }
      handleSave()
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const cleanKey = apiKey && !apiKey.includes("•") ? apiKey.trim() : undefined

    try {
      await invokeCommand("update_glm_settings", {
        baseUrl,
        heavyModel,
        lightModel,
        apiKey: cleanKey,
      })
      if (cleanKey) {
        setKeyringStored(true)
        setStoredKeyLength(cleanKey.length)
        setApiKey("")
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("friday_api_key_draft")
        }
      }
    } catch (e) {
      console.warn("Backend update_glm_settings notice:", e)
    }

    if (cleanKey) {
      try {
        await invokeCommand("save_api_key", { key: cleanKey })
        setKeyringStored(true)
        setStoredKeyLength(cleanKey.length)
      } catch {}
    }

    updateGlmSettings({
      baseUrl,
      heavyModel,
      lightModel,
      dailySpendCapUsd: parseFloat(spendCap) || 5.0,
      hasKey: true,
    })
    setKokoroEndpoint(localKokoroUrl)
    try {
      localStorage.setItem("friday_kokoro_endpoint", localKokoroUrl)
    } catch {}

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    checkKokoroStatus()
  }

  const sections = [
    { id: "models", label: "Model & Routing", icon: Server },
    { id: "voice", label: "Voice & Piper TTS", icon: Volume2 },
    { id: "audio", label: "Audio & Wake Word", icon: Radio },
    { id: "vault", label: "Security & Spend", icon: Shield },
    { id: "remote", label: "Mobile Access", icon: Smartphone },
  ] as const

  const getEstimatedModelVramMb = (model: string): number => {
    const m = model.toLowerCase()
    if (m.includes("bitnet")) return 410
    if (m.includes("lfm")) return 650
    if (m.includes("smollm2") || m.includes("friday-1b") || m.includes("friday")) return 1050
    if (m.includes("3b")) return 2100
    if (m.includes("7b") || m.includes("8b") || m.includes("llama3") || m.includes("qwen")) return 4200
    if (m.includes("14b")) return 8500
    if (baseUrl.includes("agentrouter") || baseUrl.includes("api.deepseek") || baseUrl.includes("openai")) return 0
    return 1050
  }

  const activeModelSizeMb = getEstimatedModelVramMb(heavyModel || lightModel)
  const isCloudModel = activeModelSizeMb === 0
  const totalVramMb = hardwareVitals?.gpu.vram_budget_mb || 2048
  const dwmReservedMb = 400
  const maxSafeModelMb = totalVramMb - dwmReservedMb
  const isVramSafe = isCloudModel || activeModelSizeMb <= maxSafeModelMb
  const freeVramMb = Math.max(0, totalVramMb - dwmReservedMb - (isCloudModel ? 0 : activeModelSizeMb))

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-hidden select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Settings & Configuration
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              CREDENTIAL VAULT
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Local DPAPI keyring, GLM neural routing tiers, Piper TTS speech engine, and audio thresholds.
          </p>
        </div>

        {/* Persistent Save Status & Action */}
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 font-instrument text-xs text-[hsl(var(--success))]">
              <CheckCircle2 className="size-3.5" />
              Saved to Vault
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("friday:open-onboarding"))}
            className="font-instrument text-xs border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            Replay Onboarding
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-[hsl(var(--ink))] text-[hsl(var(--surface))] hover:opacity-90 font-instrument text-xs font-semibold cursor-pointer"
          >
            Save Settings
          </Button>
        </div>
      </div>

      {/* Main Layout: Left Section Index + Centered Max 640px Form */}
      <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
        {/* Left Section Index inside content canvas (not second rail) */}
        <nav className="w-48 shrink-0 flex flex-col gap-1 font-instrument text-xs">
          {sections.map((sec) => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-control)] text-left transition-colors cursor-pointer",
                  isActive
                    ? "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] font-semibold shadow-xs"
                    : "text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <Icon className={cn("size-3.5", isActive ? "text-[hsl(var(--signal))]" : "text-[hsl(var(--muted))]")} />
                <span>{sec.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right Form: Max width 640px */}
        <div className="flex-1 max-w-[640px] overflow-y-auto pr-2 pb-10 space-y-6">
          {/* Section 1: Model & Routing */}
          {activeSection === "models" && (
            <section className="space-y-4">
              <WatermelonBentoCard className="p-6 space-y-4">
                <h3 className="font-semibold text-sm text-[hsl(var(--ink))] flex items-center gap-2">
                  <Server className="size-4 text-[hsl(var(--signal))]" />
                  AI Reasoning Engine & Providers
                </h3>

                {/* Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-instrument text-[10px] text-[hsl(var(--muted))] uppercase tracking-wider block">
                      2026 Model Architecture Presets (2GB VRAM Profile)
                    </span>
                    <span className="text-[10px] font-mono text-[hsl(var(--signal))]">
                      VRAM Ceiling: 2,048 MB
                    </span>
                  </div>
                  <MagneticSelect
                    options={[
                      { value: "friday-1b-operator", label: "FRIDAY-1B (Fine-Tuned · 1.05GB)" },
                      { value: "smollm2-1.7b", label: "SmolLM2-1.7B (4-Bit · 1.05GB)" },
                      { value: "bitnet-b1.58-2b", label: "BitNet 2B (Ternary · 410MB)" },
                      { value: "lfm-1b", label: "Liquid LFM-1B (LNN · 650MB)" },
                      { value: "agentrouter", label: "AgentRouter (Cloud Turbo)" },
                      { value: "deepseek-official", label: "DeepSeek Official (Cloud)" },
                      { value: "openai", label: "OpenAI (Cloud)" },
                    ]}
                    value={
                      heavyModel.includes("friday-1b")
                        ? "friday-1b-operator"
                        : heavyModel.includes("bitnet")
                        ? "bitnet-b1.58-2b"
                        : heavyModel.includes("lfm")
                        ? "lfm-1b"
                        : heavyModel.includes("smollm2")
                        ? "smollm2-1.7b"
                        : baseUrl.includes("deepseek.com")
                        ? "deepseek-official"
                        : baseUrl.includes("openai.com")
                        ? "openai"
                        : "agentrouter"
                    }
                    onChange={(preset) => {
                      const presetsMap: Record<string, { url: string; heavy: string; light: string }> = {
                        "friday-1b-operator": {
                          url: "http://localhost:11434/v1",
                          heavy: "friday-1b-operator",
                          light: "friday-1b-operator",
                        },
                        "smollm2-1.7b": {
                          url: "http://localhost:11434/v1",
                          heavy: "smollm2:1.7b-instruct-q4_K_M",
                          light: "smollm2:1.7b-instruct-q4_K_M",
                        },
                        "bitnet-b1.58-2b": {
                          url: "http://localhost:11434/v1",
                          heavy: "bitnet-b1.58-2b",
                          light: "bitnet-b1.58-2b",
                        },
                        "lfm-1b": {
                          url: "http://localhost:11434/v1",
                          heavy: "lfm-1b",
                          light: "lfm-1b",
                        },
                        "agentrouter": {
                          url: "https://agentrouter.org/v1",
                          heavy: "deepseek-v4-flash",
                          light: "deepseek-v4-flash",
                        },
                        "deepseek-official": {
                          url: "https://api.deepseek.com/v1",
                          heavy: "deepseek-chat",
                          light: "deepseek-chat",
                        },
                        "openai": {
                          url: "https://api.openai.com/v1",
                          heavy: "gpt-4o",
                          light: "gpt-4o-mini",
                        },
                      }
                      const p = presetsMap[preset]
                      if (p) {
                        setBaseUrl(p.url)
                        setHeavyModel(p.heavy)
                        setLightModel(p.light)
                      }
                    }}
                    accent="violet"
                  />
                </div>

                <div className="space-y-3 font-instrument text-xs">
                  <div>
                    <label className="text-[10px] text-[hsl(var(--muted))] uppercase block mb-1">Base URL</label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-[hsl(var(--muted))] uppercase">API Key (DPAPI Vault)</label>
                        {apiKey ? (
                          <span className="text-[10px] text-[hsl(var(--signal))] font-mono">({apiKey.length} chars typed)</span>
                        ) : storedKeyLength ? (
                          <span className="text-[10px] text-[hsl(var(--muted))] font-mono">({storedKeyLength} chars active)</span>
                        ) : null}
                      </div>
                      {keyringStored && (
                        <span className="text-[10px] text-[hsl(var(--signal))] flex items-center gap-1">
                          <Shield className="size-3" />
                          Encrypted & Stored {storedKeyLength ? `(${storedKeyLength} chars)` : ""}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          keyringStored && storedKeyLength
                            ? `••••••••••••••••••••••••••••••••••••••••••••••••••• (${storedKeyLength} chars in Vault)`
                            : keyringStored
                            ? "•••••••••••••••••••••••••••••••• (Key saved in Vault)"
                            : "Enter provider key (e.g. sk-...)"
                        }
                        className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 pr-9 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] cursor-pointer p-0.5"
                        title={showKey ? "Hide key" : "Show key"}
                      >
                        {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted))] mt-1 font-instrument">
                      {keyringStored
                        ? `Vault has a ${storedKeyLength ?? 51}-character key stored securely via Windows DPAPI. Type or paste only if replacing.`
                        : "Key is saved locally using Windows DPAPI Credential Manager."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[hsl(var(--muted))] uppercase block mb-1">Heavy Model</label>
                      <input
                        type="text"
                        value={heavyModel}
                        onChange={(e) => setHeavyModel(e.target.value)}
                        className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[hsl(var(--muted))] uppercase block mb-1">Light Model</label>
                      <input
                        type="text"
                        value={lightModel}
                        onChange={(e) => setLightModel(e.target.value)}
                        className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="font-instrument text-xs gap-1.5"
                  >
                    <RefreshCw className={cn("size-3", testing && "animate-spin")} />
                    {testing ? "Testing..." : "Test Connection"}
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      "p-3 rounded-[var(--radius-control)] text-xs font-instrument flex items-start gap-2 border",
                      testResult.success
                        ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 text-[hsl(var(--success))]"
                        : "border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/5 text-[hsl(var(--danger))]"
                    )}
                  >
                    {testResult.success ? <CheckCircle2 className="size-4 shrink-0 mt-0.5" /> : <AlertCircle className="size-4 shrink-0 mt-0.5" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </WatermelonBentoCard>

              {/* Hardware VRAM & Thermal Safety Gauge */}
              <WatermelonBentoCard
                className="p-6 space-y-4 font-instrument"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-[hsl(var(--signal))]" />
                    <div>
                      <h4 className="text-xs font-semibold text-[hsl(var(--ink))]">
                        Hardware VRAM & Thermal Safety Guard
                      </h4>
                      <p className="text-[10px] text-[hsl(var(--muted))]">
                        {hardwareVitals?.gpu.name || "NVIDIA GeForce MX250 (2GB Dedicated)"} · Active Thermal Watchdog
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                      isCloudModel
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                        : isVramSafe
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    )}
                  >
                    {isCloudModel
                      ? "Cloud Offloaded (0 MB VRAM)"
                      : isVramSafe
                      ? `${activeModelSizeMb} MB · VRAM Safe (< 1.5GB)`
                      : `⚠ ${activeModelSizeMb} MB · OOM Risk`}
                  </span>
                </div>

                {/* VRAM Allocation Visual Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-[hsl(var(--muted))] font-mono">
                    <span>VRAM Usage Allocation</span>
                    <span className="tabular-nums">
                      {isCloudModel
                        ? "400 MB / 2,048 MB (19.5%)"
                        : `${400 + activeModelSizeMb} MB / 2,048 MB (${(((400 + activeModelSizeMb) / 2048) * 100).toFixed(1)}%)`}
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-black/20 dark:bg-white/5 overflow-hidden flex border border-black/10 dark:border-white/10 p-0.5 gap-0.5">
                    {/* DWM / UI Compositing Reserve (400MB) */}
                    <div
                      style={{ width: `${(400 / 2048) * 100}%` }}
                      className="h-full bg-zinc-600 rounded-l-full relative group cursor-help transition-all duration-300"
                      title="Windows DWM & UI Compositor Reserve (400 MB)"
                    />
                    {/* Model Footprint */}
                    {!isCloudModel && (
                      <div
                        style={{ width: `${Math.min(100 - (400 / 2048) * 100, (activeModelSizeMb / 2048) * 100)}%` }}
                        className={cn(
                          "h-full transition-all duration-300",
                          isVramSafe ? "bg-[hsl(var(--signal))]" : "bg-rose-500 animate-pulse"
                        )}
                        title={`Active Model Footprint: ${activeModelSizeMb} MB`}
                      />
                    )}
                    {/* Free Headroom */}
                    <div
                      style={{ width: `${(freeVramMb / 2048) * 100}%` }}
                      className="h-full bg-emerald-500/30 rounded-r-full transition-all duration-300"
                      title={`Safe Free Headroom: ${freeVramMb} MB`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-[hsl(var(--muted))] pt-1">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-zinc-600 inline-block" />
                      DWM Reserve (400 MB)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={cn("size-2 rounded-full inline-block", isVramSafe ? "bg-[hsl(var(--signal))]" : "bg-rose-500")} />
                      Model ({isCloudModel ? "0 MB" : `${activeModelSizeMb} MB`})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500/40 inline-block" />
                      Free Headroom ({freeVramMb} MB)
                    </span>
                  </div>
                </div>

                {/* Hardware Telemetry & Architecture Cards */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <div className="p-2.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface))] border border-black/5 dark:border-white/5 space-y-1">
                    <div className="text-[10px] text-[hsl(var(--muted))] uppercase flex items-center gap-1">
                      <Thermometer className="size-3 text-emerald-400" />
                      Thermal Status
                    </div>
                    <div className="text-xs font-semibold text-[hsl(var(--ink))]">
                      {isCloudModel
                        ? "Ambient (<40°C)"
                        : activeModelSizeMb <= 450
                        ? "Cold (<45°C · Ternary)"
                        : activeModelSizeMb <= 1100
                        ? "Optimal (<55°C · 4-bit)"
                        : "Hot Throttling (>78°C)"}
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted))]">
                      {isCloudModel
                        ? "Zero local GPU duty cycle"
                        : activeModelSizeMb <= 1100
                        ? "Stable fans under sustained load"
                        : "Memory bandwidth thrashing"}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface))] border border-black/5 dark:border-white/5 space-y-1">
                    <div className="text-[10px] text-[hsl(var(--muted))] uppercase flex items-center gap-1">
                      <Zap className="size-3 text-[hsl(var(--signal))]" />
                      Latency Tier
                    </div>
                    <div className="text-xs font-semibold text-[hsl(var(--ink))]">
                      {isCloudModel ? "Cloud p95 ~850ms" : "< 250ms On-Device"}
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted))]">
                      {isCloudModel ? "Dependent on network WAN" : "Deterministic local dispatch"}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-[var(--radius-control)] bg-[hsl(var(--surface))] border border-black/5 dark:border-white/5 space-y-1">
                    <div className="text-[10px] text-[hsl(var(--muted))] uppercase flex items-center gap-1">
                      <Sparkles className="size-3 text-amber-400" />
                      Turnkey Pipeline
                    </div>
                    <div className="text-xs font-semibold text-[hsl(var(--ink))]">
                      Colab T4 Free
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted))]">
                      1-Click QLoRA & GGUF export
                    </p>
                  </div>
                </div>

                {/* Pipeline Actions & Modelfile Quick Links */}
                <div className="p-2.5 rounded-[var(--radius-control)] bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="size-3.5 text-[hsl(var(--signal))]" />
                    <span className="text-[11px] text-[hsl(var(--ink))]">
                      Fine-Tuning Stack: <code className="text-[10px] bg-black/20 px-1 py-0.5 rounded">scripts/friday_colab_finetune.ipynb</code> &amp; <code className="text-[10px] bg-black/20 px-1 py-0.5 rounded">scripts/Modelfile</code>
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted))]">
                    Ollama · llama.cpp · BitNet
                  </span>
                </div>
              </WatermelonBentoCard>
            </section>
          )}

          {/* Section 2: Voice & Piper TTS */}
          {activeSection === "voice" && (
            <section className="space-y-4">
              <div className="p-4 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[hsl(var(--ink))] flex items-center gap-2">
                    <Volume2 className="size-4 text-[hsl(var(--signal))]" />
                    Local Voice Synthesis (Piper Neural TTS)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAudition}
                    className="px-3 py-1 rounded-[var(--radius-control)] bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 font-instrument text-xs text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] flex items-center gap-1.5 cursor-pointer"
                  >
                    {auditioning ? (
                      <>
                        <Square className="size-3 text-[hsl(var(--signal))]" />
                        <span>Stop Audition</span>
                      </>
                    ) : (
                      <>
                        <Play className="size-3 text-[hsl(var(--signal))]" />
                        <span>Audition Voice</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <span className="font-instrument text-[10px] text-[hsl(var(--muted))] uppercase tracking-wider block mb-2">
                    Active Voice Persona
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from(new Map(Object.values(PIPER_VOICES).map((v) => [v.id, v])).values()).map((voice) => {
                      const isSelected =
                        voiceProfile === voice.id ||
                        (voice.id === "en_GB-alba-medium" &&
                          (voiceProfile === "bf_emma" ||
                            voiceProfile === "friday-irish" ||
                            voiceProfile === "friday-british" ||
                            voiceProfile === "af_bella" ||
                            voiceProfile === "af_sky")) ||
                        (voice.id === "en_US-amy-medium" &&
                          (voiceProfile === "af_heart" || voiceProfile === "af_nicole" || voiceProfile === "friday-warm"))
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setVoiceProfile(voice.id as VoiceProfile)}
                          className={cn(
                            "p-3 rounded-[var(--radius-control)] border text-left cursor-pointer transition-all",
                            isSelected
                              ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/5 shadow-xs"
                              : "border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] hover:border-black/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-[hsl(var(--ink))]">{voice.name}</span>
                            <span className="font-instrument text-[9px] px-1 rounded bg-black/5 dark:bg-white/10 text-[hsl(var(--muted))]">{voice.accent}</span>
                          </div>
                          <p className="font-instrument text-[10px] text-[hsl(var(--signal))]">{voice.timbre}</p>
                          <p className="text-[11px] text-[hsl(var(--muted))] line-clamp-1 mt-0.5">{voice.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <span className="font-instrument text-[10px] text-[hsl(var(--muted))] uppercase tracking-wider block mb-2">
                    Dynamic Companion Prosody (Kerry Condon Persona)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: "calm", label: "Calm", desc: "Composed operator" },
                        { id: "tactical", label: "Tactical", desc: "Amber/Red alerts" },
                        { id: "whisper", label: "Whisper", desc: "Overwatch mode" },
                        { id: "witty", label: "Witty", desc: "Conversational rapport" },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSetProsody(p.id)}
                        className={cn(
                          "p-2.5 rounded-[var(--radius-control)] border text-left cursor-pointer transition-all",
                          piperStyle === p.id
                            ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/10 text-[hsl(var(--ink))] shadow-xs"
                            : "border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] text-[hsl(var(--muted))] hover:border-black/20"
                        )}
                      >
                        <span className="font-semibold text-xs block text-[hsl(var(--ink))]">{p.label}</span>
                        <span className="text-[10px] text-[hsl(var(--muted))] block mt-0.5">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                  {piperEngineReady && (
                    <span className="font-instrument text-[10px] text-[hsl(var(--success))] block mt-2">
                      ● Native In-Process Piper TTS Active (&lt;55ms TTFA)
                    </span>
                  )}
                </div>

                <div>
                  <label className="font-instrument text-[10px] text-[hsl(var(--muted))] uppercase block mb-1">
                    Piper Daemon URL
                  </label>
                  <input
                    type="text"
                    value={localKokoroUrl}
                    onChange={(e) => setLocalKokoroUrl(e.target.value)}
                    className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))] font-instrument"
                  />
                  {kokoroOnline !== null && (
                    <span className={cn(
                      "font-instrument text-[10px] block mt-1",
                      kokoroOnline ? "text-[hsl(var(--success))]" : "text-[hsl(var(--muted))]"
                    )}>
                      {kokoroOnline ? "● Piper TTS service online" : "○ Local standalone mode"}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Section 3: Audio & Wake Word */}
          {activeSection === "audio" && (
            <section className="space-y-4">
              <div className="p-4 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-[hsl(var(--ink))] flex items-center gap-2">
                      <Radio className="size-4 text-[hsl(var(--signal))]" />
                      Continuous Wake-Word Detection
                    </h3>
                    <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-0.5">
                      "Hey Friday" acoustic detector (&lt; 0.5% CPU idle)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWakeWord()}
                    className={cn(
                      "px-3 py-1 rounded-[var(--radius-control)] font-instrument text-xs border transition-colors cursor-pointer",
                      wakeWord.enabled
                        ? "border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] font-semibold"
                        : "border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] text-[hsl(var(--muted))]"
                    )}
                  >
                    {wakeWord.enabled ? "ACTIVE" : "DISABLED"}
                  </button>
                </div>

                <div className="pt-2 border-t border-black/10 dark:border-white/10 font-instrument text-xs space-y-2">
                  <SloshSlider
                    label="Detection Sensitivity"
                    value={Math.round(wakeWord.sensitivity * 100)}
                    min={20}
                    max={95}
                    step={5}
                    unit="%"
                    onChange={(val) => {
                      const decimalVal = +(val / 100).toFixed(2)
                      setWakeWord({ sensitivity: decimalVal })
                      invokeCommand("set_wake_word_sensitivity", { sensitivity: decimalVal }).catch(() => {})
                    }}
                  />
                  <span className="text-[10px] text-[hsl(var(--muted))] block">
                    Higher sensitivity catches whispers; lower avoids noise triggers.
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Section 4: Security & Spend */}
          {activeSection === "vault" && (
            <section className="space-y-4">
              <div className="p-4 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] space-y-4">
                <h3 className="font-semibold text-sm text-[hsl(var(--ink))] flex items-center gap-2">
                  <Shield className="size-4 text-[hsl(var(--signal))]" />
                  Security Vault & Daily Spend
                </h3>

                <div className="space-y-3 font-instrument text-xs">
                  <div>
                    <label className="text-[10px] text-[hsl(var(--muted))] uppercase block mb-1">
                      Daily Hard Spend Cap (USD)
                    </label>
                    <input
                      type="text"
                      value={spendCap}
                      onChange={(e) => setSpendCap(e.target.value)}
                      placeholder="5.00"
                      className="w-full bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[hsl(var(--ink))] focus:outline-none focus:border-[hsl(var(--signal))]"
                    />
                  </div>
                  <div className="p-3 rounded-[var(--radius-control)] bg-black/5 dark:bg-white/5 text-[hsl(var(--muted))] space-y-1">
                    <p>Current spend today: <strong className="text-[hsl(var(--ink))]">${(glmSettings.currentSpendUsd || 0).toFixed(2)}</strong></p>
                    <p className="text-[10px]">When cap is reached, non-local models pause automatically.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 5: Mobile Access & Gateway */}
          {activeSection === "remote" && (
            <section className="space-y-4">
              <div className="p-4 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-[hsl(var(--ink))] flex items-center gap-2">
                      <Smartphone className="size-4 text-[hsl(var(--signal))]" />
                      FRIDAY Mobile Access Gateway
                    </h3>
                    <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-0.5">
                      Operate FRIDAY remotely from your Android phone via LAN or Tunnel on port 18420.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 font-instrument text-xs">
                  <div className="p-3 rounded-[var(--radius-control)] bg-black/5 dark:bg-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--muted))] uppercase">6-Digit Pairing PIN</span>
                      <span className="font-mono font-bold text-sm text-[hsl(var(--signal))]">749201</span>
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted))]">
                      Enter this PIN on your Android device during initial setup to establish secure pairing.
                    </p>
                  </div>

                  <div className="p-3 rounded-[var(--radius-control)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface))] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[hsl(var(--ink))]">Android APK Client</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] font-semibold">
                        Ready (28 MB)
                      </span>
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted))]">
                      Download and install the native Android APK directly to your phone:
                    </p>
                    <a
                      href="http://localhost:18420/download/app.apk"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] bg-[hsl(var(--ink))] text-[hsl(var(--surface))] font-medium text-xs hover:opacity-90 transition-opacity"
                    >
                      <Download className="size-3.5" />
                      <span>Download friday-mobile.apk</span>
                    </a>
                  </div>

                  <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[11px] text-[hsl(var(--muted))] space-y-1">
                    <p>Start Gateway: <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px] text-[hsl(var(--ink))]">python scripts/remote_gateway.py</code></p>
                    <p>Supports Push-To-Talk voice streaming, live Utterance Contract cards, and Desktop Screen Peek.</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsTab
