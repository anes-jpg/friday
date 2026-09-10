import React, { useState } from "react";
import { PendingPlan } from "@/lib/bindings";
import { TremorBadge } from "@/components/tremor/Badge";
import { Button } from "@/components/ui/Button";
import { ShimmerButton } from "@/components/magicui/ShimmerButton";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { Check, X, RotateCcw, ArrowRight, ShieldAlert } from "lucide-react";

interface InlineResultProps {
  plan: PendingPlan;
  onConfirm: () => void;
  onCancel: () => void;
  onUndo: () => void;
}

export const InlineResult: React.FC<InlineResultProps> = ({
  plan,
  onConfirm,
  onCancel,
  onUndo,
}) => {
  const [redConfirmInput, setRedConfirmInput] = useState("");
  const isRed = plan.tier === "Red";
  const canConfirmRed = !isRed || redConfirmInput.trim().toLowerCase() === "confirm";

  return (
    <div className="w-full border-t border-[var(--color-edge)] bg-[var(--color-hull)] p-3.5 flex flex-col gap-3 transition-all">
      {/* 1. Heard */}
      <div className="flex items-center justify-between text-[var(--text-micro)] text-[var(--color-mute)] font-mono">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold uppercase tracking-wider text-[var(--color-text)]">HEARD:</span>
          <span className="text-[var(--color-text)] italic truncate">"{plan.heard}"</span>
        </div>
        <TremorBadge variant={plan.tier === "Green" ? "success" : plan.tier === "Amber" ? "warning" : "error"}>
          {plan.tier}
        </TremorBadge>
      </div>

      {/* 2. Plan Steps */}
      <div className="flex flex-col gap-1.5 py-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">PLAN:</span>
        <div className="flex flex-col gap-1">
          {plan.steps.map((step, idx) => {
            const isCompleted = idx < plan.currentStepIndex;
            const isCurrent = idx === plan.currentStepIndex && plan.status === "executing";

            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-[var(--text-body)] text-[var(--color-text)]"
              >
                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-[var(--color-acid)]" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[var(--color-acid)] animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mute)] opacity-50" />
                  )}
                </div>
                <span className={isCompleted ? "line-through opacity-60" : ""}>
                  {step.description}
                </span>
                <TremorBadge
                  variant={step.tier === "Green" ? "success" : step.tier === "Amber" ? "warning" : "error"}
                  className="ml-auto scale-90 origin-right"
                >
                  {step.tier}
                </TremorBadge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diff Preview if present */}
      {plan.diff && (
        <DiffViewer filename={plan.filename} diff={plan.diff} className="my-1" />
      )}

      {/* 3. Doing / Result & Confirmation */}
      {plan.status === "awaiting_confirm" && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-edge)]">
          {isRed ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[var(--text-micro)] text-[var(--color-fail)] font-semibold uppercase flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Type "confirm":
              </span>
              <input
                type="text"
                value={redConfirmInput}
                onChange={(e) => setRedConfirmInput(e.target.value)}
                placeholder="confirm"
                className="h-7 px-2 w-28 font-mono text-xs rounded bg-[var(--color-plate)] border border-[var(--color-edge)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-fail)]"
              />
            </div>
          ) : (
            <div className="text-[var(--text-micro)] text-[var(--color-mute)] truncate font-mono">
              Spoken narration: &ldquo;Go ahead?&rdquo; (8s timeout)
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <ShimmerButton
              shimmerColor={isRed ? "oklch(63% 0.21 25)" : "oklch(78% 0.19 152)"}
              background={isRed ? "var(--color-fail)" : "var(--color-acid)"}
              className={isRed ? "text-white font-semibold" : "text-[var(--color-void)] font-bold"}
              onClick={onConfirm}
              disabled={!canConfirmRed}
            >
              <ArrowRight className="w-3.5 h-3.5 mr-1" />
              {isRed ? "Confirm Action" : "Execute (Go Ahead)"}
            </ShimmerButton>
          </div>
        </div>
      )}

      {plan.status === "executing" && (
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-edge)] text-[var(--text-micro)] text-[var(--color-acid)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-acid)] animate-ping" />
          <span>Executing step {plan.currentStepIndex + 1} of {plan.steps.length}...</span>
        </div>
      )}

      {plan.status === "done" && (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-edge)] text-[var(--text-body)]">
          <div className="flex items-center gap-2 text-[var(--color-acid)] text-[var(--text-micro)] font-mono">
            <Check className="w-4 h-4" />
            <span>{plan.resultSummary || "Completed successfully."}</span>
          </div>
          {plan.undoable && (
            <Button variant="secondary" size="sm" onClick={onUndo} title="Deterministic undo">
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
