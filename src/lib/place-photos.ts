import { z } from "zod"
import { placeJson } from "./place-transport"
import { safePlaceWebsite, type MapPlace } from "./places"

export interface PlacePhoto {
  id: string
  url: string
  sourceUrl: string
  title: string
  credit: string
  license: string
  scope: "place" | "nearby"
}
const commonsSchema = z.object({ query: z.object({ pages: z.record(z.object({
  pageid: z.number(), title: z.string(), imageinfo: z.array(z.object({
    thumburl: z.string().optional(), url: z.string(), descriptionurl: z.string(),
    mime: z.string().optional(), extmetadata: z.record(z.object({ value: z.union([z.string(), z.number()]) })).optional(),
  })).optional(),
})) }).optional() })
const plainText = (value: string | number | undefined) => String(value ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()

export function parseCommonsPhotos(data: unknown, scope: PlacePhoto["scope"]): PlacePhoto[] {
  const pages = commonsSchema.parse(data).query?.pages ?? {}
  return Object.values(pages).flatMap(page => {
    const info = page.imageinfo?.[0]
    if (!info || (info.mime && !["image/jpeg", "image/png", "image/webp"].includes(info.mime))) return []
    const url = safePlaceWebsite(info.thumburl || info.url), sourceUrl = safePlaceWebsite(info.descriptionurl)
    if (!url || !sourceUrl || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(new URL(url).hostname) || new URL(sourceUrl).hostname !== "commons.wikimedia.org") return []
    return [{ id: String(page.pageid), url, sourceUrl, scope, title: plainText(page.title.replace(/^File:/, "").replace(/\.[^.]+$/, "")),
      credit: plainText(info.extmetadata?.Artist?.value) || "Credit on source page", license: plainText(info.extmetadata?.LicenseShortName?.value) || "License on source page" }]
  })
}
async function json(url: string, signal: AbortSignal): Promise<unknown> {
  const data: unknown = await placeJson(url, signal)
  if (data && typeof data === "object" && "error" in data) throw new Error("Photos could not load. Try again.")
  return data
}
async function commons(params: Record<string, string>, scope: PlacePhoto["scope"], signal: AbortSignal) {
  const query = new URLSearchParams({ action: "query", prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "640", format: "json", origin: "*", ...params })
  return parseCommonsPhotos(await json(`https://commons.wikimedia.org/w/api.php?${query}`, signal), scope)
}
export async function placePhotos(place: MapPlace, signal: AbortSignal): Promise<PlacePhoto[]> {
  const image = place.tags.image
  const category = place.tags.wikimedia_commons?.startsWith("Category:") ? place.tags.wikimedia_commons : undefined
  if (category) {
    try { const photos = await commons({ generator: "categorymembers", gcmtitle: category, gcmtype: "file", gcmlimit: "8" }, "place", signal); if (photos.length) return photos }
    catch (error) { if (signal.aborted) throw error }
  }
  let file = place.tags.wikimedia_commons?.startsWith("File:") ? place.tags.wikimedia_commons : image?.startsWith("File:") ? image : undefined
  if (!file && /^Q\d+$/.test(place.tags.wikidata || "")) {
    try {
      const params = new URLSearchParams({ action: "wbgetentities", ids: place.tags.wikidata, props: "claims", format: "json", origin: "*" })
      const data = z.object({ entities: z.record(z.object({ claims: z.object({ P18: z.array(z.object({ mainsnak: z.object({ datavalue: z.object({ value: z.string() }).optional() }) })).optional() }).optional() })) }).parse(await json(`https://www.wikidata.org/w/api.php?${params}`, signal))
      const filename = data.entities[place.tags.wikidata]?.claims?.P18?.[0]?.mainsnak.datavalue?.value
      if (filename) file = `File:${filename}`
    } catch (error) { if (signal.aborted) throw error }
  }
  if (file) {
    try { const photos = await commons({ titles: file }, "place", signal); if (photos.length) return photos }
    catch (error) { if (signal.aborted) throw error }
  }
  const direct = safePlaceWebsite(image)
  if (direct && !file) return [{ id: `${place.id}:image`, url: direct, sourceUrl: direct, title: place.name, scope: "place", credit: "Image linked by the OpenStreetMap listing", license: "See image source" }]
  return commons({ generator: "geosearch", ggscoord: `${place.lat}|${place.lng}`, ggsradius: "1000", ggsnamespace: "6", ggslimit: "8" }, "nearby", signal)
}
