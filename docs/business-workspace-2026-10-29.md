# Integrated business workspace

This corrective pass connects fullscreen Work, History, Memory, analytics, and the command palette to the same console routes and saved records. The old fullscreen hardcoded completed swarm and separate empty recall panel have been removed from the shell. The inspector shows independent native readings; an unsupported GPU sensor no longer hides CPU and RAM.

Work starts with the complete unfinished queue, including undated and personal tasks. Tasks can be started, completed with undo, edited, or prepared as a project request. Project Overview exposes next steps, sources, files, and an inline request composer. Empty auxiliary cards are omitted.

Map starts in business discovery with visible categories, including shops, food, salons, hotels, health, and services. Website and contact filters distinguish sourced listings from unverified map labels. Businesses can be shortlisted into the saved Website leads collection. “Not listed” never claims that no website exists.

Build website reads the source listing and prepares a persistent project, quoted source capture, brief, and four unfinished tasks. Windows creates a UUID-scoped working folder under FRIDAY's app-data website-projects directory. The next screen reviews a file-writing request using the configured project/current provider and existing confirmation tiers. Repeated creation repairs partial saves without resetting edited records or completed tasks. No outreach or deployment is part of this flow.

Business projects include a local index.html preview with desktop and 390px mobile views, refresh, and file-editor navigation. The preview uses an opaque data document in an iframe that permits scripts but has no same-origin, forms, popups, downloads, or top-navigation permissions. The parent application's script policy remains unchanged; frame-src allows this preview document. Files must actually be generated before a preview appears.

Reusable ASCII glyph layers animate only during pending work: control-room checks, fullscreen expansion, route loading, chat processing, memory reads, business lookup, project preparation, and preview reads. The voice core responds to measured RMS through discrete opacity/scale states; thinking motion stops when the core becomes idle. Reduced-motion mode stops repeated glyph changes and collapses motion. No new dependencies were added. This adapts the user's ASCII Reveal and flood.md reference techniques within FRIDAY's existing UI.

Memory graph height is bounded; small graphs show readable content labels and use the whole circle for a single populated tier. Generic fallback labels never produce associations. Links still represent only shared meaningful subjects or actual source IDs.

Verification covers website/contact filters, source uncertainty, persistence through restart, partial-save retries, native-folder handoff, task backlog visibility, source handoff, and generic memory associations. Native path tests reject traversal and absolute paths. A Windows test-runner startup failure was traced to missing Common Controls v6 activation: Tauri's resource link applies to bins, while unit-test executables imported TaskDialogIndirect without a manifest. `src-tauri/test-native.ps1` compiles the library tests, discovers the executable through Cargo's JSON artifact output, embeds `windows.manifest` using the installed Windows SDK, and runs the requested filter (default: workspace). Production retains Tauri's existing application manifest; adding a second global manifest causes a duplicate-resource link failure.

Visual QA could not run in this session: the browser access host was unavailable and native browser control stopped because the current URL could not be verified. Live provider-driven file generation, preview interaction, and 60fps behavior have not been visually measured here.

Verified before release: `pnpm check`; `pnpm build`; 166 Vitest tests across 20 files; another focused run of the 10 affected workspace/business/window tests after final UI wiring; and the manifest-assisted native workspace tests (3 tests). Reproduce the native run with `powershell -File src-tauri/test-native.ps1 -Filter workspace`. The final artifact is produced with `pnpm tauri build --no-bundle`.

The final no-bundle build exited successfully. `src-tauri/target/release/friday.exe` is 63,099,904 bytes, written on 2026-10-29 at 10:28:27 local time. SHA-256: `74F7B0392D95E12AE6C900E34787A3B53BFE255EC1541812A13378972CADE78C`. Generated artifacts remain outside Git.
