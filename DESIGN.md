# FRIDAY Interface System — Atmospheric Halftone OS

**Status:** implementation specification  
**Scope:** FRIDAY desktop bar, console, onboarding, command palette, settings, telemetry, tools, memory, and system states  
**Design intent:** a precise monochrome operating surface suspended over a quiet atmospheric world—half editorial halftone, half compact instrument panel, never a generic AI dashboard.

---

## 1. Product feeling

FRIDAY should feel like a private instrument built into the operating system, not a website in a desktop wrapper.

The visual direction combines three ideas:

1. **Editorial clarity:** large quiet fields, disciplined typography, obvious reading order.
2. **Pixel instrumentation:** halftone textures, segmented meters, terse monospace labels, hard data.
3. **Atmospheric depth:** a desaturated sky/fog layer behind a crisp black shell, visible only where it creates calm and identity.

The result is **soft world / hard instrument**. Backgrounds may feel cinematic; controls must remain exact.

### What this is not

- not glassmorphism everywhere;
- not a purple-gradient AI SaaS dashboard;
- not cyberpunk neon;
- not dense borders around every object;
- not decorative animation on every component;
- not a collection of unrelated component-library demos;
- not a literal copy of any reference image.

---

## 2. Immutable design laws

1. **One shell, one rail, one canvas.** Navigation is a black vertical instrument rail. Content occupies a single continuous canvas.
2. **90% neutral, 10% signal.** Black, bone, fog, and graphite dominate. One violet signal color communicates active intelligence.
3. **Halftone is identity, not wallpaper.** Use it at edges, masks, empty states, and transitions—never behind dense text.
4. **Every surface has one dominant object.** Chat has the conversation, Memory has the map, Review has the diff, Settings has the current section.
5. **Type creates hierarchy before boxes do.** Prefer spacing and typography over nested cards.
6. **Cards are instruments.** A card must expose a state, decision, metric, or action. No decorative containers.
7. **Motion explains state.** Nothing floats, pulses, or shimmers without meaning.
8. **Voice is the hero interaction.** Listening, thinking, speaking, and interruption must be legible in under 100 ms.
9. **Errors stay in context.** Never replace an entire working surface with a generic error page.
10. **The UI must remain complete without the atmospheric image or animation.** Reduced motion, high contrast, and fallback rendering are first-class.

---

## 3. Visual tokens

All production components must consume semantic tokens from `src/styles/theme.css`. No raw palette values in feature components.

### 3.1 Color

| Token | Light value | Dark value | Use |
|---|---:|---:|---|
| `--canvas` | `#D8DEDD` | `#151716` | outer atmospheric field |
| `--surface` | `#F4F3EF` | `#1C1E1D` | primary workspace |
| `--surface-raised` | `#FCFBF7` | `#242625` | panels and overlays |
| `--ink` | `#0A0A0A` | `#F4F3EF` | primary text and black shell |
| `--muted` | `#6F7472` | `#A2A7A4` | secondary text |
| `--line` | `rgba(10,10,10,.14)` | `rgba(244,243,239,.14)` | structural separators |
| `--line-strong` | `rgba(10,10,10,.28)` | `rgba(244,243,239,.28)` | focused divisions |
| `--signal` | `#7657FF` | `#9B86FF` | active intelligence only |
| `--success` | `#2F8F63` | `#62C893` | confirmed completion |
| `--warning` | `#B77418` | `#E4A84D` | caution/confirmation |
| `--danger` | `#B63C3C` | `#F06A6A` | destructive/failure |

**Signal-color budget:** violet may occupy no more than roughly 8% of a screen. It is reserved for the voice core, current selection, primary focus, streaming caret, and live model state. Success/warning/danger appear only when semantically required.

### 3.2 Typography

Use the best locally packaged equivalents after inspecting the repository. Do not add a network font dependency.

- **Display/UI:** `Geist`, `Inter`, `Segoe UI Variable`, system sans.
- **Instrument/data:** `IBM Plex Mono`, `JetBrains Mono`, `Cascadia Mono`, monospace.
- **Editorial accent:** optional serif only for a single onboarding headline; never in console data UI.

| Role | Size / line | Weight | Tracking |
|---|---|---:|---:|
| Display | `40/44` | 540 | `-0.035em` |
| Page title | `24/29` | 600 | `-0.025em` |
| Section title | `15/20` | 600 | `-0.01em` |
| Body | `14/21` | 430 | `-0.005em` |
| UI label | `12/16` | 560 | `0` |
| Instrument label | `10/14` mono | 600 | `0.11em` |
| Metric | `26/29` mono | 500 | `-0.04em` |

Use sentence case for human-facing copy. Reserve uppercase for short instrument labels such as `LISTENING`, `MODEL`, `LATENCY`, and `RISK`.

### 3.3 Geometry

- Base spacing unit: `4px`.
- Standard gaps: `8`, `12`, `16`, `24`, `32`, `48`.
- Outer window inset: `12px` compact, `18px` normal.
- Rail width: `64px`; expanded rail, if needed: `224px`.
- Header height: `56px`.
- Control height: `36px`; compact control: `28px`; primary composer: `48px` minimum.
- Main shell radius: `22px`.
- Panel radius: `16px`.
- Control radius: `10px`.
- Pill radius is permitted only for state chips, avatar/status, and the voice bar.
- Borders: 1px. Never stack two visible borders at one seam.
- Shadows: one restrained shell shadow; internal surfaces use lines and contrast instead.

### 3.4 Texture

Use `src/assets/images/sky-pixel.jpg` as the atmospheric source only if it meets contrast/performance requirements after inspection.

Texture stack:

1. desaturated atmospheric image at `0.12–0.28` opacity;
2. static halftone/dither mask at an edge or corner;
3. subtle paper/noise layer at `0.015–0.03` opacity;
4. solid readable surface beneath all text.

