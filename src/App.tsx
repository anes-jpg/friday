import React, { useEffect, useState, useRef } from "react";
import { useFridayStore, useFriday, sendChatMessage } from "@/lib/store";
import { invokeCommand } from "@/lib/ipc";
import { playInstantAcousticCue } from "@/lib/phrasebank";
import { isAudioActive } from "@/lib/kokoro";

import { Palette } from "@/surfaces/palette/Palette";
import { Console } from "@/surfaces/console/Console";
import { OnboardingModal } from "@/surfaces/onboarding/OnboardingModal";
import { LandingShowcase } from "@/surfaces/landing/LandingShowcase";
import { surfaceLabel } from "@/lib/ipc";

const getTauriWindowLabel = (): string => {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return "browser";
  }
  try {
    const internals = (window as unknown as {
      __TAURI_INTERNALS__?: {
        metadata?: {
          currentWindow?: { label?: string };
          currentWebview?: { label?: string };
        };
      };
    }).__TAURI_INTERNALS__;
    return (
      internals?.metadata?.currentWindow?.label ||
      internals?.metadata?.currentWebview?.label ||
      "main"
    );
  } catch {
    return "main";
  }
};

export const App: React.FC = () => {
  const {
    activeSurface,
    setActiveSurface,
    setActiveConsoleTab,
    paletteOpen,
    setPaletteOpen,
    startVoiceCapture,
    stopVoiceCapture,
    bargeIn,
    updateAudioRms,
    loadBackendData,
    orbState,
    setOrbState,
    inputMode,
    setInputMode,
    wakeWord,
  } = useFridayStore();

  const [windowLabel, setWindowLabel] = useState<string>(() => getTauriWindowLabel());
  const [showShowcase, setShowShowcase] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem("friday_onboarded_v1_0") !== "true";
    } catch {
      return true;
    }
  });
  const isHoldingPttRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOpenOnboarding = () => setShowOnboarding(true);
    window.addEventListener("friday:open-onboarding", handleOpenOnboarding);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle voice capture on Alt+Shift or Alt+Space
      if ((e.altKey && e.shiftKey) || (e.altKey && (e.code === "Space" || e.key === " "))) {
        e.preventDefault();
        const s = useFriday.getState();
        if (s.orb === "listening") {
          stopVoiceCapture();
        } else {
          startVoiceCapture();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("friday:open-onboarding", handleOpenOnboarding);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [startVoiceCapture, stopVoiceCapture]);

  useEffect(() => {
    loadBackendData();
    if (wakeWord.enabled) {
      invokeCommand("start_wake_word", { sensitivity: wakeWord.sensitivity }).catch(() => {});
    }
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
          const win = getCurrentWebviewWindow();
          if (win?.label) {
            setWindowLabel(win.label);
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

      try {
        const audioData = await invokeCommand<{ mic_rms: number; output_rms: number }>("get_audio_rms");
        if (audioData && typeof audioData.mic_rms === "number") {
          updateAudioRms(audioData.mic_rms);
        }
      } catch {
        // ignore
      }

      if (orbState === "speaking") {
        try {
          const speaking = await invokeCommand<boolean>("is_speaking");
          if (!speaking && !isAudioActive() && mounted) {
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

  // Global OS-level hotkey and voice event listeners dispatched from Tauri backend
  useEffect(() => {
    let unlisten: (() => void)[] = [];

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        const handleVoiceToggleShortcut = (state: string) => {
          if (state === "pressed") {
            const currentOrb = useFriday.getState().orb;
            if (currentOrb === "listening") {
              stopVoiceCapture();
            } else {
              startVoiceCapture();
            }
          }
        };

        listen<string>("global-shortcut-voice-toggle", (event) => {
          handleVoiceToggleShortcut(event.payload);
        }).then((un) => unlisten.push(un));

        listen<string>("global-shortcut-alt-space", (event) => {
          handleVoiceToggleShortcut(event.payload);
        }).then((un) => unlisten.push(un));

        listen<string>("global-shortcut-console", () => {
          // No-op for now, dashboard is always visible
        }).then((un) => unlisten.push(un));

        listen<string>("global-shortcut-dictation", () => {
          setInputMode(inputMode === "dictation" ? "command" : "dictation");
        }).then((un) => unlisten.push(un));

        listen<string>("switch-console-tab", (event) => {
          if (event.payload) {
            setActiveConsoleTab(event.payload as "chat" | "automations" | "skills" | "memory" | "audit" | "settings");
          }
        }).then((un) => unlisten.push(un));

        listen<{ wake_word: string; timestamp_ms: number } | string>("friday://wake-word-detected", () => {
          playInstantAcousticCue();
          setOrbState("listening");
          useFriday.getState().setOrb("listening");
          useFriday.getState().setPartial("Listening...");
          // Do NOT force setActiveConsoleTab("chat") here so current view/tab (e.g. Settings) is preserved
          invokeCommand("show_main_window").catch(() => {});
          startVoiceCapture();
        }).then((un) => unlisten.push(un));

        listen<string>("friday://voice-partial", (event) => {
          if (event.payload) {
            const text = event.payload.trim();
            if (text) {
              const currentOrb = useFriday.getState().orb;
              if (currentOrb !== "speaking") {
                useFriday.getState().setOrb("listening");
              }
              useFriday.getState().setPartial(text);
            }
          }
        }).then((un) => unlisten.push(un));

        listen<string>("friday://voice-command", (event) => {
          if (event.payload) {
            const cmd = event.payload.trim();
            const lower = cmd.toLowerCase().replace(/[.,!?;:]/g, "").trim();
            if (
              lower === "hey friday" ||
              lower === "friday" ||
              lower === "hey computer" ||
              lower === "computer" ||
              lower === "operator"
            ) {
              // Standalone wake word: keep microphone alive in listening mode without executing blank turn
              useFriday.getState().setOrb("listening");
              useFriday.getState().setPartial("Listening for your command...");
              return;
            }
            if (cmd.length > 0) {
              useFriday.getState().setOrb("thinking");
              useFriday.getState().setPartial("");
              sendChatMessage(cmd);
            }
          }
        }).then((un) => unlisten.push(un));
      });
    }

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, [windowLabel, orbState, inputMode, setActiveConsoleTab, setInputMode, setOrbState, startVoiceCapture, stopVoiceCapture]);

  useEffect(() => {
    const handleOpenConsole = () => setActiveConsoleTab("chat");
    const handleKeyDown = (e: KeyboardEvent) => {
      // Panic Kill Switch: Ctrl+Alt+Shift+F
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        bargeIn();
        alert("PANIC KILL SWITCH TRIGGERED: Mic released, turns cancelled, automations paused.");
        return;
      }

      // Command Palette Toggle: Ctrl+K / Cmd+K (window-level)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }

      // Instant Voice Barge-In / Interrupt on Escape
      if (e.key === "Escape" && (orbState === "speaking" || orbState === "listening")) {
        e.preventDefault();
        bargeIn();
        return;
      }

      // Toggle Console: Alt+Shift+Space (No-op in new architecture as it's always open)
      if (e.altKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        return;
      }

      // Toggle Dictation Mode: Alt+Shift+D (§"Three modes, never ambiguous")
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setInputMode(inputMode === "dictation" ? "command" : "dictation");
        return;
      }

      // Toggle Project Mode: Alt+Shift+P
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const nextMode = inputMode === "project" ? "command" : "project";
        setInputMode(nextMode);
        if (nextMode === "project") {
          setActiveConsoleTab("projects");
        }
        return;
      }

      // Primary Voice Push-To-Talk & Toggle: Alt+Shift (with Alt+Space fallback)
      const isAltShiftPress =
        (e.altKey && (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight")) ||
        (e.shiftKey && (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight"));

      const isAltSpacePress = e.altKey && !e.shiftKey && (e.code === "Space" || e.key === " ");

      if (isAltShiftPress || isAltSpacePress) {
        e.preventDefault();
        e.stopPropagation();
        if (!isHoldingPttRef.current) {
          isHoldingPttRef.current = Date.now();
          const currentOrb = useFriday.getState().orb;
          if (currentOrb === "listening") {
            stopVoiceCapture();
            isHoldingPttRef.current = null;
          } else {
            startVoiceCapture();
          }
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Process keyup if it was initiated as an Alt+Shift or Alt+Space PTT
      const isAltShiftOrSpaceRelease =
        e.key === "Shift" ||
        e.key === "Alt" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight" ||
        e.code === "AltLeft" ||
        e.code === "AltRight" ||
        e.code === "Space" ||
        e.key === " ";

      if (isAltShiftOrSpaceRelease && isHoldingPttRef.current !== null) {
        const heldDurationMs = Date.now() - isHoldingPttRef.current;
        isHoldingPttRef.current = null;
        // If held for > 300ms, user was holding to talk (Push-to-Talk) -> release stops capture
        // If released within 300ms, user tapped to toggle -> leave capture running
        if (heldDurationMs > 300) {
          e.preventDefault();
          e.stopPropagation();
          stopVoiceCapture();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (windowLabel === "main" || activeSurface === "bar") {
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
  }, [windowLabel, activeSurface, paletteOpen, setPaletteOpen, orbState, inputMode, setInputMode, startVoiceCapture, stopVoiceCapture, bargeIn]);


  return (
    <div className="relative w-full h-full overflow-hidden font-sans bg-[hsl(var(--canvas))]">
      <Console />
      <Palette />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          try {
            localStorage.setItem("friday_onboarded_v1_0", "true");
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
        }}
        onLaunchConsole={() => {
          setShowShowcase(false);
        }}
      />
    </div>
  );
};

export default App;

