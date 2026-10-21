import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

// ─── 1. Perspective 3D Tilt Card ─────────────────────────────────────────────
interface PerspectiveTiltProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scaleOnHover?: number;
}

export const PerspectiveTilt: React.FC<PerspectiveTiltProps> = ({
  children,
  className = "",
  maxTilt = 6,
  perspective = 1000,
  scaleOnHover = 1.015,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // High-performance spring dampening (Argon/Bencho standard: stiffness 320, damping 28)
  const springConfig = { stiffness: 320, damping: 28, mass: 0.6 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn("group/tilt [perspective:1000px]", className)}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ scale: scaleOnHover }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full h-full transition-shadow duration-300"
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── 2. Interactive Spotlight Aura Surface ───────────────────────────────────
interface SpotlightSurfaceProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  spotlightSize?: number;
}

export const SpotlightSurface: React.FC<SpotlightSurfaceProps> = ({
  children,
  className = "",
  glowColor = "rgba(255, 255, 255, 0.08)",
  spotlightSize = 350,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const [isHovered, setIsHovered] = useState(false);

  const springConfig = { stiffness: 450, damping: 32 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handlePointerEnter = () => setIsHovered(true);
  const handlePointerLeave = () => {
    setIsHovered(false);
    mouseX.set(-1000);
    mouseY.set(-1000);
  };

  return (
    <div
      ref={surfaceRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={cn("relative overflow-hidden group/spotlight", className)}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 z-10"
        animate={{ opacity: isHovered ? 1 : 0 }}
      >
        <motion.div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            background: useTransform(
              [smoothMouseX, smoothMouseY],
              ([x, y]) =>
                `radial-gradient(${spotlightSize}px circle at ${x}px ${y}px, ${glowColor}, transparent 70%)`
            ),
          }}
        />
      </motion.div>

      {/* Surface Content */}
      <div className="relative z-20 w-full h-full">{children}</div>
    </div>
  );
};

// ─── 3. Magnetic Hover Pull (Buttons & Chips) ────────────────────────────────
interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  pullFactor?: number;
}

export const Magnetic: React.FC<MagneticProps> = ({
  children,
  className = "",
  pullFactor = 0.28,
}) => {
  const magnetRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 480, damping: 26, mass: 0.5 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!magnetRef.current) return;
    const rect = magnetRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * pullFactor;
    const deltaY = (e.clientY - centerY) * pullFactor;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={magnetRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ x: smoothX, y: smoothY }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
};

// ─── 4. Tactile Spring Chip ──────────────────────────────────────────────────
export interface SpringChipProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  active?: boolean;
}

export const SpringChip: React.FC<SpringChipProps> = ({
  children,
  className = "",
  active = false,
  ...props
}) => {
  return (
    <Magnetic pullFactor={0.25}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 480, damping: 28 }}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors duration-150 border select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--signal))]",
          active
            ? "bg-[hsl(var(--signal))]/15 border-[hsl(var(--signal))]/40 text-[hsl(var(--signal))]"
            : "bg-white/[0.04] border-white/10 text-white/80 hover:bg-white/[0.08] hover:border-white/20 hover:text-white",
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    </Magnetic>
  );
};
