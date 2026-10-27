import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_AI_URL, validateProviderConfig } from "../src/lib/ai-config"
import { executeAiTurn, getAiConfig, normalizeSay } from "../src/lib/ai"
import { sendChatMessage, useFriday } from "../src/lib/store"

afterEach(() => vi.unstubAllGlobals())

describe("Reasoning recovery", () => {
  it.each([
    { endpoint: "https://api.openai.com/v1", model: "gpt-4o", key: "test-openai-key" },
    { endpoint: "http://127.0.0.1:1234/v1", model: "qwen3:latest", key: "" },
  ])("sends the configured model to $endpoint", async ({ endpoint, model, key }) => {
    const values: Record<string, string> = {
      friday_glm_base_url: endpoint,
      friday_glm_heavy_model: model,
      friday_glm_api_key: key,
    }
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", { getItem: (name: string) => values[name] || null })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ say: "Ready.", show: "Configured provider response." }) } }],
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await executeAiTurn("Explain the current instruction")
    expect(result.failed).not.toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${endpoint}/chat/completions`)
    expect(JSON.parse(String(request.body))).toMatchObject({ model })
  })

  it("preserves OpenAI-compatible local and remote model configuration", () => {
    expect(getAiConfig()).toMatchObject({ baseUrl: DEFAULT_AI_URL, model: "friday-1b-operator" })
    expect(validateProviderConfig(DEFAULT_AI_URL, "glm-4-plus", "glm-4-flash")).toBeNull()
    for (const url of ["http://127.0.0.1:11434/v1", "https://localhost/v1", "https://127.0.0.2/v1", "https://[::1]/v1"]) {
      expect(validateProviderConfig(url, "custom-model:latest")).toBeNull()
    }
    expect(validateProviderConfig("https://api.deepseek.com/v1", "deepseek-chat")).toBeNull()
    expect(validateProviderConfig("not a URL", "custom-model")).not.toBeNull()
  })

  it("keeps spoken output to two sentences and removes paths, URLs, and markdown", () => {
    const speech = normalizeSay("**Done.** Read [the report](https://example.com) at C:\\work\\report.txt and /tmp/report.txt. Third sentence.")
    expect(speech).toMatch(/^Done\. Read the report/)
    expect(speech).not.toMatch(/https|report.txt|\*|Third/)
  })

  it("records a failed HTTP turn as failed in utterance state", async () => {
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", { getItem: () => null })
    useFriday.setState({ threads: [{ id: "recovery", title: "Recovery", pinned: false, messages: [] }], activeThreadId: "recovery" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })))
    await sendChatMessage("Explain how to organize my notes")
    const state = useFriday.getState()
    expect(state.utterance.heard).toBe("Explain how to organize my notes")
    expect(state.utterance.plan[0].status).toBe("failed")
    expect(state.utterance.doing).toBeNull()
    expect(state.utterance.result?.say).toContain("connection error")
  })

  it("uses the configured model name when selecting a model with a separate fleet ID", async () => {
    const model = { ...useFriday.getState().aiModels[0], id: "reasoning-slot", name: "deepseek-chat", provider: "openai_compatible", base_url: "https://api.deepseek.com/v1" }
    useFriday.setState({ aiModels: [model] })
    await useFriday.getState().setActiveModel(model.id)
    expect(useFriday.getState().glmSettings.heavyModel).toBe("deepseek-chat")
  })

  it("rejects a browser HTTP failure without claiming the operation completed", async () => {
    const values: Record<string, string> = { friday_glm_base_url: DEFAULT_AI_URL, friday_glm_heavy_model: "glm-4-plus", friday_glm_api_key: "test-key" }
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", { getItem: (key: string) => values[key] || null })
    const fetchMock = vi.fn().mockResolvedValue(new Response("Invalid key", { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)
    const response = await executeAiTurn("Explain this instruction")
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(response.failed).toBe(true)
    expect(response.show).toContain("401")
  })

  it("marks a valid browser OpenAI-compatible response as successful and preserves screen detail", async () => {
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", { getItem: (key: string) => key === "friday_glm_api_key" ? "test-key" : null })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ say: "Done. See https://example.com for details. Extra sentence.", show: "## Full details\nhttps://example.com" }) } }] }), { status: 200 })))
    const response = await executeAiTurn("Explain this instruction")
    expect(response.failed).not.toBe(true)
    expect(response.say).not.toContain("https")
    expect(response.say).not.toContain("Extra sentence")
    expect(response.show).toContain("https://example.com")
  })
})
