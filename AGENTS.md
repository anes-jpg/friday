# AGENTS.md — Constitution for FRIDAY

You are building **FRIDAY**, an intelligent, voice-first desktop operator for Windows.
This document is non-negotiable. Every change must adhere to these laws and quality gates.

---

## 1. The Three Design Laws

1. **Surface Law**:
   - Every panel is a rounded rectangle on an 8px grid (radius 16px for containers, 8px for controls).
   - Surfaces sit on Mica (Win11) or acrylic (Win10) / dark plates.
   - No gradients except the 40px reactive Orb.
   - Ambient glow: Use subtle drop shadows `0 20px 40px -15px rgba(0,0,0,0.6)` on prominent dashboard cards.

2. **One-Signal Law**:
   - Preserve the existing violet accent — `--color-acid: oklch(68.5% 0.205 285.5)` — and the Atmospheric Halftone OS design in `DESIGN.md`. Do not introduce green activity styling or redesign working UI without an explicit request.
   - It only ever signifies that **FRIDAY is actively doing something**: listening, thinking, streaming, or an active state change.
   - Never use `--color-acid` for decorative branding or static chrome.

3. **Sub-Frame Law**:
   - Every transition is 120–220ms, transform and opacity only, using `cubic-bezier(0.22, 1, 0.36, 1)`.
   - Any animation that cannot maintain 60 fps is deleted, not optimized.
   - `prefers-reduced-motion` collapses transitions to instant or opacity-only fades.

---

## 2. The Voice-First Operating Rules

- **Voice First**: The Dashboard must show the Utterance Contract on every spoken turn:
  1. `Heard` — Live ASR transcript, editable inline.
  2. `Plan` — Step-by-step plain language with risk color dots.
  3. `Doing` — Active step with elapsed time.
  4. `Result` — Clear change summary with undo affordance for reversible actions.
- **Two-Channel Output**:
  - `say`: Spoken prose, maximum 2 sentences, no URLs, no paths, no markdown.
  - `show`: Code blocks, diffs, tables, markdown rendered on screen.
- **Confirmation Tiers**:
  - `Green`: Silent execution, past-tense spoken narration.
  - `Amber`: Preview card, 1-sentence spoken confirmation, "go ahead" / 8s timeout.
  - `Red`: Full diff/details preview, requires explicit spoken/typed "confirm".

---

## 3. Strict Latency Budgets

- Non-verbal acknowledgement: **≤ 150 ms**
- Endpoint decision: **≤ 280 ms**
- Recognition tail after speech stops: **≤ 250 ms**
- Intent router (bge-small kNN / rules): **≤ 15 ms**
- Perceived end-to-end voice turn: **≤ 1.8 s p95** (stretch 1.3 s)
- Barge-in stop time: **≤ 200 ms**

---

## 4. Banned Practices

- ❌ No new dependencies without an ADR (Architecture Decision Record).
- ❌ No `unwrap()` in Rust code outside `#[cfg(test)]`. Use `?` or explicit error handling.
- ❌ No `any` in TypeScript.
- ❌ No inline styles (`style={{ ... }}`) — use Tailwind tokens and utility classes.
- FRIDAY supports configurable OpenAI-compatible model endpoints and model names, including local and remote providers. Do not restrict it to GLM. Speech remains local.
- ❌ The 2D Canvas Orb must burn 0% CPU in Idle state (never spin `requestAnimationFrame` when idle).
