import React, { useEffect, useState, useRef } from "react";
import { useFridayStore, useFriday, sendChatMessage, acceptRunEvent, recordVoiceMetrics, recordLatency } from "@/lib/store";
import type { RunEvent } from "@/lib/workspace-native";
import { invokeCommand } from "@/lib/ipc";
import { playInstantAcousticCue } from "@/lib/phrasebank";
import { isAudioActive } from "@/lib/kokoro";

import { Palette } from "@/surfaces/palette/Palette";
import { DailyWorkHost } from "@/components/work/DailyWorkHost";
import { useDailyWork } from "@/lib/daily-work";
import { Console } from "@/surfaces/console/Console";
import { FridayOSShell } from "@/surfaces/os/FridayOSShell";
import { HudBootSequence } from "@/components/hud/HudBootSequence";
import { FullscreenReveal } from "@/components/hud/FullscreenReveal";
import { useWindowMode } from "@/lib/window-mode";
import { useSettings } from "@/lib/settings";
import { surfaceLabel } from "@/lib/ipc";

const OnboardingModal = React.lazy(() =>
  import("@/surfaces/onboarding/OnboardingModal").then((m) => ({ default: m.OnboardingModal }))
);
const LandingShowcase = React.lazy(() =>
  import("@/surfaces/landing/LandingShowcase").then((m) => ({ default: m.LandingShowcase }))
);

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
    tab: activeSurface,
    setActiveSurface,
    setActiveConsoleTab,
    paletteOpen,
    setPaletteOpen,
    startVoiceCapture,
    stopVoiceCapture,
    bargeIn,
    updateAudioRms,
    loadBackendData,
    orb: orbState,
    setOrbState,
    mode: inputMode,
    setInputMode,
    wakeWord,
  } = useFridayStore();
  const spatialHudActive = useWindowMode((s) => s.spatial);
  const windowError = useWindowMode((s) => s.error);

  const [windowLabel, setWindowLabel] = useState<string>(() => getTauriWindowLabel());
  const [showShowcase, setShowShowcase] = useState<boolean>(false);
  const [isBootingHud, setIsBootingHud] = useState<boolean>(false);
  const [fullscreenReveal, setFullscreenReveal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem("friday_onboarded_v1_0") !== "true";
    } catch {
      return true;
    }
  });
  const isHoldingPttRef = useRef<number | null>(null);

  useEffect(() => {
    const revealFullscreen = () => setFullscreenReveal(true);
    const handleTriggerHudBoot = async () => {
      if (await useWindowMode.getState().enterSpatial()) setIsBootingHud(true);
    };
    const handleFullscreenKey = (event: KeyboardEvent) => {
      if (event.key !== "F11" || event.repeat) return;
      event.preventDefault();
      if (event.ctrlKey && event.shiftKey) {
        if (useWindowMode.getState().spatial) void useWindowMode.getState().exitSpatial();
        else void handleTriggerHudBoot();
      } else void useWindowMode.getState().toggleFullscreen();
    };
    const syncFullscreen = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      useWindowMode.getState().sync(fullscreen);
      if (!fullscreen) setFullscreenReveal(false);
      if (!fullscreen && useWindowMode.getState().spatial) void useWindowMode.getState().exitSpatial();
    };
    window.addEventListener("keydown", handleFullscreenKey);
    document.addEventListener("fullscreenchange", syncFullscreen);
    let disposed = false;
    let unlistenResize: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
        const nativeWindow = getCurrentWindow();
        const sync = async () => {
          try { const fullscreen = await nativeWindow.isFullscreen(); if (!disposed) useWindowMode.getState().sync(fullscreen); }
          catch (error) { console.warn("Window state unavailable", error); }
        };
        await sync();
        const stop = await nativeWindow.onResized(() => { void sync(); });
        if (disposed) stop(); else unlistenResize = stop;
      });
    }
    window.addEventListener("friday:trigger-hud-boot", handleTriggerHudBoot);
    window.addEventListener("friday:fullscreen-ready", revealFullscreen);
    return () => {
      window.removeEventListener("keydown", handleFullscreenKey);
      disposed = true;
      unlistenResize?.();
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.removeEventListener("friday:trigger-hud-boot", handleTriggerHudBoot);
      window.removeEventListener("friday:fullscreen-ready", revealFullscreen);
    };
  }, []);

  const handleBootComplete = () => {
    setIsBootingHud(false);
  };

  const handleExitHud = async () => {
    await useWindowMode.getState().exitSpatial();
    setIsBootingHud(false);
  };

  useEffect(() => {
    const handleOpenOnboarding = () => setShowOnboarding(true);
    window.addEventListener("friday:open-onboarding", handleOpenOnboarding);


    return () => {
      window.removeEventListener("friday:open-onboarding", handleOpenOnboarding);
    };
  }, [startVoiceCapture, stopVoiceCapture]);

  useEffect(() => {
    void useSettings.getState().hydrate();
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
    const unlisten: (() => void)[] = [];
    let disposed = false;
    const register = (stop: () => void) => { if (disposed) stop(); else unlisten.push(stop); };

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        void listen<RunEvent>("run-event", event => acceptRunEvent(event.payload)).then(register);
        void listen<{ status: string; error: string | null; rms: number; metrics:Record<string,unknown> | null }>("friday://voice-state", event => {
          const state=useFriday.getState()
          state.updateAudioRms(event.payload.rms)
          useFriday.setState(current=>({resources:{...current.resources,asr_warm:event.payload.status==="ready"}}))
          if(event.payload.metrics) recordVoiceMetrics(event.payload.metrics)
          if (["failed", "disabled"].includes(event.payload.status) && state.orb === "listening") state.setOrb("idle")
          if (event.payload.error) window.dispatchEvent(new CustomEvent("friday:voice-error", { detail: event.payload.error }))
        }).then(register);
        const handleVoiceToggleShortcut = (state: string) => {
          if (state === "pressed") {
            isHoldingPttRef.current=performance.now()
            const currentOrb = useFriday.getState().orb;
            if (currentOrb === "listening") {
              stopVoiceCapture();
              isHoldingPttRef.current=null
            } else {
              startVoiceCapture();
            }
          } else if(state==="released" && isHoldingPttRef.current!=null) {
            const duration=performance.now()-isHoldingPttRef.current
            isHoldingPttRef.current=null
            if(duration>300) stopVoiceCapture()
          }
        };

        listen<string>("global-shortcut-voice-toggle", (event) => {
          handleVoiceToggleShortcut(event.payload);
        }).then(register);

        listen<string>("global-shortcut-alt-space", (event) => {
          handleVoiceToggleShortcut(event.payload);
        }).then(register);

        listen<string>("global-shortcut-console", () => {
          // No-op for now, dashboard is always visible
        }).then(register);

        listen<string>("global-shortcut-dictation", () => {
          setInputMode(useFriday.getState().mode === "dictation" ? "command" : "dictation");
        }).then(register);

        listen<string>("switch-console-tab", (event) => {
          if (event.payload) {
            setActiveConsoleTab(event.payload as "chat" | "automations" | "skills" | "memory" | "audit" | "settings");
          }
        }).then(register);

        listen<{ wake_word: string; timestamp_ms: number } | string>("friday://wake-word-detected", () => {
          playInstantAcousticCue();
          setOrbState("listening");
          useFriday.getState().setOrb("listening");
          useFriday.getState().setPartial("Listening...");
          // Do NOT force setActiveConsoleTab("chat") here so current view/tab (e.g. Settings) is preserved
          invokeCommand("show_main_window").catch(() => {});
          startVoiceCapture();
        }).then(register);

        listen<string>("friday://voice-partial", (event) => {
          if (event.payload) {
            const store = useFriday.getState();
            if (store.micMuted || (store.orb !== "listening" && store.mode !== "conversation")) {
              return;
            }
            const text = event.payload.trim();
            if (text) {
              const currentOrb = store.orb;
              if (currentOrb !== "speaking") {
                store.setOrb("listening");
              }
              store.setPartial(text);
            }
          }
        }).then(register);

        listen<string>("friday://voice-command", (event) => {
          if (event.payload) {
            const store = useFriday.getState();
            if (store.micMuted) {
              console.warn("[Voice] Spoken command dropped because microphone is muted.");
              return;
            }
            const cmd = event.payload.trim();
            if (useDailyWork.getState().captureOpen) {
              useDailyWork.setState(current => ({ draft: { ...current.draft, text: [current.draft.text, cmd].filter(Boolean).join("\n"), sourceKind: "idea" } }));
              store.setPartial(""); store.setOrb("idle");
              return;
            }
            const lower = cmd.toLowerCase().replace(/[.,!?;:]/g, "").trim();
            if (
              lower === "hey friday" ||
              lower === "friday" ||
              lower === "hey computer" ||
              lower === "computer" ||
              lower === "operator"
            ) {
              // Standalone wake word: activate listening mode
              store.setOrb("listening");
              store.setPartial("Listening for your command...");
              return;
            }

            // Reject ambient/background noise unless user explicitly opened voice listening
            if (store.orb !== "listening" && store.mode !== "conversation") {
              console.warn("[Voice] Spoken audio ignored (not in active listening mode):", cmd);
              return;
            }

            if (cmd.length > 0) {
              store.setOrb("thinking");
              store.setPartial("");
              sendChatMessage(cmd);
            }
          }
        }).then(register);
      });
    }

    return () => {
      disposed = true;
      unlisten.forEach((fn) => fn());
    };
  }, [windowLabel, setActiveConsoleTab, setInputMode, setOrbState, startVoiceCapture, stopVoiceCapture]);

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
      if (e.key === "Escape" && orbState !== "idle") {
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
        if (windowLabel!=="browser") return
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
      if (windowLabel === "main" || windowLabel === "bar") {
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
      {spatialHudActive ? (
        <FridayOSShell onExitFullscreen={handleExitHud} />
      ) : (
        <Console />
      )}

      {isBootingHud && spatialHudActive && (
        <HudBootSequence
          onComplete={handleBootComplete}
          onSkip={() => void handleExitHud()}
        />
      )}
      {fullscreenReveal && !spatialHudActive && <FullscreenReveal onComplete={() => setFullscreenReveal(false)} />}
      {windowError && <div className="window-error" role="alert">Window mode could not change: {windowError}</div>}

      <Palette />
      <DailyWorkHost />
      <React.Suspense fallback={null}>
        {showOnboarding && (
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
        )}
        {showShowcase && (
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
        )}
      </React.Suspense>
    </div>
  );
};

export default App;