Do not animate thousands of dots. Adapt Magic UI `DotPattern` as a static SVG (`glow={false}`), or pre-render dithered WebP/AVIF assets. Dynamic halftone may update only when the voice state changes and must be GPU-cheap.

---

## 4. Application shell

### 4.1 Window composition

The console is a rounded rectangular instrument floating inside the native window:

- outer field: atmospheric canvas;
- left: black rail, flush to shell edges;
- right: continuous content canvas;
- no separate boxed sidebar;
- titlebar drag region integrated into the top header;
- native minimize/close controls remain discoverable and keyboard accessible.

At widths below `920px`, the rail remains icon-only. At widths below `720px`, inspectors become sheets and secondary columns collapse. Never horizontally scale the UI.

### 4.2 Instrument rail

Adapt the **shadcn collapsible sidebar primitive / sidebar-07 interaction model**, but reduce it to a 64px icon rail and preserve FRIDAY's existing `Rail.tsx` routing.

Order:

1. FRIDAY mark / voice-core button;
2. Chat;
3. Browser;
4. Automations;
5. Memory;
6. Review;
7. Skills;
8. Audit;
9. Settings;
10. flexible spacer;
11. documentation/help;
12. system status;
13. profile/accent button.

Rules:

- active item: bone circular plate on black with black icon;
- hover: `rgba(255,255,255,.10)` plate, 160 ms;
- inactive icons: 70% white, 18–20px;
- tooltip appears after 450 ms and includes shortcut;
- status dot is semantic, not decorative;
- do not put text permanently beside icons in compact mode.

### 4.3 Page header

One header pattern for every console tab:

- left: eyebrow/instrument label + page title;
- center/remaining space: optional contextual breadcrumb or current target;
- right: one primary action, optional overflow, system state;
- bottom: one separator line aligned to the content grid.

No oversized dashboard title blocks.

---

## 5. Voice bar — the primary surface

The compact assistant bar must communicate the complete state without opening the console.

### Anatomy

`[voice core] [live transcript / response] [state + latency] [stop or submit]`

- height: `52px` idle, expands to maximum `132px` for transcript/confirmation;
- radius: `18px`;
- black surface with bone text;
- voice core: 28px field with violet center;
- transcript is the widest element;
- secondary metadata uses 10px monospace;
- destructive stop remains visible while listening, thinking, or speaking.

### State behavior

| State | Immediate visual response | Copy |
|---|---|---|
| idle | steady 1px ring | “Ask FRIDAY” |
| arming | ring closes in 120 ms | “Opening microphone…” |
| listening | amplitude contour + live partial transcript | “Listening” |
| endpointing | contour settles, transcript locks | “Got it” |
| thinking | segmented progress travels once, streamed tokens follow | “Thinking” |
| tool use | current tool and target, cancellable | “Checking Calendar” |
| confirmation | compact risk panel expands in place | “Confirm before I continue” |
| speaking | output RMS contour; stop always visible | “Speaking” |
| interrupted | immediate visual stop under 100 ms | “Stopped” |
| offline/error | contextual recovery action | “Model unavailable — open Settings” |

Do not use an indefinite spinner before 250 ms. Fast paths should transition directly.

---

## 6. Chat surface

Chat is a working transcript, not a messaging-app imitation.

### Layout

- content column: `minmax(560px, 760px)`;
- optional inspector column: `300–360px`;
- generous top and bottom breathing room;
- no bubbles for assistant prose;
- user turns may use a subtle bone/graphite block with a left index marker;
- assistant output is plain editorial text with clear tool/result inserts.

### Message anatomy

- 10px mono role/time line;
- readable response body;
- citations/actions immediately beneath relevant content;
- tool calls rendered as compact instrument cards;
- pending content shows a streaming caret, not a skeleton paragraph;
- long output receives a progressive edge fade only when scrollable.

### Composer

Adapt existing shadcn input/command behavior and `InputWithKbd.tsx`.

- fixed at canvas bottom with 16px breathing room;
- 48px minimum, expanding to 144px;
- voice button left, text area center, send/stop right;
- attachment/tools sit in a secondary row only when activated;
- focus ring uses signal violet plus a 2px outer contrast ring;
- `Enter` sends, `Shift+Enter` creates newline, `Esc` stops/collapses.

Empty state: one strong prompt, 3 contextual actions, and a cropped static halftone field. No marketing copy.

---

## 7. Tool calls, plans, and confirmations

Use the black budget-card reference as the conceptual model: **one clear title, one segmented status line, one consequence, one action**.

### Tool card

- black or graphite instrument panel inside light surfaces;
- header: tool icon, human-readable action, running state;
- body: target and essential parameters only;
- segmented tracker: queued → running → verifying → complete;
- expandable raw details are secondary;
- success collapses to one line after completion;
- failure stays expanded with retry or repair action.

Adapt **Tremor status tracker** logic, restyled to project tokens. Do not import Tremor's visual palette wholesale.

### Confirmation panel

- risk tier at top left;
- exact consequence in plain language;
- resource/target and reversibility;
- primary confirm and secondary cancel;
- destructive confirmation is never color-only;
- keyboard focus starts on the safe action.

---

## 8. Telemetry and system status

Telemetry should read like an instrument cluster, not an executive dashboard.

### KPI card

Adapt a compact **Tremor KPI card** composition and existing `KpiCard.tsx`/`MetricCard.tsx`:

- mono label;
- one large value;
- tiny delta or threshold;
- optional segmented meter;
- no gradient fill;
- no chart unless history changes the decision.

### Segmented meter

Use 20–32 square segments, 4–6px each. Filled segments use ink or signal; remaining segments use `--line`. Status thresholds add an icon/label, not just color.

### Audio spectrum

`AudioSpectrumVisualizer.tsx` should become a restrained 24–40 bar contour:

- monochrome in idle;
- signal violet while listening;
- bone on black while speaking;
- cap at 30 fps;
- pause when hidden;
- reduced motion uses a 3-level static RMS indicator.

---

## 9. Surface-by-surface specification

### Browser

