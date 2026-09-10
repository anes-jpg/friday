import React, { useEffect, useRef } from "react";
import { OrbState } from "@/lib/bindings";

interface OrbProps {
  state: OrbState;
  mode?: string;
  amplitude?: number; // 0.0 to 1.0
  onClick?: () => void;
  className?: string;
}

export const Orb: React.FC<OrbProps> = ({ state, mode = "command", amplitude = 0.5, onClick, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 40;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const center = (size * dpr) / 2;
    const radius = (size * dpr) / 2 - 3 * dpr;

    // Draw Idle State (Static ring, 0% CPU, no requestAnimationFrame)
    if (state === "idle") {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "oklch(32% 0.008 265)"; // --color-edge
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      return;
    }

    // Active animation loop for Listening, Thinking, Speaking
    let running = true;
    startTimeRef.current = performance.now();

    const render = (now: number) => {
      if (!running) return;

      const elapsed = now - startTimeRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (state === "listening") {
        // Listening: 12 FFT-derived control points modulated by RMS amplitude
        const points = 12;
        const ampMod = Math.max(0.2, amplitude);
        const waveSpeed = elapsed * 0.005;

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const noise = Math.sin(angle * 3 + waveSpeed) * Math.cos(angle * 2 - waveSpeed) * 3.5 * dpr * ampMod;
          const r = radius + noise;
          const x = center + Math.cos(angle) * r;
          const y = center + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        const isDictation = mode === "dictation";
        const accentStroke = isDictation
          ? "oklch(58% 0.010 265 / 0.8)"
          : "oklch(78% 0.19 152 / 0.75)";
        const glowFill = isDictation
          ? "oklch(58% 0.010 265 / 0.15)"
          : "oklch(78% 0.19 152 / 0.2)";

        ctx.closePath();
        ctx.strokeStyle = accentStroke;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Subtle glow center
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.4 * ampMod, 0, Math.PI * 2);
        ctx.fillStyle = glowFill;
        ctx.fill();
      } else if (state === "thinking") {
        // Thinking: Single arc sweeping at 900ms per rotation, no easing
        const rotationDuration = 900;
        const rotAngle = ((elapsed % rotationDuration) / rotationDuration) * Math.PI * 2;
        const arcLength = Math.PI * 0.8;
        const isDictation = mode === "dictation";

        // Base dim ring
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "oklch(24% 0.007 265)";
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        // Sweeping accent arc
        ctx.beginPath();
        ctx.arc(center, center, radius, rotAngle, rotAngle + arcLength);
        ctx.strokeStyle = isDictation
          ? "oklch(58% 0.010 265)"
          : "oklch(78% 0.19 152)";
        ctx.lineWidth = 2.5 * dpr;
        ctx.lineCap = "round";
        ctx.stroke();
      } else if (state === "speaking") {
        // Speaking: Concentric pulse locked to TTS output amplitude
        const pulseCycle = (Math.sin(elapsed * 0.008) + 1) / 2; // 0 to 1
        const pulseRadius = radius * (0.85 + pulseCycle * 0.25 * amplitude);
        const isDictation = mode === "dictation";

        // Inner pulse
        ctx.beginPath();
        ctx.arc(center, center, pulseRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = isDictation
          ? "oklch(58% 0.010 265 / 0.25)"
          : "oklch(78% 0.19 152 / 0.35)";
        ctx.fill();

        // Middle ring
        ctx.beginPath();
        ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isDictation
          ? "oklch(58% 0.010 265)"
          : "oklch(78% 0.19 152)";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Outer faint echo
        ctx.beginPath();
        ctx.arc(center, center, radius * 1.15, 0, Math.PI * 2);
        ctx.strokeStyle = isDictation
          ? "oklch(58% 0.010 265 / 0.2)"
          : "oklch(78% 0.19 152 / 0.2)";
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [state, amplitude]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center w-10 h-10 cursor-pointer shrink-0 select-none ${className}`}
      title={`FRIDAY Orb: ${state}`}
    >
      <canvas ref={canvasRef} className="block w-10 h-10" />
    </div>
  );
};
