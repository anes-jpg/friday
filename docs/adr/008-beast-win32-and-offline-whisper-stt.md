# ADR 008: Faster-Whisper Local STT, Beast Code Intelligence, and Win32 Desktop Perception

## Status
Accepted (Phase M6 Local Intelligence & Desktop Operations)

## Context
1. **Speech-to-Text Listener Limitation**:
   - The original voice capture relied on Windows SAPI dictation grammar (`speech_service.ps1`), which possessed a limited 27-verb fixed grammar or produced empty/hallucinated dictation outputs on natural language phrases.
   - Cloud speech APIs introduce network latency (300–800 ms), require external API keys, and violate the constitutional privacy rule: *"Zero audio leaves the machine"*.
2. **Desktop Perception & System Control**:
   - Operating Windows requires deep native integration: enumerating top-level windows (`EnumWindows`), window title and PID filtering, active window focus (`SetForegroundWindow`), and high-performance DXGI/GDI screenshot capture without external dependencies.
3. **Local Code Intelligence**:
   - For programming assistance, the assistant requires immediate local code context without waiting for heavy external language servers. It requires AST-aware code chunking, trigram BM25 indexing, and Reciprocal Rank Fusion (RRF) search.

## Decision

### 1. Faster-Whisper Local Speech-to-Text (STT) Subsystem
- **Model**: OpenAI Whisper `tiny.en` quantized to `int8` with CTranslate2.
- **Footprint**: 39 MB weights, 72 MB runtime footprint on disk (`models/stt/`).
- **Performance**:
  - Cold load: ~0.68 s
  - Inference latency: ~74 ms on standard Intel/AMD multi-core CPUs.
  - Recognition tail after speech stops: ≤ 250 ms (satisfying §03 latency budget).
- **Architecture**:
  - Audio pipeline captures 16 kHz mono float32 PCM via CPAL in Rust (`AudioCaptureManager` in `src-tauri/src/voice/capture.rs`).
  - Streams audio over stdin to `scripts/stt_service.py` with base64 encoded chunks.
  - Emits real-time partial transcriptions every ~600 ms (`friday://voice-partial`) and commits final commands (`friday://voice-command`) upon VAD silence closure.
  - Fallback: Gracefully falls back to SAPI `speech_service.ps1` if Python or `faster-whisper` is unavailable.

### 2. Beast Engine Code Intelligence
- Located in `src-tauri/src/agent/beast.rs`.
- Provides two-stage hybrid code search combining:
  1. Trigram index & BM25 lexical ranking.
  2. AST symbol tree extractor (functions, structs, classes, traits, interfaces).
  3. Reciprocal Rank Fusion ($RRF = \sum \frac{1}{60 + rank}$) for relevance scoring.
- Provides AST chunking (`code_chunk`) respecting syntax boundaries for Rust, TypeScript/JavaScript, and Python.

### 3. Win32 Desktop Perception & Window Management
- Located in `src-tauri/src/tools/mod.rs`.
- Implements:
  - `list_windows`: Enumerates visible top-level windows, PIDs, process names, and window titles using Win32 API.
  - `focus_window`: Brings requested window to foreground (`ShowWindow` + `SetForegroundWindow`).
  - `capture_screen`: Captures active window or virtual screen rect as base64 PNG data URL for visual inspection.

### 4. OpenCodeReview & Delphi Tools
- **OpenCodeReview** (`src-tauri/src/agent/review.rs`): Inspects git diff bundles, detects dangerous `unwrap()` calls, hardcoded secrets, and formatting anomalies before commit.
- **Delphi Suite** (`src-tauri/src/tools/delphi.rs`): Media probing (MIME, video/audio stream metadata) and JSON formatting/validation without external dependencies.

## Consequences
- **Positive**:
  - Complete, natural speech transcription with instantaneous live partial updates on the dashboard and prompt inputs.
  - Zero audio data leaves the local workstation.
  - Full desktop control and visual understanding available to conversational and command modes.
- **Compliance**:
  - Conforms to all §01, §02, §03, and §04 laws and latency budgets in `AGENTS.md`.
