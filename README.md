# FRIDAY v2.0 — Windows Spatial OS & Omniscient AI Companion

An intelligent, voice-first desktop operator and spatial AI companion for Windows 11/10. FRIDAY runs your professional work while you talk to her, replies in under two seconds, sounds like a person instead of a phone menu, and operates as a native fullscreen operating environment (**`FridayOS`**).

---

## 🎯 What's New in FRIDAY v2.0

1. **FridayOS Spatial Shell**: Fullscreen borderless desktop environment with DWM-safe Mica vibrancy, a 36px Dynamic Island Orb status bar, and a tactile magnifying dock.
2. **In-Process Neural Piper TTS (`voice/piper.rs`)**: Sub-55ms ONNX VITS speech synthesis directly into `rodio` with 4 context-adaptive prosody profiles (*Calm*, *Tactical*, *Whisper*, *Witty*) and sub-80ms barge-in.
3. **9-Layer "God's Eye" Telemetry**: 60fps WebGL2 vector cartography (`MapLibre GL`) mapping Windows process sockets, subsea fiber cables, ADS-B flights, SGP4 orbital satellites, AIS maritime vessels, USGS earthquakes, and local LAN devices.
4. **"The Mind Stone" — Windows UIA Perception (`agent/perception.rs`)**: Reads the live accessibility DOM tree of *every* Windows app in `<3ms` for cursor-aware *"Point-and-Speak"* actuation.
5. **"Overwatch Mode" — Proactive Companion (`agent/overwatch.rs`)**: Event-driven consciousness watching terminal panics, Python tracebacks, and git merge conflicts to offer unprompted 1-click fixes.
6. **"Iron Legion Protocol" (`agent/legion.rs`)**: Parallel Tokio 4-worker DAG swarm (`Scout`, `Architect`, `Sentinel`, `Operator`) with an interactive node visualizer.
7. **Entity Dossier Drawer & Slide-to-Confirm**: Right-hand inspection drawer with tactile Red-Tier Slide-to-Confirm process socket termination.

---

## 📐 The Three Design Laws

- **Surface Law**: Rounded rectangles on an 8px grid (radius 16px for containers, 8px for controls). Surfaces sit on Mica (Windows 11) or Acrylic (Windows 10).
- **One-Signal Law**: The accent color `--color-acid: oklch(78% 0.19 152)` appears at most twice per viewport and only signifies that FRIDAY is actively doing something (listening, thinking, streaming, or executing).
- **Sub-Frame Law**: All transitions are 120–220ms, transform and opacity only, using `cubic-bezier(0.22, 1, 0.36, 1)`. `prefers-reduced-motion` collapses transitions to opacity fades. The 2D Canvas Orb and WebGL2 map burn **0% CPU** in Idle state.

---

## ⌨️ Spatial Keyboard Shortcuts

| Shortcut | Surface / Action | Description |
| :--- | :--- | :--- |
| **`F11`** | **Exclusive Fullscreen** | Toggles borderless FridayOS with automatic DWM Mica clearing. |
| **`Ctrl+1`** | **God's Eye Command** | Fullscreen 9-layer planetary-to-process telemetry canvas. |
| **`Ctrl+2`** | **Operator Split** | Left 440px Chat Console + Right interactive WebGL2 God's Eye Map. |
| **`Ctrl+3`** | **Iron Legion IDE** | Fullscreen 4-agent Tokio Swarm DAG visualizer with live latencies. |
| **`Ctrl+4`** | **Desktop Bento Grid**| 2×2 quad workspace combining Console, Map, Swarm, and Timeline. |
| **`Ctrl+N`** | **New Chat** | Spawns a fresh conversation thread with automatic titling. |
| **`Ctrl+H`** | **Chat History** | Toggles the 260px chronological session drawer. |
| **`Alt+Space`** | **The Bar** | Floating 720×64 Mica dock with reactive 40px Orb. |

---

## 🛠️ Verification & Test Commands

```bash
# 1. Run full Rust backend test suite (74 unit & integration tests)
cargo test --manifest-path src-tauri/Cargo.toml --lib

# 2. Run TypeScript strict check (0 errors, zero any)
pnpm check

# 3. Run Frontend test suites (Vitest: 86 tests passed across 6 suites)
pnpm test run

# 4. Build Vite production bundle
pnpm build

# 5. Compile standalone Windows release binary
pnpm tauri build --no-bundle
# -> Generates: src-tauri/target/release/friday.exe
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
