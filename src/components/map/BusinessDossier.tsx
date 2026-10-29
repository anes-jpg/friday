import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowUpRight, Bookmark, Phone, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { useSettings } from "@/lib/settings"
import { businessAddress, businessEmail, businessHours, businessPhone, businessWebsite } from "@/lib/business-workflow"
import { verifiedBusiness } from "@/lib/business-research"
import { captureSelectedBusiness, closeBusinessSearch, openSelectedBusiness, pullSelectedBusiness, selectedBusinessRequest, type BusinessSearchCapture, type BusinessSelection } from "@/lib/business-search"
import { isDesktop } from "@/lib/ipc"
import type { BusinessDetailField, MapPlace } from "@/lib/places"
import { PlacePhotos } from "./PlacePhotos"

const fieldGlyphs = "+-----------------------------+\n| :: # . : # :: . # : . :: # : |\n| . ## : :: # . : ## : . # :: |\n| # : . ## : # :: . : ## . : |\n+-----------------------------+"

/** Each arrived field resolves through its own glyph plate, never a page skeleton. */
export function DossierBlock({ title, children }: { title: string; children: ReactNode }) {
  const reduced = useSettings(state => state.saved.appearance.reducedMotion)
  return <article className={`dossier-block${reduced ? " dossier-instant" : ""}`}>
    <pre className="dossier-arrival-glyphs" aria-hidden="true">{fieldGlyphs}</pre>
    <div className="dossier-block-content"><h4>{title}</h4>{children}</div>
  </article>
}

function DossierPhotos({ capture, place }: { capture: BusinessSearchCapture; place: MapPlace }) {
  const [loaded, setLoaded] = useState<string[]>([])
  const [failed, setFailed] = useState<string[]>([])
  const photos = capture.photos.filter(url => !failed.includes(url))
  return <section className="dossier-photos" aria-label="Business photos">
    {photos.length ? <><div className="dossier-photo-grid">{photos.map((url, index) => <figure key={url} className="dossier-photo">
      {!loaded.includes(url) && <AsciiLoader variant="block" label="Loading business photo" />}
      <a href={capture.url} target="_blank" rel="noopener noreferrer"><img className={loaded.includes(url) ? "dossier-photo-ready" : "dossier-photo-pending"} src={url} alt={`${capture.selectedName || place.name} · source photo ${index + 1}`} decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(current => [...current, url])} onError={() => setFailed(current => [...current, url])} /></a>
    </figure>)}</div><a className="place-photo-credit" href={capture.url} target="_blank" rel="noopener noreferrer">Photos shown by Google Maps · view source and credits ↗</a></> : <PlacePhotos place={place} />}
  </section>
}

