# Project switching and onboarding review

The selected project now owns one keyed content subtree, including its heading, tabs and context. Thirty consecutive project switches in Chromium kept exactly one heading and one context row, with the saved project count unchanged.

The first-launch guide now starts with software, research and everyday goals, with business discovery available as an optional route. It uses the existing shadcn controls and a goal-list structure adapted from the bundled Tremor onboarding pattern. FRIDAY's dark surfaces, rounded geometry and violet focus signal remain intact. Controls no longer pass through the ASCII text reveal.

| Finding | Resolution |
| --- | --- |
| Opening Settings or another feature marked the entire guide complete | Guide position, deferral and completion have separate persisted states. Only Finish guide marks completion. |
| First launch assumed business website work | Arbitrary goals, planning, software, research, optional folders, multiple providers and typed interaction are covered. |
| Guide navigation could push its footer outside a short window | Grid rows have a bounded minimum; navigation becomes horizontal in narrow windows and content scrolls independently of the footer. |
| Empty or overlong response languages failed only during saving | Field validation accepts arbitrary names/codes and directs focus to the language field. |
| Repeating the same invalid submission did not reliably restore focus | Each validation attempt requests focus explicitly. Async errors wait until form controls are enabled. |
| All save failures with a folder were reported as folder errors | Folder inspection errors stay on the folder field; storage errors remain general save errors. |
| Custom presets and drafts could be difficult to review | Custom goal/type/task edits survive preset changes and Back; dismissal offers Keep editing and explicit Discard draft. |

Validation: all 203 frontend tests passed; the final related 13 tests passed after the async-focus change. Type checking and production builds passed. `scripts/verify-workspace-ui.mjs` passed against the production preview, including custom goals, arbitrary language, another saved provider, custom type/tasks/tags, unsafe-link validation, folder-error focus, guide resumption and completion, 640×480 and 390×640 layouts, long content, reduced motion, keyboard focus, visible footer actions, and saved work after reload. No browser runtime errors occurred. Screenshots in `scratch/` were visually inspected.

Browser verification uses a disposable context and saved-data fixtures; it does not modify the user's native workspace or credentials. It requires an existing Playwright installation and Chromium, supplied as command arguments, and adds no project dependency.

Native microphone recognition, audible speech, voice latency and the Windows folder-picker interaction were not exercised. Existing production bundle size and mixed-import warnings remain outside this UI change.

## Publication verification

The selected changes were exported from Git's index into an isolated review folder, excluding the existing Android companion and research work. That source passed all **191 frontend tests**, TypeScript compilation and a production build. The browser regression passed again against that production bundle, including all 30 switches, custom setup, field focus, draft protection, guide progress, small windows, long content and reload persistence, with no runtime errors.

A fresh Windows checkout exposed three tracked component filenames whose casing disagreed with their lowercase imports. `Button.tsx`, `Input.tsx` and `Kbd.tsx` were renamed to `button.tsx`, `input.tsx` and `kbd.tsx`, with their contents unchanged. The isolated production build then passed.

The final native release build of the full development workspace also succeeded and produced both NSIS and WiX packages. These local packages include the preserved companion and research work and are not uploaded as release assets by this change. They do not establish audible voice behavior or clean-machine installation.

| Local output | SHA-256 |
| --- | --- |
| `friday.exe` | `4143222795471363525A6E9AAD5AB484CEF6A11AABD5B7D022FFD591362B2FBA` |
| `friday_1.0.0_x64-setup.exe` | `3F50A47B4171A1A82EF4C0776D28FACB7A9D8EFE44A410DE0DFFB6B42331A5AE` |
| `friday_1.0.0_x64_en-US.msi` | `01C56A79809DB6D3273A46EE72A59356970DCC73A788197DBDDA91F01BFAB91D` |
