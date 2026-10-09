import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cx = cn;

export const DUR = { fast: 0.12, base: 0.18, slow: 0.22 } as const;

export const EASE = [0.22, 1, 0.36, 1] as const;

export function ms(value: number): string {
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
}

export function ago(iso: string | number, now = Date.now()): string {
  const time = typeof iso === "number" ? iso : new Date(iso).getTime();
  const delta = Math.max(0, now - time);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
