# Google business dossier release — 2026-10-29

Selected businesses now have automatic Google Maps research and an explicit **Capture selected listing** action for duplicate-name branches. Successful import closes the research window and expands the existing panel into a sourced dossier. Business photo controls contribute up to six source-linked photos, with per-image ASCII loading and existing source-viewer fallback. Business headings use Manrope. Extra research/actions/source text is collapsed. Onboarding describes the current controls.

Verification:

- TypeScript check passed; the final production build also ran TypeScript successfully.
- Full frontend suite: 186 tests passed in 24 files, including bilingual hotel identity, branch ambiguity, camera-coordinate rejection, contact isolation, and selected-photo source isolation.
- Native research suite: four tests passed, including startup blank-page rejection/retry classification, candidate bounds, photo host restrictions, and explicit selected-listing validation.
- `git diff --check` passed.
- `pnpm tauri build --no-bundle` passed, final optimized compilation 6m43s. Existing mixed-import and large-main-chunk warnings remain.

Live inspection found the Four Points hotel through Oran place search and opened its actual Google Maps listing, which displayed its phone, address, and official Marriott website. This exposed the initial blank-page race, the OSM-only hotel descriptor, bilingual identity, and unrelated tenant status; fixes have regression coverage. The user stopped Computer Use with physical Escape before final live acceptance. Final photo rendering, manual-capture interaction, font/layout, and animation frame rate were not live-verified this turn.

Artifact: `src-tauri/target/release/friday.exe`

- 63,338,496 bytes
- Generated 2026-10-29 15:18:35 local
- SHA256 `708525EBF5A426B38449F179C8D98345F96478FC787E5DC24D7609146A724E4C`

Launch this executable for the update. The no-bundle command produces a desktop executable, not an installer or an update to the existing installed shortcut.
