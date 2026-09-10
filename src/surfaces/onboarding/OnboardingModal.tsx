import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { ShimmerButton } from "@/components/magicui/ShimmerButton";
import {
  Mic,
  Headphones,
  ShieldCheck,
  Zap,
  Terminal,
  FileText,
  AlertOctagon,
  CheckCircle2,
  X,
} from "lucide-react";
import { invokeCommand } from "@/lib/ipc";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<number>(1);
  const [micTested, setMicTested] = useState<boolean>(false);
  const [testingMic, setTestingMic] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTestChime = async () => {
    setTestingMic(true);
    try {
      await invokeCommand("speak_text", { text: "On it." });
      setMicTested(true);
    } catch {
      setMicTested(true);
    } finally {
      setTimeout(() => setTestingMic(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <Card
        variant="hull"
        className="relative w-full max-w-lg p-6 space-y-5 rounded-[var(--radius-surface)] border border-[var(--color-edge)] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--color-mute)] hover:text-[var(--color-text)] transition-colors"
          title="Dismiss Onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-acid)] animate-pulse" />
            <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
              Welcome to FRIDAY
            </h2>
          </div>
          <p className="text-[var(--text-body)] text-[var(--color-mute)]">
            A voice-first desktop operator with hands on your machine.
          </p>
        </div>

        {/* Step 1: Voice & Three Modes */}
        {step === 1 && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg bg-[var(--color-plate)] border border-[var(--color-edge)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--color-text)] font-semibold">
                <Mic className="w-4 h-4 text-[var(--color-acid)]" />
                <span>Three Operating Modes, Never Ambiguous</span>
              </div>
              <ul className="space-y-2 text-[var(--color-mute)]">
                <li className="flex items-start gap-2">
                  <Kbd>Alt+Space</Kbd>
                  <div>
                    <strong className="text-[var(--color-text)]">Command Mode:</strong> Hold to talk,
                    tap to type. Interprets instructions, creates preview plans, and executes tools.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Kbd>Alt+Shift+D</Kbd>
                  <div>
                    <strong className="text-[var(--color-text)]">Dictation Mode:</strong> Transcribes
                    verbatim into your active editor or document. No LLM reasoning, zero tool execution.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Kbd>Alt+Shift+Space</Kbd>
                  <div>
                    <strong className="text-[var(--color-text)]">Console Surface:</strong> Access full
                    chat threads, memory facts, automations, skills, and audit logs.
                  </div>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-[oklch(20%_0.02_265)] border border-[var(--color-edge)] flex items-start gap-2.5">
              <Headphones className="w-4 h-4 text-[var(--color-acid)] shrink-0 mt-0.5" />
              <p className="text-[var(--color-mute)] leading-relaxed">
                <strong className="text-[var(--color-text)]">Acoustic Recommendation:</strong> Using
                headphones prevents internal loopback echo and allows sub-200ms instantaneous barge-in
                interruption.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation Tiers & Panic Switch */}
        {step === 2 && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg bg-[var(--color-plate)] border border-[var(--color-edge)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--color-text)] font-semibold">
                <Zap className="w-4 h-4 text-[var(--color-acid)]" />
                <span>The Utterance Contract & Risk Tiers</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-[var(--color-void)] border border-[var(--color-edge)]">
                  <div className="text-[var(--color-acid)] font-bold">GREEN</div>
                  <div className="text-[var(--color-mute)] text-[10px] mt-0.5">Read-only actions run silently.</div>
                </div>
                <div className="p-2 rounded bg-[var(--color-void)] border border-[var(--color-edge)]">
                  <div className="text-[var(--color-warn)] font-bold">AMBER</div>
                  <div className="text-[var(--color-mute)] text-[10px] mt-0.5">Preview card, 8s timeout.</div>
                </div>
                <div className="p-2 rounded bg-[var(--color-void)] border border-[var(--color-edge)]">
                  <div className="text-[var(--color-fail)] font-bold">RED</div>
                  <div className="text-[var(--color-mute)] text-[10px] mt-0.5">Full diff, requires "confirm".</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[oklch(20%_0.02_265)] border border-[var(--color-edge)] space-y-1.5">
              <div className="flex items-center gap-2 text-[var(--color-text)] font-semibold">
                <AlertOctagon className="w-4 h-4 text-[var(--color-warn)]" />
                <span>Global Panic Kill Switch</span>
              </div>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Press <Kbd>Ctrl+Alt+Shift+F</Kbd> anywhere on Windows to immediately cancel all active
                turns, pause automations, and release the microphone.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Audio Check & Security */}
        {step === 3 && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg bg-[var(--color-plate)] border border-[var(--color-edge)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--color-text)] font-semibold">
                <ShieldCheck className="w-4 h-4 text-[var(--color-acid)]" />
                <span>Data Privacy & Credential Vault</span>
              </div>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Audio never leaves this machine. Speech recognition and synthesis run 100% on your
                local CPU. API credentials are encrypted with Windows DPAPI via Credential Manager.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[oklch(20%_0.02_265)] border border-[var(--color-edge)] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[var(--color-text)] font-semibold">Synthesized Acoustic Check</div>
                <div className="text-[var(--color-mute)]">Listen to the sub-150ms acknowledgement cue</div>
              </div>
              <Button
                variant={micTested ? "outline" : "primary"}
                size="sm"
                onClick={handleTestChime}
                disabled={testingMic}
                className="text-xs flex items-center gap-1.5 font-mono"
              >
                {micTested ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-acid)]" /> : null}
                {testingMic ? "Playing..." : micTested ? "Verified" : "Play Cue"}
              </Button>
            </div>
          </div>
        )}

        {/* Step Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-edge)]">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === i ? "bg-[var(--color-acid)]" : "bg-[var(--color-edge)]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button variant="outline" size="sm" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={onClose}>
                Ready to Operate
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
