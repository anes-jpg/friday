# ADR 007: Local Neural TTS and Continuous Background Wake-Word Engine

## Status
Accepted (Phase M5b Audio Subsystem)

## Context
FRIDAY's voice identity requires delivering the persona of Kerry Condon (composed, articulate, warm yet dryly witty) under strict latency constraints:
- Non-verbal acknowledgement: **≤ 150 ms**
- Voice playback response: **≤ 1.8 s p95**
- Idle CPU consumption: **≤ 3% total (< 1% audio)**
- Zero audio leaves the machine (all STT, TTS, and wake-word run locally on the user's hardware).

Standard cloud TTS adds unacceptable network latency (400–1200 ms) and violates privacy laws. Python-based sidecars introduce heavy memory footprints (> 1 GB) and cold-start latency.

## Decision
1. **Local Neural TTS Pipeline**:
   - Primary: Support Kokoro-82M / Piper ONNX local audio synthesis providing 24 kHz studio voice delivery across 5 tailored neural voice profiles (`bf_emma`, `af_heart`, `af_bella`, `af_nicole`, `af_sky`).
   - Web Audio Studio Broadcast DSP: Applies 220 Hz chest resonance, 3.2 kHz presence, dynamic range compression, and de-essing.
   - Dual-channel fallback: Sub-100ms pre-rendered golden phrase bank and adaptive prosody synthesis when the local neural service is unprovisioned.
2. **Continuous In-Process Wake-Word Detection**:
   - `WakeWordDetector` in Rust runs an in-process, sliding-window acoustic energy and spectral phonetic detector tuned to *"Hey Friday"* and *"Friday"*.
   - Uses low-energy gate rejection to ensure $< 0.5\%$ CPU utilization in ambient silence.
   - Dispatches `friday://wake-word-detected` via Tauri IPC, immediately triggering the 120 ms non-verbal acoustic chime and transitioning the 2D Orb to `listening`.

## Consequences
- **Positive**:
  - Hands-free activation without sacrificing the zero-CPU idle law.
  - Authentic, human-like voice synthesis with selectable profiles matching MCU persona.
  - Zero cloud dependencies for speech audio; zero privacy leakage.
- **Negative**:
  - Requires tuning sensitivity depending on microphone background noise floors.
