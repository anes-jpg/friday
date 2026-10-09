# ANTIGRAVITY DIRECTIVE — FRIDAY UI OVERHAUL

Implement the attached `DESIGN.md` against the current FRIDAY repository. This is an execution task, not a request for another moodboard, design proposal, or generic audit.

## Authority and source order

1. Actual repository behavior and working product contracts.
2. `DESIGN.md` for visual, interaction, state, and accessibility decisions.
3. The three supplied reference images for atmosphere only—not literal cloning.
4. Existing reusable components and the `ultimate-frontend` bundle.

Preserve working application behavior. Coordinate with the recovery work; do not hide backend failures behind mock UI.

## Required operating method

1. Inspect the running UI at fixed sizes and capture baseline screenshots.
2. Create a route/surface checklist covering bar, console, every tab, onboarding, palette, dialogs, inspectors, loading, empty, error, offline, confirmation, and speaking/listening states.
3. Work in the exact implementation order in `DESIGN.md`.
4. Finish and verify one slice before moving to the next. A slice includes normal, hover, focus, disabled, loading, empty, error, offline, and reduced-motion behavior.
5. Reuse real components. Search the installed `ultimate-frontend` bundle before hand-writing standard UI. Read candidate source before copying it and normalize imports/tokens.
6. Use shadcn for structure/primitives, existing Tremor wrappers for data instruments, and at most the static Magic UI texture/edge effects named in `DESIGN.md`.
7. Do not paste an entire template or import a second design system. Adapt pieces to FRIDAY's state and semantic tokens.
8. Keep one canonical navigation, card anatomy, status tracker, modal/sheet behavior, and effect implementation.
9. Never use fake backend data to make screenshots look complete. Build deterministic visual fixtures or Storybook/dev-only states that cannot leak into production.
10. Do not stop after changing colors. This overhaul includes information hierarchy, density, states, keyboard behavior, motion, error recovery, and perceived latency.

## Visual target

Build **Atmospheric Halftone OS**:

- a desaturated atmospheric field outside the app shell;
- a black 64px instrument rail;
- a calm bone/graphite content canvas;
- cropped static halftone transitions and segmented meters;
- one violet signal color for active intelligence;
- editorial hierarchy for conversation;
- monospace instrumentation for metrics, state, risk, and latency;
- precise rounded geometry without glassmorphism or card soup.

The interface must still look intentional with images and animation disabled.

## Component choices already approved

- shadcn sidebar primitive / sidebar-07 interaction model → adapt into FRIDAY's icon rail;
- existing shadcn dialogs, sheets, command, inputs, tooltip, scroll area, and Sonner → retokenize, preserve ARIA behavior;
- existing Tremor wrappers plus bundled KPI/status tracker composition → data and tool lifecycle only, fully retokenized;
- Magic UI `DotPattern` → static, masked, `glow={false}`;
- Magic UI `ProgressiveBlur` → only for scroll affordance after performance measurement; otherwise use a gradient fade;
- existing `sky-pixel.jpg` → only as an optimized atmospheric layer after verifying contrast and asset weight.

Do not introduce Dock magnification, animated particle fields, aurora text, border beams, shimmer buttons, meteors, or continuously animated decorative grids.

## Hard quality gates

- input acknowledgement under 100 ms;
- loader delayed until approximately 250 ms;
- no indefinite state without timeout/recovery;
- body-text contrast meets WCAG AA;
- all icon controls have names, tooltips, focus states, and at least 36px hit areas;
- reduced motion implemented, not merely documented;
- no full-window continuously animated canvas;
- voice visualizer pauses when hidden and is capped at 30 fps;
- no raw color values in feature components after token migration;
- no new duplicate primitives or effect implementations;
- no `any`, ignored TypeScript errors, disabled lint rules, or snapshot updates used to conceal regressions.

## Verification loop for every slice

1. Run typecheck/lint/tests relevant to the changed files.
2. Launch the Tauri app or supported development shell.
3. Capture screenshots at 1280×720 and 1440×900; also inspect 150% Windows scaling when available.
4. Exercise keyboard-only navigation.
5. Exercise reduced motion.
6. Exercise loading, empty, error, offline, and cancellation fixtures.
7. Compare with the preceding slice for regressions.
8. Commit the coherent slice if Git is available.

## Final required evidence

Return:

1. a short description of the completed visual system;
2. before/after images for the bar, Chat, one data-heavy tab, Settings, onboarding, and command palette;
3. a surface checklist with normal/loading/empty/error/offline/reduced-motion results;
4. exact verification commands and pass totals;
5. performance measurements for window open, navigation response, and voice visualizer;
6. component provenance: existing project, shadcn, Tremor, Magic UI, coss/Origin, or hand-written—with a one-line reason for each hand-written component;
7. remaining externally blocked items only.

Do not return a plan. Do not call the overhaul finished after a shell mockup. Implement it inch by inch until every acceptance item in `DESIGN.md` is satisfied.

## Embedded code is the starting implementation

`DESIGN.md` now contains an **Embedded implementation kit** with adapted, repository-targeted source for the theme, atmospheric field, rail, segmented tracker, metric instrument, tool lifecycle card, voice state model, voice bar, composer, palette, empty state, and console shell.

Use that code before searching for alternatives. It was extracted and adapted from the named shadcn, Tremor, Magic UI, and coss sources in the user's `ultimate-frontend` bundle. Normalize imports to the repository's current aliases and package versions, but do not casually redesign the APIs or substitute generic generated components.

For each embedded component:

1. inspect the existing target file and preserve real behavior;
2. merge rather than blindly overwrite;
3. connect real routes, store state, IPC, and actions;
4. run typecheck immediately;
5. render the state matrix;
6. screenshot and visually inspect it before continuing.

If embedded code conflicts with the repository, fix the integration at the boundary. Do not discard the component and fall back to generic cards without documenting the exact incompatibility.
