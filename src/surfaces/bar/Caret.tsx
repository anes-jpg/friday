import React, { useRef, useEffect } from "react";
import { InputMode } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/components/magicui/AnimatedShinyText";

interface CaretProps {
  value: string;
  asrPartial?: string;
  mode: InputMode;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  onOpenPalette: () => void;
  onToggleMode: () => void;
}

export const Caret: React.FC<CaretProps> = ({
  value,
  asrPartial,
  mode,
  onChange,
  onSubmit,
  onOpenPalette,
  onToggleMode,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleWindowFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = value.trim() || asrPartial?.trim() || "";
      if (text) {
        onSubmit(text);
      }
    } else if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onOpenPalette();
    } else if (e.key === ">" && value === "") {
      e.preventDefault();
      onOpenPalette();
    } else if (e.key === "Tab" && !value) {
      e.preventDefault();
      onToggleMode();
    } else if (e.altKey && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const modeLabels = {
    command: "CMD",
    dictation: "DICT",
    conversation: "TALK",
  };

  return (
    <div className="relative flex items-center flex-1 h-full px-2">
      {/* Mode Tag */}
      <button
        onClick={onToggleMode}
        title="Click to cycle mode: Command / Dictation / Conversation (or press Tab)"
        className={cn(
          "mr-2.5 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold uppercase select-none transition-colors",
          mode === "command" && "bg-[var(--color-plate)] text-[var(--color-text)] border border-[var(--color-edge)]",
          mode === "dictation" && "bg-[oklch(58%_0.010_265_/_0.2)] text-[var(--color-mute)] border border-[var(--color-edge)]",
          mode === "conversation" && "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border border-[oklch(78%_0.19_152_/_0.3)]"
        )}
      >
        {modeLabels[mode]}
      </button>

      {/* Input container */}
      <div className="relative flex items-center flex-1 h-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "dictation"
              ? "Dictation active — speak or type verbatim..."
              : mode === "conversation"
              ? "Listening for conversation... (type or talk)"
              : "Ask Friday anything, hold Alt+Space to talk, or type > for commands"
          }
          className="w-full bg-transparent border-none text-[var(--text-input)] text-[var(--color-text)] placeholder:text-[var(--color-mute)] focus:outline-none font-sans font-normal"
        />

        {/* Live ASR partial overlay when user hasn't typed (§"Three modes": full opacity in dictation) */}
        {!value && asrPartial && (
          <div className="absolute left-0 pointer-events-none text-[var(--text-input)] truncate pr-4">
            {mode === "dictation" ? (
              <span className="text-[var(--color-text)] font-sans opacity-100">
                {asrPartial}
              </span>
            ) : (
              <AnimatedShinyText shimmerWidth={140} className="text-[var(--color-acid)] font-sans">
                {asrPartial}
              </AnimatedShinyText>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
