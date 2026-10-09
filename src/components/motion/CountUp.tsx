import React, { useEffect, useRef, useCallback } from "react";
import { useMotionValue, useSpring } from "motion/react";

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  separator?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 0.6,
  className = "",
  prefix = "",
  suffix = "",
  decimals = 0,
  separator = ",",
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);

  const springValue = useSpring(motionValue, {
    damping: 24,
    stiffness: 140,
  });

  const formatValue = useCallback(
    (latest: number) => {
      const fixed = latest.toFixed(decimals);
      const parts = fixed.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      return `${prefix}${parts.join(".")}${suffix}`;
    },
    [decimals, separator, prefix, suffix]
  );

  useEffect(() => {
    motionValue.set(to);
  }, [to, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });
    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={`font-mono tabular-nums ${className}`} ref={ref}>{formatValue(from)}</span>;
};

export default CountUp;
