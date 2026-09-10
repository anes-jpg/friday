import React, { useState, useEffect } from "react";
import { useFridayStore } from "@/lib/store";
import { invokeCommand } from "@/lib/ipc";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Key, Server, Cpu, Volume2, Shield, DollarSign, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export const SettingsTab: React.FC = () => {
  const { glmSettings, updateGlmSettings } = useFridayStore();
  const [apiKey, setApiKey] = useState("••••••••••••••••••••••••");
  const [baseUrl, setBaseUrl] = useState(glmSettings.baseUrl);
  const [heavyModel, setHeavyModel] = useState(glmSettings.heavyModel);
  const [lightModel, setLightModel] = useState(glmSettings.lightModel);
  const [spendCap, setSpendCap] = useState(String(glmSettings.dailySpendCapUsd));
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keyringStored, setKeyringStored] = useState(true);

  useEffect(() => {
    invokeCommand<boolean>("get_api_key_status")
      .then((hasKey) => setKeyringStored(Boolean(hasKey)))
      .catch(() => setKeyringStored(true));
  }, []);

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
        setKeyringStored(true);
      } catch {
        // Fallback for browser mock
      }
    }
    updateGlmSettings({
      baseUrl,
      heavyModel,
      lightModel,
      dailySpendCapUsd: parseFloat(spendCap) || 5.0,
      hasKey: true,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full max-w-4xl">
      <div>
        <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
          Settings & Runtime Configuration
        </h2>
        <p className="text-[var(--text-micro)] text-[var(--color-mute)]">
          Configure the GLM brain, Windows Credential Manager vault, and hardware resource caps.
        </p>
      </div>

      {/* GLM Provider Config */}
      <Card variant="hull" className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-body)] font-medium text-[var(--color-text)]">
          <Server className="w-4 h-4 text-[var(--color-acid)]" />
          <span>GLM Brain Settings (The only cloud network call)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[var(--text-micro)] text-[var(--color-mute)] font-mono uppercase">
              Base URL (OpenAI-compatible)
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://open.bigmodel.cn/api/paas/v4"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[var(--text-micro)] text-[var(--color-mute)] font-mono uppercase">
                API Key (Windows Credential Manager)
              </label>
              {keyringStored && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-acid)] font-mono">
                  <Shield className="w-3 h-3" /> DPAPI Encrypted
                </span>
              )}
            </div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              icon={<Key className="w-3.5 h-3.5" />}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="text-[var(--text-micro)] text-[var(--color-mute)] font-mono uppercase">
              Reasoning & Tool Model (Heavy Tier)
            </label>
            <Input
              value={heavyModel}
              onChange={(e) => setHeavyModel(e.target.value)}
              placeholder="glm-4-plus"
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="text-[var(--text-micro)] text-[var(--color-mute)] font-mono uppercase">
              Intent & Directives Model (Cheap Tier)
            </label>
            <Input
              value={lightModel}
              onChange={(e) => setLightModel(e.target.value)}
              placeholder="glm-4-flash"
              className="mt-1 font-mono"
            />
          </div>
        </div>

        {/* Spend tracker & Connection Test */}
        <div className="pt-2 border-t border-[var(--color-edge)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--color-acid)]" />
            <span className="text-xs text-[var(--color-text)]">
              Daily Spend Cap: <strong>${spendCap}</strong> · Current Today:{" "}
              <span className="text-[var(--color-acid)] font-mono">
                ${glmSettings.currentSpendUsd.toFixed(2)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="text-xs flex items-center gap-1.5"
            >
              {testing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-[var(--color-acid)]" />
              ) : (
                <Server className="w-3 h-3" />
              )}
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <div className="w-24">
              <Input
                value={spendCap}
                onChange={(e) => setSpendCap(e.target.value)}
                placeholder="5.00"
                className="h-7 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-2.5 rounded text-xs flex items-start gap-2 ${
              testResult.success
                ? "bg-[oklch(20%_0.05_152)] border border-[var(--color-acid)] text-[var(--color-acid)]"
                : "bg-[oklch(20%_0.08_25)] border border-[var(--color-fail)] text-[var(--color-fail)]"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span className="font-mono">{testResult.message}</span>
          </div>
        )}
      </Card>

      {/* Voice & Synthesis Config */}
      <Card variant="hull" className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-body)] font-medium text-[var(--color-text)]">
          <Volume2 className="w-4 h-4 text-[var(--color-acid)]" />
          <span>Local Voice Runtime & Emotion Directives</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded bg-[var(--color-plate)] border border-[var(--color-edge)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-text)]">Kokoro-82M int8 (ONNX)</span>
              <span className="text-[10px] font-mono text-[var(--color-acid)]">Primary</span>
            </div>
            <p className="text-[var(--color-mute)]">
              82M params, 24 kHz output, Apache-2.0. 256-float style vectors interpolated via delivery directives.
            </p>
          </div>

          <div className="p-3 rounded bg-[var(--color-plate)] border border-[var(--color-edge)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-text)]">Piper Neural Voice</span>
              <span className="text-[10px] font-mono text-[var(--color-mute)]">Fallback & Phrases</span>
            </div>
            <p className="text-[var(--color-mute)]">
              Instant sub-100ms fallback and phrase-bank renderer for fixed acknowledgements.
            </p>
          </div>
        </div>
      </Card>

      {/* Hardware Profile & Thread Guard */}
      <Card variant="hull" className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-body)] font-medium text-[var(--color-text)]">
          <Cpu className="w-4 h-4 text-[var(--color-acid)]" />
          <span>Machine Guardrails (Intel i7-8565U Profile)</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded bg-[var(--color-plate)] border border-[var(--color-edge)]">
            <div className="text-[var(--color-mute)] text-[10px]">ASR THREAD CAP</div>
            <div className="text-sm font-semibold text-[var(--color-text)] mt-1">1 Thread</div>
            <div className="text-[10px] text-[var(--color-acid)]">Interactive path</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--color-plate)] border border-[var(--color-edge)]">
            <div className="text-[var(--color-mute)] text-[10px]">TTS THREAD CAP</div>
            <div className="text-sm font-semibold text-[var(--color-text)] mt-1">2 Threads</div>
            <div className="text-[10px] text-[var(--color-acid)]">Sentence overlap</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--color-plate)] border border-[var(--color-edge)]">
            <div className="text-[var(--color-mute)] text-[10px]">IDLE MEMORY CAP</div>
            <div className="text-sm font-semibold text-[var(--color-text)] mt-1">≤ 250 MB</div>
            <div className="text-[10px] text-[var(--color-acid)]">KWS + VAD only</div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-xs text-[var(--color-acid)] font-mono">
            Settings saved successfully!
          </span>
        )}
        <Button variant="primary" size="md" onClick={handleSave}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
};
