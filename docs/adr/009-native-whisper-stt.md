# ADR 009: Native whisper.cpp STT via whisper-rs

## Status
Accepted (Phase 1.1 — STT Bundling)

## Context
FRIDAY's original STT pipeline relied on an external Python sidecar (`scripts/stt_service.py`) running `faster-whisper` via CTranslate2. This architecture had three critical weaknesses:

1. **Python Dependency**: Users must have Python 3.x and the `faster-whisper` package installed. On clean Windows machines this is absent, causing silent fallback to the nearly useless SAPI grammar.
2. **Process Fragility**: The Python child process communicates via stdin/stdout JSON pipes. Any encoding error, Python crash, or PATH misconfiguration silently kills transcription.
3. **Deployment Complexity**: The `model.bin` (75 MB CTranslate2 format) is specific to `faster-whisper` and incompatible with whisper.cpp.

## Decision
Replace the Python sidecar with the [`whisper-rs`](https://docs.rs/whisper-rs/) crate, which provides Rust bindings to `whisper.cpp`.

### Architecture
- **Model**: `ggml-tiny.en.bin` (~39 MB) placed in `models/stt/`.
- **Integration Point**: `AudioCaptureManager` in `capture.rs` holds an `Arc<Mutex<Option<Arc<WhisperStt>>>>`.
- **Inference Strategy**: Audio buffers are cloned and transcribed on a background `std::thread` to avoid blocking the CPAL audio callback.
- **Partial Transcriptions**: Every ~600ms (9600 samples), a partial transcription is emitted via `friday://voice-partial`.
- **Final Transcriptions**: On VAD silence closure (configurable 700ms–2000ms), a final transcription is committed via `friday://voice-command`.
- **Thread Budget**: Uses `available_parallelism() / 2` capped at 4 threads to avoid starving the UI.

### Fallback Chain
1. **Primary**: Native `whisper-rs` (in-process, zero external dependencies).
2. **Fallback 1**: Python `stt_service.py` (if GGML model is missing but Python + faster-whisper are available).
3. **Fallback 2**: Windows SAPI `speech_service.ps1` (last resort, limited grammar).

### Model Search Paths
The system searches these locations (in order) for `ggml-tiny.en.bin`:
1. `./models/stt/`
2. `<exe_dir>/models/stt/`
3. `<exe_dir>/resources/models/stt/`
4. `%APPDATA%/FRIDAY/models/stt/`

## Consequences
- **Positive**:
  - Zero external runtime dependencies for STT (no Python, no pip, no venvs).
  - Single binary distribution — the GGML model ships alongside the executable.
  - In-process inference avoids IPC overhead and process management complexity.
  - Complies with §03 latency budget: ≤ 250 ms recognition tail.
- **Negative**:
  - Requires `libclang` / LLVM for build (whisper-rs-sys uses bindgen for C++ FFI). CI must provision LLVM.
  - Adds ~39 MB to the distribution size (GGML model).
  - `tiny.en` is English-only; multilingual support requires `ggml-tiny.bin` (~75 MB) or larger models.
