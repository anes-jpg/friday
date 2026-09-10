import React, { useEffect, useState } from "react";
import { useFridayStore } from "@/lib/store";
import { invokeCommand } from "@/lib/ipc";
import { Bar } from "@/surfaces/bar/Bar";
import { Palette } from "@/surfaces/palette/Palette";
import { Console } from "@/surfaces/console/Console";
import { OnboardingModal } from "@/surfaces/onboarding/OnboardingModal";
import { LandingShowcase } from "@/surfaces/landing/LandingShowcase";
import { Particles } from "@/components/magicui/Particles";
import { Kbd } from "@/components/ui/Kbd";
import { Button } from "@/components/ui/Button";
import { Layers, AlertTriangle } from "lucide-react";

export const App: React.FC = () => {
  const {
    activeSurface,
    setActiveSurface,
    paletteOpen,
    setPaletteOpen,
    simulateVoiceTurn,
    startVoiceCapture,
    stopVoiceCapture,
    bargeIn,
    updateAudioRms,
    loadBackendData,
    orbState,
    setOrbState,
    inputMode,
    setInputMode,
  } = useFridayStore();

  const [showShowcase, setShowShowcase] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem("friday_onboarded") !== "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    loadBackendData();
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
          const win = getCurrentWebviewWindow();
          if (win.label === "console") {
            setActiveSurface("console");
          }
        });
      }
    } catch {
      // Browser fallback
    }
  }, [setActiveSurface, loadBackendData]);

  // Active audio RMS and speech monitoring (0% CPU at idle per Constitution)
  useEffect(() => {
    if (orbState === "idle") return;

    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      await updateAudioRms();

      if (orbState === "speaking") {
        try {
          const speaking = await invokeCommand<boolean>("is_speaking");
          if (!speaking && mounted) {
            setOrbState("idle");
          }
        } catch {
          // ignore
        }
      }
    }, 60);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [orbState, setOrbState, updateAudioRms]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Panic Kill Switch: Ctrl+Alt+Shift+F
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        bargeIn();
        alert("PANIC KILL SWITCH TRIGGERED: Mic released, turns cancelled, automations paused.");
        return;
      }

      // Instant Voice Barge-In / Interrupt on Escape
      if (e.key === "Escape" && (orbState === "speaking" || orbState === "listening")) {
        e.preventDefault();
        bargeIn();
        return;
      }

      // Toggle Console: Alt+Shift+Space
      if (e.altKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setActiveSurface(activeSurface === "bar" ? "console" : "bar");
        return;
      }

      // Toggle Dictation Mode: Alt+Shift+D (§"Three modes, never ambiguous")
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setInputMode(inputMode === "dictation" ? "command" : "dictation");
        return;
      }

      // Summon / Voice Push-To-Talk: Alt+Space hold
      if (e.altKey && !e.shiftKey && e.code === "Space") {
        e.preventDefault();
        if (activeSurface === "console") {
          setActiveSurface("bar");
        }
        if (orbState === "idle" || orbState === "speaking") {
          startVoiceCapture();
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && orbState === "listening") {
        e.preventDefault();
        stopVoiceCapture();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeSurface, setActiveSurface, orbState, setOrbState, inputMode, setInputMode, startVoiceCapture, stopVoiceCapture, bargeIn]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--color-void)] font-sans">
      {/* Magic UI Ambient Particles Backdrop */}
      <Particles quantity={30} size={1.4} color="#8b949e" />

      {/* Surface 1: The Bar (Centered at 22% from the top) */}
      {activeSurface === "bar" && (
        <div className="relative w-full h-full flex flex-col items-center justify-start pt-[18vh] p-4">
          <Bar />

          {/* Development & Desktop Surface Navigator */}
          <div className="mt-8 flex items-center gap-3 px-3 py-1.5 rounded-full bg-[oklch(14%_0.006_265_/_0.85)] border border-[var(--color-edge)] shadow-lg backdrop-blur text-xs text-[var(--color-mute)]">
            <span className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-acid)]" />
              FRIDAY S1 · The Bar
            </span>
            <div className="h-3 w-px bg-[var(--color-edge)]" />
            <button
              onClick={() => setActiveSurface("console")}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
            >
              Switch to Console <Kbd>Alt+Shift+Space</Kbd>
            </button>
            <div className="h-3 w-px bg-[var(--color-edge)]" />
            <button
              onClick={() => setInputMode(inputMode === "dictation" ? "command" : "dictation")}
              className={`hover:text-[var(--color-text)] transition-colors flex items-center gap-1 ${
                inputMode === "dictation" ? "text-[var(--color-acid)]" : ""
              }`}
            >
              Dictation <Kbd>Alt+Shift+D</Kbd>
            </button>
            <div className="h-3 w-px bg-[var(--color-edge)]" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
            >
              Palette <Kbd>Ctrl+K</Kbd>
            </button>
            <div className="h-3 w-px bg-[var(--color-edge)]" />
            <button
              onClick={() => setShowOnboarding(true)}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
            >
              Guide <Kbd>?</Kbd>
            </button>
            <div className="h-3 w-px bg-[var(--color-edge)]" />
            <button
              onClick={() => setShowShowcase(true)}
              className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
            >
              Showcase
            </button>
          </div>
        </div>
      )}

      {/* Surface 3: The Console */}
      {activeSurface === "console" && <Console />}

      {/* Surface 2: Command Palette Modal */}
      <Palette />

      {/* Surface: Onboarding Flow (§11 M9 First-Run Experience) */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          try {
            localStorage.setItem("friday_onboarded", "true");
          } catch {
            // ignore
          }
        }}
      />

      {/* Surface: 1.0 Product Showcase & Landing Page (§11 M11) */}
      <LandingShowcase
        isOpen={showShowcase}
        onClose={() => setShowShowcase(false)}
        onLaunchBar={() => {
          setShowShowcase(false);
          setActiveSurface("bar");
        }}
        onLaunchConsole={() => {
          setShowShowcase(false);
          setActiveSurface("console");
        }}
      />
    </div>
  );
};

export default App;
