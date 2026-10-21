import React, { createContext, useContext, useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { motion } from "motion/react";
import Lenis, { ScrollEventData } from "@/lib/lenis";

export interface SmoothScrollContextValue {
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

export interface SmoothScrollHandle {
  scrollTo: (target: number | HTMLElement, options?: { immediate?: boolean }) => void;
  scrollToBottom: (immediate?: boolean) => void;
  getContainer: () => HTMLDivElement | null;
  getLenis: () => Lenis | null;
}

interface SmoothScrollProps {
  children: React.ReactNode;
  className?: string;
  showScrollbar?: boolean;
}

export const SmoothScroll = forwardRef<SmoothScrollHandle, SmoothScrollProps>(({
  children,
  className = "",
  showScrollbar = false,
}, ref) => {
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
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 1.05,
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

  const scrollToBottom = (immediate = false) => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(maxScroll, { immediate });
      } else {
        el.scrollTop = maxScroll;
      }
    }
  };

  useImperativeHandle(ref, () => ({
    scrollTo,
    scrollToBottom,
    getContainer: () => containerRef.current,
    getLenis: () => lenisRef.current,
  }));

  // Map progress (0 to 1) to translateY percentage string
  const thumbTranslateY = `${Math.round(scrollProgress * 240)}%`;

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef.current, scrollTo, scrollProgress }}>
      <div
        ref={containerRef}
        className={`relative overflow-y-auto [scroll-behavior:auto] ${className}`}
      >
        {children}

        {/* Minimal Glowing Momentum Scrollbar Indicator without inline styles */}
        {showScrollbar && (
          <div
            className={`pointer-events-none absolute right-1.5 top-2 bottom-2 w-1 rounded-full z-40 transition-opacity duration-300 ${
              isScrolling ? "opacity-90" : "opacity-0"
            }`}
          >
            <motion.div
              className="w-full h-8 bg-[hsl(var(--signal))] rounded-full shadow-[0_0_8px_hsl(var(--signal))]"
              animate={{ y: scrollProgress * 180 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          </div>
        )}
      </div>
    </SmoothScrollContext.Provider>
  );
});

SmoothScroll.displayName = "SmoothScroll";

export default SmoothScroll;
