import { afterEach, describe, expect, it, vi } from "vitest"
import { parseCommonsPhotos, placePhotos } from "../src/lib/place-photos"

const source = { query: { pages: { "1": { pageid: 1, title: "File:Alger.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/wikipedia/commons/a/Alger.jpg", thumburl: "https://thumb.wikimedia.org/a/Alger.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Alger.jpg", mime: "image/jpeg", extmetadata: { Artist: { value: '<a href="https://example.com">Photographer &amp; team</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] } } } }
afterEach(() => vi.unstubAllGlobals())
describe("source-backed place photos", () => {
  it("keeps attribution as plain text and labels nearby photos accurately", () => {
    const [photo] = parseCommonsPhotos(source, "nearby")
    expect(photo).toMatchObject({ scope: "nearby", credit: "Photographer & team", license: "CC BY-SA 4.0", title: "Alger" })
    expect(photo.credit).not.toContain("<a")
  })
  it("rejects executable and unexpected photo sources", () => {
    const invalid = { query: { pages: { "1": { pageid: 1, title: "File:Bad.jpg", imageinfo: [{ url: "javascript:alert(1)", descriptionurl: "https://commons.wikimedia.org/wiki/File:Bad.jpg" }] } } } }
    expect(parseCommonsPhotos(invalid, "place")).toEqual([])
  })
  it("uses a linked Commons file as a photo of this place", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => source })
    vi.stubGlobal("fetch", fetch)
    const photos = await placePhotos({ id: "node/1", name: "Landmark", lat: 36.75, lng: 3.05, category: "attraction", tags: { wikimedia_commons: "File:Alger.jpg" } }, new AbortController().signal)
    expect(photos[0].scope).toBe("place")
    expect(fetch.mock.calls[0][0]).toContain("titles=File%3AAlger.jpg")
    expect(fetch).toHaveBeenCalledOnce()
  })
  it("falls back to geotagged neighbourhood photos without claiming they depict a store", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => source })
    vi.stubGlobal("fetch", fetch)
    const photos = await placePhotos({ id: "node/2", name: "Store", lat: 36.75, lng: 3.05, category: "shop", tags: {} }, new AbortController().signal)
    expect(photos[0].scope).toBe("nearby")
    expect(fetch.mock.calls[0][0]).toContain("generator=geosearch")
  })
  it("loads an album explicitly linked by the place's Commons category", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => source })
    vi.stubGlobal("fetch", fetch)
    const photos = await placePhotos({ id: "way/3", name: "Garden", lat: 36.75, lng: 3.05, category: "garden", tags: { wikimedia_commons: "Category:Garden" } }, new AbortController().signal)
    expect(photos[0].scope).toBe("place")
    expect(fetch.mock.calls[0][0]).toContain("generator=categorymembers")
  })
})
