import type { Fact } from "./types"

export interface MemoryLink { from: string; to: string; kind: "subject" | "source" }
const fallbackLabels = new Set(["saved fact", "saved context", "user-direct", "unknown", ""])
export function memoryLabel(fact: Fact): string {
  return fallbackLabels.has(fact.subject.trim().toLocaleLowerCase()) ? fact.value.trim().split(/\s+/).slice(0, 5).join(" ") || "Untitled memory" : fact.subject
}

/** Associations are explainable metadata matches, never inferred claims. */
export function memoryLinks(facts: Fact[]): MemoryLink[] {
  const links: MemoryLink[] = []
  const subjects = new Map<string, string>()
  const sources = new Map<string, string>()
  for (const fact of facts) {
    const subject = fact.subject.trim().toLocaleLowerCase()
    const source = fact.source_message_id
    const meaningfulSubject = !fallbackLabels.has(subject)
    const meaningfulSource = source && !fallbackLabels.has(source.trim().toLocaleLowerCase())
    const sameSubject = meaningfulSubject ? subjects.get(subject) : undefined
    const sameSource = meaningfulSource ? sources.get(source) : undefined
    if (sameSubject) links.push({ from: sameSubject, to: fact.id, kind: "subject" })
    else if (meaningfulSubject) subjects.set(subject, fact.id)
    if (sameSource && sameSource !== sameSubject) links.push({ from: sameSource, to: fact.id, kind: "source" })
    else if (meaningfulSource) sources.set(source, fact.id)
  }
  return links
}
