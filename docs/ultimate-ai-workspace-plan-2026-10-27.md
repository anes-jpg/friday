# The Ultimate FRIDAY Workspace — blueprint and daily drivable expansion

Date: 27 October 2026. Grounded in the docs folder: [FRIDAY_PROJECT_AUDIT_2026-10-26.md](FRIDAY_PROJECT_AUDIT_2026-10-26.md), [overnight-2026-10-26.md](overnight-2026-10-26.md), [ui-refinement-2026-10-25.md](ui-refinement-2026-10-25.md), and ADRs 002/004/011/012/013/014. The governing constraints stay [AGENTS.md](../AGENTS.md) (Surface Law, One-Signal Law, Sub-Frame Law, latency budgets) and the audit's central thesis: trustworthy integration beats new cinematic features.

## 1. What "the ultimate AI workspace" means here

The audit's strongest, daily-usable foundation is the **project/workspace model + run system**: SQLite projects/threads/tasks/notes, run-scoped approvals, inverse receipts, TanStack Query/Form/Table choreography (ADR 012), bounded native inspection commands, and the voice contract. The ultimate workspace is the surface where those already-real capabilities meet every day — not a second, fake execution system built beside them.

**One-line promise (audit §3, adopted):** a Windows assistant that helps me work through my projects by voice, remembers the context I choose, performs reviewed actions, and shows exactly what changed.

### 2. The four rooms of the workspace

All four live inside the existing shell (ProjectWorkspace + console surfaces, Atmospheric Halftone OS identity, 56 px rail / 40 px header chrome from ui-refinement):

1. **Focus room (default landing).** Today + one selected project. The brief, the single divided context inspector (ADR 012/ui-refinement), overdue work, and the three queues that make it "ultimate": *overdue items, recently verified actions (from run receipts), interrupted work awaiting reconciliation.* Nothing decorative on this screen; violet appears only on active state changes (One-Signal Law).
2. **Turn room.** The Utterance Contract (Heard → Plan → Doing → Result) pinned at the top of every spoken turn. Plan risk dots are wired to the real approval tier of the target command, not copied default colors. Every Result for a mutating action carries its receipt: what changed, which inverse exists, where the evidence row lives (audit §8 trust invariant).
3. **Forge room.** The bounded coding workflow from Phase D: inspect the open project (`find_symbols` / `rrf_search` / `review_diff`), stage a proposed edit behind an Amber preview, run a reviewed build/test command, show the real diff and the real exit code. One complete loop proven end-to-end before any second skill.
4. **Recovery room.** The reconciliation/failure surface from audit Phase B: interrupted runs, storage-save failures awaiting retry (F04), stale capability states ("why can't FRIDAY do that right now"), and undo-conflict cases. Trust is built hardest here — the room that honestly says what did not happen.

### 3. Standing invariants for every room

- Every mutation passes the native plan-bound approval + receipt boundary; direct desktop commands are refactored behind it (F03), never kept as a parallel path.
- Every displayed status is measured, unknown, or explicitly labeled demonstration (F12/F13/F17 rule: no invented telemetry, no estimated values posing as measurements).
- Speech, provider and tool failures record `Failed` — never surface as completed turns (F05).
- Bounded places/cameras/maps keep attribution, missing-data states and bounded caches (ADR 012/013); sample telemetry (F01) never feeds executables.
- No new dependencies without an ADR; components from shadcn/Watermelon MCP discovery first inspect source before adoption (ADR 011).

## 4. The daily drivable expansion

A **daily slice** is a work unit sized so a single session can: implement it, gate it with fresh commands, record evidence in a dated note, and leave the tree committable. It maps the audit's Phase A→B→C order onto day-sized units. Each slice names its *drive* — the command or native journey that shows the day's work actually running (verification-before-assertion; test names stay honest per F15).

### Slice ladder (work in this order; do not skip a rung)

**A1 — Trust wiring (audit Phase A)**
- A1.1 Remove/label sample-telemetry executables: dossier termination either disabled against simulated PIDs or fully plan-bound with identity validation.
- A1.2 Workspace write-queue recovery (F04): a failed write keeps a visible retry affordance; later saves proceed. Drive: the isolated queue harness extended to the two-write recovery sequence.
- A1.3 Provider-failure truthfulness (F05/F06): mid-stream disconnect ⇒ `Failed` run, zero executable tool calls from truncated buffers. Drive: fixture server disconnect test in the native suite.
- A1.4 Cache scoping (F11): context/freshness key or explicit reusable-only scope. Drive: cross-project reuse regression test.

**B1 — Unified controlled execution (Phase B)**
- B1.1 Capabilities/readiness view: adapters declare real availability (wake word unavailable, partial ASR unavailable, UIA actuation unavailable) so the UI says why not, never fakes a yes.
- B1.2 Reconciliation view: startup shows unfinished runs and their uncertain side effects; user resolves instead of auto-replay.
- B1.3 Gateway authentication hardening (F02) before any remote feature grows.
- Drive: the temporary-file journey (create/edit/undo, changed-plan denial, restart recovery) passing manually in the debug exe.

**C1 — Daily voice/workspace experience (Phase C)**
- C1.1 Speech lifecycle: one canonical path, warm Piper assets, cancellation separated from the synthesis mutex (F10). Drive: measured audio-start/-stop at the output on the target microphone.
- C1.2 Today queues wired to real overdue work, verified actions and interrupted runs.
- C1.3 Latency corpus: cold/warm endpoint, tail and turn timings recorded with device/model context; publish p50/p95, keep estimates out.

**D1 — First proven operator skill (Phase D)**
- Forge-room loop end-to-end on one scratch repo: inspect → propose diff → Amber confirm → build/test → real exit code shown. Drive: scripted journey with recorded evidence.

### The daily rhythm

1. Pick the next rung slice (top-down; One-Signal scope: one signal per day).
2. Baseline checkpoint under `scratch/checkpoints/<date>-<time>-baseline/` before touching anything (overnight-log pattern).
3. Implement within slice scope only; no drive-by refactors of unrelated modules.
4. Gate: `pnpm check` + targeted tests for the slice; `cargo test --manifest-path src-tauri/Cargo.toml --lib` when Rust changed; record fresh output in the dated note; state open gaps explicitly.
5. Evidence note: `docs/<topic>-<date>.md` in the style of the overnight log — commands run, results, gaps. Slices never carry yesterday's unfinished scope forward silently; it becomes the next slice explicitly.

### Definition of "ultimate" reached (exit gates)

- The Focus room's three queues are populated from real persisted state, on restart.
- A full spoken project turn (request → plan → reviewed action → receipt → undo offer) completes ≤1.8 s p95 **as measured**, or the budget is honestly reported as unmet.
- Every workspace journey from audit §13's list has a pass or an explicit recorded gap — no journey left silently unverified.
- Clean-checkout build and first-run install verified on a clean Windows account (F14) before any distribution claims.

## 5. Explicitly out of scope until their gates open

Global telemetry layers beyond the map's sourced data, autonomous Legion delegation, remote companion authority, and live partial ASR announcements remain locked behind their audit gates. They are demonstrations until they are operations; the plan keeps the difference enforced, not just worded.
