import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Bookmark, ExternalLink, MapPin, Search, X, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { ALGERIA_CITIES, filterMapPlaces, nearbyPlaces, placeDetails, safePlaceWebsite, searchPlaces, type MapPlace, type PlaceCategory } from "@/lib/places"
import { PlacePhotos } from "./PlacePhotos"
import { PlaceActions } from "./PlaceActions"
import { PlaceComparison } from "./PlaceComparison"
import { useSavedPlaces } from "@/lib/saved-places"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { businessPhone, businessPhoneLink, businessWebsite, businessEmail, businessAddress, businessHours, businessWebsiteStatus, filterBusinesses, type WebsiteFilter } from "@/lib/business-workflow"
import { enrichLinkedBusiness } from "@/lib/business-research"
import { BusinessResearchPanel } from "./BusinessResearchPanel"
import { BlockReveal } from "@/components/ui/block-reveal"
import { WebsiteProjectDialog } from "./WebsiteProjectDialog"
import { GoogleBusinessSearch } from "./GoogleBusinessSearch"

const categories: { id: PlaceCategory; label: string }[] = [{ id: "all", label: "All" }, { id: "shop", label: "Shops" }, { id: "food", label: "Food & coffee" }, { id: "beauty", label: "Salons" }, { id: "hotel", label: "Hotels" }, { id: "health", label: "Health" }, { id: "services", label: "Services" }, { id: "leisure", label: "Leisure" }]

