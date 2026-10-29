import { invokeCommand, isDesktop } from "./ipc"
import { newCapture, type Capture } from "./daily-work"

export async function readSharedClipboard(): Promise<string> {
  if (isDesktop) return (await import("@tauri-apps/plugin-clipboard-manager")).readText()
  return navigator.clipboard.readText()
}
export async function copySharedText(text: string): Promise<void> {
  if (isDesktop) await (await import("@tauri-apps/plugin-clipboard-manager")).writeText(text)
  else await navigator.clipboard.writeText(text)
}
const textExtensions = /\.(txt|md|markdown|json|jsonl|csv|tsv|log|diff|patch|[cm]?[jt]sx?|rs|py|html?|css|scss|sql|ya?ml|toml|xml|sh|ps1|ini|cfg|c|cpp|h|java|go|rb|vue|svelte)$/i
export async function captureFile(file: File, projectId?: string): Promise<Capture> {
  const base = { title: file.name, path: file.name, sourceKind: "file" as const, projectId }
  if (!textExtensions.test(file.name) && !["Dockerfile", "Makefile", ".gitignore"].includes(file.name)) return newCapture({ ...base, extractionError: "This document format is not supported yet. Share a text or code file." })
  if (file.size > 1_000_000) return newCapture({ ...base, extractionError: "This file exceeds the one megabyte capture limit." })
  const text = await file.text()
  if (text.includes("\0")) return newCapture({ ...base, extractionError: "This file contains binary data. Share a text or code file." })
  return newCapture({ ...base, text })
}
export async function captureWebpage(url: string): Promise<Capture> {
  const parsed = new URL(url)
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Use an HTTP or HTTPS URL without credentials.")
  if (isDesktop) return newCapture(await invokeCommand<Partial<Capture>>("capture_webpage", { url }))
  const response = await fetch(url, { credentials: "omit" })
  if (!response.ok) throw new Error(`Webpage returned HTTP ${response.status}.`)
  const html = await response.text()
  if (html.length > 2_000_000) throw new Error("Webpage exceeds the capture limit.")
  const document = new DOMParser().parseFromString(html, "text/html")
  document.querySelectorAll("script,style,noscript,nav,header,footer").forEach(node => node.remove())
  const text = (document.querySelector("article,main") || document.body).textContent?.replace(/\s+/g, " ").trim() || ""
  if (!text) throw new Error("No readable text was found. Paste the excerpt you want to share.")
  return newCapture({ title: document.title || parsed.hostname, sourceKind: "url", url: response.url || url, text: text.slice(0, 1_000_000) })
}
export async function captureScreenText(): Promise<Capture> {
  if (!isDesktop) throw new Error("Screen capture and local OCR require the Windows app.")
  const result = await invokeCommand<{ status: string; text: string; title?: string; error?: string; message?: string }>("screen_ocr", { target: "full_screen" })
  if (result.status !== "ok" || result.error || !result.text.trim()) throw new Error(result.error || result.message || "Local OCR returned no readable text.")
  return newCapture({ title: result.title || "Screen excerpt", sourceKind: "screen", text: result.text })
}
