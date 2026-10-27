import React, { useId, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useVelocity,
  AnimatePresence,
} from "motion/react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

/**
 * ============================================================================
 * PART 1: DATA NORMALIZERS & BUG-FIX HELPERS
 * ============================================================================
 */
export interface NormalizedAuditRow {
  id: string;
  formattedTime: string;
  toolName: string;
  tier: "Green" | "Amber" | "Red";
  argsHash: string;
  decision: string;
  durationMs: number | null;
}

export function formatAuditTimestamp(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  let date: Date;

  if (typeof raw === "number") {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    date = new Date(ms);
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e12 ? num * 1000 : num;
      date = new Date(ms);
    } else {
      const normalizedIso =
        trimmed.includes(" ") && !trimmed.includes("T")
          ? trimmed.replace(" ", "T") + (trimmed.endsWith("Z") ? "" : "Z")
          : trimmed;
      date = new Date(normalizedIso);
    }
  } else {
    return "—";
  }

  if (isNaN(date.getTime())) return String(raw);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function normalizeAuditEntry(
  source: object,
  index: number
): NormalizedAuditRow {
  const entry = source as Record<string, unknown>;
  const rawTime =
    entry.created_at ??
    entry.timestamp ??
    entry.time ??
    entry.createdAt ??
    null;

  const rawTool =
    entry.tool_name ??
    entry.action_tool ??
    entry.action ??
    entry.tool ??
    entry.name ??
    "system.op";

  const rawHash =
    entry.args_hash ??
    entry.parameters_hash ??
    entry.params_hash ??
    entry.hash ??
    "—";

  const rawTier = String(
    entry.tier ?? entry.risk_tier ?? entry.riskTier ?? "Green"
  ).toLowerCase();

  const tier: "Green" | "Amber" | "Red" = rawTier.includes("red")
    ? "Red"
    : rawTier.includes("amber") || rawTier.includes("yellow")
    ? "Amber"
    : "Green";

  const rawDecision = String(
    entry.decision ?? entry.outcome ?? entry.status ?? "AUTO"
  ).toUpperCase();

  const durationMs =
    typeof entry.duration_ms === "number"
      ? entry.duration_ms
      : typeof entry.latency_ms === "number"
      ? entry.latency_ms
      : null;

  return {
    id: String(entry.id ?? `audit-${index}`),
    formattedTime: formatAuditTimestamp(rawTime),
    toolName: String(rawTool),
    tier,
    argsHash:
      String(rawHash).length > 16
        ? `${String(rawHash).slice(0, 8)}…${String(rawHash).slice(-6)}`
        : String(rawHash),
    decision: rawDecision,
    durationMs,
  };
}

export function InlineMarkdownText({
  text,
  className = "",
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) return null;
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
          return (
            <strong key={i} className="font-semibold text-zinc-100">
              {seg.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={i}>{seg}</React.Fragment>;
      })}
    </span>
  );
}

/**
 * ============================================================================
 * PART 2: WATERMELON UI STRUCTURAL PRIMITIVES (ui.watermelon.sh)
 * ============================================================================
 */

/**
 * WATERMELON PRIMITIVE 1: WatermelonBentoCard
 * Interactive surface card with cursor-tracking subtle border spotlight,
 * inner top-edge specular highlight, and optional header badge.
 * Used for Primary Engine Directive (ProjectsTab), AI Reasoning Engine
 * (SettingsTab), and JSON workbenches (DelphiTab).
 */
