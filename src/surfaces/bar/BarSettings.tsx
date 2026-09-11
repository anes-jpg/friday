import React, { useState, useEffect } from "react";
import { useFridayStore } from "@/lib/store";
import { invokeCommand } from "@/lib/ipc";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import {
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react";

interface BarSettingsProps {
  onClose: () => void;
}

export const BarSettings: React.FC<BarSettingsProps> = ({ onClose }) => {
  const { glmSettings, updateGlmSettings, openConsoleTab, telemetry } = useFridayStore();
  const [apiKey, setApiKey] = useState("••••••••••••••••••••••••");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(glmSettings.baseUrl);
  const [heavyModel, setHeavyModel] = useState(glmSettings.heavyModel);
  const [lightModel, setLightModel] = useState(glmSettings.lightModel);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await invokeCommand<string>("test_glm_connection", {
        baseUrl,
        model: lightModel,
      });
      setTestResult({ success: true, message: res || "Connection verified successfully." });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (apiKey && !apiKey.includes("•")) {
      try {
        await invokeCommand("save_api_key", { key: apiKey });
      } catch {
        // Browser mock fallback
      }
    }
    updateGlmSettings({
      baseUrl,
      heavyModel,
      lightModel,
      hasKey: true,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="w-full border-t border-[var(--color-edge)] bg-[var(--color-hull)] p-4 space-y-3.5 text-[var(--color-text)] select-none animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-edge)]">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--color-acid)]" />
          <span className="font-semibold text-xs tracking-wide">SETTINGS & GLM CREDENTIALS</span>
          <span className="text-[10px] font-mono text-[var(--color-mute)] bg-[var(--color-plate)] px-1.5 py-0.5 rounded">
            Win32 Vault
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              openConsoleTab("settings");
            }}
            className="h-6 px-2 text-[11px] text-[var(--color-mute)] hover:text-[var(--color-text)]"
            title="Open Full 1200x800 Console (Alt+Shift+Space)"
          >
            Full Console <ExternalLink className="w-3 h-3 ml-1" />
          </Button>

          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-mute)] hover:text-[var(--color-text)] bg-[var(--color-plate)] px-1.5 py-0.5 rounded border border-[var(--color-edge)] cursor-pointer transition-colors"
            title="Dismiss Settings (Esc)"
          >
            <span>ESC</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* API Key */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)] flex items-center justify-between">
            <span>GLM API Key</span>
            <span className="text-[9px] text-[var(--color-acid)] flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Keyring
            </span>
          </label>
          <div className="relative flex items-center">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste GLM-4 API Key..."
              className="pr-8 text-xs h-7 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 text-[var(--color-mute)] hover:text-[var(--color-text)]"
            >
              {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
            Endpoint Base URL
          </label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://open.bigmodel.cn/api/paas/v4"
            className="text-xs h-7 font-mono"
          />
        </div>

        {/* Heavy Model */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
            Heavy Model (Complex Planning)
          </label>
          <Input
            value={heavyModel}
            onChange={(e) => setHeavyModel(e.target.value)}
            placeholder="glm-4-plus"
            className="text-xs h-7 font-mono"
          />
        </div>

        {/* Light Model */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
            Light Model (Fast Voice Turn)
          </label>
          <Input
            value={lightModel}
            onChange={(e) => setLightModel(e.target.value)}
            placeholder="glm-4-flash"
            className="text-xs h-7 font-mono"
          />
        </div>
      </div>

      {/* Test feedback */}
      {testResult && (
        <div
          className={`flex items-center gap-2 p-2 rounded text-xs ${
            testResult.success
              ? "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border border-[oklch(78%_0.19_152_/_0.3)]"
              : "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)] border border-[oklch(63%_0.21_25_/_0.3)]"
          }`}
        >
          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{testResult.message}</span>
        </div>
      )}

      {/* Actions & Telemetry Strip */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-edge)]">
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--color-mute)]">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[var(--color-acid)]" /> {telemetry.cpuPercent}% CPU
          </span>
          <span>{telemetry.idleRssMb}MB RAM</span>
          <span>{telemetry.glmTtftMs}ms TTFT</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            className="h-7 px-2.5 text-xs text-[var(--color-mute)] hover:text-[var(--color-text)]"
          >
            {testing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
            Test Connection
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            className="h-7 px-3 text-xs bg-[var(--color-acid)] text-[var(--color-void)] hover:brightness-110 font-semibold"
          >
            {saved ? "Saved ✓" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};
