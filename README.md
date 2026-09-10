# FRIDAY — Windows Desktop Assistant & Operator

An intelligent, voice-first desktop operator for Windows. FRIDAY runs your professional work while you talk to her, replies in under two seconds, sounds like a person instead of a phone menu, and looks like Microsoft shipped it.

---

## 🎯 Core Operating Principles

1. **Voice is the Primary Interface**: Every capability is reachable by voice, with complete keyboard parity.
2. **Strict Latency Budget**: Perceived latency $\le$ 1.8 s p95 from end-of-speech to her first syllable. Fired by a **$\le$ 150 ms** non-verbal synthesized acoustic cue.
3. **The Single Cloud Brain**: Wake word, speech capture, audio synthesis, memory search, and automations run 100% locally on your CPU. The cloud is exactly one thing: **GLM-4** over an encrypted connection. Audio never leaves your machine.
4. **The Utterance Contract**: Spoken turns display four distinct phases:
   - `Heard` — Live transcript, editable inline.
   - `Plan` — Step-by-step plain language with Green/Amber/Red risk dots.
   - `Doing` — Active step with elapsed execution time.
   - `Result` — Clear change summary with undo affordance.

---

## 📐 The Three Design Laws

- **Surface Law**: Rounded rectangles on an 8px grid (radius 16px for containers, 8px for controls). Surfaces sit on Mica (Windows 11) or Acrylic (Windows 10). Single 40px ambient shadow on the floating Bar: `0 20px 40px -15px rgba(0,0,0,0.6)`.
- **One-Signal Law**: The accent color `--color-acid: oklch(78% 0.19 152)` appears at most twice per viewport and only signifies that FRIDAY is actively doing something (listening, thinking, streaming, or executing).
- **Sub-Frame Law**: All transitions are 120–220ms, transform and opacity only, using `cubic-bezier(0.22, 1, 0.36, 1)`. `prefers-reduced-motion` collapses transitions to opacity fades. The 2D Canvas Orb burns **0% CPU** in Idle state.

---

## 🖥️ Four Surfaces, One Process

| Surface | Shortcut | Description |
| :--- | :--- | :--- |
| **S1: The Bar** | `Alt+Space` | Floating 720x64 Mica dock, reactive 40px Orb, caret input, inline plan cards, live wave amplitude. |
| **S2: The Palette** | `Ctrl+K` or `>` | Fuzzy command palette executing the same underlying tool registry. |
| **S3: The Console** | `Alt+Shift+Space` | Full obsidian workbench with Chat, Automations, Skills, Memory, Audit, and Settings. |
| **S4: Ambient** | Tray / Background | Autostart, background cron automations, Windows toast notifications with deep-links. |

---

## 🎙️ The Three Operating Modes

- **Command Mode** (`Alt+Space`): Interprets the spoken utterance as an instruction, generates a confirmation plan, and executes authorized tools.
- **Dictation Mode** (`Alt+Shift+D`): Transcribes verbatim at 100% opacity into your active field. The Orb turns neutral grey; zero LLM reasoning or tool execution.
- **Conversation Mode**: Open mic mode with responsive turn-taking and context retention.
- **Panic Kill Switch** (`Ctrl+Alt+Shift+F`): Global emergency hotkey that immediately stops all audio, cancels active turns, pauses automations, and releases the microphone.

---

## ⚡ Latency Budgets (§04 Spec)

| Stage | Target Budget | Realized Implementation |
| :--- | :--- | :--- |
| **Non-verbal acknowledgement** | $\le$ 150 ms | 120 ms synthesized cue fired asynchronously (< 5 ms) |
| **Barge-in interruption cutoff** | $\le$ 200 ms | < 2 ms active sink stop on speech detection or keypress |
| **Intent router** | $\le$ 15 ms | Fast-path intent matching (< 5 ms) |
| **Speech Normalization** | Instant | Strips URLs, file paths, and markdown to $\le$ 2 spoken sentences |
| **Idle CPU (Orb & mic)** | $\le$ 3% (0% Orb) | Zero animation frames spun while idle |

---

## 🛠️ Verification & Test Commands

```bash
# 1. Run full Rust backend test suite (21 unit & integration tests)
cargo test --manifest-path src-tauri/Cargo.toml --lib

# 2. Run Rust static analysis & safety linter (0 warnings, 0 errors)
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 3. Run CI voice persona compliance linter (banned phrases, emojis, sentence limits)
pnpm test:voice

# 4. Run TypeScript checks
pnpm check

# 5. Run Frontend unit test suite (Vitest)
pnpm test --run

# 6. Run M0 hardware benchmark harness
pnpm bench:hardware

# 7. Build production bundle
pnpm build
```

---

## 🔒 Security & Privacy

- **API Keys**: Stored exclusively in Windows Credential Manager via DPAPI (`keyring`). Never written to SQLite, logs, or crash dumps.
- **Local Audio**: Audio capture never leaves RAM. Recognition and speech synthesis run 100% on the local CPU.
- **Safe Execution**: All destructive filesystem actions require explicit confirmation, support deterministic undo, and move deleted files to the Windows Recycle Bin rather than calling permanent `unlink`.
- **Skill Sandboxing**: Declared permissions in `manifest.json` are enforced at runtime; unauthorized tool access is blocked and logged to `audit_log`.

---

## 📄 License
Apache-2.0
