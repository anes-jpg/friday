# Workspace experience — 29 October 2026

Implemented in priority order:

1. F11 fullscreen boot: a staged ASCII glyph field, terrain core, and workspace gates. The overlay ignores pointer input, ends after 800 ms, and disappears immediately with reduced motion.
2. Memory: a static SVG constellation grouped by memory tier, with keyboard selection, zoom, pagination, and a list fallback. Connections are exact shared subjects or source-message IDs; manually entered records are not connected just because they share `user-direct` as a source. Selecting a record moves to its graph page.
3. Analytics: saved task snapshot, project workload, overdue tasks, and 7/30-day run counts, completion rate, and median elapsed duration. Run history is restricted to the latest 200 backend records and explicitly labels this limit. Tasks lack completion timestamps, so task counts are labeled as current snapshots rather than historical trends.
4. Universal palette: all workspace routes, projects, task/note bodies, captures, routines, saved places, conversations, memory text, skills, and automations. The latest six executed commands are persisted as IDs, and stale IDs are ignored.
5. Telemetry/history: native hardware readings, rolling voice p95 readings, run outcomes, project filtering, JSON export, existing run event details, cancel, and receipt-backed undo.
6. Core motion: listening/thinking/speaking contours with one 180 ms acknowledgement per state change. No new idle animation loops.

## Reference adaptations

The provided screenshots identify [ASCII Reveal](https://github.com/quanhoangindex/ascii-reveal) and [Flood](https://flood.md). Their README and agent entry point were read. The implementation adapts ASCII Reveal's stable-layout glyph layering and reduced-motion fallback, and Flood's calm neutral surfaces and native semantics. It uses FRIDAY's existing shadcn command/dialog and Tremor instruments rather than installing another design system. This preserves the host fonts and tokens, avoids additional dependencies, and keeps transitions limited to opacity/transform at 120–220 ms. The upstream ASCII Reveal canvas redraws at about 30 fps; FRIDAY's boot uses static glyphs and CSS compositing instead.

## Verification

Focused tests cover terminal versus active run status, empty completion rates, calendar boundaries, median duration, overdue task counts, explainable memory links, and selected graph records beyond the first page. `pnpm check` passed; the full `pnpm exec vitest run` suite passed 157 tests across 18 files. The Vite dev server returned HTTP 200. Production builds passed with existing chunk-size and mixed static/dynamic import warnings. Native visual verification was attempted, but Computer Use stopped because it could not confidently identify the current Chrome URL; the embedded browser host was unavailable. Native hardware readings and interactive visual layout therefore remain unverified in this session.
