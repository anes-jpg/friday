import { z } from "zod"
import { placeJson } from "./place-transport"
import { safePlaceWebsite, type MapPlace, type BusinessDetailField } from "./places"
import { businessPhone, businessWebsite } from "./business-workflow"
import { isDesktop, invokeCommand } from "./ipc"

const entities = z.object({ entities: z.record(z.object({ claims: z.record(z.array(z.object({ rank: z.string().optional(), mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }) }))).optional() })) })
/** Only the exact Wikidata entity linked by this listing may enrich its facts. */
export async function enrichLinkedBusiness(place: MapPlace, signal: AbortSignal): Promise<MapPlace> {
  const id = place.tags.wikidata
  if (!/^Q\d+$/.test(id || "") || (businessPhone(place) && businessWebsite(place))) return place
  try {
    const params = new URLSearchParams({ action: "wbgetentities", ids: id, props: "claims", format: "json", origin: "*" })
    const data = entities.parse(await placeJson(`https://www.wikidata.org/w/api.php?${params}`, signal))
    const claims = data.entities[id]?.claims
    const value = (property: string) => claims?.[property]?.find(claim => claim.rank !== "deprecated" && typeof claim.mainsnak.datavalue?.value === "string")?.mainsnak.datavalue?.value
    const details = { ...place.details }
    const phone = value("P1329"), website = value("P856")
    const evidence = { sourceUrl: `https://www.wikidata.org/wiki/${id}`, fetchedAt: Date.now(), provider: "wikidata" as const }
    if (!businessPhone(place) && typeof phone === "string" && phone.replace(/\D/g, "").length >= 6) details.phone = { ...evidence, value: phone.slice(0, 120) }
    if (!businessWebsite(place) && typeof website === "string" && safePlaceWebsite(website)) details.website = { ...evidence, value: safePlaceWebsite(website) || website }
    return { ...place, details }
  } catch (error) { if (signal.aborted) throw error; return place }
}
const clean = (text: string) => text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim()
const decoded = (text: string) => { try { return decodeURIComponent(clean(text)) } catch { return clean(text) } }
export interface BusinessSiteFacts { url: string; title: string; phones: string[]; emails: string[]; names: string[]; contactLinks: string[] }
/** Extract candidates; the caller must confirm the site's business identity before saving. */
export function parseBusinessSite(html: string, rawUrl: string): BusinessSiteFacts {
  const url = safePlaceWebsite(rawUrl)
  if (!url) throw new Error("Invalid website source")
  const phones = new Set<string>(), emails = new Set<string>(), names = new Set<string>(), contactLinks = new Set<string>()
  const phone = (text: string) => { const value = decoded(text).trim(); if (value.length <= 120 && value.replace(/\D/g, "").length >= 6 && /^[+\d\s().;/\-]+$/.test(value)) phones.add(value) }
  const email = (text: string) => { const value = decoded(text.split("?")[0]); if (/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) && value.length < 320) emails.add(value) }
  for (const match of html.matchAll(/href\s*=\s*["']tel:([^"'<>]*)["']/gi)) phone(match[1])
  for (const match of html.matchAll(/href\s*=\s*["']mailto:([^"'<>]*)["']/gi)) email(match[1])
  let visited = 0
  const walk = (node: unknown, depth = 0) => {
    if (depth > 8 || ++visited > 300 || !node || typeof node !== "object") return
    if (Array.isArray(node)) { node.slice(0, 50).forEach(value => walk(value, depth + 1)); return }
    const record = node as Record<string, unknown>
    if (record["@type"]) {
      if (typeof record.name === "string") names.add(clean(record.name).slice(0, 180))
      if (typeof record.telephone === "string") phone(record.telephone)
      if (typeof record.email === "string") email(record.email)
    }
    if (record["@graph"]) walk(record["@graph"], depth + 1)
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(match[1]) as unknown) } catch { /* A broken structured-data block does not invalidate the page. */ } }
  for (const match of html.matchAll(/href\s*=\s*["']([^"']*(?:contact|about|mentions|contacter)[^"']*)["']/gi)) {
    try { const link = new URL(decoded(match[1]), url); if (link.hostname === new URL(url).hostname && ["http:", "https:"].includes(link.protocol)) contactLinks.add(link.href) } catch { /* Ignore malformed links. */ }
  }
  return { url, title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Website page").slice(0, 180), phones: [...phones].slice(0, 12), emails: [...emails].slice(0, 12), names: [...names].slice(0, 8), contactLinks: [...contactLinks].slice(0, 6) }
}
export async function readBusinessSite(url: string): Promise<BusinessSiteFacts> {
  if (!isDesktop) throw new Error("Public-site research runs in the Windows app.")
  const page = await invokeCommand<{ url: string; html: string }>("read_business_site", { url })
  return parseBusinessSite(page.html, page.url)
}
export async function searchBusinessSources(place: MapPlace) {
  if (!isDesktop) throw new Error("Free source search runs in the Windows app. Use the browser search links here.")
  return invokeCommand<Array<{ title: string; url: string }>>("search_business_sources", { query: `${place.name} ${place.address || ""} contact téléphone site officiel` })
}
export function verifiedBusiness(place: MapPlace, values: Partial<Record<BusinessDetailField, string>>, source: string, provider: "website" | "manual" = "manual"): MapPlace {
  const sourceUrl = safePlaceWebsite(source)
  if (!sourceUrl) throw new Error("Add a public source URL for the details you verified.")
  const details = { ...place.details }
  for (const [field, text] of Object.entries(values)) {
    if (!text?.trim()) { delete details[field as BusinessDetailField]; continue }
    if (field === "phone" && (!/^[+\d\s().;/\-]+$/.test(text) || text.replace(/\D/g, "").length < 6)) throw new Error("Enter a valid phone number")
    if (field === "email" && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(text.trim())) throw new Error("Enter a valid contact email")
    if (field === "website" && !safePlaceWebsite(text)) throw new Error("Enter a valid business website")
    details[field as BusinessDetailField] = { value: text.trim().slice(0, 2000), sourceUrl, fetchedAt: Date.now(), provider }
  }
  return { ...place, details }
}
