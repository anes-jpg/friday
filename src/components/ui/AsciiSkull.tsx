import React from "react";
import { cn } from "@/lib/utils";

interface AsciiSkullProps {
  className?: string;
  showStarfield?: boolean;
}

export const AsciiSkull: React.FC<AsciiSkullProps> = ({ 
  className,
  showStarfield = true,
}) => {
  return (
    <div className={cn("relative p-4 select-none font-mono", className)}>
      {showStarfield && (
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
      )}

      <pre className="relative text-[10px] sm:text-[11px] leading-[1.05] text-white font-mono tracking-tighter whitespace-pre drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
{`               .,c7:'"
             .d@@oo:.
           deeeeeeoo::.
         .deeeeeeoo; ::
        ,eeeeeeeeoo::.
        deeeeeeeoo:'
       '"4eeeeeeeoo::
     d"   'Yeee@ooo";:
     '     8@7"@o:'':
    @c.   .d'. '"4,'
   '@@@7" i        l2
    '4@7   (      llJl2
     >@< /'(,@.   4/
     d@@'..cd7,bc=7'l2
     @@7/d@47>@@eb
     '7<'bd"''`}
      </pre>

      <div className="text-right text-[8px] tracking-widest text-zinc-500 font-mono mt-1">
        atonalosprey
      </div>
    </div>
  );
};