export function PlacesPanel({ center, selected, mapPlaces, onSelect, onResults, onClose, onLocate, onExploreArea }: {
  center: [number, number]; selected: MapPlace | null; onSelect: (place: MapPlace | null) => void
  mapPlaces: MapPlace[]
  onResults: (places: MapPlace[]) => void; onClose: () => void; onLocate: () => void
  onExploreArea: (radius: number) => void
}) {
  const [tab, setTab] = useState("nearby")
  const [businessOnly, setBusinessOnly] = useState(true)
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all")
  const [contactOnly, setContactOnly] = useState(false)
  const [websitePlace, setWebsitePlace] = useState<MapPlace | null>(null)
  const [shortlisting, setShortlisting] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [country, setCountry] = useState<"dz" | "all">("dz")
  const [request, setRequest] = useState<{ text: string; country: "dz" | "all" } | null>(null)
  const [category, setCategory] = useState<PlaceCategory>("all")
  const [radius, setRadius] = useState(1500)
  const [area, setArea] = useState<{ center: [number, number]; category: PlaceCategory; radius: number } | null>(() => ({ center: [center[0], center[1]], category: "all", radius: 1500 }))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(60)
  const savedData=useSavedPlaces()
  const saved = savedData.places
  const [collectionId,setCollectionId]=useState("all")
  const [comparison,setComparison]=useState<MapPlace[]>([])
  const [comparing,setComparing]=useState(false)
  useEffect(()=>{void savedData.hydrate()},[savedData.hydrate])
  const search = useQuery({ queryKey: ["place-search", request], enabled: Boolean(request), staleTime: 30 * 60_000,
    queryFn: ({ signal }) => request ? searchPlaces(request.text, request.country, signal) : Promise.resolve([]) })
  const nearby = useQuery({ queryKey: ["nearby-places", area], enabled: Boolean(area), staleTime: 10 * 60_000,
    queryFn: ({ signal }) => area ? nearbyPlaces(area.center, area.category, signal, area.radius) : Promise.resolve([]) })
  const details = useQuery({ queryKey: ["place-details", selected?.id], enabled: Boolean(selected), staleTime: 30 * 60_000,
    queryFn: async ({ signal }) => selected ? selected.locationPrecision === "area" ? selected : enrichLinkedBusiness(await placeDetails(selected, signal), signal) : Promise.reject(new Error("Choose a place.")) })
  const result = tab === "nearby" ? nearby : search
  const mapped = useMemo(() => filterMapPlaces(mapPlaces, area?.center ?? center, tab === "nearby" ? area?.category ?? category : "all", area?.radius ?? radius), [mapPlaces, area, center[0], center[1], category, radius, tab])
  const candidates = useMemo(() => {
    if (tab === "saved") return collectionId === "all" ? saved : saved.filter(place=>savedData.collections.find(collection=>collection.id===collectionId)?.placeIds.includes(place.id))
    if (tab === "search") return request ? search.data : mapped
    const listed = nearby.data ?? []
    const extras = mapped.filter(candidate => !listed.some(place => place.id===candidate.id || (place.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase() && Math.hypot(place.lng - candidate.lng, place.lat - candidate.lat) < .0005)))
    return [...listed, ...extras]
  }, [tab, saved, request, search.data, nearby.data, mapped, collectionId, savedData.collections])
  const places = useMemo(() => {
    const records = candidates?.map(item => ({ ...item, details: { ...item.details, ...saved.find(record => record.id === item.id)?.details } }))
    return businessOnly ? filterBusinesses(records ?? [], websiteFilter, contactOnly) : records
  }, [businessOnly, candidates, websiteFilter, contactOnly, saved])
  const shortlist = async (item: MapPlace) => {
    if (shortlisting) return
    setShortlisting(item.id)
    setSaveError(null)
    try {
      await savedData.save(item)
      const collection = useSavedPlaces.getState().collections.find(record => record.id === "website-leads")
      await savedData.saveCollection({ id: "website-leads", name: "Website leads", placeIds: [...(collection?.placeIds ?? []), item.id] })
    } catch (failure) { setSaveError(String(failure)) }
    finally { setShortlisting(null) }
  }
  useEffect(() => setVisibleCount(60), [tab, request, area])
  useEffect(() => { onResults(places ?? []) }, [places, onResults])
  const base = details.data ?? selected
  const stored = saved.find(item => item.id === base?.id)
  const place = base ? { ...base, details: { ...base.details, ...stored?.details } } : null
  const save = async () => {
    if (!place || savedData.error) return
    setSaveError(null)
    try { if(saved.some(item=>item.id===place.id)) await savedData.remove(place.id);else await savedData.save(place) } catch(failure) {setSaveError(String(failure))}
  }
  const website = place ? businessWebsite(place) : undefined
  const searchCenter = area?.center ?? center
  const searchCity = ALGERIA_CITIES.find(city => Math.hypot(city.center[0] - searchCenter[0], city.center[1] - searchCenter[1]) < .4)?.name
  const googleQuery = text || `${category === "all" ? "Businesses" : categories.find(item => item.id === category)?.label} ${searchCity ? `in ${searchCity}` : `near ${searchCenter[1].toFixed(3)}, ${searchCenter[0].toFixed(3)}`}`
  return <aside className="places-panel" aria-label="Places and businesses">
    <header><div><span className="instrument-label">Discovery → project</span><h2>{place ? "Business & place details" : "Find your next client."}</h2></div><Button variant="ghost" size="icon" aria-label="Hide place search" onClick={onClose}><X data-icon="inline-start" /></Button></header>
    {savedData.error && <p role="alert" className="places-error">{savedData.error}</p>}
    {place ? <div className="place-detail">
      <Button variant="ghost" onClick={() => onSelect(null)}><ArrowLeft data-icon="inline-start" />Back to places</Button>
      <span className="instrument-label">{place.category.replaceAll("_", " ")}</span><h3 dir="auto">{place.name}</h3>
      <details className="place-media-disclosure"><summary>Source photos</summary><PlacePhotos key={place.id} place={place} /></details>
      {details.isFetching && <p role="status">Loading business details…</p>}
      {details.isError && <p className="places-error" role="alert">Details could not load. <button type="button" onClick={() => void details.refetch()}>Try again</button></p>}
      <BlockReveal loading={details.isPending && !businessPhone(place) && !businessHours(place)} label="Reading business contact fields" lines={3}><dl><dt>Phone</dt><dd>{businessPhone(place) ? <a href={businessPhoneLink(place)}>{businessPhone(place)}</a> : "Not supplied by available sources"}</dd><dt>Email</dt><dd>{businessEmail(place) || "Not supplied by available sources"}</dd><dt>Address</dt><dd dir="auto">{businessAddress(place) || "No street address listed"}</dd><dt>Opening hours</dt><dd>{businessHours(place) || "Not listed"}</dd>{place.tags.cuisine && <><dt>Cuisine</dt><dd>{place.tags.cuisine.replaceAll(";", ", ")}</dd></>}{place.tags.wheelchair && <><dt>Wheelchair access</dt><dd>{place.tags.wheelchair}</dd></>}</dl></BlockReveal>
      <BusinessResearchPanel key={place.id} place={place} onSave={async updated => { await savedData.save(updated); onSelect(updated) }} />
      <div className="place-detail-actions"><Button variant="outline" onClick={()=>void save()} disabled={Boolean(savedData.error) || !savedData.ready}><Bookmark data-icon="inline-start" />{saved.some(item => item.id === place.id) ? "Remove saved place" : "Save place"}</Button>{website && <a href={website} target="_blank" rel="noopener noreferrer">Website<ExternalLink size={14} /></a>}{place.locationPrecision !== "area" && <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noopener noreferrer">Directions<ExternalLink size={14} /></a>}</div>
      <PlaceActions key={place.id} place={place}/>
      <Button variant="ghost" size="sm" disabled={comparison.length>=3 && !comparison.some(item=>item.id===place.id)} onClick={()=>setComparison(items=>items.some(item=>item.id===place.id) ? items.filter(item=>item.id!==place.id) : [...items,place])}>{comparison.some(item=>item.id===place.id) ? "Remove from comparison" : "Add to comparison"}</Button>
      {comparison.length>0 && <Button variant="outline" size="sm" onClick={()=>setComparing(true)}>Compare ({comparison.length}/3)</Button>}
      {saveError && <p role="alert" className="places-error">{saveError}</p>}
      <p className="place-source">{place.locationPrecision === "area" ? "Browser research lead. No verified business coordinates yet. Open the Google source to check its location." : "OpenStreetMap community data. Details may be incomplete; opening hours are the source listing, not live opening status."}</p>
      {place.researchSourceUrl && <a className="place-source" href={place.researchSourceUrl} target="_blank" rel="noopener noreferrer">View research source ↗</a>}
      {place.researchExcerpt && <details className="google-page-excerpt"><summary>Quoted discovery text</summary><pre dir="auto">{place.researchExcerpt}</pre></details>}
      <p className="place-source">{place.provenance ? `${place.provenance.source} · ${place.provenance.cached ? "cached" : "retrieved"} ${new Date(place.provenance.fetchedAt).toLocaleString()}${place.provenance.stale ? " · stale; refresh when online" : ""}` : "Source retrieval time unavailable"}</p>
      {place.osmType && place.osmId && <a className="place-source" href={`https://www.openstreetmap.org/${place.osmType}/${place.osmId}`} target="_blank" rel="noopener noreferrer">View source listing ↗</a>}
    </div> : <>
      <p className="business-discovery-intro">Find local businesses, save leads, and turn a sourced brief into a website you can build and preview.</p>
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="nearby">Explore area</TabsTrigger><TabsTrigger value="search">Find a place</TabsTrigger><TabsTrigger value="saved">Saved / leads ({saved.length})</TabsTrigger></TabsList></Tabs>
      <div className="business-mode"><button type="button" aria-pressed={businessOnly} onClick={() => setBusinessOnly(true)}>Businesses</button><button type="button" aria-pressed={!businessOnly} onClick={() => setBusinessOnly(false)}>All places</button></div>
      {tab !== "saved" && <details className="google-discovery-disclosure"><summary>Find businesses with Google Search / Maps</summary><GoogleBusinessSearch initialQuery={googleQuery} center={searchCenter} onLead={async lead => { await savedData.save(lead); const collection = useSavedPlaces.getState().collections.find(item => item.id === "website-leads"); await savedData.saveCollection({ id: "website-leads", name: "Website leads", placeIds: [...(collection?.placeIds ?? []), lead.id] }); setTab("saved"); onSelect(lead) }} /></details>}
      {tab==="saved" && savedData.collections.length>0 && <Select value={collectionId} onValueChange={setCollectionId}><SelectTrigger aria-label="Saved place collection"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All saved places</SelectItem>{savedData.collections.map(collection=><SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>)}</SelectGroup></SelectContent></Select>}
      {comparison.length>0 && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setComparing(true)}>Compare ({comparison.length}/3)</Button><Button variant="ghost" size="sm" onClick={()=>setComparison([])}>Clear</Button></div>}
      {tab === "search" && <form onSubmit={event => { event.preventDefault(); if (text.trim()) setRequest({ text: text.trim(), country }) }} className="place-search-form">
        <Field><FieldLabel htmlFor="place-search" className="sr-only">Search places</FieldLabel><Input id="place-search" value={text} onChange={event => setText(event.target.value)} placeholder="Store, business, street or city…" dir="auto" /></Field>
        <div><Select value={country} onValueChange={value => setCountry(value === "dz" ? "dz" : "all")}><SelectTrigger aria-label="Place search country"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="dz">Algeria</SelectItem><SelectItem value="all">Everywhere</SelectItem></SelectGroup></SelectContent></Select><Button type="submit" variant="outline" disabled={!text.trim() || search.isFetching}><Search data-icon="inline-start" />Search</Button></div>
      </form>}
      {tab === "nearby" && <div className="place-search-form"><div className="business-category-chips" aria-label="Business categories">{categories.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setArea({ center: [center[0], center[1]], category: item.id, radius }); onExploreArea(radius) }}>{item.label}</button>)}</div><div><Button variant="outline" onClick={() => { setArea({ center: [center[0], center[1]], category, radius }); onExploreArea(radius) }} disabled={nearby.isFetching}><MapPin data-icon="inline-start" />Search this area</Button><Button variant="ghost" size="icon" aria-label="Use my location" onClick={onLocate}><LocateFixed data-icon="inline-start" /></Button><Select value={String(radius)} onValueChange={value => setRadius(Number(value))}><SelectTrigger aria-label="Nearby search radius"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="500">500 m</SelectItem><SelectItem value="1500">1.5 km</SelectItem><SelectItem value="2000">2 km</SelectItem></SelectGroup></SelectContent></Select></div><small>Pan to a neighbourhood, then search this area.</small></div>}
      {businessOnly && <div className="business-lead-filters"><label>Website<select aria-label="Filter businesses by website" value={websiteFilter} onChange={event => setWebsiteFilter(event.target.value as WebsiteFilter)}><option value="all">Any website status</option><option value="not-listed">Not listed in source</option><option value="listed">Website listed</option></select></label><label><input type="checkbox" checked={contactOnly} onChange={event => setContactOnly(event.target.checked)} />Contact listed</label><small>“Not listed” does not prove a business has no website. Map labels need a detailed listing check.</small></div>}
      {saveError && <p role="alert" className="places-error">{saveError}</p>}
      <div className="place-results" aria-live="polite">{places && <span className="place-result-count">{places.length} listed places{tab === "nearby" && area ? ` · within ${area.radius / 1000} km` : ""}</span>}
        {tab !== "saved" && result.isFetching && !places?.length && <BlockReveal loading label="Finding businesses and source details" lines={6} />}
        {tab !== "saved" && result.isError && <p className="places-error" role="alert">{tab === "nearby" && mapped.length ? "Detailed listings could not load. Showing places labelled on the map. " : result.error.message}<button type="button" onClick={() => void result.refetch()}>Try again</button></p>}
        {places?.slice(0, visibleCount).map(item => <article key={item.id} className="business-result"><button type="button" className="place-result" onClick={() => onSelect(item)}><MapPin size={17} /><span><strong dir="auto">{item.name}</strong><small>{item.category.replaceAll("_", " ")}</small>{item.address && <small dir="auto">{item.address}</small>}{businessOnly && <small>{businessWebsiteStatus(item) === "listed" ? "Website listed" : businessWebsiteStatus(item) === "unknown" ? "Map label · website unverified" : "Website not listed"}{businessPhone(item) ? " · Phone listed" : ""}</small>}</span></button>{businessOnly && <div className="business-result-actions"><Button variant="ghost" size="sm" disabled={!savedData.ready || Boolean(savedData.error) || Boolean(shortlisting)} onClick={() => void shortlist(item)}>{savedData.collections.find(record => record.id === "website-leads")?.placeIds.includes(item.id) ? "Shortlisted" : "Shortlist"}</Button><Button variant="outline" size="sm" onClick={() => setWebsitePlace(item)}>Build website</Button></div>}</article>)}
        {places && places.length > visibleCount && <Button variant="ghost" size="sm" onClick={() => setVisibleCount(current => current + 60)}>Show more places ({places.length - visibleCount})</Button>}
        {!result.isFetching && places?.length === 0 && <p>{tab === "saved" ? "Save places to keep them here." : "No listed places found. Try another name or area."}</p>}
        {!places && !result.isFetching && <p>{tab === "search" ? "Search in French, Arabic, or English. Choose a result to see its details." : "Move the map, then search this area."}</p>}
      </div><footer>© OpenStreetMap contributors</footer>
    </>}
    {comparing && <PlaceComparison places={comparison} center={center} onClose={()=>setComparing(false)}/>}
    {websitePlace && <WebsiteProjectDialog place={websitePlace} onClose={() => setWebsitePlace(null)} />}
  </aside>
}
