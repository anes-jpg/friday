import React from "react";
import { useFridayStore } from "@/lib/store";
import { invokeCommand } from "@/lib/ipc";
import { Orb } from "./Orb";
import { Caret } from "./Caret";
import { InlineResult } from "./InlineResult";
import { Palette } from "../palette/Palette";
import { Kbd } from "@/components/ui/Kbd";
import { BorderBeam } from "@/components/magicui/BorderBeam";
import { ShimmerButton } from "@/components/magicui/ShimmerButton";
import { Mic, Terminal, LayoutDashboard, Volume2, Sparkles } from "lucide-react";

export const Bar: React.FC = () => {
  const {
    orbState,
    inputMode,
    caretText,
    asrPartial,
    pendingPlan,
    paletteOpen,
    setCaretText,
    setInputMode,
    setOrbState,
    setPaletteOpen,
    setActiveSurface,
    openConsoleTab,
    submitQuery,
    confirmPendingPlan,
    cancelPendingPlan,
    undoLastAction,
    startVoiceCapture,
    stopVoiceCapture,
    bargeIn,
    telemetry,
  } = useFridayStore();

  const handleToggleMode = () => {
    const modes: ("command" | "dictation" | "conversation")[] = [
      "command",
      "dictation",
      "conversation",
    ];
    const nextIdx = (modes.indexOf(inputMode) + 1) % modes.length;
    setInputMode(modes[nextIdx]);
  };

  const handleOrbClick = () => {
    if (orbState === "idle") {
      startVoiceCapture();
    } else if (orbState === "listening") {
      stopVoiceCapture();
    } else {
      bargeIn();
    }
  };

  React.useEffect(() => {
    const targetHeight = (pendingPlan || paletteOpen) ? 460 : 64;
    invokeCommand("set_bar_height", { height: targetHeight }).catch(() => {});
  }, [pendingPlan, paletteOpen]);

  return (
    <div className="relative w-[720px] max-w-full rounded-[var(--radius-surface)] acrylic-bar overflow-hidden select-none transition-all duration-200">
      {/* Magic UI Border Beam: Active whenever FRIDAY is listening, thinking, awaiting confirmation, or palette is open */}
      {(orbState !== "idle" || pendingPlan?.status === "awaiting_confirm" || paletteOpen) && (
        <BorderBeam
          size={80}
          duration={4}
          colorFrom="oklch(78% 0.19 152)"
          colorTo="oklch(78% 0.19 152 / 0.1)"
        />
      )}

      {/* 64px Main Bar */}
      <div
        data-tauri-drag-region
        className="flex items-center h-16 px-3.5 gap-2 cursor-grab active:cursor-grabbing"
      >
        {/* 40px Reactive 2D Canvas Orb */}
        <Orb
          state={orbState}
          mode={inputMode}
          amplitude={orbState === "speaking" ? (telemetry.outputRms || 0.45) : (telemetry.micRms || 0.4)}
          onClick={handleOrbClick}
          className="hover:scale-105 transition-transform"
        />

        {/* Caret & ASR Partial Input Area */}
        <Caret
          value={caretText}
          asrPartial={asrPartial}
          mode={inputMode}
          onChange={setCaretText}
          onSubmit={submitQuery}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleMode={handleToggleMode}
        />

        {/* Bar Toolbar Affordances */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-edge)]">
          {/* Magic UI ShimmerButton for push-to-talk voice shortcut */}
          <ShimmerButton
            onMouseDown={() => startVoiceCapture()}
            onMouseUp={() => stopVoiceCapture()}
            onTouchStart={() => startVoiceCapture()}
            onTouchEnd={() => stopVoiceCapture()}
            title="Hold Alt+Space to speak (Push to Talk)"
            className="h-8 px-2.5 py-1 text-xs gap-1.5"
            shimmerColor="oklch(78% 0.19 152)"
            background="var(--color-plate)"
          >
            <Mic className={`w-3.5 h-3.5 ${orbState === "listening" ? "text-[var(--color-acid)] animate-pulse" : "text-[var(--color-acid)]"}`} />
            <Kbd>Alt+Space</Kbd>
          </ShimmerButton>

          {/* Palette button */}
          <button
            onClick={() => setPaletteOpen(!paletteOpen)}
            title="Command Palette (Ctrl+K or type >)"
            className={`p-1.5 rounded-[var(--radius-control)] hover:bg-[var(--color-plate)] text-[var(--color-mute)] hover:text-[var(--color-text)] transition-colors cursor-pointer ${
              paletteOpen ? "text-[var(--color-acid)] bg-[var(--color-plate)]" : ""
            }`}
          >
            <Terminal className="w-4 h-4" />
          </button>

          {/* Open Console button */}
          <button
            onClick={() => openConsoleTab("chat")}
            title="Open Console (Alt+Shift+Space)"
            className="p-1.5 rounded-[var(--radius-control)] hover:bg-[var(--color-plate)] text-[var(--color-mute)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Inline Result Region (Utterance Contract) */}
      {pendingPlan && (
        <InlineResult
          plan={pendingPlan}
          onConfirm={confirmPendingPlan}
          onCancel={cancelPendingPlan}
          onUndo={undoLastAction}
        />
      )}

      {/* Docked Command Palette */}
      {paletteOpen && <Palette docked />}
    </div>
  );
};
