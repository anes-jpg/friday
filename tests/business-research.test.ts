import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MapPlace } from "../src/lib/places"

const place: MapPlace = { id: "node/1", name: "Atlas", category: "cafe", lat: 36, lng: 3, tags: { amenity: "cafe" } }
beforeEach(() => vi.resetModules())
afterEach(() => { vi.doUnmock("../src/lib/place-transport"); vi.unstubAllGlobals() })
describe("free business source research", () => {
  it("extracts contact candidates from links and structured data without accepting off-site contact pages", async () => {
    const { parseBusinessSite } = await import("../src/lib/business-research")
    const html = '<title>Atlas &amp; Coffee</title><a href="tel:%2B213%20555%20000%20000">Call</a><a href="mailto:hello@atlas.example?subject=Hi">Email</a><script type="application/ld+json">{"@graph":[{"@type":"CafeOrCoffeeShop","name":"Atlas","telephone":"+213 555 000 000","email":"owner@atlas.example"}]}</script><a href="/contact">Contact</a><a href="https://other.example/contact">Other</a><a href="javascript:contact()">Bad</a>'
    const facts = parseBusinessSite(html, "https://atlas.example")
    expect(facts.title).toBe("Atlas & Coffee")
    expect(facts.phones).toEqual(["+213 555 000 000"])
    expect(facts.emails).toEqual(["hello@atlas.example", "owner@atlas.example"])
    expect(facts.names).toEqual(["Atlas"])
    expect(facts.contactLinks).toEqual(["https://atlas.example/contact"])
  })
  it("handles malformed structured data and missing contacts honestly", async () => {
    const { parseBusinessSite } = await import("../src/lib/business-research")
    expect(parseBusinessSite('<script type="application/ld+json">broken</script>', "https://atlas.example").phones).toEqual([])
    expect(() => parseBusinessSite("", "javascript:alert(1)")).toThrow("Invalid website")
  })
  it("uses only the listing's exact linked entity and preserves supplied fields", async () => {
    const json = vi.fn(async () => ({ entities: { Q123: { claims: { P1329: [{ mainsnak: { datavalue: { value: "+213 555 000 000" } } }], P856: [{ rank: "deprecated", mainsnak: { datavalue: { value: "https://old.example" } } }, { mainsnak: { datavalue: { value: "https://atlas.example" } } }] } } } }))
    vi.doMock("../src/lib/place-transport", async importOriginal => ({ ...await importOriginal<typeof import("../src/lib/place-transport")>(), placeJson: json }))
    const { enrichLinkedBusiness } = await import("../src/lib/business-research")
    const enriched = await enrichLinkedBusiness({ ...place, tags: { wikidata: "Q123", phone: "+213 111 111 111" } }, new AbortController().signal)
    expect(json.mock.calls[0][0]).toContain("ids=Q123")
    expect(enriched.details?.phone).toBeUndefined()
    expect(enriched.details?.website?.value).toBe("https://atlas.example/")
    expect(enriched.details?.website?.sourceUrl).toBe("https://www.wikidata.org/wiki/Q123")
    json.mockClear()
    await enrichLinkedBusiness({ ...place, tags: { "brand:wikidata": "Q123" } }, new AbortController().signal)
    expect(json).not.toHaveBeenCalled()
  })
  it("persists source evidence, validates contacts, and removes incorrect overrides", async () => {
    const { verifiedBusiness } = await import("../src/lib/business-research")
    const { parseSavedPlaces } = await import("../src/lib/places")
    const verified = verifiedBusiness(place, { phone: "+213 555 000 000", email: "hello@atlas.example" }, "https://atlas.example/contact", "website")
    expect(parseSavedPlaces([verified])[0].details?.phone?.provider).toBe("website")
    expect(verifiedBusiness(verified, { phone: "" }, "https://atlas.example/contact").details?.phone).toBeUndefined()
    expect(() => verifiedBusiness(place, { phone: "call me" }, "https://atlas.example")).toThrow("valid phone")
    expect(() => verifiedBusiness(place, { email: "bad" }, "https://atlas.example")).toThrow("valid contact email")
    expect(() => parseSavedPlaces([{ ...verified, details: { phone: { ...verified.details?.phone, sourceUrl: "javascript:alert(1)" } } }])).toThrow()
  })
  it("filters newly verified contacts and never concatenates multiple telephone numbers", async () => {
    const { verifiedBusiness } = await import("../src/lib/business-research")
    const { filterBusinesses, businessPhoneLink, businessBrief } = await import("../src/lib/business-workflow")
    const verified = verifiedBusiness(place, { phone: "+213 555 000 000; +213 666 000 000" }, "https://atlas.example")
    expect(filterBusinesses([place, verified], "all", true)).toEqual([verified])
    expect(businessPhoneLink(verified)).toBe("tel:+213555000000")
    expect(JSON.parse(businessBrief(verified)).fieldSources.phone.sourceUrl).toBe("https://atlas.example/")
  })
})
