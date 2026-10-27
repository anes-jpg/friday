import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Bookmark, ExternalLink, MapPin, Search, X, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { filterMapPlaces, nearbyPlaces, placeDetails, safePlaceWebsite, searchPlaces, type MapPlace, type PlaceCategory } from "@/lib/places"
import { PlacePhotos } from "./PlacePhotos"
import { PlaceActions } from "./PlaceActions"
import { PlaceComparison } from "./PlaceComparison"
import { useSavedPlaces } from "@/lib/saved-places"

const categories: { id: PlaceCategory; label: string }[] = [{ id: "all", label: "All places" }, { id: "shop", label: "Stores" }, { id: "food", label: "Food & coffee" }, { id: "health", label: "Health" }, { id: "services", label: "Services" }, { id: "leisure", label: "Places to visit" }]

export function PlacesPanel({ center, selected, mapPlaces, onSelect, onResults, onClose, onLocate, onExploreArea }: {
  center: [number, number]; selected: MapPlace | null; onSelect: (place: MapPlace | null) => void
  mapPlaces: MapPlace[]
  onResults: (places: MapPlace[]) => void; onClose: () => void; onLocate: () => void
  onExploreArea: (radius: number) => void
}) {
  const [tab, setTab] = useState("search")
  const [text, setText] = useState("")
  const [country, setCountry] = useState<"dz" | "all">("dz")
  const [request, setRequest] = useState<{ text: string; country: "dz" | "all" } | null>(null)
  const [category, setCategory] = useState<PlaceCategory>("all")
  const [radius, setRadius] = useState(1500)
  const [area, setArea] = useState<{ center: [number, number]; category: PlaceCategory; radius: number } | null>(null)
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
    queryFn: ({ signal }) => selected ? placeDetails(selected, signal) : Promise.reject(new Error("Choose a place.")) })
  const result = tab === "nearby" ? nearby : search
  const mapped = useMemo(() => filterMapPlaces(mapPlaces, area?.center ?? center, tab === "nearby" ? area?.category ?? category : "all", area?.radius ?? radius), [mapPlaces, area, center[0], center[1], category, radius, tab])
  const places = useMemo(() => {
    if (tab === "saved") return collectionId === "all" ? saved : saved.filter(place=>savedData.collections.find(collection=>collection.id===collectionId)?.placeIds.includes(place.id))
    if (tab === "search") return request ? search.data : mapped
    const listed = nearby.data ?? []
    const extras = mapped.filter(candidate => !listed.some(place => place.id===candidate.id || (place.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase() && Math.hypot(place.lng - candidate.lng, place.lat - candidate.lat) < .0005)))
    return [...listed, ...extras]
  }, [tab, saved, request, search.data, nearby.data, mapped, collectionId, savedData.collections])
  useEffect(() => setVisibleCount(60), [tab, request, area])
  useEffect(() => { onResults(places ?? []) }, [places, onResults])
  const place = details.data ?? selected
  const save = async () => {
    if (!place || savedData.error) return
    setSaveError(null)
    try { if(saved.some(item=>item.id===place.id)) await savedData.remove(place.id);else await savedData.save(place) } catch(failure) {setSaveError(String(failure))}
  }
  const website = safePlaceWebsite(place?.tags.website || place?.tags["contact:website"])
  return <aside className="places-panel" aria-label="Places and businesses">
    <header><div><span className="instrument-label">Your neighbourhood</span><h2>{place ? "Place details" : "Find your next stop."}</h2></div><Button variant="ghost" size="icon" aria-label="Hide place search" onClick={onClose}><X data-icon="inline-start" /></Button></header>
    {savedData.error && <p role="alert" className="places-error">{savedData.error}</p>}
    {place ? <div className="place-detail">
      <Button variant="ghost" onClick={() => onSelect(null)}><ArrowLeft data-icon="inline-start" />Back to places</Button>
      <span className="instrument-label">{place.category.replaceAll("_", " ")}</span><h3 dir="auto">{place.name}</h3>
      <PlacePhotos key={place.id} place={place} />
      {details.isFetching && <p role="status">Loading business details…</p>}
      {details.isError && <p className="places-error" role="alert">Details could not load. <button type="button" onClick={() => void details.refetch()}>Try again</button></p>}
      <dl><dt>Address</dt><dd dir="auto">{place.address || "No street address listed"}</dd><dt>Opening hours</dt><dd>{place.tags.opening_hours || "Not listed"}</dd><dt>Phone</dt><dd>{place.tags.phone || place.tags["contact:phone"] || "Not listed"}</dd>{place.tags.cuisine && <><dt>Cuisine</dt><dd>{place.tags.cuisine.replaceAll(";", ", ")}</dd></>}{place.tags.wheelchair && <><dt>Wheelchair access</dt><dd>{place.tags.wheelchair}</dd></>}</dl>
      <div className="place-detail-actions"><Button variant="outline" onClick={()=>void save()} disabled={Boolean(savedData.error) || !savedData.ready}><Bookmark data-icon="inline-start" />{saved.some(item => item.id === place.id) ? "Remove saved place" : "Save place"}</Button>{website && <a href={website} target="_blank" rel="noopener noreferrer">Website<ExternalLink size={14} /></a>}<a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noopener noreferrer">Directions<ExternalLink size={14} /></a></div>
      <PlaceActions key={place.id} place={place}/>
      <Button variant="ghost" size="sm" disabled={comparison.length>=3 && !comparison.some(item=>item.id===place.id)} onClick={()=>setComparison(items=>items.some(item=>item.id===place.id) ? items.filter(item=>item.id!==place.id) : [...items,place])}>{comparison.some(item=>item.id===place.id) ? "Remove from comparison" : "Add to comparison"}</Button>
      {comparison.length>0 && <Button variant="outline" size="sm" onClick={()=>setComparing(true)}>Compare ({comparison.length}/3)</Button>}
      {saveError && <p role="alert" className="places-error">{saveError}</p>}
      <p className="place-source">OpenStreetMap community data. Details may be incomplete; opening hours are the source listing, not live opening status.</p>
      <p className="place-source">{place.provenance ? `${place.provenance.source} · ${place.provenance.cached ? "cached" : "retrieved"} ${new Date(place.provenance.fetchedAt).toLocaleString()}${place.provenance.stale ? " · stale; refresh when online" : ""}` : "Source retrieval time unavailable"}</p>
      {place.osmType && place.osmId && <a className="place-source" href={`https://www.openstreetmap.org/${place.osmType}/${place.osmId}`} target="_blank" rel="noopener noreferrer">View source listing ↗</a>}
    </div> : <>
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="search">Search</TabsTrigger><TabsTrigger value="nearby">Nearby</TabsTrigger><TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger></TabsList></Tabs>
      {tab==="saved" && savedData.collections.length>0 && <Select value={collectionId} onValueChange={setCollectionId}><SelectTrigger aria-label="Saved place collection"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All saved places</SelectItem>{savedData.collections.map(collection=><SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>)}</SelectGroup></SelectContent></Select>}
      {comparison.length>0 && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setComparing(true)}>Compare ({comparison.length}/3)</Button><Button variant="ghost" size="sm" onClick={()=>setComparison([])}>Clear</Button></div>}
      {tab === "search" && <form onSubmit={event => { event.preventDefault(); if (text.trim()) setRequest({ text: text.trim(), country }) }} className="place-search-form">
        <Field><FieldLabel htmlFor="place-search" className="sr-only">Search places</FieldLabel><Input id="place-search" value={text} onChange={event => setText(event.target.value)} placeholder="Store, business, street or city…" dir="auto" /></Field>
        <div><Select value={country} onValueChange={value => setCountry(value === "dz" ? "dz" : "all")}><SelectTrigger aria-label="Place search country"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="dz">Algeria</SelectItem><SelectItem value="all">Everywhere</SelectItem></SelectGroup></SelectContent></Select><Button type="submit" variant="outline" disabled={!text.trim() || search.isFetching}><Search data-icon="inline-start" />Search</Button></div>
      </form>}
      {tab === "nearby" && <div className="place-search-form"><Select value={category} onValueChange={value => setCategory(value as PlaceCategory)}><SelectTrigger aria-label="Business category"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{categories.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select><div><Button variant="outline" onClick={() => { setArea({ center: [center[0], center[1]], category, radius }); onExploreArea(radius) }} disabled={nearby.isFetching}><MapPin data-icon="inline-start" />Search this area</Button><Button variant="ghost" size="icon" aria-label="Use my location" onClick={onLocate}><LocateFixed data-icon="inline-start" /></Button></div><Select value={String(radius)} onValueChange={value => setRadius(Number(value))}><SelectTrigger aria-label="Nearby search radius"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="500">Within 500 m</SelectItem><SelectItem value="1500">Within 1.5 km</SelectItem><SelectItem value="2000">Within 2 km</SelectItem></SelectGroup></SelectContent></Select><small>Search around the map centre. Pan to explore another neighbourhood.</small></div>}
      <div className="place-results" aria-live="polite">{places && <span className="place-result-count">{places.length} listed places{tab === "nearby" && area ? ` · within ${area.radius / 1000} km` : ""}</span>}
        {tab !== "saved" && result.isFetching && <p role="status">Finding places…</p>}
        {tab !== "saved" && result.isError && <p className="places-error" role="alert">{tab === "nearby" && mapped.length ? "Detailed listings could not load. Showing places labelled on the map. " : result.error.message}<button type="button" onClick={() => void result.refetch()}>Try again</button></p>}
        {places?.slice(0, visibleCount).map(item => <button type="button" className="place-result" key={item.id} onClick={() => onSelect(item)}><MapPin size={17} /><span><strong dir="auto">{item.name}</strong><small>{item.category.replaceAll("_", " ")}</small>{item.address && <small dir="auto">{item.address}</small>}</span></button>)}
        {places && places.length > visibleCount && <Button variant="ghost" size="sm" onClick={() => setVisibleCount(current => current + 60)}>Show more places ({places.length - visibleCount})</Button>}
        {!result.isFetching && places?.length === 0 && <p>{tab === "saved" ? "Save places to keep them here." : "No listed places found. Try another name or area."}</p>}
        {!places && !result.isFetching && <p>{tab === "search" ? "Search in French, Arabic, or English. Choose a result to see its details." : "Move the map, then search this area."}</p>}
      </div><footer>© OpenStreetMap contributors</footer>
    </>}
    {comparing && <PlaceComparison places={comparison} center={center} onClose={()=>setComparing(false)}/>}
  </aside>
}
