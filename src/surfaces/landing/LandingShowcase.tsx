import React, { useState } from "react";
import {
  Mic,
  ShieldCheck,
  Cpu,
  Zap,
  Volume2,
  Terminal,
  FileCode,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  X,
  Play,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";

interface LandingShowcaseProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchBar: () => void;
  onLaunchConsole: () => void;
}

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({
  isOpen,
  onClose,
  onLaunchBar,
  onLaunchConsole,
}) => {
  const [activeMode, setActiveMode] = useState<"command" | "dictation" | "conversation">("command");
  const [interactiveTurnActive, setInteractiveTurnActive] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[oklch(10%_0.005_265_/_0.94)] backdrop-blur-xl flex flex-col items-center justify-start p-6 sm:p-12 text-[var(--color-text)] animate-in fade-in duration-200">
      {/* Top Navigation Header */}
      <div className="w-full max-w-5xl flex items-center justify-between pb-8 border-b border-[var(--color-edge)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--color-hull)] border border-[var(--color-edge)] flex items-center justify-center font-mono font-bold text-sm tracking-wider">
            FR
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">FRIDAY</div>
            <div className="text-xs text-[var(--color-mute)]">Intelligent Voice-First Desktop Operator for Windows</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLaunchConsole}
            className="text-xs border border-[var(--color-edge)]"
          >
            Launch Console
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onLaunchBar}
            className="text-xs font-medium"
          >
            Open Bar <Kbd className="ml-1.5">Alt+Shift</Kbd>
          </Button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-control)] hover:bg-[var(--color-hull)] text-[var(--color-mute)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close showcase"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-5xl pt-16 pb-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-hull)] border border-[var(--color-edge)] text-xs text-[var(--color-mute)] mb-6 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mute)]" />
          RELEASE 1.0 · OPERATOR CONSTITUTION VERIFIED
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.15]">
          Hands on your machine. Voice in under two seconds.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[var(--color-mute)] max-w-2xl font-normal leading-relaxed">
          Not a chatbot in a window. A deterministic, voice-first Windows operator running your professional workflows
          locally on your CPU. Pure GLM-4 cloud intelligence with zero audio ever leaving your laptop.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onLaunchBar}
            className="text-sm font-semibold px-6"
          >
            Launch Operator <Kbd className="ml-2">Alt+Shift</Kbd>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setInteractiveTurnActive(true);
              setTimeout(() => setInteractiveTurnActive(false), 2400);
            }}
            className="text-sm border border-[var(--color-edge)]"
          >
            <Play className="w-4 h-4 mr-2" />
            Simulate 1.8s Spoken Turn
          </Button>
        </div>
      </div>

      {/* Interactive Utterance Contract Preview */}
      <div className="w-full max-w-4xl p-6 sm:p-8 rounded-[var(--radius-surface)] bg-[var(--color-hull)] border border-[var(--color-edge)] shadow-2xl mt-4">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-edge)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-[var(--color-mute)] uppercase tracking-wider">
              Live Utterance Contract
            </span>
            {interactiveTurnActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-plate)] text-[var(--color-acid)] border border-[var(--color-acid)]">
                STREAMING
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveMode("command")}
              className={`px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-mono transition-colors ${
                activeMode === "command"
                  ? "bg-[var(--color-plate)] text-[var(--color-text)] font-semibold border border-[var(--color-edge)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-text)]"
              }`}
            >
              Command
            </button>
            <button
              onClick={() => setActiveMode("dictation")}
              className={`px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-mono transition-colors ${
                activeMode === "dictation"
                  ? "bg-[var(--color-plate)] text-[var(--color-text)] font-semibold border border-[var(--color-edge)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-text)]"
              }`}
            >
              Dictation
            </button>
            <button
              onClick={() => setActiveMode("conversation")}
              className={`px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-mono transition-colors ${
                activeMode === "conversation"
                  ? "bg-[var(--color-plate)] text-[var(--color-text)] font-semibold border border-[var(--color-edge)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-text)]"
              }`}
            >
              Conversation
            </button>
          </div>
        </div>

        {/* Contract 4 Lines */}
        <div className="mt-6 space-y-4 font-mono text-xs">
          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-void)] border border-[var(--color-edge)] flex items-start gap-3">
            <span className="text-[var(--color-mute)] w-16 shrink-0 font-semibold">1. HEARD</span>
            <span className="text-[var(--color-text)]">
              {activeMode === "command" && "Rename every screenshot on my desktop to its date and move them to Assets"}
              {activeMode === "dictation" && "Meeting notes comma Kwame approved the oklch design tokens period"}
              {activeMode === "conversation" && "What did we decide about the sub-200ms barge in cutoff?"}
            </span>
          </div>

          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-void)] border border-[var(--color-edge)] flex items-start gap-3">
            <span className="text-[var(--color-mute)] w-16 shrink-0 font-semibold">2. PLAN</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-warn)]" />
                <span>1. Scan Desktop directory for *.png screenshots (14 items)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-fail)]" />
                <span>2. Batch rename using ISO timestamps and move to Assets [Requires Confirmation]</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-void)] border border-[var(--color-edge)] flex items-start gap-3">
            <span className="text-[var(--color-mute)] w-16 shrink-0 font-semibold">3. DOING</span>
            <span className="text-[var(--color-mute)]">
              {interactiveTurnActive ? "Synthesizing spoken confirmation preview (112ms elapsed)..." : "Idle · Ready for user confirmation"}
            </span>
          </div>

          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-void)] border border-[var(--color-edge)] flex items-start gap-3">
            <span className="text-[var(--color-mute)] w-16 shrink-0 font-semibold">4. RESULT</span>
            <div className="flex items-center justify-between w-full">
              <span className="text-[var(--color-text)]">
                Prepared diff for 14 files. Atomic rollback journal created.
              </span>
              <span className="text-[var(--color-mute)] underline cursor-pointer hover:text-[var(--color-text)]">
                [Undo Available]
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Latency Budgets & Architectural Pillars Grid */}
      <div className="w-full max-w-5xl mt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight">The Arithmetic of Voice Latency</h2>
          <p className="text-sm text-[var(--color-mute)] mt-2">
            Strict engineering budgets verified on thermal-constrained 15W Intel Core i7-8565U hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-[var(--radius-surface)] bg-[var(--color-hull)] border border-[var(--color-edge)]">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-[var(--color-mute)]" />
              <span className="text-xs font-mono font-bold text-[var(--color-mute)]">&le; 150 MS</span>
            </div>
            <h3 className="text-base font-semibold mt-4">Acoustic Acknowledgement</h3>
            <p className="text-xs text-[var(--color-mute)] mt-2 leading-relaxed">
              Synthesized non-verbal cue plays immediately on endpoint detection from the local phrase bank. Silence collapses before the brain begins thinking.
            </p>
          </div>

          <div className="p-6 rounded-[var(--radius-surface)] bg-[var(--color-hull)] border border-[var(--color-edge)]">
            <div className="flex items-center justify-between">
              <Cpu className="w-5 h-5 text-[var(--color-mute)]" />
              <span className="text-xs font-mono font-bold text-[var(--color-mute)]">&le; 250 MS</span>
            </div>
            <h3 className="text-base font-semibold mt-4">Streaming Transducer Tail</h3>
            <p className="text-xs text-[var(--color-mute)] mt-2 leading-relaxed">
              Zipformer streams decoding continuously while you speak. When speech stops, decoding is already complete—only the final chunk and VAD remain.
            </p>
          </div>

          <div className="p-6 rounded-[var(--radius-surface)] bg-[var(--color-hull)] border border-[var(--color-edge)]">
            <div className="flex items-center justify-between">
              <Volume2 className="w-5 h-5 text-[var(--color-mute)]" />
              <span className="text-xs font-mono font-bold text-[var(--color-mute)]">&lt; 2 MS CUTOFF</span>
            </div>
            <h3 className="text-base font-semibold mt-4">Sub-200ms Barge-In</h3>
            <p className="text-xs text-[var(--color-mute)] mt-2 leading-relaxed">
              Live microphone ring buffer stays hot during playback. Interrupting speech immediately silences the audio sink and starts a fresh turn.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Privacy Law */}
      <div className="w-full max-w-5xl mt-12 p-8 rounded-[var(--radius-surface)] bg-[var(--color-plate)] border border-[var(--color-edge)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--color-mute)]" />
            <h3 className="text-lg font-bold">Zero Audio Leaves the Machine</h3>
          </div>
          <p className="text-xs text-[var(--color-mute)] max-w-2xl leading-relaxed">
            Wake word detection, Silero VAD, streaming ASR, and speech synthesis all run on your CPU.
            The network is exactly one thing: GLM-4 reasoning over TLS. API keys are safely held in the Windows Credential Manager via DPAPI.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onLaunchBar}
          className="shrink-0 border border-[var(--color-edge)] text-xs font-medium"
        >
          Try FRIDAY Now
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Footer Meta */}
      <div className="w-full max-w-5xl mt-16 pt-8 border-t border-[var(--color-edge)] flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--color-mute)] gap-4">
        <div>FRIDAY Operator 1.0 · Windows 10 & 11 · Built with Tauri 2 & React 19</div>
        <div className="flex items-center gap-4 font-mono">
          <span>Surface Law</span>
          <span>·</span>
          <span>One-Signal Law</span>
          <span>·</span>
          <span>Sub-Frame Law</span>
        </div>
      </div>
    </div>
  );
};

