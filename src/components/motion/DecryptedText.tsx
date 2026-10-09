import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, type HTMLMotionProps } from "motion/react";

interface DecryptedTextProps extends HTMLMotionProps<"span"> {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover" | "inViewHover" | "mount";
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 8,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#$%",
  className = "",
  parentClassName = "",
  encryptedClassName = "text-[var(--color-acid)]/70",
  animateOn = "mount",
  ...props
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);

  const containerRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableChars = useMemo<string[]>(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(""))).filter((c) => c !== " ")
      : characters.split("");
  }, [useOriginalCharsOnly, text, characters]);

  const shuffleText = useCallback(
    (originalText: string, currentRevealed: Set<number>) => {
      return originalText
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (currentRevealed.has(i)) return originalText[i];
          return availableChars[Math.floor(Math.random() * availableChars.length)] || char;
        })
        .join("");
    },
    [availableChars]
  );

  const triggerDecrypt = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsAnimating(true);
    setRevealedIndices(new Set());

    let iteration = 0;
    const len = text.length;

    intervalRef.current = setInterval(() => {
      setRevealedIndices((prev) => {
        iteration++;
        const next = new Set(prev);
        const revealCount = Math.min(len, Math.ceil((iteration / maxIterations) * len));

        for (let i = 0; i < revealCount; i++) {
          next.add(i);
        }

        setDisplayText(shuffleText(text, next));

        if (next.size >= len || iteration >= maxIterations) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsAnimating(false);
          setIsDecrypted(true);
          setDisplayText(text);
        }

        return next;
      });
    }, speed);
  }, [text, maxIterations, speed, shuffleText]);

  useEffect(() => {
    if (animateOn === "mount") {
      triggerDecrypt();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animateOn, triggerDecrypt]);

  return (
    <motion.span
      ref={containerRef}
      className={`inline-block font-mono ${parentClassName}`}
      onMouseEnter={animateOn === "hover" ? triggerDecrypt : undefined}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {displayText.split("").map((char, index) => {
          const isRevealed = revealedIndices.has(index) || isDecrypted || !isAnimating;
          return (
            <span
              key={index}
              className={isRevealed ? className : encryptedClassName}
            >
              {char}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
};

export default DecryptedText;
