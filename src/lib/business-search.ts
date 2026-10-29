import { z } from "zod"
import { invokeCommand, isDesktop } from "./ipc"
import { safePlaceWebsite, type MapPlace } from "./places"

const sourceUrl = z.string().max(4000).url().refine(value => Boolean(safePlaceWebsite(value)))
const captureSchema = z.object({
  url: sourceUrl, title: z.string().max(200), text: z.string().max(20000),
  selectedName: z.string().max(180).nullable(), phones: z.array(z.string().max(120)).max(12),
  addresses: z.array(z.string().max(500)).max(8),
  results: z.array(z.object({ title: z.string().max(200), url: sourceUrl, snippet: z.string().max(900) })).max(20),
})
export type BusinessSearchCapture = z.infer<typeof captureSchema>
let searchWindow: string | undefined
export function currentBusinessSearchWindow() { return searchWindow }
export async function openBusinessSearch(query: string, maps: boolean): Promise<string> {
  if (!isDesktop) throw new Error("Google result import runs in the Windows app.")
  searchWindow = await invokeCommand<string>("open_business_search", { query, maps, label: searchWindow ?? null })
  return searchWindow
}
export async function captureBusinessSearch(label: string): Promise<BusinessSearchCapture> {
  if (!isDesktop) throw new Error("Google result import runs in the Windows app.")
  return captureSchema.parse(await invokeCommand<unknown>("capture_business_search", { label }))
}
/** The search area's center is context only; never represent it as a business pin. */
export function businessSearchLead(name: string, source: string, center: [number, number], query: string, text: string): MapPlace {
  const url = safePlaceWebsite(source)
  if (!url || !name.trim() || name.trim().length > 180) throw new Error("Review the business name and source URL before saving a lead.")
  const [lng, lat] = center
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) throw new Error("Invalid search area")
  return { id: `research/${crypto.randomUUID()}`, name: name.trim(), category: "Research lead", lat, lng, tags: {},
    locationPrecision: "area", researchSourceUrl: url, researchQuery: query.slice(0, 1000), researchExcerpt: text.slice(0, 4000),
    provenance: { source: "Google browser research · user reviewed", fetchedAt: Date.now(), cached: false, stale: false } }
}
