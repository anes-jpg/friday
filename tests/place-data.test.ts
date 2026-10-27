import { describe, expect, it, vi } from "vitest"
import { filterMapPlaces, nearbyPlaces, parseOSMArea, parseNearbyPlaces, parsePhotonPlaces, parsePlaceSearch, parseSavedPlaces, placeDetails, safePlaceWebsite, searchPlaces } from "../src/lib/places"

describe("place data boundaries", () => {
  it("preserves Arabic/French names and rejects invalid search coordinates", () => {
    const places = parsePlaceSearch([{ osm_type: "node", osm_id: 4, lat: "36.7", lon: "3.1", name: "متجر / Magasin", display_name: "متجر / Magasin, Alger", type: "supermarket" }, { osm_type: "node", osm_id: 5, lat: "NaN", lon: "3", display_name: "Invalid" }])
    expect(places).toHaveLength(1)
    expect(places[0].name).toBe("متجر / Magasin")
    expect(places[0].category).toBe("supermarket")
  })
  it("keeps source hours and contact fields without inventing missing details", () => {
    const [place] = parseNearbyPlaces({ elements: [{ type: "way", id: 9, center: { lat: 36.7, lon: 3.1 }, tags: { name: "Local shop", shop: "clothes", opening_hours: "Mo-Sa 09:00-18:00" } }] })
    expect(place.tags.opening_hours).toBe("Mo-Sa 09:00-18:00")
    expect(place.address).toBeUndefined()
    expect(place.tags.phone).toBeUndefined()
  })
  it("rejects executable and credential-bearing business URLs", () => {
    expect(safePlaceWebsite("javascript:alert(1)")).toBeUndefined()
    expect(safePlaceWebsite("https://user:secret@example.com")).toBeUndefined()
    expect(safePlaceWebsite("shop.example.com")).toBe("https://shop.example.com/")
  })
  it("rejects corrupt saved places before their detail fields can reach the UI", () => {
    expect(() => parseSavedPlaces([{ id: "node/1", name: "Store", lat: 36.7, lng: 3.1, tags: null }])).toThrow()
    expect(() => parseSavedPlaces([{ id: "node/1", name: "Store", lat: 999, lng: 3.1, category: "shop", tags: {} }])).toThrow()
  })
  it("locates closed shop buildings without double-counting their closing node", () => {
    const places = parseOSMArea({ elements: [
      { type: "node", id: 1, lat: 36.70, lon: 3.10 },
      { type: "node", id: 2, lat: 36.72, lon: 3.10 },
      { type: "node", id: 3, lat: 36.72, lon: 3.12 },
      { type: "node", id: 4, lat: 36.70, lon: 3.12 },
      { type: "way", id: 10, nodes: [1, 2, 3, 4, 1], tags: { name: "Magasin", shop: "supermarket" } },
      { type: "way", id: 11, nodes: [99], tags: { shop: "books" } },
      { type: "node", id: 12, lat: 36.71, lon: 3.11, tags: { amenity: "restaurant" } },
    ] }, "shop")
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({ id: "way/10", name: "Magasin" })
    expect(places[0].lat).toBeCloseTo(36.71)
    expect(places[0].lng).toBeCloseTo(3.11)
  })
  it("includes bakeries in food and ATMs in all businesses", () => {
    const data = { elements: [
      { type: "node", id: 1, lat: 36.7, lon: 3.1, tags: { shop: "bakery" } },
      { type: "node", id: 2, lat: 36.7, lon: 3.1, tags: { amenity: "atm" } },
    ] }
    expect(parseOSMArea(data, "food").map(place => place.id)).toEqual(["node/1"])
    expect(parseOSMArea(data, "all")).toHaveLength(2)
  })
  it("falls back to OSM when nearby service fails and excludes shops beyond the radius", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [
      { type: "node", id: 1, lat: 36.7, lon: 3.1, tags: { name: "Closest", shop: "books" } },
      { type: "node", id: 2, lat: 36.702, lon: 3.1, tags: { name: "Further", shop: "clothes" } },
      { type: "node", id: 3, lat: 36.706, lon: 3.1, tags: { name: "Outside", shop: "books" } },
      { type: "node", id: 4, lat: 36.7, lon: 3.1, tags: { amenity: "restaurant" } },
    ] }) })
    vi.stubGlobal("fetch", fetch)
    try {
      const result = await nearbyPlaces([3.1, 36.7], "shop", new AbortController().signal, 500)
      expect(result.map(place => place.name)).toEqual(["Closest", "Further"])
      expect(fetch.mock.calls[1][0]).toMatch(/^https:\/\/www.openstreetmap.org\/api\/0.6\/map.json\?bbox=/)
    } finally { vi.unstubAllGlobals() }
  })
  it("covers offices, local amenities, and attractions beyond the old 500 m limit", () => {
    const data = { elements: [
      { type: "node", id: 1, lat: 36.706, lon: 3.1, tags: { name: "Office", office: "insurance" } },
      { type: "node", id: 2, lat: 36.708, lon: 3.1, tags: { name: "Library", amenity: "library" } },
      { type: "node", id: 3, lat: 36.7, lon: 3.1, tags: { amenity: "bench" } },
    ] }
    const places = parseOSMArea(data, "all")
    expect(filterMapPlaces(places, [3.1, 36.7], "all", 1500)).toHaveLength(2)
    expect(filterMapPlaces(places, [3.1, 36.7], "services", 1500).map(place => place.name)).toEqual(["Office"])
    expect(filterMapPlaces(places, [3.1, 36.7], "leisure", 1500).map(place => place.name)).toEqual(["Library"])
    expect(filterMapPlaces(places, [3.1, 36.7], "all", 500)).toHaveLength(0)
  })
  it("uses the same exact OSM ID when falling back to Nominatim details", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 }).mockResolvedValueOnce({ ok: true, json: async () => [
      { osm_type: "way", osm_id: 10, lat: "36.7", lon: "3.1", display_name: "Selected, Alger", name: "Selected", extratags: { phone: "+213 555" } },
    ] })
    vi.stubGlobal("fetch", fetch)
    try {
      const result = await placeDetails({ id: "way/10", osmType: "way", osmId: 10, name: "Selected", lat: 36.7, lng: 3.1, category: "shop", tags: {} }, new AbortController().signal)
      expect(result.tags.phone).toBe("+213 555")
      expect(fetch.mock.calls[1][0]).toContain("osm_ids=W10")
    } finally { vi.unstubAllGlobals() }
  })
  it("loads the exact selected OSM record without replacing it with another element", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [
      { type: "node", id: 99, lat: 36.7, lon: 3.1, tags: { name: "Other", phone: "wrong" } },
      { type: "way", id: 10, tags: { name: "Selected", shop: "books", phone: "+213 555 000 000" } },
    ] }) })
    vi.stubGlobal("fetch", fetch)
    const original = { id: "way/10", osmType: "way" as const, osmId: 10, name: "Selected", lat: 36.7, lng: 3.1, category: "shop", address: "Alger", tags: {} }
    try {
      expect(await placeDetails(original, new AbortController().signal)).toMatchObject({ name: "Selected", address: "Alger", lat: 36.7, lng: 3.1, tags: { phone: "+213 555 000 000" } })
      expect(fetch.mock.calls[0][0]).toBe("https://www.openstreetmap.org/api/0.6/way/10.json")
    } finally { vi.unstubAllGlobals() }
  })
  it("does not attach a neighbouring store's details to a clicked POI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ osm_type: "node", osm_id: 2, lat: "36.7", lon: "3.1", display_name: "Different shop, Alger", name: "Different shop", extratags: { phone: "wrong-number" } }] }))
    const original = { id: "vector-place", name: "Selected shop", lat: 36.7, lng: 3.1, category: "shop", tags: {} }
    try { expect(await placeDetails(original, new AbortController().signal)).toEqual(original) } finally { vi.unstubAllGlobals() }
  })
  it("cancels a submitted search before starting a network request", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const abort = new AbortController(); abort.abort()
    try { await expect(searchPlaces("Alger", "dz", abort.signal)).rejects.toBeDefined(); expect(fetch).not.toHaveBeenCalled() } finally { vi.unstubAllGlobals() }
  })
  it("keeps Photon results inside Algeria and retains their real OSM identities", () => {
    const data = { features: [
      { geometry: { type: "Point", coordinates: [3.05, 36.75] }, properties: { osm_type: "W", osm_id: 10, name: "Jardin", countrycode: "DZ", osm_key: "leisure", osm_value: "garden", city: "Alger" } },
      { geometry: { type: "Point", coordinates: [-6, 34] }, properties: { osm_type: "N", osm_id: 11, name: "Other country", countrycode: "MA" } },
    ] }
    expect(parsePhotonPlaces(data, "dz")).toMatchObject([{ id: "way/10", name: "Jardin", tags: { leisure: "garden" } }])
    expect(parsePhotonPlaces(data, "all")).toHaveLength(2)
  })
  it("recovers a submitted search when Nominatim blocks access", async () => {
    vi.resetModules()
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 }).mockResolvedValueOnce({ ok: true, json: async () => ({ features: [
      { geometry: { type: "Point", coordinates: [3.05, 36.75] }, properties: { osm_type: "W", osm_id: 10, name: "Jardin", countrycode: "DZ" } },
    ] }) })
    vi.stubGlobal("fetch", fetch)
    try {
      const { searchPlaces: searchWithFallback } = await import("../src/lib/places")
      expect(await searchWithFallback("Jardin", "dz", new AbortController().signal)).toMatchObject([{ id: "way/10", name: "Jardin" }])
      expect(fetch.mock.calls[1][0]).toContain("photon.komoot.io")
    } finally { vi.unstubAllGlobals() }
  })
})
