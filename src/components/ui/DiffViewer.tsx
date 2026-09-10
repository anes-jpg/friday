import * as React from "react";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  filename?: string;
  diff: string; // Unified diff or lines prefixed with +, -, or space
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ filename, diff, className }) => {
  const lines = diff.split("\n");

  return (
    <div className={cn("rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-void)] overflow-hidden font-mono text-[12px]", className)}>
      {filename && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-plate)] border-b border-[var(--color-edge)] text-[var(--color-mute)] text-[var(--text-micro)]">
          <span className="font-semibold text-[var(--color-text)]">{filename}</span>
          <span>Diff Preview</span>
        </div>
      )}
      <div className="p-2 overflow-x-auto max-h-60 leading-5">
        {lines.map((line, idx) => {
          const isAdd = line.startsWith("+");
          const isDel = line.startsWith("-");
          const isHunk = line.startsWith("@@");

          return (
            <div
              key={idx}
              className={cn(
                "px-1.5 rounded-sm whitespace-pre font-mono",
                isAdd && "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)]",
                isDel && "bg-[oklch(63%_0.21_25_/_0.15)] text-[var(--color-fail)]",
                isHunk && "text-[var(--color-warn)] opacity-80",
                !isAdd && !isDel && !isHunk && "text-[var(--color-mute)]"
              )}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
};
