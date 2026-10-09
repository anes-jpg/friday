import React, { useMemo } from "react";
import { motion, type Transition } from "motion/react";

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  onAnimationComplete?: () => void;
}

export const BlurText: React.FC<BlurTextProps> = ({
  text = "",
  delay = 30,
  className = "",
  animateBy = "words",
  direction = "bottom",
  onAnimationComplete,
}) => {
  const elements = useMemo(() => {
    return animateBy === "words" ? text.split(" ") : text.split("");
  }, [text, animateBy]);

  // Honor prefers-reduced-motion
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fromSnapshot = prefersReduced
    ? { opacity: 0 }
    : { filter: "blur(8px)", opacity: 0, y: direction === "top" ? -12 : 12 };

  const toSnapshot = prefersReduced
    ? { opacity: 1 }
    : { filter: "blur(0px)", opacity: 1, y: 0 };

  return (
    <p className={`inline-flex flex-wrap ${className}`}>
      {elements.map((segment, index) => {
        const spanTransition: Transition = {
          duration: 0.22,
          delay: (index * delay) / 1000,
          ease: [0.22, 1, 0.36, 1], // Sub-Frame Law easing
        };

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={toSnapshot}
            transition={spanTransition}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
            style={{ display: "inline-block", willChange: "transform, opacity" }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
};

export default BlurText;
