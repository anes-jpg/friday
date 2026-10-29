import { z } from "zod"
import { placeJson, withPlaceSources, sourceFor, type PlaceProvenance } from "./place-transport"

export const ALGERIA_CENTER: [number, number] = [3.0588, 36.7538]
export const ALGERIA_CITIES = [
  { name: "Alger", center: ALGERIA_CENTER },
  { name: "Oran", center: [-0.6417, 35.6969] as [number, number] },
  { name: "Constantine", center: [6.6147, 36.365] as [number, number] },
  { name: "Annaba", center: [7.7667, 36.9] as [number, number] },
  { name: "Tizi Ouzou", center: [4.0497, 36.7169] as [number, number] },
]
export type PlaceCategory = "all" | "shop" | "food" | "health" | "services" | "leisure" | "beauty" | "hotel"
export type BusinessDetailField = "phone" | "email" | "website" | "address" | "openingHours"
export interface BusinessDetailEvidence { value: string; sourceUrl: string; fetchedAt: number; provider: "wikidata" | "website" | "manual" }
export interface MapPlace {
  id: string
  osmType?: "node" | "way" | "relation"
  osmId?: number
  name: string
  lat: number
  lng: number
  category: string
  address?: string
  tags: Record<string, string>
  provenance?: PlaceProvenance
  details?: Partial<Record<BusinessDetailField, BusinessDetailEvidence>>
}
const savedPlaceSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), category: z.string(),
  lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  osmType: z.enum(["node", "way", "relation"]).optional(), osmId: z.number().int().positive().optional(),
  address: z.string().optional(), tags: z.record(z.string()),
  provenance: z.object({ source:z.string(), fetchedAt:z.number(), cached:z.boolean(), stale:z.boolean() }).optional(),
  details: z.record(z.enum(["phone", "email", "website", "address", "openingHours"]), z.object({ value: z.string().max(2000), sourceUrl: z.string().url().refine(value => Boolean(safePlaceWebsite(value)), "HTTP or HTTPS source required"), fetchedAt: z.number().finite(), provider: z.enum(["wikidata", "website", "manual"]) })).optional(),
})
export function parseSavedPlaces(data: unknown): MapPlace[] { return z.array(savedPlaceSchema).parse(data) }
const tagsSchema = z.record(z.string())
const nominatimSchema = z.array(z.object({
  osm_type: z.enum(["node", "way", "relation"]), osm_id: z.number(), lat: z.string(), lon: z.string(),
  name: z.string().optional(), display_name: z.string(), category: z.string().optional(), type: z.string().optional(),
  extratags: tagsSchema.nullish(), address: tagsSchema.optional(),
}))
const photonSchema = z.object({ features: z.array(z.object({ geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }), properties: z.object({
  osm_type: z.enum(["N", "W", "R"]), osm_id: z.number(), name: z.string().optional(), osm_key: z.string().optional(), osm_value: z.string().optional(),
  countrycode: z.string().optional(), housenumber: z.string().optional(), street: z.string().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional(), postcode: z.string().optional(),
}) })) })
const overpassSchema = z.object({ elements: z.array(z.object({
  type: z.enum(["node", "way", "relation"]), id: z.number(), lat: z.number().optional(), lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(), tags: tagsSchema.optional(),
})) })
const osmAreaSchema = z.object({ elements: z.array(z.object({ type: z.enum(["node", "way", "relation"]), id: z.number(), lat: z.number().optional(), lon: z.number().optional(), nodes: z.array(z.number()).optional(), tags: tagsSchema.optional() })) })
let overpassRetryAt = 0
let nominatimRetryAt = 0
function matchesCategory(tags: Record<string, string>, category: PlaceCategory): boolean {
  const amenity = tags.amenity || ""
  if (category === "shop") return Boolean(tags.shop)
  if (category === "beauty") return ["hairdresser", "beauty", "cosmetics", "massage"].includes(tags.shop || "")
  if (category === "hotel") return ["hotel", "motel", "guest_house", "hostel"].includes(tags.tourism || "")
  if (category === "food") return ["restaurant", "cafe", "fast_food"].includes(amenity) || tags.shop === "bakery"
  if (category === "health") return ["pharmacy", "hospital", "clinic", "dentist", "doctors"].includes(amenity)
  if (category === "services") return Boolean(tags.office || tags.craft) || ["bank", "atm", "post_office", "fuel", "police", "townhall"].includes(amenity)
  if (category === "leisure") return Boolean(tags.tourism || tags.leisure) || ["cinema", "theatre", "library", "arts_centre"].includes(amenity)
  return Boolean(tags.shop || tags.office || tags.craft || tags.tourism || tags.leisure) || Boolean(amenity && !["bench", "waste_basket", "parking_space", "waste_disposal", "recycling", "parking_entrance"].includes(amenity))
}
export function parseOSMArea(data: unknown, category: PlaceCategory): MapPlace[] {
  const { elements } = osmAreaSchema.parse(data)
  const nodes = new Map(elements.filter(element => element.type === "node" && element.lat !== undefined && element.lon !== undefined).map(element => [element.id, element]))
  const candidates = elements.filter(element => matchesCategory(element.tags || {}, category)).map(element => {
    const positions = [...new Set(element.nodes || [])].flatMap(id => { const node = nodes.get(id); return node?.lat !== undefined && node.lon !== undefined ? [{ lat: node.lat, lon: node.lon }] : [] })
    return { ...element, ...(positions.length ? { center: { lat: positions.reduce((total, node) => total + node.lat, 0) / positions.length, lon: positions.reduce((total, node) => total + node.lon, 0) / positions.length } } : {}) }
  })
  return parseNearbyPlaces({ elements: candidates })
}

