import React from "react";
import { cn } from "@/lib/utils";

interface HalftoneBudgetCardProps {
  spent?: number;
  limit?: number;
  currency?: string;
  onDetailsClick?: () => void;
  className?: string;
}

export const HalftoneBudgetCard: React.FC<HalftoneBudgetCardProps> = ({
  spent = 1400,
  limit = 2000,
  currency = "$",
  onDetailsClick,
  className,
}) => {
  const totalBlocks = 36;
  const ratio = Math.min(1, Math.max(0, spent / limit));
  const filledBlocks = Math.round(ratio * totalBlocks);

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between bg-black text-white rounded-[24px] border border-white/20 p-6 overflow-hidden shadow-2xl font-mono select-none",
        className
      )}
    >
      {/* Halftone dot noise overlay / left margin */}
      <div 
        className="absolute inset-y-0 left-0 w-8 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
          backgroundSize: '6px 6px',
        }}
      />

      {/* Vertical edge tag */}
      <div className="absolute left-2 bottom-6 text-[8px] tracking-widest text-zinc-600 rotate-[-90deg] origin-bottom-left font-mono uppercase">
        FRIDAY.BUDGET
      </div>

      <div className="pl-4">
        {/* Header: Dot-matrix / Pixel "BUDGET" */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-['VT323',monospace] tracking-[0.25em] text-white leading-none">
            BUDGET
          </h2>
        </div>

        {/* Spent & Limit Info */}
        <div className="flex items-center justify-between text-xs tracking-wider text-zinc-300 font-mono mb-3 uppercase">
          <div>
            SPENT: <span className="text-white font-bold">{currency}{spent.toLocaleString()}</span>
          </div>
          <div>
            LIMIT: <span className="text-white font-bold">{currency}{limit.toLocaleString()}</span>
          </div>
        </div>

        {/* 2-Row Pixel Progress Bar */}
        <div className="flex flex-col gap-[3px] bg-zinc-950/80 p-2 rounded-lg border border-white/10 mb-5">
          {/* Row 1 */}
          <div className="flex items-center gap-[3px] w-full overflow-hidden">
            {Array.from({ length: totalBlocks }).map((_, i) => {
              const isFilled = i < filledBlocks;
              const isEdge = i === filledBlocks - 1;
              return (
                <div
                  key={`r1-${i}`}
                  className={cn(
                    "flex-1 h-3 rounded-[1.5px] transition-all duration-300",
                    isFilled
                      ? isEdge
                        ? "bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                        : "bg-white shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                      : "bg-zinc-800/80"
                  )}
                />
              );
            })}
          </div>

          {/* Row 2 */}
          <div className="flex items-center gap-[3px] w-full overflow-hidden">
            {Array.from({ length: totalBlocks }).map((_, i) => {
              const isFilled = i < filledBlocks;
              const isEdge = i === filledBlocks - 1;
              return (
                <div
                  key={`r2-${i}`}
                  className={cn(
                    "flex-1 h-3 rounded-[1.5px] transition-all duration-300",
                    isFilled
                      ? isEdge
                        ? "bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                        : "bg-white shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                      : "bg-zinc-800/80"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Status & Details Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] leading-relaxed tracking-wider text-zinc-400 font-mono uppercase">
            <div>YOU&apos;RE GETTING CLOSE TO YOUR LIMIT</div>
            <div className="text-zinc-500">CONSIDER SLOWING DOWN SPENDING</div>
          </div>

          <button
            onClick={onDetailsClick}
            className="px-5 py-1.5 bg-white text-black font-mono font-bold text-xs tracking-wider rounded-full hover:bg-zinc-200 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer"
          >
            DETAILS
          </button>
        </div>
      </div>
    </div>
  );
};
