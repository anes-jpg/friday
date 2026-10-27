import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { placeDetails, safePlaceWebsite, type MapPlace } from "@/lib/places"
import { PlacePhotos } from "./PlacePhotos"
import { placeLink } from "./PlaceActions"

function ComparisonPlace({ place,center }: {place:MapPlace;center:[number,number]}) {
  const details=useQuery({queryKey:["place-details",place.id],queryFn:({signal})=>placeDetails(place,signal),staleTime:30*60_000})
  const value=details.data || place
  const distance=Math.hypot((value.lat-center[1])*111_320,(value.lng-center[0])*111_320*Math.cos(center[1]*Math.PI/180))
  const website=safePlaceWebsite(value.tags.website || value.tags["contact:website"])
  return <article className="min-w-0 rounded-2xl border border-border p-4"><h3 dir="auto">{value.name}</h3><PlacePhotos place={value}/><dl className="flex flex-col gap-2 text-xs"><dt>Address</dt><dd dir="auto">{value.address || "Not supplied"}</dd><dt>Phone</dt><dd>{value.tags.phone || value.tags["contact:phone"] || "Not supplied"}</dd><dt>Opening hours</dt><dd>{value.tags.opening_hours || "Not supplied"}</dd><dt>Distance from map centre</dt><dd>{distance<1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`} (straight line)</dd></dl>{website && <a href={website} target="_blank" rel="noopener noreferrer">Website</a>}<p className="place-source">{value.provenance ? `${value.provenance.cached ? "Cached" : "Retrieved"} ${new Date(value.provenance.fetchedAt).toLocaleString()}${value.provenance.stale ? " · stale" : ""}` : "Freshness unavailable"}</p><a className="place-source" href={placeLink(value)} target="_blank" rel="noopener noreferrer">Source listing</a>{details.isError && <p role="alert">Details unavailable. Showing saved listing.</p>}</article>
}
export function PlaceComparison({places,center,onClose}:{places:MapPlace[];center:[number,number];onClose:()=>void}) {
  return <Dialog open onOpenChange={value=>{if(!value)onClose()}}><DialogContent className="max-h-[88vh] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Compare places</DialogTitle><DialogDescription>Up to three source listings. Hours are supplied information, with no live opening guarantee.</DialogDescription></DialogHeader><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{places.slice(0,3).map(place=><ComparisonPlace key={place.id} place={place} center={center}/>)}</div><Button variant="ghost" onClick={onClose}>Close comparison</Button></DialogContent></Dialog>
}
