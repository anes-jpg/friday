import React from "react";

interface HudReticleProps {
  children?: React.ReactNode;
  className?: string;
  label?: string;
  status?: string;
}

export const HudReticle: React.FC<HudReticleProps> = ({
  children,
  className = "",
  label,
  status = "ONLINE",
}) => {
  return (
    <div className={`relative border border-white/10 bg-black/40 backdrop-blur-md rounded-lg p-3 ${className}`}>
      {/* Precision Corner Brackets */}
      <span className="pointer-events-none absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-[var(--color-acid)]/80" />
      <span className="pointer-events-none absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-[var(--color-acid)]/80" />
      <span className="pointer-events-none absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 border-[var(--color-acid)]/80" />
      <span className="pointer-events-none absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 border-[var(--color-acid)]/80" />

      {/* Header Telemetry line if label provided */}
      {label && (
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2 font-mono text-[10px] tracking-wider text-zinc-400">
          <span className="text-zinc-300 font-semibold">{label}</span>
          <span className="text-[var(--color-acid)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-acid)] inline-block" />
            {status}
          </span>
        </div>
      )}

      {children}
    </div>
  );
};

export default HudReticle;
