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

describe("automatic selected listing capture", () => {
  const selection = { name: "Atlas Café", city: "Oran", lat: 35.6969, lng: -0.6417 }
  function capture({ selected = false, urls = ["https://www.google.com/maps/place/Atlas/data=!8m2!3d35.697!4d-0.641"], address = "12 Rue, Oran", website = "https://atlas.example/", name = "Atlas Café" } = {}) {
    let clicks = 0
    const visible = { getClientRects: () => [1] }
    const anchors = urls.map(href => ({ ...visible, href, innerText: "", parentElement: { innerText: address }, getAttribute: () => name, click: () => { clicks++ } }))
    const heading = { ...visible, innerText: name, closest: () => null }
    const buttons = [{ ...visible, innerText: "", getAttribute: () => `Adresse: ${address}` }, { ...visible, innerText: "", getAttribute: () => "Numéro de téléphone: 0555 12 34 56" }, { ...visible, innerText: "", getAttribute: () => "Horaires: Ouvert · Ferme à 18:00" }]
    const document = { title: "Google Maps", body: { innerText: `${name}\nOuvert · Ferme à 18:00` }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector === "h1" ? selected ? [heading] : [] : selector === "button[aria-label]" ? buttons : selector === "a[href]" ? [{ ...visible, href: website, getAttribute: () => "Site Web: atlas.example" }] : selector.includes("main a[href]") ? anchors : [] }
    const script = captureScript.replace("const request = null;", `const request = ${JSON.stringify(selection)};`)
    const result = runInNewContext(script, { location: new URL(selected ? urls[0] : "https://www.google.com/maps/search/atlas"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { selectionState: string; selectedName: string; website: string; hours: string; phones: string[]; error: string | null }
    return { result, clicks }
  }
  it("selects a unique nearby Oran listing and captures its displayed fields", () => {
    expect(capture().clicks).toBe(1)
    const { result } = capture({ selected: true })
    expect(result.error).toBeNull()
    expect(result.selectionState).toBe("matched")
    expect(result.website).toBe("https://atlas.example/")
    expect(result.hours).toBe("Ouvert · Ferme à 18:00")
    expect(result.phones).toContain("0555 12 34 56")
  })
  it("does not choose among two branches or use the camera as business coordinates", () => {
    const duplicate = capture({ urls: ["https://www.google.com/maps/place/Atlas/data=!8m2!3d35.697!4d-0.641", "https://www.google.com/maps/place/Atlas2/data=!8m2!3d35.698!4d-0.642"] })
    expect(duplicate.result.selectionState).toBe("ambiguous")
    expect(duplicate.clicks).toBe(0)
    expect(capture({ urls: ["https://www.google.com/maps/place/Atlas/@35.6969,-0.6417,15z"], address: "" }).clicks).toBe(0)
    expect(capture({ selected: true, urls: ["https://www.google.com/maps/place/Atlas/data=!8m2!3d36.732!4d3.029"], address: "Alger" }).result.selectionState).toBe("mismatch")
    expect(capture({ selected: true, name: "Another Café" }).result.selectionState).toBe("mismatch")
  })
  it("isolates the selected business from other visible listing contacts", () => {
    const scope = { innerText: "Atlas Café\nOuvert", querySelectorAll: (selector: string) => selector === "button[aria-label]" ? [{ getClientRects: () => [1], getAttribute: () => "Adresse: Rue, Oran" }] : [] }
    const heading = { innerText: "Atlas Café", getClientRects: () => [1], closest: (selector: string) => selector.includes("main") ? scope : null }
    const document = { title: "Maps", body: { innerText: "Other Store\n0555 00 00 00" }, querySelector: () => null, querySelectorAll: (selector: string) => selector === "h1" ? [heading] : [] }
    const result = runInNewContext(captureScript, { location: new URL("https://www.google.com/maps/place/Atlas"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { phones: string[]; text: string; error: string | null }
    expect(result.error).toBeNull()
    expect(result.phones).toEqual([])
    expect(result.text).not.toContain("Other Store")
  })
  it("handles a bilingual hotel identity without importing a tenant's closed status", () => {
    const visible = { getClientRects: () => [1], closest: () => null }
    const information = { ...visible, innerText: "Boulevard du 19 Mars, Oran\n041 59 02 59\nHeure d'arrivée : 3:00 PM", getAttribute: () => "Four Points by Sheraton Oran - Informations",
      querySelectorAll: (selector: string) => selector === "button[aria-label]" ? [{ ...visible, getAttribute: () => "Adresse: Boulevard du 19 Mars, Oran" }, { ...visible, getAttribute: () => "Numéro de téléphone: 041 59 02 59" }] : [] }
    const main = { innerText: "Four Points by Sheraton Oran\nفور بوينتس شيراطون\nHôtel 4 étoiles\nArena Club\nFermé · Ouvre à 22:30\n0555 99 99 99", getAttribute: () => "Four Points by Sheraton Oran",
      querySelectorAll: (selector: string) => selector === '[role="region"]' ? [information] : [] }
    const headings = ["Four Points by Sheraton Oran", "فور بوينتس شيراطون"].map(innerText => ({ ...visible, innerText, closest: (selector: string) => selector.includes("main") ? main : null }))
    const document = { title: "Maps", body: main, querySelector: () => null, querySelectorAll: (selector: string) => selector === "h1" ? headings : [] }
    const script = captureScript.replace("const request = null;", `const request = ${JSON.stringify({ name: "Hôtel Four Points by Sheraton Oran", city: "Oran", lat: 35.7167, lng: -0.6106 })};`)
    const result = runInNewContext(script, { location: new URL("https://www.google.com/maps/place/FourPoints/data=!8m2!3d35.716781!4d-0.610165"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { selectedName: string; selectionState: string; hours: string | null; phones: string[]; error: string | null }
    expect(result.error).toBeNull()
    expect(result.selectedName).toBe("Four Points by Sheraton Oran")
    expect(result.selectionState).toBe("matched")
    expect(result.hours).toBeNull()
    expect(result.phones).toEqual(["041 59 02 59"])
  })
  it("captures photos only from the selected business photo control", () => {
    const visible = { getClientRects: () => [1], closest: () => null }
    const photo = (label: string, urls: string[]) => ({ ...visible, getAttribute: () => label, querySelectorAll: () => urls.map(src => ({ ...visible, src })) })
    const buttons = [photo("Photo de Atlas Café", ["https://lh3.googleusercontent.com/p/atlas", "https://attacker.example/tracker"]), photo("Photo de Other Café", ["https://lh3.googleusercontent.com/p/other"])]
    const scope = { innerText: "Atlas Café", querySelectorAll: (selector: string) => selector === "button[aria-label]" ? buttons : [] }
    const heading = { ...visible, innerText: "Atlas Café", closest: (selector: string) => selector.includes("main") ? scope : null }
    const document = { title: "Maps", body: scope, querySelector: () => null, querySelectorAll: (selector: string) => selector === "h1" ? [heading] : [] }
    const result = runInNewContext(captureScript, { location: new URL("https://www.google.com/maps/place/Atlas"), document, URL, getComputedStyle: () => ({ visibility: "visible" }) }) as { photos: string[]; error: string | null }
    expect(result.error).toBeNull()
    expect(result.photos).toEqual(["https://lh3.googleusercontent.com/p/atlas"])
  })
})