export function WatermelonBentoCard({
  children,
  className = "",
  spotlightColor = "rgba(139, 92, 246, 0.12)",
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative rounded-2xl watermelon-surface overflow-hidden transition-colors duration-200 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(480px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 45%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * WATERMELON PRIMITIVE 2: WatermelonSegmentedTabs
 * Sliding shared-layout (`layoutId`) pill tab bar from Watermelon UI.
 * Used for the 5 sub-tabs in ProjectsTab (`Roadmap & Tasks`, `Code Studio & Files`,
 * `Terminal & Scripts`, `Git & Diff Review`, `Project Settings`), DelphiTab
 * (`JSON`, `Regex`, `JWT & UUID`, `Diff`), and AutomationsTab (`Split`, `Calendar`, `Jobs`).
 */
export interface WatermelonTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export function WatermelonSegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  value,
  onChange,
  variant = "pill",
}: {
  tabs: WatermelonTabItem<T>[];
  activeTab?: T;
  value?: T;
  onChange: (next: T) => void;
  variant?: "pill" | "light";
}) {
  const layoutGroupId = useId();
  const currentTab = (activeTab ?? value) as T;

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800/80 select-none">
      {tabs.map((tab) => {
        const isActive = tab.id === currentTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer ${
              isActive
                ? variant === "light"
                  ? "text-zinc-950 font-semibold"
                  : "text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={`watermelon-tab-${layoutGroupId}`}
                transition={{ type: "spring", stiffness: 440, damping: 32 }}
                className={`absolute inset-0 rounded-lg ${
                  variant === "light"
                    ? "bg-zinc-100 shadow-sm"
                    : "bg-zinc-800/95 border border-zinc-700/70 shadow-sm"
                }`}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-950/60 text-zinc-300 tabular-telemetry">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * WATERMELON PRIMITIVE 3: WatermelonKpiCard
 * Telemetry metric card with tabular figures and status badge.
 * Used for AutomationsTab (`ACTIVE JOBS`, `EXECUTED (24H)`, `FAILURE RATE`).
 */
export function WatermelonKpiCard({
  label,
  value,
  badgeText,
  badgeTone = "zinc",
}: {
  label: string;
  value: string | number;
  badgeText?: string;
  badgeTone?: "violet" | "emerald" | "zinc" | "amber";
}) {
  const toneClass =
    badgeTone === "emerald"
      ? "text-[hsl(var(--success))]"
      : badgeTone === "amber"
      ? "text-amber-400"
      : badgeTone === "zinc"
      ? "text-zinc-400"
      : "text-[hsl(var(--ink))]";

  return (
    <WatermelonBentoCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {badgeText && (
          <span className={`text-xs font-mono tabular-telemetry ${toneClass}`}>
            {badgeText}
          </span>
        )}
      </div>
      <div className="text-3xl font-semibold tracking-tight text-zinc-100 tabular-telemetry">
        {value}
      </div>
    </WatermelonBentoCard>
  );
}

/**
 * WATERMELON PRIMITIVE 4: WatermelonCollapsibleDrawer
 * Smooth spring-height expandable drawer for `Projects on Your Desktop (11)`
 * and ChatTab Native Tool Execution cards (`fs.read`, `compute.aggregate`).
 */
export function WatermelonCollapsibleDrawer({
  header,
  defaultOpen = false,
  children,
  className = "",
}: {
  header: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl watermelon-surface overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">{header}</div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="ml-3 text-zinc-400"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="overflow-hidden border-t border-zinc-800/70"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * WATERMELON PRIMITIVE 5: WatermelonStatusBadge
 * Crisp uppercase hardware status pill (`RUST WORKER`, `SQLCIPHER • APPEND-ONLY`,
 * `CREDENTIAL VAULT`, `SDK EXTENSIONS`).
 */
export function WatermelonStatusBadge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "violet" | "emerald" | "amber" | "rose" | "zinc";
}) {
  const styles =
    tone === "emerald"
      ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30"
      : tone === "amber"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : tone === "rose"
      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
      : tone === "zinc"
      ? "bg-zinc-800/80 text-zinc-300 border-zinc-700/70"
      : "bg-[hsl(var(--surface-raised))] text-[hsl(var(--ink))] border-[hsl(var(--line))]";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border tabular-telemetry ${styles}`}
    >
      {children}
    </span>
  );
}

/**
 * ============================================================================
 * PART 3: BENCHO TACTILE MICRO-INTERACTION BLOCKS (bencho.dev)
 * ============================================================================
 */

export function LiquidToggle({
  checked,
  onChange,
  size = "sm",
  activeColor = "hsl(var(--ink))",
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "md";
  activeColor?: string;
  disabled?: boolean;
}) {
  const filterId = useId().replace(/:/g, "");
  const isSm = size === "sm";
  const trackW = isSm ? 44 : 56;
  const trackH = isSm ? 24 : 30;
  const thumbSize = isSm ? 18 : 22;
  const travelX = trackW - thumbSize - 6;

  return (
    <div className="inline-flex items-center select-none">
      <svg className="hidden" aria-hidden="true">
        <defs>
          <filter id={`bencho-goo-${filterId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <button
        type="button"
        role="switch"
        disabled={disabled}
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        style={{
          width: trackW,
          height: trackH,
          filter: `url(#bencho-goo-${filterId})`,
          backgroundColor: checked ? activeColor : "#27272a",
        }}
        className="relative rounded-full p-[3px] transition-colors duration-200 cursor-pointer disabled:opacity-50"
      >
        <motion.div
          animate={{
            x: checked ? travelX : 0,
            scaleX: [1, 1.34, 1],
            scaleY: [1, 0.84, 1],
          }}
          transition={{
            type: "spring",
            stiffness: 460,
            damping: 24,
          }}
          style={{ width: thumbSize, height: thumbSize }}
          className="rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}

export interface MagneticOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function MagneticSelect<T extends string = string>({
  options,
  value,
  onChange,
  accent = "white",
}: {
  options: (T | MagneticOption<T>)[];
  value: T;
  onChange: (next: T) => void;
  accent?: "violet" | "white" | "emerald";
}) {
  const normalized: MagneticOption<T>[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
  const selectedIndex = normalized.findIndex((o) => o.value === value);

  const activeStyles =
    accent === "white"
      ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
      : accent === "emerald"
      ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/50 shadow-sm"
      : "bg-[hsl(var(--ink))] text-[hsl(var(--canvas))] border-[hsl(var(--line))] shadow-sm";

  return (
    <div className="inline-flex flex-wrap items-center gap-2 select-none">
      {normalized.map((opt, idx) => {
        const isSelected = opt.value === value;
        const distance = idx - selectedIndex;
        const pushX =
          selectedIndex === -1 || isSelected
            ? 0
            : Math.sign(distance) * Math.max(0, 9 - Math.abs(distance) * 2.5);

        return (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            animate={{
              x: pushX,
              scaleX: isSelected ? 1.07 : 1,
              scaleY: isSelected ? 1.05 : 1,
            }}
            transition={{
              x: { type: "spring", stiffness: 380, damping: 22 },
              scaleX: { type: "spring", stiffness: 520, damping: 20 },
              scaleY: { type: "spring", stiffness: 340, damping: 24 },
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isSelected
                ? activeStyles
                : "bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function SloshSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  const rawValue = useMotionValue(value);
  const velocity = useVelocity(rawValue);
  const rotate = useTransform(velocity, [-800, 0, 800], [-4.5, 0, 4.5]);
  const springRotate = useSpring(rotate, { stiffness: 300, damping: 18 });

  const percentage = Math.min(
    100,
    Math.max(0, ((value - min) / (max - min || 1)) * 100)
  );

  return (
    <motion.div
      style={{ rotate: springRotate }}
      className="w-full p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 select-none"
    >
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span className="text-sm font-mono font-semibold tabular-nums text-zinc-100">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative h-7 rounded-lg bg-zinc-950 border border-zinc-800/70 overflow-hidden flex items-center">
        <motion.div
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          className="h-full bg-[hsl(var(--ink))] rounded-lg"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            rawValue.set(next);
            onChange(next);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>
    </motion.div>
  );
}

export function SlideConfirm({
  label = "Slide to authorize execution",
  confirmedLabel = "Authorized",
  onConfirm,
}: {
  label?: string;
  confirmedLabel?: string;
  onConfirm?: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const trackWidth = 268;
  const thumbSize = 40;
  const maxDrag = trackWidth - thumbSize - 8;

  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 420, damping: 32 });
  const labelOpacity = useTransform(springX, [0, maxDrag * 0.65], [1, 0]);
  const fillWidth = useTransform(springX, (v) => v + thumbSize + 4);

  const handleDragEnd = () => {
    if (x.get() >= maxDrag * 0.88) {
      x.set(maxDrag);
      setConfirmed(true);
      onConfirm?.();
    } else {
      x.set(0);
    }
  };

  return (
    <div
      style={{ width: trackWidth, height: 48 }}
      className="relative flex items-center rounded-full bg-zinc-950 p-1 border border-amber-500/40 select-none overflow-hidden"
    >
      <motion.div
        style={{ width: fillWidth }}
        className="absolute left-1 top-1 bottom-1 rounded-full bg-[hsl(var(--success))]/20 pointer-events-none"
      />
      <motion.span
        style={{ opacity: confirmed ? 0 : labelOpacity }}
        className="w-full text-center text-xs font-medium text-amber-200/90 pointer-events-none pl-6"
      >
        {label}
      </motion.span>
      {confirmed && (
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[hsl(var(--success))] pointer-events-none"
        >
          {confirmedLabel}
        </motion.span>
      )}
      <motion.div
        drag={confirmed ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.04}
        onDragEnd={handleDragEnd}
        style={{ x: springX, width: thumbSize, height: thumbSize }}
        whileTap={{ scale: 0.95 }}
        className="relative z-10 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-950 shadow-md cursor-grab active:cursor-grabbing"
      >
        {confirmed ? (
          <Check className="w-4 h-4 text-[hsl(var(--success))]" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
      </motion.div>
    </div>
  );
}

export function ProgressTicks({
  segments = 24,
  completed = true,
}: {
  segments?: number;
  completed?: boolean;
}) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))`, gap: "0.25rem" }}
      className="my-2.5"
    >
      {Array.from({ length: segments }).map((_, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0.2, scaleY: 0.6 }}
          animate={{
            opacity: completed ? 1 : [0.3, 1, 0.3],
            scaleY: 1,
          }}
          transition={{
            delay: idx * 0.012,
            type: "spring",
            stiffness: 420,
            damping: 26,
          }}
          className="h-2 rounded-[2px] bg-[hsl(var(--ink))]"
        />
      ))}
    </div>
  );
}

export function AnimatedTaskRow({
  id,
  text,
  done,
  onToggle,
}: {
  id: string;
  text: string;
  done: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/70 text-left transition-colors cursor-pointer"
    >
      <motion.div
        animate={{
          scale: done ? [1, 1.22, 1] : 1,
          backgroundColor: done ? "hsl(var(--ink))" : "transparent",
          borderColor: done ? "hsl(var(--ink))" : "#52525b",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className="w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0"
      >
        <AnimatePresence>
          {done && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Check className="w-3 h-3 text-white stroke-[3]" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <span
        className={`relative text-xs font-medium transition-colors ${
          done ? "text-zinc-500" : "text-zinc-200"
        }`}
      >
        <InlineMarkdownText text={text} />
        <motion.span
          initial={false}
          animate={{ width: done ? "100%" : "0%" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute left-0 top-1/2 h-[1.5px] bg-zinc-500 -translate-y-1/2"
        />
      </span>
    </motion.button>
  );
}
