import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { businessSearchLead } from "../src/lib/business-search"
import { businessBrief, businessWebsite, filterBusinesses, placeSourceLink } from "../src/lib/business-workflow"
import { parseSavedPlaces, placeDetails } from "../src/lib/places"
import { verifiedBusiness } from "../src/lib/business-research"

const captureScript = readFileSync(new URL("../src-tauri/src/business_search_capture.js", import.meta.url), "utf8")
describe("Google browser business research", () => {
  it("saves sourced leads without pretending the search center is a business location or website", async () => {
    const lead = businessSearchLead("Atlas Coffee", "https://www.google.com/maps/place/Atlas", [3, 36], "cafes in Alger", "Atlas Coffee · phone not supplied")
    const persisted = parseSavedPlaces([lead])[0]
    expect(persisted.locationPrecision).toBe("area")
    expect(filterBusinesses([persisted], "all", false)).toEqual([persisted])
    expect(businessWebsite(persisted)).toBeUndefined()
    expect(placeSourceLink(persisted)).toBe(lead.researchSourceUrl)
    const brief = JSON.parse(businessBrief(persisted)) as Record<string, unknown>
    expect(brief.coordinates).toBeNull()
    expect(brief.searchArea).toEqual({ lat: 36, lng: 3, note: "Search context only; business coordinates are unknown" })
    expect(brief.quotedSearchText).toContain("phone not supplied")
    expect(await placeDetails(persisted, new AbortController().signal)).toBe(persisted)
  })
  it("rejects invalid leads and preserves Google's evidence on confirmed contacts", () => {
    expect(() => businessSearchLead("", "https://www.google.com/search", [3, 36], "", "")).toThrow("Review")
    expect(() => businessSearchLead("Atlas", "javascript:alert(1)", [3, 36], "", "")).toThrow("Review")
    expect(() => businessSearchLead("Atlas", "https://www.google.com/search", [Infinity, 36], "", "")).toThrow("Invalid search area")
    const lead = businessSearchLead("Atlas", "https://www.google.com/search?q=atlas", [3, 36], "atlas", "")
    const verified = parseSavedPlaces([verifiedBusiness(lead, { phone: "+213 555 000 000" }, lead.researchSourceUrl || "", "google")])[0]
    expect(verified.details?.phone?.provider).toBe("google")
    expect(verified.details?.phone?.sourceUrl).toBe(lead.researchSourceUrl)
    expect(filterBusinesses([verified], "all", true)).toEqual([verified])
  })
  it("captures rendered search headings and redirect links without including hidden results", () => {
    const anchor = { href: "https://www.google.com/url?q=https%3A%2F%2Fatlas.example%2Fcontact", innerText: "Atlas Coffee", parentElement: null }
    const heading = { innerText: "Atlas Coffee", getClientRects: () => [1], closest: () => anchor, querySelector: () => null }
    const hidden = { innerText: "Hidden result", getClientRects: () => [] }
    const document = { title: "Google Search", body: { innerText: "Atlas Coffee\n+213 555 000 000" }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector === "h3" ? [heading, heading, hidden] : [] }
    const output = runInNewContext(captureScript, { location: new URL("https://www.google.com/search?q=atlas"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { results: Array<{ title: string; url: string }>; phones: string[]; error: string | null }
    expect(output.error).toBeNull()
    expect(output.results).toHaveLength(1)
    expect(output.results[0]).toMatchObject({ title: "Atlas Coffee", url: "https://atlas.example/contact" })
    expect(output.phones).toEqual(["+213 555 000 000"])
  })
  it("leaves verification pages to the user instead of capturing them as businesses", () => {
    const document = { title: "Google", body: { innerText: "Verify" }, querySelector: () => ({}), querySelectorAll: () => [] }
    const output = runInNewContext(captureScript, { location: new URL("https://www.google.com/sorry/index"), document, URL }) as { error: string; results: unknown[] }
    expect(output.error).toContain("verification")
    expect(output.results).toEqual([])
  })
  it("distinguishes the Maps results heading from a selected business and reads French contact labels", () => {
    const heading = { innerText: "Résultats", getClientRects: () => [1], closest: () => ({}) }
    const button = (label: string) => ({ getClientRects: () => [1], getAttribute: () => label })
    const document = { title: "Google Maps", body: { innerText: "Businesses" }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector === "h1" ? [heading] : selector === "button[aria-label]" ? [button("Adresse: 2eme étage, Bir Mourad Raïs 16000"), button("Numéro de téléphone: 0558 74 03 06")] : [] }
    const output = runInNewContext(captureScript, { location: new URL("https://www.google.com/maps/search/Businesses"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { selectedName: string | null; phones: string[]; addresses: string[]; error: string | null }
    expect(output.error).toBeNull()
    expect(output.selectedName).toBeNull()
    expect(output.phones).toEqual(["0558 74 03 06"])
    expect(output.addresses).toEqual(["2eme étage, Bir Mourad Raïs 16000"])
  })
})
