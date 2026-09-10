# ADR 002: GLM-4 Model Gateway & Windows Credential Manager Storage

## Status
Accepted

## Context
FRIDAY operates as a desktop operator on an Intel Core i7-8565U ultrabook with thermally constrained hardware and 2 GB VRAM (NVIDIA MX250). Local 7B+ LLMs run at 4–8 tokens/second, which creates unacceptable dead air (10–15s latency) on spoken turns. Furthermore, plaintext API keys in `.env` files or application config within `%APPDATA%` represent severe security risks for shipped desktop applications.

## Decision
1. **Single Cloud Brain**: GLM via Zhipu AI / BigModel OpenAI-compatible endpoint is the sole brain over the network. Wake word, VAD, ASR, TTS, embeddings, and intent routing run 100% locally on CPU.
2. **Two-Tier Model Routing**:
   - `heavy_model` (`glm-4-plus`): Used for multi-step reasoning, plan synthesis, and tool calling.
   - `light_model` (`glm-4-flash`): Used for sub-15ms intent screening, fact extraction, thread summarization, and per-sentence emotional delivery directives.
3. **Hardware Secrets Management**:
   - API keys are stored in the Windows Credential Manager via the `keyring` crate under the service name `friday-assistant` and key `glm-api-key`.
   - API keys are protected by Windows DPAPI encryption and are never written to SQLite, debug logs, or crash reports.
4. **Server-Sent Events (SSE) Streaming**:
   - Delta tokens and fragmented tool-call arguments are accumulated per index until the finish reason arrives, avoiding incomplete JSON parse errors.

## Consequences
- Single network dependency keeps API costs flat and predictable.
- Audio and speech never leave the local machine; only approved text enters the provider network hop.
- Sub-second first-token response times when combined with pre-warmed TLS connections.
