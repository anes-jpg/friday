export const DEFAULT_AI_URL = "http://127.0.0.1:11434/v1"
export const DEFAULT_HEAVY_MODEL = "friday-1b-operator"
export const DEFAULT_LIGHT_MODEL = "friday-1b-operator"

export function validateProviderConfig(baseUrl: string, ...models: string[]): string | null {
  try {
    const url = new URL(baseUrl.trim())
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "Use an HTTP or HTTPS OpenAI-compatible endpoint."
    }
  } catch {
    return "Enter a valid OpenAI-compatible endpoint."
  }
  if (models.some((model) => !model.trim())) {
    return "Enter a model name for reasoning."
  }
  return null
}

export function isLocalAiEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "").toLowerCase()
    return host === "localhost" || host.endsWith(".localhost") || host === "::1" || host.startsWith("127.")
  } catch { return false }
}
