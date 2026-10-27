# Overnight candidate — 26 October 2026

Times use Africa/Lagos (UTC+1). Feature freeze: 06:00. Integration,
regression fixes, verification and packaging only from 06:00 to 07:00.

## Recovery

- Started at 00:30. Existing dirty tree is preserved.
- Baseline checkpoint: `scratch/checkpoints/2026-10-26-0035-baseline/`.
  Contains a binary tracked patch and copies of every changed/untracked file.
- Do not reset, clean, stash, or overwrite existing improvements.

## Ordered work

1. Native workspace migration; run ownership, captured context, durable events,
   single-use approvals, cancellation, truthful persisted undo.
2. Today, editable project presets, continued conversations, search and cited context;
   reviewed reminder schedules and history.
3. Native bounded place adapters and caches; comparison, collections and errands.
4. Whistle discovery/readiness, bounded transcription queue and measured endpointing.
5. Health, measured monitoring, camera cleanup, CSP and unsigned Windows candidate.
6. Fresh acceptance checks and 30-minute native soak; explicit gaps at handoff.

## Baseline findings

- AgentCore is the current turn executor, but writes to whichever thread is active
  at response time. Plans and undo are held only in memory; undo is simulated.
- Browser workspace and saved places use localStorage. SQLite currently holds
  conversations, automations, settings, facts and audit rows.
- Installed frontend includes TanStack Query, Form and Table v9, shadcn and
  Watermelon primitives. Preserve existing map depth/photos and shell identity.
- Frontend baseline test startup was blocked by filesystem sandbox access; rerun
  requested with the required escalation. Rust baseline tests started.

## Evidence and gaps

No acceptance claim yet. Record fresh commands, outputs, native journey results,
latency/resource measurements and artifact paths here as work progresses.

### 00:55 milestone

- Native workspace import archives original browser payloads, imports transactionally
  and refuses corrupt/orphan records. Existing SQLite files receive a recoverable
  pre-workspace backup before schema extension.
- AgentCore captures request/thread/project/provider context. Native tool calls
  record planned arguments and outcomes. SQLite approvals are plan-bound and
  single-use; cancelled and changed plans are rejected before execution.
- File writes receive Amber previews. File write/move inverse receipts are
  persisted before execution; restoration checks exact bytes and occupied paths.
  Simulated batch rename and simulated undo were removed.
- Work adds Today, editable blank/personal/research/errand/development presets,
  continued project conversations, run history and selected cited note context.
- Fresh checks: 138 frontend tests pass, 110 native tests pass, TypeScript passes.
  These are automated checks, not yet evidence of native UI journeys or microphone
  accuracy. Full acceptance and packaging remain outstanding.
- Remaining integration work: expiry timer, execution error status, cancellation
  coverage, workspace search/collections, schedule timezone/history, native place
  adapters, Whistle worker/readiness, health/CSP, camera validation and release.

### 01:12 recovery milestone

- Resume checkpoint: `scratch/checkpoints/2026-10-26-0115-resume/`.
- Fresh frontend run: 138/138 pass; TypeScript passes. Native baseline: 112/113
  pass; code sandbox expectation needs updating for interactive approval behavior.
- Reminder timezone/history and native place cache modules were present but had
  not yet been connected throughout the UI. ADR 014 covers chrono/chrono-tz.
- Whistle now has 20 ms frames, bounded capture/recognition queues, 220 ms
  endpoint target, actual level/timing events, native readiness and startup timeout,
  crash handling and generation-based late-event suppression. Native cargo check
  passes. Python 3.12 has needle, sounddevice, numpy installed; real recognition
  and capture evidence still pending. Partial ASR is explicitly unavailable.
- No new dependencies. Provider credentials remain in Credential Manager.
- User is asleep; use approved permissions and record external/environment blocks.
