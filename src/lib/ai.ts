/** FRIDAY Core AI Execution Engine (§05 & §08)
 *
 * Provides real LLM reasoning across both Desktop (Tauri IPC) and Browser environments:
 * - Direct execution against OpenAI-compatible endpoints (AgentRouter, Zhipu GLM, OpenAI, DeepSeek)
 * - Two-channel output parser: 'say' (natural conversational audio prose) and 'show' (rich markdown)
 * - Dynamic emotion attribution for human-like Kokoro / prosody voice delivery
 * - Telemetry tracking (TTFT, token metrics, model performance)
 */

import { invokeCommand, isDesktop } from "./ipc"
import type { Emotion, ToolCall, PendingPlanBackend } from "./types"

export interface AiTurnResult {
  say: string
  show: string
  emotion: Emotion
  model: string
  tokens: number
  ttftMs: number
  totalMs: number
  toolCalls: ToolCall[]
  pendingPlan?: PendingPlanBackend | null
  needsKey?: boolean
}

export function getAiConfig() {
  if (typeof window === "undefined") {
    return {
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "",
    }
  }

  const baseUrl = localStorage.getItem("friday_glm_base_url") || "https://api.deepseek.com/v1"
  const model = localStorage.getItem("friday_glm_heavy_model") || localStorage.getItem("friday_glm_model") || "deepseek-chat"
  const apiKey = localStorage.getItem("friday_glm_api_key") || ""

  return { baseUrl, model, apiKey }
}

const FRIDAY_SYSTEM_PROMPT = `You are FRIDAY (Female Replacement Intelligent Digital Assistant Youth), an intelligent desktop AI operator with the persona of Kerry Condon from the Marvel Cinematic Universe: composed, articulate, warm yet dryly witty, razor-sharp, and exceptionally competent.

OPERATOR FIRST PRINCIPLE:
You are an active desktop operator, NOT a passive chatbot. When asked to inspect files, check if an icon/shortcut/app exists, read the screen, look at open windows, or execute actions, DO NOT guess, speculate, or say 'I will look' without calling tools.

You communicate across two synchronized channels:
1. Spoken Channel ('say'): What you speak aloud to the user. Speak naturally, articulately, and warmly in 2 to 3 engaging sentences. Provide real conversational depth, your key insight or recommendation, and address the user like a trusted partner in the room. Don't be excessively clipped or terse. NEVER include URLs, file paths, bullet points, asterisks, or markdown in 'say'.
2. Visual Channel ('show'): What you display on screen. Use rich GitHub-flavored markdown, code blocks, clean tables, structured lists, and formatted data.

When providing your final answer, output a single valid JSON object strictly formatted as:
{
  "say": "Natural, articulate spoken sentences for text-to-speech synthesis.",
  "show": "Detailed markdown explanation, code, or structured answer for the screen.",
  "emotion": "focused" | "warm" | "bright" | "calm-concerned" | "dry-amused" | "apologetic" | "neutral"
}

Do not wrap the JSON in backticks or markdown code blocks if possible, or provide raw JSON only.`

