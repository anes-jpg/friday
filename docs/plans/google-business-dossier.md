# Selected business → Google capture → dossier

Goal: One action researches the selected business in a visible Google Maps window, then expands the existing search panel into a sourced business dossier with ASCII block reveals.

1. Add bounded automatic capture and conservative name/location matching. Check rendered-DOM fixtures for Oran, duplicate branches, missing data, and verification pages.
2. Add window cancellation, timeout recovery, and close/focus after stable capture. Check native compilation and unit tests.
3. Expand the existing aside; use current controls and dialog focus conventions, independent ASCII field reveals, and a compact source-backed website workflow. Check TypeScript and interaction/render tests.
4. Run frontend/native checks, build a no-bundle release, inspect the exact release with an Oran listing, then commit and push.

Risks: Google's DOM and availability can change. Ambiguous branches and consent/verification leave the research window available for the user. Missing fields remain unknown. Camera coordinates are never business coordinates. Imported facts require identity review before saving or building.

No new dependencies or paid services. Capture remains confined to the dedicated Google window, which cannot invoke FRIDAY commands. Animation uses 180–200ms opacity/transform and stops when idle; reduced motion resolves immediately.
