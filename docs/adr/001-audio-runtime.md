# ADR 001: In-Process Audio Runtime (cpal + rodio)

## Status
Accepted (Phase M5 Audio Subsystem)

## Context
FRIDAY is a voice-first Windows desktop assistant operating under strict latency budgets:
- Non-verbal acknowledgement: **≤ 150 ms**
- Endpoint decision: **≤ 280 ms**
- Voice round-trip p95: **≤ 1.8 s** (1.3 s stretch)
- Idle CPU: **≤ 3%** on 4 cores
- Peak CPU: **≤ 70%** on an Intel i7-8565U (15 W TDP)

Cloud speech endpoints add 400–1200 ms of unpredictable round-trip latency over local Wi-Fi, violating both the 1.8 s latency budget and the zero-audio-leaves-the-machine privacy law. Python sidecars (PyTorch/Whisper) cost 400 MB–2 GB of disk/RAM overhead and introduce cold-start stalls.

## Decision
We adopt pure in-process Rust audio crates:
1. **`cpal`** (`0.15`): Dedicated, time-critical OS thread capturing 16 kHz mono microphone frames into a lock-free ring buffer (`ringbuf`).
2. **`rodio`** (`0.19`): Zero-latency audio playback engine for playing pre-rendered 150 ms phrase-bank WAV cues and streaming TTS chunks directly to the default Windows output device.
3. **`ringbuf`** (`0.4`): Single-producer single-consumer lock-free ring buffer connecting the real-time audio capture callback to the VAD and ASR pipelines.
4. **`hound`** (`3`): Lightweight WAV file encoder/decoder for in-memory phrase bank caching.

## Consequences
- **Positive**:
  - Direct WASAPI access on Windows with minimal latency (<10 ms capture buffer).
  - 0 MB extra runtime overhead; statically compiled into `friday.exe`.
  - Audio never touches disk or network.
  - Barge-in monitoring runs concurrently without thread contention.
- **Negative**:
  - Requires handling Windows audio device disconnect/sleep events gracefully.