- URL/target bar aligned with page header;
- snapshot occupies the dominant canvas;
- action history is a narrow timeline, not a second dashboard;
- selected DOM target uses one signal outline and numbered marker;
- errors appear beside the failed action with retry.

### Automations

- rows over cards for recurring jobs;
- left: state and name; middle: trigger/next run; right: last result and toggle;
- create automation opens a focused sheet;
- disabled items remain readable at 55–65% emphasis, not full opacity loss.

### Memory

- `MemoryGlobe.tsx` is the singular hero object, not one tile among many;
- facts appear as a searchable list/inspector beside it;
- selected relation uses violet; all other graph lines remain neutral;
- provide list-only fallback and reduced-motion mode;
- adding/deleting facts produces immediate local feedback and undo where real.

### Review

- diff is full-width and primary;
- file tree collapses into a 240px column;
- findings appear as anchored annotations;
- accepted/rejected hunks have shape/icon differences in addition to color;
- copy and apply actions stay in the sticky header.

### Beast / code search

- search field is the hero control;
- result rows show path, symbol, compact snippet, score only on demand;
- preview opens in an inspector rather than a modal;
- use monospace for code, sans for metadata.

### Delphi

- utility chooser uses a compact command list;
- input and output form a 40/60 split at wide sizes;
- copy result is always visible after success;
- validation errors appear next to the invalid field.

### Skills

- list rows with capability, origin, and permission summary;
- enabled state is explicit text plus switch;
- permission expansion is inline;
- no marketplace-style promotional cards.

### Audit

- chronological table/timeline hybrid;
- fixed columns for time, actor, action, resource, outcome;
- filter bar stays sticky;
- receipt detail opens in the inspector;
- risk events have icon + label, not a red wash.

### Settings

- left section index inside the content canvas, not a second black rail;
- forms have maximum width `640px`;
- save status is inline and persistent long enough to read;
- model connection tests show connecting/success/failure per row;
- secret fields never reveal stored values and never clear on unrelated updates;
- voice audition keeps a visible stop action.

### Onboarding

Onboarding uses the editorial sign-in reference:

- 42% instruction column, 58% atmospheric/halftone visual field;
- one decision per step;
- progress shown as small numbered instrument marks;
- voice preview is interactive but skippable;
- permission copy explains value before requesting access;
- final step demonstrates barge-in and stop, not just a static “ready” screen.

### Command palette

- centered at top third, `min(680px, calc(100vw - 32px))`;
- black search header, bone result canvas;
- sections: actions, navigation, recent, settings;
- result metadata and shortcut aligned right;
- opening/closing duration 160/120 ms;
- no scale-from-zero effect.

---

## 10. Component strategy

Use existing project components first, then adapt vetted bundle components. Do not introduce five visual systems.

| Need | Source | Adaptation |
|---|---|---|
| app rail/shell behavior | shadcn sidebar primitive / sidebar-07 | reduce to icon rail; wire real FRIDAY routes |
| base controls, dialogs, sheets, command | existing shadcn components | retokenize; preserve accessibility |
| KPI and status compositions | existing Tremor wrappers + bundled Tremor KPI/status tracker patterns | remove vendor palette; use semantic tokens |
| texture | Magic UI static `DotPattern` | no glow; masked/cropped; reduced density |
| long-scroll affordance | Magic UI `ProgressiveBlur` only if renderer performance is acceptable | use sparingly; fallback to gradient fade |
| terminal/code sequencing | existing/bundled Magic UI terminal ideas | disable theatrical typing for real logs |
| notification | existing Sonner | neutral styling; semantic icon and recovery action |
| special variants | coss/Origin only when existing primitives cannot express the interaction | copy exact source, normalize imports |

Any hand-written component must be justified by a FRIDAY-specific state or native-desktop constraint.

---

## 11. Motion system

### Timing

- press/hover: `100–160ms`;
- small state transition: `160–220ms`;
- panel enter/exit: `220–320ms`;
- onboarding scene: maximum `420ms`;
- loops: only live listening/speaking indicators.

### Easing

- enter: `cubic-bezier(.16,1,.3,1)`;
- exit: `cubic-bezier(.7,0,.84,0)`;
- state morph: `cubic-bezier(.65,0,.35,1)`.

### Rules

- animate opacity and transform; avoid animating layout dimensions when possible;
- never type-animate real assistant content;
- never animate a metric while the user is comparing it;
- barge-in visuals respond inside 100 ms;
- honor `prefers-reduced-motion` and application-level reduced motion;
- in reduced motion, replace transforms with 100–160 ms crossfades and static state icons.

---

## 12. Complete async-state contract

Every data surface must implement:

1. idle;
2. instant acknowledgement (<100 ms);
3. delayed loading (>250 ms);
4. partial/streaming;
5. success;
6. empty;
7. recoverable error;
8. offline/degraded;
9. permission denied;
10. cancelled.

Skeletons mirror actual geometry. Never show skeletons for actions that usually finish under 250 ms. Preserve usable cached content during refresh and display stale/degraded status inline.

---

## 13. Accessibility and desktop behavior

- WCAG AA contrast for all body text and controls;
- visible focus on every interactive element;
- 36px minimum pointer target, 44px for primary voice actions;
- all icon-only controls have accessible labels and tooltips;
- state is never conveyed by color alone;
- rail, palette, composer, confirmations, tabs, and dialogs are fully keyboard operable;
- screen readers receive polite updates for transcript partials and assertive updates only for blocking failures;
- native drag regions never overlap controls;
- text zoom to 200% must not clip essential actions;
- test at 1280×720, 1440×900, 1920×1080, and Windows scaling 125%/150%.

---

## 14. Performance budgets

