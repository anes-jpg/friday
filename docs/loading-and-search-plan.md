# Loading and search refinement

Goal: keep the working shell usable during navigation, replace the detached ASCII skeleton with block-aware loading, and make free business research use search results as sourced candidates.

1. Reproduce the loading screenshot and inspect the actual Suspense/reveal boundaries. Check the loaded shell and pending content independently.
2. Keep the current workspace visible during route changes, show a small truthful opening state, and decode only newly arrived content. Remove decorative page-length placeholder rows. Check pending and reduced-motion behavior.
3. Open a visible Google Search/Maps WebView2 window and import rendered results on request. A live plain-HTTP request returned only Google's JavaScript handoff, so capture the loaded DOM instead. Retain evidence and snippets, and leave challenges to the user. Check validation and a live window.
4. Connect search candidates to contact research and website briefs, with clear business identity confirmation. Check contact provenance and stale-field handling.
5. Run affected/full tests and the no-bundle release build, then commit/push the verified changes.

Risks: lazy-loading boundaries hiding unrelated UI, animation cleanup, changing search markup, and incorrectly attaching a chain's details to a local branch. No paid API, login automation, or invented business facts.

Live findings: the first release check successfully opened Google Maps and imported its rendered business links and excerpts. Google Search displayed a network CAPTCHA, and import reported the required user verification. Maps supplied real phone numbers, street addresses, and website links. Its results heading was incorrectly treated as a selected business; capture now excludes feed headings and reads links only inside the main business panel. The nested map Suspense boundary also briefly replaced Work during navigation; it now defers to Console's shared route boundary. The final release must include both corrections.

Launch verification: the computer-use launcher opened the older installed copy when given a plain executable path. Using `process:C:\Users\anesx\Desktop\friday\src-tauri\target\release\friday.exe` selected the correct release. Always verify the returned window's executable path before assessing new UI. The no-bundle build does not replace the installed shortcut's target.

Final verification: 181 frontend tests across 24 files passed, including rendered Maps capture, source-preserving leads, and pending-content checks. Native business search validation passed 3 tests. TypeScript and the final production frontend/native build passed. The Work-to-Map observation retained Work under the compact opening status. The final executable imported nine real Maps business listings plus their supplied website links, including quoted phone/address fields; it excluded Google's navigation link and did not label the results feed as a selected business. Search's CAPTCHA path displayed an actionable verification message. Animation frame rate and live model website generation were not measured in this check.

Final no-bundle artifact: `src-tauri/target/release/friday.exe`, 63,247,360 bytes, generated 2026-10-29 12:54:03 local time. SHA256: `B7CA3BB9F4D4AF0DD6306E3D521E6BA9B6EC48561AA8193FB44C81D6791D9B9E`. The production build retains mixed-import and large-chunk warnings. Generated binaries remain outside Git.