export function safePlaceWebsite(value?: string): string | undefined {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function parsePlaceSearch(data: unknown): MapPlace[] {
  return nominatimSchema.parse(data).flatMap(item => {
    const lat = Number(item.lat), lng = Number(item.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    return [{ id: `${item.osm_type}/${item.osm_id}`, osmType: item.osm_type, osmId: item.osm_id,
      name: item.name || item.display_name.split(",")[0], address: item.display_name, lat, lng,
      category: item.type || item.category || "Place", tags: { ...item.extratags, ...(item.category && item.type ? { [item.category]: item.type } : {}) } }]
  })
}
export function parsePhotonPlaces(data: unknown, country: "dz" | "all"): MapPlace[] {
  return photonSchema.parse(data).features.flatMap(({ geometry, properties: props }) => {
    const [lng, lat] = geometry.coordinates
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(lat) || !Number.isFinite(lng) || (country === "dz" && props.countrycode?.toLowerCase() !== "dz")) return []
    const osmType = { N: "node", W: "way", R: "relation" }[props.osm_type] as MapPlace["osmType"]
    const tags: Record<string, string> = {}
    if (props.osm_key && props.osm_value) tags[props.osm_key] = props.osm_value
    return [{ id: `${osmType}/${props.osm_id}`, osmType, osmId: props.osm_id, lat, lng, name: props.name || "Unnamed place", category: props.osm_value || "Place", tags,
      address: [...new Set([props.housenumber, props.street, props.city, props.state, props.postcode, props.country].filter(Boolean))].join(", ") || undefined }]
  })
}

export function parseNearbyPlaces(data: unknown): MapPlace[] {
  return overpassSchema.parse(data).elements.flatMap(item => {
    const lat = item.lat ?? item.center?.lat, lng = item.lon ?? item.center?.lon, tags = item.tags ?? {}
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(", ")
    return [{ id: `${item.type}/${item.id}`, osmType: item.type, osmId: item.id, lat, lng,
      name: tags.name || tags["name:fr"] || tags["name:ar"] || tags.brand || "Unnamed place",
      category: tags.shop || tags.amenity || tags.tourism || tags.office || tags.craft || tags.leisure || "Place", address: address || undefined, tags }]
  })
}

let nextSearchAt = 0
async function searchRateLimit(signal: AbortSignal) {
  const delay = Math.max(0, nextSearchAt - Date.now())
  nextSearchAt = Date.now() + delay + 1100
  if (delay) await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")) }
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, delay)
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
  })
  signal.throwIfAborted()
}
async function fetchJson(url: string, signal: AbortSignal, body?: string, timeout = 15_000): Promise<unknown> {
  return placeJson(url, signal, body, timeout)
}
export async function searchPlaces(query: string, country: "dz" | "all", signal: AbortSignal): Promise<MapPlace[]> {
  await searchRateLimit(signal)
  const params = new URLSearchParams({ q: query.trim(), format: "jsonv2", limit: "15", addressdetails: "1", extratags: "1", "accept-language": "fr,ar,en" })
  if (country === "dz") params.set("countrycodes", "dz")
  if (Date.now() >= nominatimRetryAt) {
    try { const data=await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, signal, undefined, 8000); return withPlaceSources(parsePlaceSearch(data),data) }
    catch (error) { if (signal.aborted) throw error; nominatimRetryAt = Date.now() + 5 * 60_000 }
  }
  return photonSearch(query, country, signal)
}
async function photonSearch(query: string, country: "dz" | "all", signal: AbortSignal, center?: [number, number]): Promise<MapPlace[]> {
  const params = new URLSearchParams({ q: query, limit: "30", lang: "fr" })
  if (country === "dz") params.set("bbox", "-8.7,18.9,12,37.2")
  if (center) { params.set("lon", String(center[0])); params.set("lat", String(center[1])) }
  const data=await fetchJson(`https://photon.komoot.io/api/?${params}`, signal)
  return withPlaceSources(parsePhotonPlaces(data, country),data)
}
export async function nearbyPlaces(center: [number, number], category: PlaceCategory, signal: AbortSignal, radius = 1500): Promise<MapPlace[]> {
  const [lng, lat] = center
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Choose a valid map location.")
  const boundedRadius = Math.min(2000, Math.max(50, radius))
  const around = `(around:${boundedRadius},${lat.toFixed(5)},${lng.toFixed(5)})`
  const filters: Record<PlaceCategory, string[]> = {
    all: ['["shop"]', '["amenity"]["amenity"!~"^(bench|waste_basket|parking_space|waste_disposal|recycling|parking_entrance)$"]', '["tourism"]', '["office"]', '["craft"]', '["leisure"]'],
    shop: ['["shop"]'], food: ['["amenity"~"^(restaurant|cafe|fast_food)$"]', '["shop"="bakery"]'],
    beauty: ['["shop"~"^(hairdresser|beauty|cosmetics|massage)$"]'], hotel: ['["tourism"~"^(hotel|motel|guest_house|hostel)$"]'],
    health: ['["amenity"~"^(pharmacy|hospital|clinic|dentist|doctors)$"]'], services: ['["amenity"~"^(bank|atm|post_office|fuel|police|townhall)$"]', '["office"]', '["craft"]'],
    leisure: ['["tourism"]', '["leisure"]', '["amenity"~"^(cinema|theatre|library|arts_centre)$"]'],
  }
  const query = `[out:json][timeout:6];(${filters[category].map(filter => `nwr${filter}${around};`).join("")});out center tags 1000;`
  let places: MapPlace[] | undefined
  if (Date.now() >= overpassRetryAt) {
    try { const data=await fetchJson("https://overpass-api.de/api/interpreter", signal, query, 8000); places = withPlaceSources(parseNearbyPlaces(data),data) }
    catch (error) { if (signal.aborted) throw error; overpassRetryAt = Date.now() + 5 * 60_000 }
  }
  if (!places) {
    const latDelta = boundedRadius / 111_320, lngDelta = boundedRadius / (111_320 * Math.max(.1, Math.cos(lat * Math.PI / 180)))
    const bbox = [Math.max(-180, lng - lngDelta), Math.max(-90, lat - latDelta), Math.min(180, lng + lngDelta), Math.min(90, lat + latDelta)].map(value => value.toFixed(6)).join(",")
    const data=await fetchJson(`https://www.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, signal)
    places = withPlaceSources(parseOSMArea(data, category),data)
  }
  return places.filter(place => Math.hypot((place.lat - lat) * 111_320, (place.lng - lng) * 111_320 * Math.cos(lat * Math.PI / 180)) <= boundedRadius).sort((a, b) =>
    Math.hypot(a.lat - lat, (a.lng - lng) * Math.cos(lat * Math.PI / 180)) - Math.hypot(b.lat - lat, (b.lng - lng) * Math.cos(lat * Math.PI / 180)))
}
export async function placeDetails(place: MapPlace, signal: AbortSignal): Promise<MapPlace> {
  if (place.osmType && place.osmId) {
    try {
    const raw = await fetchJson(`https://www.openstreetmap.org/api/0.6/${place.osmType}/${place.osmId}.json`, signal)
    const data = osmAreaSchema.parse(raw)
    const element = data.elements.find(item => item.type === place.osmType && item.id === place.osmId)
    const result = element ? parseNearbyPlaces({ elements: [{ ...element, lat: element.lat ?? place.lat, lon: element.lon ?? place.lng }] })[0] : undefined
    return result ? { ...place, ...result, tags: { ...place.tags, ...result.tags }, category: result.category === "Place" ? place.category : result.category, address: result.address || place.address, provenance:sourceFor(raw) || place.provenance } : place
    } catch (error) {
      if (signal.aborted) throw error
      await searchRateLimit(signal)
      const prefix = { node: "N", way: "W", relation: "R" }[place.osmType]
      const params = new URLSearchParams({ osm_ids: `${prefix}${place.osmId}`, format: "json", extratags: "1", addressdetails: "1", "accept-language": "fr,ar,en" })
      let candidates: MapPlace[] | undefined
      if (Date.now() >= nominatimRetryAt) {
        try { const raw=await fetchJson(`https://nominatim.openstreetmap.org/lookup?${params}`, signal); candidates = withPlaceSources(parsePlaceSearch(raw),raw) }
        catch (failure) { if (signal.aborted) throw failure; nominatimRetryAt = Date.now() + 5 * 60_000 }
      }
      const result = (candidates ?? await photonSearch(place.name, "all", signal, [place.lng, place.lat])).find(item => item.id === place.id)
      return result ? { ...place, ...result, tags: { ...place.tags, ...result.tags } } : place
    }
  }
  await searchRateLimit(signal)
  const params = new URLSearchParams({ q: place.name, viewbox: `${place.lng - .002},${place.lat + .002},${place.lng + .002},${place.lat - .002}`, bounded: "1", format: "jsonv2", extratags: "1", limit: "5", "accept-language": "fr,ar,en" })
  let results: MapPlace[] | undefined
  if (Date.now() >= nominatimRetryAt) {
    try { const raw=await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, signal); results = withPlaceSources(parsePlaceSearch(raw),raw) }
    catch (error) { if (signal.aborted) throw error; nominatimRetryAt = Date.now() + 5 * 60_000 }
  }
  results ??= await photonSearch(place.name, "all", signal, [place.lng, place.lat])
  return results.find(result => result.name.toLowerCase() === place.name.toLowerCase() && Math.hypot(result.lat - place.lat, result.lng - place.lng) < .001) || place
}

export function filterMapPlaces(places: MapPlace[], center: [number, number], category: PlaceCategory, radius: number): MapPlace[] {
  const distance = (place: MapPlace) => Math.hypot((place.lat - center[1]) * 111_320, (place.lng - center[0]) * 111_320 * Math.cos(center[1] * Math.PI / 180))
  return places.filter(place => matchesCategory(place.tags, category) && distance(place) <= radius).sort((a, b) => distance(a) - distance(b))
}