- visible input feedback: under 100 ms;
- console interactive after window open: under 500 ms on target hardware;
- rail navigation response: one frame;
- animation frame budget: 16.7 ms; audio visualization may drop to 30 fps;
- no continuously animated full-window background;
- atmospheric assets: AVIF/WebP preferred, correctly sized, under 350 KB each;
- no blur radius above 24px on large moving surfaces;
- hidden tabs stop timers, observers, canvases, and audio visualizers;
- avoid duplicate `magic/` and `magicui/` implementations—select one canonical source after usage analysis.

---

## 15. File-by-file implementation map

### Foundation

- `src/styles/theme.css` — semantic tokens, type scale, focus ring, texture utilities, reduced-motion rules.
- `src/App.tsx` — correct shell per Tauri window label; global keyboard/drag behavior; no page-specific decoration.
- `src/components/layout/PillSidebar.tsx` — retire or adapt into the canonical 64px rail; do not keep two navigation systems.
- `src/surfaces/console/Rail.tsx` — route data, active/hover states, tooltips, system status.
- `src/surfaces/console/Console.tsx` — atmospheric field, rounded shell, header/drag region, content grid, inspector behavior.

### Core interaction

- `src/lib/store.ts` — expose explicit UI state for idle/listening/thinking/tool/confirmation/speaking/error; prevent boolean soup.
- `src/surfaces/console/ChatTab.tsx` — editorial transcript, state-complete composer, empty/stream/error behavior.
- `src/surfaces/console/ToolCallCard.tsx` — instrument-card lifecycle and segmented verification tracker.
- `src/surfaces/console/Inspector.tsx` — one reusable contextual side panel with responsive sheet fallback.
- `src/surfaces/console/DebugDrawer.tsx` — developer detail only; visually subordinate to user-facing status.
- `src/surfaces/palette/Palette.tsx` — command surface and keyboard behavior.

### Voice and telemetry

- `src/components/telemetry/AudioSpectrumVisualizer.tsx` — capped, state-aware contour and reduced-motion fallback.
- `src/components/telemetry/DenseMonochromeHUD.tsx` — retokenize; remove decorative density.
- `src/lib/kokoro.ts`, `src/lib/voice.ts`, `src/lib/phrasebank.ts` — emit clear UI lifecycle events; visual system consumes state rather than inferring it.

### Data surfaces

- `src/components/tremor/KpiCard.tsx`, `StatusMonitoring.tsx`, `Tracker.tsx` — canonical FRIDAY data instruments.
- `src/components/ui/MetricCard.tsx`, `HalftoneCard.tsx`, `HalftoneBudgetCard.tsx` — converge on shared panel anatomy; avoid three unrelated card APIs.
- `src/components/memory/MemoryGlobe.tsx` — single hero visualization with accessible list fallback.
- every file under `src/surfaces/console/*Tab.tsx` — adopt page-header, primary-object, inspector, and state contracts above.

### Entry and onboarding

- `src/surfaces/landing/LandingShowcase.tsx` — quiet product identity, not marketing spectacle.
- `src/surfaces/onboarding/Onboarding.tsx` — split editorial/atmospheric composition and real permission/voice states.
- `src/surfaces/onboarding/OnboardingModal.tsx` — use only if onboarding must sit above an already usable app; otherwise prefer full surface.

### Consolidation

- compare `src/components/magic/` and `src/components/magicui/`; keep one canonical implementation per effect;
- compare `src/lib/bindings.ts` and `src/lib/types.ts`; one contract source for UI states;
- remove dead visual experiments only after usage search and a passing build.

---

## 16. Implementation order

1. Screenshot current state and record routes/window sizes.
2. Introduce tokens without changing layout.
3. Rebuild console shell and rail.
4. Implement explicit voice state model and compact assistant bar.
5. Recompose Chat and Tool Call/Confirmation.
6. Standardize headers, inspectors, empty/error/loading states.
7. Recompose each remaining tab one at a time.
8. Rebuild onboarding and palette.
9. Add atmospheric/halftone identity last.
10. Remove duplicate components and dead CSS.
11. Run accessibility, performance, keyboard, reduced-motion, and Windows-scale QA.
12. Capture before/after screenshots at identical dimensions.

Never restyle all tabs simultaneously before the shell and state model are stable.

---

## 17. Acceptance checklist

- [ ] UI is recognizable in grayscale with the atmospheric image disabled.
- [ ] Exactly one primary rail and one component source per primitive/effect.
- [ ] Voice state is legible from the compact bar without opening Console.
- [ ] Barge-in/stop receives immediate visual acknowledgement.
- [ ] Every async surface has loading, partial, empty, error, offline, and cancelled behavior.
- [ ] No generic gradient dashboard cards remain.
- [ ] No nested-card stack exceeds two visual levels.
- [ ] Active, hover, focus, disabled, pending, success, warning, and danger states are defined.
- [ ] Reduced-motion mode removes all nonessential loops.
- [ ] Keyboard path works across rail, composer, palette, confirmations, tabs, and dialogs.
- [ ] Text and actions remain usable at 150% Windows scaling.
- [ ] Typecheck, lint, tests, and Tauri build pass.
- [ ] Before/after screenshots exist for every major surface.


---

# 18. Embedded implementation kit

This section exists so an implementation agent does not have to rediscover or guess the intended components. The code below is **adapted source**, not pseudocode. Place it into the named files, normalize only import paths that differ in the repository, wire real store/actions, and keep the behavior and token contracts intact.

## 18.1 Required dependency check

Before copying code, inspect `package.json`. Reuse installed packages. Expected packages are:

```json
{
  "dependencies": {
    "class-variance-authority": "existing version",
    "lucide-react": "existing version",
    "motion": "existing version",
    "radix-ui": "existing version or existing @radix-ui packages"
  }
}
```

Do not change versions merely to match the bundle. The extracted shadcn source uses both consolidated `radix-ui` and package-specific Radix imports depending on version. Follow the convention already used in `src/components/ui`.

## 18.2 Theme foundation

**Target:** `src/styles/theme.css`  
**Source:** hand-authored for FRIDAY because tokens are product-specific.

Merge this into the existing theme instead of replacing Tailwind directives or application-specific rules:

