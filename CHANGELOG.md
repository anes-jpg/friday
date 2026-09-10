# Changelog

All notable changes to **FRIDAY** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-10 — Official 1.0 Release

### Added
- **M0 & M1: Windows Shell & Design System**:
  - Tauri v2 application shell with transparent Mica/Acrylic styling via `window-vibrancy`.
  - The Bar surface (`720x64` floating dock with single 40px ambient shadow).
  - 40px reactive 2D Canvas Orb with 0% CPU consumption in Idle state.
  - Three design laws: Surface Law (8px grid, radius 16px/8px), One-Signal Law (`--color-acid`), Sub-Frame Law (120-220ms transitions).
  - Four-phase Utterance Contract: `Heard`, `Plan`, `Doing`, `Result` with undo affordance.
  - Risk tier system: Green (silent), Amber (preview card with 8s timeout), Red (requires explicit confirmation).
  - Fuzzy Command Palette (`Ctrl+K` or `>`) and full Console workbench (`Alt+Shift+Space`).

- **M2: GLM-4 Providers & Keyring Gateway**:
  - Dual-tier model routing: `heavy_model` (`glm-4-plus`) for tool planning and `light_model` (`glm-4-flash`) for intent screening.
  - Windows Credential Manager integration via `keyring` (DPAPI encryption for API keys).
  - Server-Sent Events (SSE) streaming accumulator with fragmented tool-call parsing.

- **M3 & M5: Voice Subsystem, Synthesis & Sub-200ms Barge-In**:
  - Push-to-talk (`Alt+Space`) low-latency audio capture via `cpal` with a lock-free 32,000-sample ring buffer (`ringbuf`).
  - Sub-150ms non-verbal synthesized acoustic acknowledgement cue.
  - Formant speech synthesis at 24,000 Hz with vocal tract resonance (F1, F2, F3) and consonant shaping.
  - Real-time `rodio::Sink` playback with sub-200ms (< 2ms) barge-in interruption upon speech detection or keypress.
  - Two-channel speech normalization stripping URLs, file paths, and markdown to produce concise prose ($\le$ 2 sentences).
  - Per-sentence delivery directives and prosody pitch clamping.

- **M4: Windows Grounding & Safe Action Layer**:
  - Window and screen inspection (`screen.read`, `window.active`).
  - Clipboard operations (`clipboard.get`, `clipboard.set`) with preview gating.
  - Atomic filesystem mutations with rollback journal (`fs.write`, `fs.undo`).
  - Strict shell execution allowlist (`shell.run`) blocking unauthorized binaries or destructive operations.

- **M5b: Operating Modes & Hotwords Biasing**:
  - Dictation Mode (`Alt+Shift+D`): verbatim transcription into active fields with neutral grey orb styling and zero LLM interpretation.
  - Contextual hotwords biasing table (`models/hotwords.txt`) with boost scores for technical domain terms.
  - Phonetic correction dictionary correcting common acoustic mishearings.

- **M6: Long-Term Memory & Semantic Fact Retrieval**:
  - SQLite persistent database at `%APPDATA%/FRIDAY/friday.db`.
  - Automatic fact extraction with confidence scoring.
  - Hybrid keyword retrieval injecting `<user-facts>` XML tags into system prompts.
  - Full CRUD operations and live sync in the Memory tab.

- **M7: Automations Engine & Background Scheduler**:
  - Background worker loop executing cron/interval automations every 30 seconds.
  - Direct tool execution with run auditing and instant manual triggers (`trigger_now`).
  - Bundled automations: Daily Standup Digest, Desktop Cleanup Reminder, Clipboard History Sync.

- **M8: Skill SDK & Sandboxed Permissions**:
  - Filesystem skill discovery across `%APPDATA%/FRIDAY/skills/` and workspace `./skills/`.
  - Manifest parser enforcing declared permissions (`fs:read`, `shell:run`, `clipboard`, etc.).
  - Security enforcement gate logging permission violations to `audit_log`.
  - Bundled default skills: `standup-digest`, `notion-operator`, `desktop-organizer`.

- **M9 – M11: Hardening, CI Linters & Documentation**:
  - Automated CI voice persona linter (`bench/voice-check.mjs`) testing 40 representative spoken turns against banned syrupy phrases and sentence length limits.
  - Hardware benchmark harness (`bench/hardware_bench.ps1`) verifying reference laptop specs.
  - First-run interactive Onboarding flow (`OnboardingModal.tsx`) with acoustic cue test.
  - Global Panic Kill Switch (`Ctrl+Alt+Shift+F`) for instant emergency cancellation.
  - Architecture Decision Records (`docs/adr/001` through `docs/adr/004`).