export async function executeAiTurn(
  userPrompt: string,
  history: Array<{ role: string; content: string }> = []
): Promise<AiTurnResult> {
  const startTime = performance.now()
  const cleanPrompt = userPrompt.trim()

  // 1. Try Desktop Tauri IPC Backend first if running in Tauri
  if (isDesktop) {
    try {
      interface BackendTurnRes {
        say: string
        show: string
        latency_ms?: number
        ttft_ms?: number
        tokens?: number
        model?: string
        tool_calls?: Array<Record<string, unknown>>
        pending_plan?: PendingPlanBackend | null
      }

      const res = await invokeCommand<BackendTurnRes>("submit_utterance", {
        utterance: cleanPrompt,
        mode: "command",
      })

      if (res && (res.say || res.show)) {
        const totalMs = Math.round(performance.now() - startTime)
        return {
          say: res.say || "All set.",
          show: res.show || res.say,
          emotion: "focused",
          model: res.model || "glm-5.3",
          tokens: res.tokens || 60,
          ttftMs: res.ttft_ms || 250,
          totalMs,
          pendingPlan: res.pending_plan || null,
          toolCalls: (res.tool_calls || []).map((tc, i) => {
            const toolName = String(tc.tool_name || tc.name || "tool.run")
            const rawTier = String(tc.tier || "green").toLowerCase()
            const tier: ToolCall["tier"] = rawTier === "red" ? "red" : rawTier === "amber" ? "amber" : "green"
            const outputStr = typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2)
            return {
              id: String(tc.id || `tc-${Date.now()}-${i}`),
              name: toolName,
              tier,
              status: (tc.status as ToolCall["status"]) || "ok",
              args: (tc.args as Record<string, unknown>) || {},
              output: outputStr,
              duration_ms: typeof tc.duration_ms === "number" ? tc.duration_ms : 120,
              started_at: String(tc.started_at || new Date().toISOString()),
            }
          }),
        }
      }
    } catch (e) {
      console.warn("[FRIDAY AI] Native IPC failed, falling back to direct HTTP:", e)
    }
  }

  // 2. Direct HTTP / Browser Execution
  const config = getAiConfig()
  const cleanUrl = config.baseUrl.trim().replace(/\/+$/, "")
  const effectiveUrl = cleanUrl.endsWith("/chat/completions")
    ? cleanUrl
    : cleanUrl.includes("/api/paas/v4")
      ? `${cleanUrl}/chat/completions`
      : cleanUrl.endsWith("/v1") || cleanUrl.endsWith("/beta")
        ? `${cleanUrl}/chat/completions`
        : `${cleanUrl}/v1/chat/completions`

  if (!config.apiKey || config.apiKey.trim() === "") {
    // Intelligent, persona-accurate guidance when API key is missing
    const totalMs = Math.round(performance.now() - startTime)
    return {
      say: "I'm right here, but my AI reasoning engine needs an API key. Please open Settings and enter your key so we can get to work.",
      show: `### FRIDAY · AI Fleet Idle\n\nI'm ready to assist you, but the reasoning fleet is offline because no API key is configured.\n\nTo activate live AI reasoning:\n1. Open **Settings** (click the gear icon or \`Alt+Shift+Space\`).\n2. In the **Reasoning** section, paste your API key (e.g. from DeepSeek, AgentRouter, Zhipu AI, or OpenAI).\n3. Click **Save Settings** and **Test Connection**.\n\nYour key is stored securely in your local environment and never sent anywhere except your configured endpoint.`,
      emotion: "warm",
      model: config.model,
      tokens: 0,
      ttftMs: 0,
      totalMs,
      toolCalls: [],
      needsKey: true,
    }
  }

  const messagesPayload = [
    { role: "system", content: FRIDAY_SYSTEM_PROMPT },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: cleanPrompt },
  ]

  const isDeepseekReasoner = config.model.includes("deepseek-reasoner") || config.model === "deepseek-r1"
  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: messagesPayload,
    max_tokens: 2048,
  }
  if (!isDeepseekReasoner) {
    requestBody.temperature = 0.3
  }

  let ttftMs = 0
  const fetchStart = performance.now()

  try {
    const res = await fetch(effectiveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(requestBody),
    })

    ttftMs = Math.round(performance.now() - fetchStart)

    if (!res.ok) {
      const errText = await res.text()
      const totalMs = Math.round(performance.now() - startTime)
      return {
        say: "I ran into a connection error with the AI endpoint. Please check your settings.",
        show: `### Reasoning Service Error\n\n**HTTP ${res.status}**: ${res.statusText}\n\n\`\`\`json\n${errText}\n\`\`\`\n\nPlease check your provider endpoint and API key in **Settings**.`,
        emotion: "calm-concerned",
        model: config.model,
        tokens: 0,
        ttftMs,
        totalMs,
        toolCalls: [],
      }
    }

    const data = await res.json()
    const rawContent = data.choices?.[0]?.message?.content || ""
    const tokens = data.usage?.total_tokens || rawContent.split(/\s+/).length

    // Parse two-channel output
    let say = ""
    let show = ""
    let emotion: Emotion = "focused"

    // Remove thinking tags if present
    const strippedRaw = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()

    // Try parsing as JSON first
    const jsonMatch = strippedRaw.match(/\{[\s\S]*"say"[\s\S]*"show"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        say = parsed.say || ""
        show = parsed.show || ""
        if (parsed.emotion) emotion = parsed.emotion as Emotion
      } catch {
        // Fallback resilient key matching if strict JSON parse failed
        const sayMatch = strippedRaw.match(/"say"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        const showMatch = strippedRaw.match(/"show"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (sayMatch) say = sayMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"')
        if (showMatch) show = showMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
      }
    }

    if (!say || !show) {
      // If model returned plain text or markdown instead of JSON
      let cleanText = strippedRaw.trim()

      // Strip any residual unparsed JSON wrapper from cleanText
      if (cleanText.startsWith("{") && cleanText.includes('"show"')) {
        const sMatch = cleanText.match(/"show"\s*:\s*"([\s\S]*)"/)
        if (sMatch) {
          cleanText = sMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
        }
      }

      // Extract conversational opening (up to 4 sentences) for articulate Kerry Condon speech
      const firstSentences = cleanText
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[*_#`[\]]/g, "")
        .split(/(?<=[.!?])\s+/)
        .slice(0, 4)
        .join(" ")
        .trim()

      say = say || firstSentences || "I've pulled up the full breakdown on your screen."
      show = show || cleanText
    }

    // Clean escaped newlines and tabs if show was stringified
    show = show.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"')

    const totalMs = Math.round(performance.now() - startTime)

    return {
      say,
      show,
      emotion,
      model: data.model || config.model,
      tokens,
      ttftMs,
      totalMs,
      toolCalls: [],
    }
  } catch (err: unknown) {
    const totalMs = Math.round(performance.now() - startTime)
    const msg = err instanceof Error ? err.message : String(err)
    return {
      say: "I couldn't reach the AI model server. Check network connectivity in Settings.",
      show: `### Network Failure\n\nFailed to connect to \`${effectiveUrl}\`:\n\n> ${msg}\n\nPlease check your internet connection or update the provider endpoint in **Settings**.`,
      emotion: "apologetic",
      model: config.model,
      tokens: 0,
      ttftMs,
      totalMs,
      toolCalls: [],
    }
  }
}
