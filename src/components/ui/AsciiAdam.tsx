import React from "react";
import { cn } from "@/lib/utils";

interface AsciiAdamProps {
  className?: string;
}

export const AsciiAdam: React.FC<AsciiAdamProps> = ({ className }) => {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-6 bg-black/90 border border-white/10 rounded-2xl overflow-hidden font-mono select-none shadow-2xl group",
        className
      )}
    >
      {/* Background Dot Matrix Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Cyber Corner Brackets */}
      <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-600">┌</div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-600">┐</div>
      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-600">└</div>
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-zinc-600">┘</div>

      {/* Title */}
      <div className="w-full flex items-center justify-between mb-2 text-[10px] tracking-widest text-zinc-500 font-mono">
        <span>CREATION_OF_ADAM // BINARY_SYNAPSE</span>
        <span className="text-[var(--color-acid)] animate-pulse">● LIVE_BRIDGE</span>
      </div>

      {/* ASCII Art Canvas */}
      <div className="relative text-[9px] md:text-[11px] leading-[1.1] font-mono whitespace-pre text-zinc-300 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          {/* Left Hand (God / AI) */}
          <div className="text-zinc-200">
{`          .---.
        _/     \\_
     .-'   010   \`-.
    /  1101   X   $ \\
   / 10101  XXX    1 \\
  | 01010  XXXXX    0 |
  | 1010  XXXXXXX   1 |
   \\ 01  XX`}
            <span className="text-blue-400 font-bold">1101</span>
            {`XX  0 /
    \`-._ `}
            <span className="text-cyan-300 font-bold">■■■■</span>
            {` _.-'
        | `}
            <span className="text-white font-bold bg-blue-500/20 px-0.5">101</span>
            {` |
        '-----'`}
          </div>

          {/* Center Synapse Sparks */}
          <div className="flex flex-col items-center justify-center gap-1 text-[8px] text-blue-400 font-bold animate-pulse">
            <span className="text-white drop-shadow-[0_0_8px_#38bdf8]">■</span>
            <span className="text-cyan-300">· ·</span>
            <span className="text-blue-500 text-[10px]">✕</span>
            <span className="text-cyan-300">· ·</span>
            <span className="text-white drop-shadow-[0_0_8px_#38bdf8]">■</span>
          </div>

          {/* Right Hand (Adam / Human) */}
          <div className="text-zinc-300">
{`        .---.
      _/     \\_
   .-'   101   \`-.
  / $   X   0110  \\
 / 0    XXX  10101 \\
| 1    XXXXX  01010 |
| 0   XXXXXXX  0101 |
 \\ 1  XX`}
            <span className="text-blue-400 font-bold">0110</span>
            {`XX  1 /
  \`-._ `}
            <span className="text-cyan-300 font-bold">■■■■</span>
            {` _.-'
      | `}
            <span className="text-white font-bold bg-blue-500/20 px-0.5">010</span>
            {` |
      '-----'`}
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-between mt-3 text-[9px] font-mono text-zinc-600">
        <span>INTERFACE_TYPE: SYNAPSE_RESONANCE</span>
        <span>AUTH: PROTOCOL_01</span>
      </div>
    </div>
  );
};
