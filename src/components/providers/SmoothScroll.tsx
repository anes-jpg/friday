import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis, { ScrollEventData } from "@/lib/lenis";

interface SmoothScrollContextValue {
  lenis: Lenis | null;
  scrollTo: (target: number | HTMLElement, options?: { immediate?: boolean }) => void;
  scrollProgress: number;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
  scrollTo: () => {},
  scrollProgress: 0,
});

export const useLenis = () => useContext(SmoothScrollContext);

interface SmoothScrollProps {
  children: React.ReactNode;
  className?: string;
  showScrollbar?: boolean;
}

export const SmoothScroll: React.FC<SmoothScrollProps> = ({
  children,
  className = "",
  showScrollbar = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check prefers-reduced-motion per Constitution
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      wrapper: el,
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 1.0,
    });

    lenisRef.current = lenis;

    const unbind = lenis.on("scroll", (data: ScrollEventData) => {
      setScrollProgress(data.progress);
      setIsScrolling(Math.abs(data.velocity) > 0.1);
    });

    return () => {
      unbind();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = (target: number | HTMLElement, options?: { immediate?: boolean }) => {
    lenisRef.current?.scrollTo(target, options);
  };

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef.current, scrollTo, scrollProgress }}>
      <div
        ref={containerRef}
        className={`relative overflow-y-auto ${className}`}
        style={{ scrollBehavior: "auto" }}
      >
        {children}

        {/* Cinematic Glowing Momentum Scrollbar Indicator */}
        {showScrollbar && (
          <div
            className={`pointer-events-none absolute right-1 top-2 bottom-2 w-1 rounded-full z-40 transition-opacity duration-300 ${
              isScrolling ? "opacity-90" : "opacity-0 hover:opacity-40"
            }`}
          >
            <div
              className="w-full bg-[var(--color-acid)] rounded-full transition-all duration-75 shadow-[0_0_8px_var(--color-acid)]"
              style={{
                height: `${Math.max(8, scrollProgress * 100)}%`,
                maxHeight: "100%",
                transform: `translateY(${scrollProgress * 20}px)`,
              }}
            />
          </div>
        )}
      </div>
    </SmoothScrollContext.Provider>
  );
};

export default SmoothScroll;
