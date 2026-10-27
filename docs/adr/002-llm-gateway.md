# ADR 002: OpenAI-Compatible Model Gateway & Windows Credential Manager Storage

## Status
Accepted

## Context
FRIDAY operates as a desktop operator on an Intel Core i7-8565U ultrabook with thermally constrained hardware and 2 GB VRAM (NVIDIA MX250). Local 7B+ LLMs run at 4–8 tokens/second, which creates unacceptable dead air (10–15s latency) on spoken turns. Furthermore, plaintext API keys in `.env` files or application config within `%APPDATA%` represent severe security risks for shipped desktop applications.

## Decision
1. **Configurable Model Providers**: Support local and remote OpenAI-compatible endpoints and arbitrary model names. GLM is one supported provider. Wake word, VAD, ASR, TTS, embeddings, and intent routing run locally on CPU. This policy reflects the user's explicit clarification on 2026-10-25.
2. **Two-Tier Model Routing**:
   - `heavy_model`: A configurable model used for multi-step reasoning, plan synthesis, and tool calling.
   - `light_model`: A configurable model used for fact extraction, thread summarization, and delivery directives. Local rules and embeddings handle latency-sensitive intent routing.
3. **Hardware Secrets Management**:
   - API keys are stored in the Windows Credential Manager via the `keyring` crate under the service name `friday-assistant` and key `glm-api-key`.
   - API keys are protected by Windows DPAPI encryption and are never written to SQLite, debug logs, or crash reports.
4. **Server-Sent Events (SSE) Streaming**:
   - Delta tokens and fragmented tool-call arguments are accumulated per index until the finish reason arrives, avoiding incomplete JSON parse errors.

## Consequences
- Provider and model selection remain under user control, including endpoint, model name, and API key configuration.
- Audio and speech never leave the local machine; only approved text enters the provider network hop.
- Sub-second first-token response times when combined with pre-warmed TLS connections.
