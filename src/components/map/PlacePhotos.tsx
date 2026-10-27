import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Camera, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { placePhotos } from "@/lib/place-photos"
import type { MapPlace } from "@/lib/places"

export function PlacePhotos({ place }: { place: MapPlace }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const photos = useQuery({ queryKey: ["place-photos", place.id, place.tags.image, place.tags.wikimedia_commons, place.tags.wikidata],
    queryFn: ({ signal }) => placePhotos(place, signal), staleTime: 60 * 60_000 })
  const available = photos.data?.filter(photo => !failed.includes(photo.id)) ?? []
  const photo = available[index % Math.max(1, available.length)]
  return <section className="place-photos" aria-label="Place photos">
    {photo ? <>
      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="place-photo-image"><img key={photo.id} src={photo.url} alt={photo.scope === "nearby" ? `Nearby: ${photo.title}` : photo.title} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(current => [...current, photo.id])} /></a>
      <div className="place-photo-navigation"><span>{photo.scope === "nearby" ? "Around this place" : "Place photo"} · {index % available.length + 1} / {available.length}</span>{available.length > 1 && <div><Button variant="ghost" size="icon-sm" aria-label="Previous photo" onClick={() => setIndex(current => (current - 1 + available.length) % available.length)}><ChevronLeft /></Button><Button variant="ghost" size="icon-sm" aria-label="Next photo" onClick={() => setIndex(current => current + 1)}><ChevronRight /></Button></div>}</div>
      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="place-photo-credit">{photo.credit} · {photo.license} ↗</a>
      {photo.scope === "nearby" && <small>Photos geotagged within 1 km. They may show the neighbourhood rather than this business.</small>}
    </> : <div className="place-photo-empty"><Camera size={20} /><span>{photos.isFetching ? "Finding photos…" : photos.isError ? "Photos are unavailable." : "No linked or nearby photos found."}</span>{photos.isError && <Button variant="ghost" size="sm" onClick={() => void photos.refetch()}>Try again</Button>}</div>}
  </section>
}
