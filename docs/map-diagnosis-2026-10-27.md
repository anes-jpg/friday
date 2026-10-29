# Map regression — investigation note

Date: 27 October 2026.
Context: after yesterday's release build (2e75f39 family), the map "used to be like in the screenshots" — screenshot 1 shows the **Terrain** preset (3D land use, `createNeutralMapStyle(terrain: true)`), screenshot 2 shows the dark raster **Obsidian/Vector** basemap with OpenFreeMap attribution. Both presets still exist and are correct in [map-style.ts](../src/lib/map-style.ts), so this is **not** a style-preset regression: the current tree can produce both looks.

## What the surviving session work did (already in tree, verified green)

[FridayMapCanvas.tsx](../src/components/map/FridayMapCanvas.tsx) now:

- Installs `map.on("error")` and renders a dismissible red alert band with the exact MapLibre error message, so the next run *names* the failure instead of going silently blank (the most likely user-visible symptom of "broken").
- Calls `map.resize()` on load — fixes any stale-container blank-first-paint after window restore.
- Logs the error through `log_frontend_error` so it shows up in the native log, matching audit F05 (failures must be recorded, not swallowed).

## What the current guards rule out

1. **Style preset loss** — ruled out above; `carbon`, `terrain`, `satellite`, `vector` all present and wired.
2. **Wrong tile source** — sources are unchanged (OpenFreeMap planet vector, Esri satellite raster, AWS terrarium DEM for terrain).
3. **A code-level break introduced since 2e75f39** — `git status` shows no uncommitted change to map styling or layer bundling; the only map-related change is the error band above.

## Remaining candidates (need one run of the rebuilt exe to distinguish)

- **Network/CSP in the WebView changed** (tile font/glyph fetch `tiles.openfreemap.org` blocked or offline) → the new red band will say so verbatim.
- **Container-size race** → fixed by the `resize()` call already; if the band never appears and the map renders, this was the cause.
- **Terrain DEM 404** (`elevation-tiles-prod`) — only breaks the terrain preset; the band will show it.

## Next confirmation step (one run)

Launch the rebuilt release exe → open Map. If healthy: done. If the red band appears: send its exact text; the fix is then the one-line correction it names (CSP allowlist entry, source URL, or attribution block) — no further investigation loop.

Status evidence: `pnpm check` green (fresh run this session); `cargo check` green for the 7-file working tree; clean debug `cargo test --lib` remains blocked by the pre-existing `STATUS_ENTRYPOINT_NOT_FOUND` DLL-load issue (recorded in the workspace plan note, not caused by any of these edits — the release profile compiles cleanly).
