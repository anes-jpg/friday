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
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

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

  // Global OS-level hotkey event listener dispatched from Tauri background
  useEffect(() => {
    let unlisten: (() => void)[] = [];

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<string>("global-shortcut-alt-space", (event) => {
          if (event.payload === "pressed") {
            if (activeSurface === "console") {
              setActiveSurface("bar");
            }
            if (orbState === "idle" || orbState === "speaking") {
              startVoiceCapture();
            }
          } else if (event.payload === "released") {
            if (orbState === "listening") {
              stopVoiceCapture();
            }
          }
        }).then((un) => unlisten.push(un));

        listen<string>("global-shortcut-console", () => {
          setActiveSurface(activeSurface === "bar" ? "console" : "bar");
        }).then((un) => unlisten.push(un));

        listen<string>("global-shortcut-dictation", () => {
          setInputMode(inputMode === "dictation" ? "command" : "dictation");
        }).then((un) => unlisten.push(un));
      });
    }

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, [activeSurface, orbState, inputMode, setActiveSurface, setInputMode, startVoiceCapture, stopVoiceCapture]);

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
      if (e.altKey && !e.shiftKey && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
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
      if ((e.code === "Space" || e.key === " ") && orbState === "listening") {
        e.preventDefault();
        e.stopPropagation();
        stopVoiceCapture();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (activeSurface === "bar") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activeSurface, setActiveSurface, orbState, setOrbState, inputMode, setInputMode, startVoiceCapture, stopVoiceCapture, bargeIn]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden font-sans ${
        activeSurface === "bar" ? "bg-transparent" : "bg-[var(--color-void)]"
      }`}
    >
      {/* Magic UI Ambient Particles Backdrop - Console surface only */}
      {activeSurface === "console" && (
        <Particles quantity={30} size={1.4} color="#8b949e" />
      )}

      {/* Surface 1: The Floating Bar (Transparent background, centered) */}
      {activeSurface === "bar" && (
        <div className="w-full h-full flex flex-col items-center justify-start bg-transparent select-none">
          <Bar />
        </div>
      )}

      {/* Surface 3: The Console Surface */}
      {activeSurface === "console" && (
        <>
          <Console />
          <Palette />
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
        </>
      )}
    </div>
  );
};

export default App;