export function BusinessDossier({ place, city, expanded, onExpand, onSave, onBuild }: {
  place: MapPlace; city: string; expanded: boolean; onExpand: (expanded: boolean) => void
  onSave: (place: MapPlace) => Promise<void>; onBuild: (place: MapPlace) => void
}) {
  const [capture, setCapture] = useState<BusinessSearchCapture | null>(null)
  const [busy, setBusy] = useState(false)
  const [windowReady, setWindowReady] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const request = useRef<{ label: string; selection: BusinessSelection } | null>(null)
  const generation = useRef(0)
  useEffect(() => () => {
    generation.current++
    if (request.current) void closeBusinessSearch(request.current.label).catch(() => {})
  }, [])
  const research = async (retry = false) => {
    if (busy) return
    const token = ++generation.current
    const previous = request.current
    const next = retry && previous ? previous : { label: `business-search-${crypto.randomUUID()}`, selection: selectedBusinessRequest(place, city) }
    request.current = next
    setBusy(true); setWindowReady(false); setError(null); setNotice(null); setConfirmed(false)
    try {
      if (!(retry && previous)) {
        if (previous) await closeBusinessSearch(previous.label)
        await openSelectedBusiness(next.label, next.selection)
      }
      if (generation.current !== token) { await closeBusinessSearch(next.label); return }
      setWindowReady(true)
      const result = await captureSelectedBusiness(next.label, next.selection)
      if (generation.current !== token || request.current?.label !== next.label) return
      request.current = null
      setWindowReady(false); setCapture(result); setError(null); onExpand(true)
    } catch (failure) { if (generation.current === token && request.current?.label === next.label) setError(String(failure)) }
    finally { if (generation.current === token) setBusy(false) }
  }
  const pull = async () => {
    const next = request.current
    if (!next || !windowReady || pulling) return
    const token = generation.current
    setPulling(true); setError(null); setConfirmed(false)
    try {
      const result = await pullSelectedBusiness(next.label)
      if (generation.current !== token || request.current?.label !== next.label) return
      request.current = null; setWindowReady(false); setCapture(result); setError(null); setBusy(false); onExpand(true)
    } catch (failure) { if (generation.current === token && request.current?.label === next.label) setError(String(failure)) }
    finally { if (generation.current === token) setPulling(false) }
  }
  const cancel = () => {
    generation.current++
    if (request.current) void closeBusinessSearch(request.current.label).catch(failure => setError(String(failure)))
    request.current = null; setBusy(false); setPulling(false); setWindowReady(false); setError(null)
  }
  const values: Partial<Record<BusinessDetailField, string>> = capture ? {
    ...(capture.phones[0] ? { phone: capture.phones[0] } : {}),
    ...(capture.addresses[0] ? { address: capture.addresses[0] } : {}),
    ...(capture.website ? { website: capture.website } : {}),
    ...(capture.hours ? { openingHours: capture.hours } : {}),
  } : {}
  const reviewed = capture ? verifiedBusiness({ ...place, researchSourceUrl: capture.url, researchExcerpt: capture.text.slice(0, 4000) }, values, capture.url, "google") : place
  const save = async (build = false) => {
    if (!confirmed || saving) return
    setSaving(true); setError(null)
    try { await onSave(reviewed); setNotice("Business details saved with Google Maps evidence."); if (build) onBuild(reviewed) }
    catch (failure) { setError(String(failure)) } finally { setSaving(false) }
  }
  const phone = capture?.phones[0] || businessPhone(place)
  const website = capture?.website || businessWebsite(place)
  return <section className="business-dossier" aria-label="Google business dossier">
    <div className="dossier-research-action"><Button variant="outline" disabled={busy || !isDesktop} onClick={() => void research()}><Search data-icon="inline-start" />{capture ? "Refresh Google details" : "Get Google business details"}</Button>{capture && !expanded && <Button variant="ghost" onClick={() => onExpand(true)}>Open business dossier<ArrowUpRight size={14} /></Button>}</div>
    {request.current && windowReady && <div className="dossier-pull-controls"><Button variant="outline" disabled={pulling} onClick={() => void pull()}>{pulling ? "Capturing listing…" : "Capture selected listing"}</Button><Button variant="ghost" size="sm" onClick={cancel}>Close Google window</Button></div>}
    {(busy || pulling) && <div className="dossier-working"><AsciiLoader variant="block" label={pulling ? "Capturing selected listing" : "Reading Google Maps"} />{!windowReady && <Button variant="ghost" size="sm" onClick={cancel}>Cancel research</Button>}</div>}
    {error && <div className="dossier-recovery" role="alert"><p>{/Several branches|does not match|within 50 seconds/.test(error) ? "Choose the correct branch in Google Maps, then capture it here." : error}</p></div>}
    {capture && expanded && <>
      <div className="dossier-identity"><span className="instrument-label">Google Maps · captured listing</span><h3 dir="auto">{capture.selectedName || place.name}</h3><p dir="auto">{capture.category || place.category.replaceAll("_", " ")} {city && `· ${city}`}</p></div>
      <DossierPhotos key={capture.url + capture.photos.join("|")} capture={capture} place={place} />
      <div className="dossier-grid" key={capture.text + capture.url}>
        <DossierBlock title="Contact"><p className="dossier-primary">{phone || "Phone not listed"}</p>{phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone size={14} />Call business</a>}<small>{capture.phones[0] ? "Displayed on Google Maps" : phone ? "From the existing listing" : "No phone was supplied by the displayed listing."}</small><p>{businessEmail(place) || "Email not listed"}</p></DossierBlock>
        <DossierBlock title="Location"><p dir="auto">{capture.addresses[0] || businessAddress(place) || "Street address not listed"}</p><a href={capture.url} target="_blank" rel="noopener noreferrer">View exact Google listing<ArrowUpRight size={14} /></a></DossierBlock>
        <DossierBlock title="Hours / current status"><p>{capture.hours || businessHours(place) || "Hours not listed"}</p><small>{capture.hours ? "As displayed at capture time; check before visiting." : "No live status is inferred."}</small></DossierBlock>
        <DossierBlock title="Website"><p className="dossier-primary">{website ? new URL(website).hostname : "Website not listed"}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer">Open business website<ArrowUpRight size={14} /></a>}<small>{website ? "Review the existing site before planning a redesign." : "A missing link is a research opportunity; check with the owner."}</small></DossierBlock>
      </div>
      <div className="dossier-project"><div><span className="instrument-label">From discovery to a working website</span><h4>{website ? "Build a better customer experience." : "Give this business a useful home online."}</h4><p>Prepare a sourced brief, choose French or Arabic, and create a local project with services, contact, and location pages.</p></div><div className="dossier-project-actions"><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />This is the correct business and branch.</label><div><Button variant="outline" disabled={!confirmed || saving || busy} onClick={() => void save()}><Bookmark size={14} />Save details</Button><Button variant="outline" disabled={!confirmed || saving || busy} onClick={() => void save(true)}><Sparkles size={14} />Build website</Button></div></div></div>
      {notice && <p role="status" className="place-source">{notice}</p>}
      <details className="dossier-evidence"><summary>Captured source text · check missing or uncertain details</summary><pre dir="auto">{capture.text}</pre><a href={capture.url} target="_blank" rel="noopener noreferrer">{capture.title} ↗</a></details>
    </>}
  </section>
}
