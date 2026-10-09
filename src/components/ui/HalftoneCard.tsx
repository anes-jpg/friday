import React from "react";

interface HalftoneCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const HalftoneCard: React.FC<HalftoneCardProps> = ({ children, className = "", ...props }) => {
  return (
    <div 
      className={`relative rounded-xl border border-dashed border-zinc-700 bg-black overflow-hidden ${className}`}
      {...props}
    >
      {/* Halftone dot pattern overlay */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "8px 8px"
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