```css
:root {
  --canvas: 180 8% 86%;
  --surface: 48 19% 95%;
  --surface-raised: 48 33% 98%;
  --ink: 0 0% 4%;
  --muted: 160 3% 45%;
  --line: 0 0% 4% / 0.14;
  --line-strong: 0 0% 4% / 0.28;
  --signal: 252 100% 67%;
  --success: 151 50% 37%;
  --warning: 35 76% 41%;
  --danger: 0 50% 48%;

  --radius-shell: 22px;
  --radius-panel: 16px;
  --radius-control: 10px;
  --rail-width: 64px;
  --header-height: 56px;

  --ease-enter: cubic-bezier(.16, 1, .3, 1);
  --ease-exit: cubic-bezier(.7, 0, .84, 0);
  --ease-state: cubic-bezier(.65, 0, .35, 1);
}

.dark {
  --canvas: 120 4% 9%;
  --surface: 120 3% 11%;
  --surface-raised: 120 3% 14%;
  --ink: 48 19% 95%;
  --muted: 140 3% 65%;
  --line: 48 19% 95% / 0.14;
  --line-strong: 48 19% 95% / 0.28;
  --signal: 252 100% 76%;
}

@layer base {
  * { border-color: hsl(var(--line)); }

  body {
    color: hsl(var(--ink));
    background: hsl(var(--canvas));
    font-family: Geist, Inter, "Segoe UI Variable", "Segoe UI", sans-serif;
    text-rendering: optimizeLegibility;
  }

  :focus-visible {
    outline: 2px solid hsl(var(--surface-raised));
    box-shadow: 0 0 0 4px hsl(var(--signal));
  }
}

@layer utilities {
  .font-instrument {
    font-family: "IBM Plex Mono", "JetBrains Mono", "Cascadia Mono", monospace;
    font-variant-numeric: tabular-nums;
  }

  .friday-shell-shadow {
    box-shadow:
      0 1px 0 rgb(255 255 255 / 0.55) inset,
      0 24px 70px rgb(0 0 0 / 0.18),
      0 2px 10px rgb(0 0 0 / 0.10);
  }

  .friday-noise {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E");
    mix-blend-mode: multiply;
    opacity: 0.025;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

## 18.3 Static atmospheric halftone

**Target:** `src/components/layout/AtmosphericField.tsx`  
**Source:** adapted from Magic UI `dot-pattern.tsx`; animation and resize-generated dot arrays intentionally removed for desktop performance.

```tsx
import { useId } from "react"
import skyPixel from "@/assets/images/sky-pixel.jpg"
import { cn } from "@/lib/utils"

type AtmosphericFieldProps = {
  className?: string
  density?: number
  imageOpacity?: number
}

