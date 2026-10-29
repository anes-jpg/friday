import type { Fact } from "./types"

export interface MemoryLink { from: string; to: string; kind: "subject" | "source" }

/** Associations are explainable metadata matches, never inferred claims. */
export function memoryLinks(facts: Fact[]): MemoryLink[] {
  const links: MemoryLink[] = []
  const subjects = new Map<string, string>()
  const sources = new Map<string, string>()
  for (const fact of facts) {
    const subject = fact.subject.trim().toLocaleLowerCase()
    const source = fact.source_message_id
    const sameSubject = subject ? subjects.get(subject) : undefined
    const sameSource = source && source !== "user-direct" ? sources.get(source) : undefined
    if (sameSubject) links.push({ from: sameSubject, to: fact.id, kind: "subject" })
    else if (subject) subjects.set(subject, fact.id)
    if (sameSource && sameSource !== sameSubject) links.push({ from: sameSource, to: fact.id, kind: "source" })
    else if (source && source !== "user-direct") sources.set(source, fact.id)
  }
  return links
}
