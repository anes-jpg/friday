# Onboarding and project switching

Goal: Keep one selected project on screen and make both onboarding flows useful for arbitrary goals, providers, languages and folders.

1. Reproduce the saved project-header fix against the former keyed header; guard repeated switching and project context with a browser regression.
2. Fix project setup validation and error focus, retain custom drafts and presets, and keep controls usable in a small window. Check create/edit/back/discard and failure paths.
3. Replace the feature tour's narrow copy with goal-oriented guidance and direct actions. Save its place separately from completion so users can leave for settings or work and resume. Check keyboard focus, dismissal and reduced motion.
4. Run focused and full frontend tests, type check and build; exercise both flows in Chromium, then rebuild the Windows bundles.

Risks: Preserve existing records and provider credentials. Browser verification cannot prove native microphone, speech or folder-picker behavior. No new production dependencies.