export function AtmosphericField({
  className,
  density = 12,
  imageOpacity = 0.22,
}: AtmosphericFieldProps) {
  const patternId = useId()
  const maskId = useId()

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <img
        src={skyPixel}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover grayscale contrast-[.86] saturate-0"
        style={{ opacity: imageOpacity }}
      />

      <svg className="absolute inset-0 size-full text-black/55 dark:text-white/35">
        <defs>
          <pattern
            id={patternId}
            width={density}
            height={density}
            patternUnits="userSpaceOnUse"
          >
            <rect width="3" height="3" rx="0.5" fill="currentColor" />
          </pattern>
          <linearGradient id={maskId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.9" />
            <stop offset="0.44" stopColor="white" stopOpacity="0.18" />
            <stop offset="0.72" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${maskId}-mask`}>
            <rect width="100%" height="100%" fill={`url(#${maskId})`} />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId}-mask)`}
        />
      </svg>

      <div className="friday-noise absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_38%,transparent_0,transparent_28%,hsl(var(--canvas)/.28)_72%)]" />
    </div>
  )
}
```

**Usage:** Atmospheric content belongs outside the readable shell. Do not place this as a moving background behind transcript text.

## 18.4 Canonical instrument rail

**Target:** replace/adapt `src/surfaces/console/Rail.tsx`  
**Source:** adapted from shadcn `sidebar-07` and `SidebarMenuButton`; removes collapsible submenus because FRIDAY has top-level console surfaces.

```tsx
import type { ComponentType } from "react"
import {
  Bot, BookOpen, BrainCircuit, Chrome, FileCheck2, KeyRound,
  MessageSquareText, ScrollText, Settings2, Sparkles, TimerReset,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"

export type ConsoleRoute =
  | "chat" | "browser" | "automations" | "memory" | "review"
  | "skills" | "audit" | "settings"

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>

type RailItem = {
  id: ConsoleRoute
  label: string
  shortcut?: string
  icon: Icon
}

const primaryItems: RailItem[] = [
  { id: "chat", label: "Chat", shortcut: "1", icon: MessageSquareText },
  { id: "browser", label: "Browser", shortcut: "2", icon: Chrome },
  { id: "automations", label: "Automations", shortcut: "3", icon: TimerReset },
  { id: "memory", label: "Memory", shortcut: "4", icon: BrainCircuit },
  { id: "review", label: "Review", shortcut: "5", icon: FileCheck2 },
  { id: "skills", label: "Skills", shortcut: "6", icon: Sparkles },
  { id: "audit", label: "Audit", shortcut: "7", icon: ScrollText },
  { id: "settings", label: "Settings", shortcut: ",", icon: Settings2 },
]

function RailButton({
  item,
  active,
  onSelect,
}: {
  item: RailItem
  active: boolean
  onSelect: (route: ConsoleRoute) => void
}) {
  const Icon = item.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onClick={() => onSelect(item.id)}
          className={cn(
            "grid size-10 place-items-center rounded-full text-white/70",
            "transition-[background-color,color,transform] duration-150",
            "hover:bg-white/10 hover:text-white active:scale-[.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            active && "bg-[hsl(var(--surface))] text-black hover:bg-[hsl(var(--surface))] hover:text-black",
          )}
        >
          <Icon aria-hidden className="size-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="flex items-center gap-3">
        <span>{item.label}</span>
        {item.shortcut && <kbd className="font-instrument text-[10px] opacity-55">{item.shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Rail({
  active,
  onSelect,
  healthy = true,
}: {
  active: ConsoleRoute
  onSelect: (route: ConsoleRoute) => void
  healthy?: boolean
}) {
  return (
    <TooltipProvider delayDuration={450}>
      <nav
        aria-label="FRIDAY console"
        className="flex h-full w-16 shrink-0 flex-col items-center bg-black px-3 py-3 text-white"
      >
        <button
          type="button"
          aria-label="Open FRIDAY voice bar"
          className="mb-5 grid size-10 place-items-center rounded-full border border-white/20"
        >
          <Bot aria-hidden className="size-5" />
        </button>

        <div className="flex flex-col gap-1.5">
          {primaryItems.map((item) => (
            <RailButton
              key={item.id}
              item={item}
              active={active === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-2">
          <button aria-label="Documentation" className="grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <BookOpen aria-hidden className="size-[18px]" />
          </button>
          <div className="relative grid size-10 place-items-center rounded-full border border-white/15">
            <KeyRound aria-hidden className="size-[18px] text-white/75" />
            <span
              className={cn(
                "absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-black",
                healthy ? "bg-emerald-400" : "bg-amber-400",
              )}
              aria-label={healthy ? "System healthy" : "System degraded"}
            />
          </div>
        </div>
      </nav>
    </TooltipProvider>
  )
}
```

If current route names differ, map them instead of widening this union with duplicate concepts.

## 18.5 Segmented status tracker

**Target:** replace/adapt `src/components/tremor/Tracker.tsx`  
**Source:** adapted from Tremor `primitives/Tracker.tsx`. Uses native buttons and the project's tooltip rather than introducing `@radix-ui/react-hover-card` solely for this component.

```tsx
import { cn } from "@/lib/utils"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"

export type SegmentTone = "idle" | "active" | "success" | "warning" | "danger"

export type TrackerSegment = {
  id: string
  label: string
  tone: SegmentTone
}

const toneClass: Record<SegmentTone, string> = {
  idle: "bg-white/15",
  active: "bg-[hsl(var(--signal))]",
  success: "bg-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]",
  danger: "bg-[hsl(var(--danger))]",
}

export function SegmentedTracker({
  segments,
  label,
  className,
}: {
  segments: TrackerSegment[]
  label: string
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="img"
        aria-label={label}
        className={cn("flex h-5 w-full items-center gap-[3px]", className)}
      >
        {segments.map((segment) => (
          <Tooltip key={segment.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "h-[10px] min-w-1 flex-1 rounded-[1px] transition-opacity duration-150 hover:opacity-65",
                  toneClass[segment.tone],
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {segment.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
```

For progress, build a fixed-length array. Never derive “complete” visually unless backend state confirms completion.

## 18.6 Canonical metric instrument

**Target:** converge `KpiCard.tsx` and `MetricCard.tsx` on this anatomy.  
**Source:** adapted from Tremor `kpi-card-05`; vendor palette and generic dashboard layout removed.

```tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function MetricInstrument({
  label,
  value,
  detail,
  meter,
  className,
}: {
  label: string
  value: string
  detail?: ReactNode
  meter?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-black/10 bg-[hsl(var(--surface-raised))] p-4",
        "dark:border-white/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-instrument text-[10px] font-semibold uppercase tracking-[.11em] text-[hsl(var(--muted))]">
          {label}
        </p>
        {detail && <div className="text-xs text-[hsl(var(--muted))]">{detail}</div>}
      </div>
      <p className="font-instrument mt-2 text-[26px] leading-none tracking-[-.04em] text-[hsl(var(--ink))]">
        {value}
      </p>
      {meter && <div className="mt-4">{meter}</div>}
    </section>
  )
}
```

## 18.7 FRIDAY tool lifecycle card

**Target:** `src/surfaces/console/ToolCallCard.tsx`  
**Source:** composition combines the black budget-card reference with the adapted Tremor segmented tracker.

```tsx
import { Check, ChevronDown, CircleAlert, LoaderCircle, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { SegmentedTracker, type TrackerSegment } from "@/components/tremor/Tracker"

export type ToolPhase = "queued" | "running" | "verifying" | "complete" | "failed"

const phaseMeta = {
  queued: { label: "Queued", icon: Wrench },
  running: { label: "Running", icon: LoaderCircle },
  verifying: { label: "Verifying", icon: LoaderCircle },
  complete: { label: "Complete", icon: Check },
  failed: { label: "Failed", icon: CircleAlert },
} satisfies Record<ToolPhase, { label: string; icon: typeof Wrench }>

function lifecycleSegments(phase: ToolPhase): TrackerSegment[] {
  const steps = ["Queued", "Running", "Verifying", "Complete"]
  const position = phase === "failed" ? 1 : ["queued", "running", "verifying", "complete"].indexOf(phase)
  return Array.from({ length: 24 }, (_, index) => {
    const step = Math.min(3, Math.floor(index / 6))
    const passed = step < position
    const current = step === position
    return {
      id: String(index),
      label: steps[step],
      tone: phase === "failed" && current ? "danger" : passed ? "success" : current ? "active" : "idle",
    }
  })
}

export function ToolCallCard({
  name,
  target,
  phase,
  summary,
  expanded,
  onExpandedChange,
  children,
}: {
  name: string
  target?: string
  phase: ToolPhase
  summary: string
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  children?: React.ReactNode
}) {
  const meta = phaseMeta[phase]
  const Icon = meta.icon
  const busy = phase === "running" || phase === "verifying"

  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] bg-black text-white shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <span className="grid size-8 place-items-center rounded-full bg-white/10">
          <Icon aria-hidden className={cn("size-4", busy && "animate-spin motion-reduce:animate-none")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          {target && <span className="font-instrument block truncate text-[10px] uppercase tracking-[.1em] text-white/50">{target}</span>}
        </span>
        <span className="font-instrument text-[10px] uppercase tracking-[.11em] text-white/65">{meta.label}</span>
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded && "rotate-180")} />
      </button>

      <div className="px-4 pb-4">
        <SegmentedTracker segments={lifecycleSegments(phase)} label={`${name}: ${meta.label}`} />
        <p className="mt-3 max-w-[70ch] text-sm leading-5 text-white/80">{summary}</p>
      </div>

      {expanded && children && <div className="border-t border-white/10 bg-white/[.04] p-4">{children}</div>}
    </article>
  )
}
```

Replace the spinner with a static state glyph in reduced motion if the existing CSS override does not fully stop it.

## 18.8 Voice state model

**Target:** shared UI types near `src/lib/types.ts` or the canonical generated binding source.  
**Source:** hand-authored because this state machine is FRIDAY-specific.

```ts
export type VoiceUiState =
  | { kind: "idle" }
  | { kind: "arming" }
  | { kind: "listening"; partial: string; rms: number }
  | { kind: "endpointing"; transcript: string }
  | { kind: "thinking"; transcript: string; elapsedMs: number }
  | { kind: "tool"; name: string; target?: string; cancellable: boolean }
  | { kind: "confirmation"; title: string; consequence: string; risk: "low" | "medium" | "high" }
  | { kind: "speaking"; text: string; rms: number }
  | { kind: "interrupted" }
  | { kind: "offline"; reason: string; recoveryLabel: string }
  | { kind: "error"; message: string; recoveryLabel?: string }
```

Do not replace this with several booleans such as `isListening`, `isThinking`, and `isSpeaking`; impossible combined states will return.

## 18.9 Compact voice bar

**Target:** extract from the current bar surface into `src/components/voice/VoiceBar.tsx`.  
**Source:** hand-authored because no bundle component models FRIDAY's native voice lifecycle.

```tsx
import { Mic, Send, Square, Volume2, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VoiceUiState } from "@/lib/types"

const copy = {
  idle: "Ask FRIDAY",
  arming: "Opening microphone…",
  listening: "Listening",
  endpointing: "Got it",
  thinking: "Thinking",
  tool: "Working",
  confirmation: "Confirmation required",
  speaking: "Speaking",
  interrupted: "Stopped",
  offline: "Offline",
  error: "Something went wrong",
} as const

function primaryText(state: VoiceUiState) {
  if (state.kind === "listening") return state.partial || copy.listening
  if (state.kind === "endpointing" || state.kind === "thinking") return state.transcript
  if (state.kind === "tool") return state.target ? `${state.name} · ${state.target}` : state.name
  if (state.kind === "confirmation") return state.title
  if (state.kind === "speaking") return state.text
  if (state.kind === "offline") return state.reason
  if (state.kind === "error") return state.message
  return copy[state.kind]
}

export function VoiceBar({
  state,
  onStart,
  onStop,
  onOpenConsole,
}: {
  state: VoiceUiState
  onStart: () => void
  onStop: () => void
  onOpenConsole: () => void
}) {
  const active = !["idle", "interrupted", "offline", "error"].includes(state.kind)
  const canStop = ["arming", "listening", "endpointing", "thinking", "tool", "speaking"].includes(state.kind)
  const rms = state.kind === "listening" || state.kind === "speaking" ? state.rms : 0

  return (
    <section
      aria-label="FRIDAY voice assistant"
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-black px-3 py-2 text-white",
        "shadow-[0_18px_55px_rgba(0,0,0,.24)]",
        state.kind === "confirmation" && "items-start py-3",
      )}
    >
      <button
        type="button"
        onClick={active ? onStop : onStart}
        aria-label={active ? "Stop FRIDAY" : "Talk to FRIDAY"}
        className="relative grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.06] focus-visible:ring-2 focus-visible:ring-white"
      >
        <span
          aria-hidden
          className="absolute size-3 rounded-full bg-[hsl(var(--signal))] transition-transform duration-100 motion-reduce:transition-none"
          style={{ transform: `scale(${1 + Math.min(1, rms) * 0.65})` }}
        />
        {state.kind === "offline" ? <WifiOff className="relative size-4" /> : <Mic className="relative size-4 mix-blend-difference" />}
      </button>

      <button type="button" onClick={onOpenConsole} className="min-w-0 flex-1 text-left">
        <span className="font-instrument block text-[9px] uppercase tracking-[.11em] text-white/45">
          {copy[state.kind]}
        </span>
        <span className="block truncate text-sm text-white/90">{primaryText(state)}</span>
      </button>

      {state.kind === "thinking" && (
        <span className="font-instrument text-[10px] text-white/45">{(state.elapsedMs / 1000).toFixed(1)}s</span>
      )}

      <button
        type="button"
        onClick={canStop ? onStop : onStart}
        aria-label={canStop ? "Stop" : "Start listening"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-black hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal))]"
      >
        {canStop ? <Square aria-hidden className="size-3.5 fill-current" /> : state.kind === "speaking" ? <Volume2 aria-hidden className="size-4" /> : <Send aria-hidden className="size-4" />}
      </button>
    </section>
  )
}
```

Wire confirmation actions in an expanded child row rather than silently mapping them to start/stop.

## 18.10 Composer

**Target:** use inside `src/surfaces/console/ChatTab.tsx`.  
**Source:** adapted from shadcn `Textarea` plus coss textarea-with-button composition; integrated action row is FRIDAY-specific.

```tsx
import { useRef } from "react"
import { Mic, Paperclip, Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function FridayComposer({
  value,
  onValueChange,
  onSubmit,
  onVoice,
  onStop,
  busy,
}: {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onVoice: () => void
  onStop: () => void
  busy: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim() && !busy) onSubmit()
      }}
      className="rounded-[18px] border border-black/10 bg-[hsl(var(--surface-raised))] p-2 shadow-[0_12px_36px_rgba(0,0,0,.10)] dark:border-white/10"
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (value.trim() && !busy) onSubmit()
          }
          if (event.key === "Escape" && busy) onStop()
        }}
        rows={1}
        aria-label="Message FRIDAY"
        placeholder="Ask FRIDAY"
        className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between border-t border-black/10 px-1 pt-2 dark:border-white/10">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach file">
            <Paperclip aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onVoice} aria-label="Start voice input">
            <Mic aria-hidden />
          </Button>
        </div>
        <Button
          type={busy ? "button" : "submit"}
          size="icon-sm"
          onClick={busy ? onStop : undefined}
          aria-label={busy ? "Stop response" : "Send message"}
          disabled={!busy && !value.trim()}
          className="rounded-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
        >
          {busy ? <Square aria-hidden className="fill-current" /> : <Send aria-hidden />}
        </Button>
      </div>
    </form>
  )
}
```

## 18.11 Command palette composition

**Target:** `src/surfaces/palette/Palette.tsx`  
**Source:** uses the bundled shadcn `Command` primitive directly rather than recreating keyboard selection behavior.

```tsx
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command"

export type PaletteAction = {
  id: string
  label: string
  group: "Actions" | "Navigation" | "Recent" | "Settings"
  shortcut?: string
  run: () => void
}

export function Palette({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: PaletteAction[]
}) {
  const groups = ["Actions", "Navigation", "Recent", "Settings"] as const
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="FRIDAY command palette"
      description="Search actions and destinations"
      className="top-[18%] translate-y-0 overflow-hidden rounded-[18px] border-black/15 p-0 sm:max-w-[680px] dark:border-white/15"
    >
      <div className="bg-black text-white">
        <CommandInput placeholder="Type a command or destination…" className="text-white placeholder:text-white/40" />
      </div>
      <CommandList className="max-h-[420px] bg-[hsl(var(--surface-raised))] p-2">
        <CommandEmpty>No matching command.</CommandEmpty>
        {groups.map((group, index) => {
          const items = actions.filter((action) => action.group === group)
          if (!items.length) return null
          return (
            <div key={group}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={`${group} ${action.label}`}
                    onSelect={() => {
                      action.run()
                      onOpenChange(false)
                    }}
                    className="min-h-10 rounded-[10px] data-[selected=true]:bg-black data-[selected=true]:text-white"
                  >
                    <span>{action.label}</span>
                    {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
```

## 18.12 Empty-state primitive

**Target:** reuse `src/components/ui/empty.tsx`, then compose this wrapper.  
**Source:** adapted from bundled shadcn `Empty` compound component.

```tsx
import type { ReactNode } from "react"
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty"
import { AtmosphericField } from "@/components/layout/AtmosphericField"

export function FridayEmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <Empty className="relative min-h-[320px] overflow-hidden border-0 bg-black/[.035] dark:bg-white/[.035]">
      <AtmosphericField className="opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" imageOpacity={0.12} />
      <EmptyHeader className="relative z-10">
        <EmptyMedia variant="icon" className="rounded-full bg-black text-white dark:bg-white dark:text-black">
          {icon}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actions && <EmptyContent className="relative z-10">{actions}</EmptyContent>}
    </Empty>
  )
}
```

## 18.13 Console shell composition

**Target:** `src/surfaces/console/Console.tsx`  
**Source:** composition using the embedded `AtmosphericField` and `Rail`.

```tsx
import { AtmosphericField } from "@/components/layout/AtmosphericField"
import { Rail, type ConsoleRoute } from "./Rail"

export function ConsoleShell({
  route,
  onRouteChange,
  healthy,
  header,
  children,
  inspector,
}: {
  route: ConsoleRoute
  onRouteChange: (route: ConsoleRoute) => void
  healthy: boolean
  header: React.ReactNode
  children: React.ReactNode
  inspector?: React.ReactNode
}) {
  return (
    <main className="relative h-screen overflow-hidden bg-[hsl(var(--canvas))] p-3 sm:p-[18px]">
      <AtmosphericField />
      <section className="friday-shell-shadow relative z-10 flex h-full overflow-hidden rounded-[var(--radius-shell)] border border-white/45 bg-[hsl(var(--surface))]">
        <Rail active={route} onSelect={onRouteChange} healthy={healthy} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header data-tauri-drag-region className="h-[var(--header-height)] shrink-0 border-b border-black/10 dark:border-white/10">
            {header}
          </header>
          <div className="flex min-h-0 flex-1">
            <section className="min-w-0 flex-1 overflow-y-auto">{children}</section>
            {inspector && (
              <aside className="hidden w-[340px] shrink-0 border-l border-black/10 xl:block dark:border-white/10">
                {inspector}
              </aside>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
```

Do not apply `data-tauri-drag-region` to interactive descendants. Keep native window controls outside or explicitly excluded from the drag region according to the current Tauri setup.

## 18.14 Provenance ledger

| Embedded element | Bundle source | Why this source |
|---|---|---|
| rail interaction | shadcn `sidebar-07`, `ui/sidebar.tsx` | accessible tooltip/collapsible navigation behavior |
| command palette | shadcn `ui/command.tsx` | proven `cmdk` keyboard model |
| composer base | shadcn `ui/textarea.tsx`, coss textarea composition | correct input/error foundation; FRIDAY action row added |
| empty state | shadcn `ui/empty.tsx` | reusable compound empty-state anatomy |
| segmented tracker | Tremor `primitives/Tracker.tsx` | dense status monitoring suited to tool lifecycle |
| metric anatomy | Tremor `kpi-card-05.tsx` | clear label/value/detail hierarchy |
| atmospheric field | Magic UI `dot-pattern.tsx` concept | recognizable pattern identity, rewritten static for performance |
| voice bar | hand-written | no library component models the FRIDAY voice state machine |
| console shell | hand-written composition | native Tauri drag/dual-window constraints |

