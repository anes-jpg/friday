import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BlockReveal } from "@/components/ui/block-reveal"
import { businessSearchLead, captureBusinessSearch, currentBusinessSearchWindow, openBusinessSearch, type BusinessSearchCapture } from "@/lib/business-search"
import { isDesktop } from "@/lib/ipc"
import type { BusinessDetailField, MapPlace } from "@/lib/places"

export function GoogleBusinessSearch({ initialQuery, center, onLead, onRead, onCandidate }: {
  initialQuery: string; center?: [number, number]; onLead?: (place: MapPlace) => Promise<void>
  onRead?: (url: string) => void; onCandidate?: (field: BusinessDetailField, value: string, source: string) => void
}) {
  const id = useId()
  const [query, setQuery] = useState(initialQuery)
  const [label, setLabel] = useState(currentBusinessSearchWindow)
  const [capture, setCapture] = useState<BusinessSearchCapture | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [leadSource, setLeadSource] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [importedQuery, setImportedQuery] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const open = async (maps: boolean) => {
    setBusy(true); setError(null)
    try { setLabel(await openBusinessSearch(query, maps)); setNotice("Browse the results in the Google window, then return here to import.") }
    catch (failure) { setError(String(failure)) } finally { setBusy(false) }
  }
  const read = async () => {
    if (!label) return
    setBusy(true); setError(null); setConfirmed(false); setNotice(null)
    try {
      const result = await captureBusinessSearch(label)
      const url = new URL(result.url)
      setImportedQuery(url.searchParams.get("q") || url.searchParams.get("query") || query)
      setCapture(result); setName(result.selectedName || ""); setLeadSource(result.url); setExcerpt(result.text.slice(0, 4000))
    } catch (failure) { setError(String(failure)) } finally { setBusy(false) }
  }
  const save = async () => {
    if (!center || !onLead || !confirmed) return
    setBusy(true); setError(null)
    try { await onLead(businessSearchLead(name, leadSource, center, importedQuery, excerpt)); setNotice("Saved to Website leads. Review contacts, then build a website from the business details."); setConfirmed(false) }
    catch (failure) { setError(String(failure)) } finally { setBusy(false) }
  }
  return <section className="google-business-search" aria-label="Google business research">
    <div><span className="instrument-label">Google discovery</span><p>Search a category and city, or open one business in Maps. Import the loaded page to research it here.</p></div>
    <label htmlFor={`${id}-query`}>Business or category + location</label><Input id={`${id}-query`} value={query} maxLength={1000} onChange={event => setQuery(event.target.value)} placeholder="Salons in Alger Centre" />
    <div className="google-search-actions"><Button variant="outline" size="sm" disabled={busy || !isDesktop || !query.trim()} onClick={() => void open(false)}>Open Google Search</Button><Button variant="outline" size="sm" disabled={busy || !isDesktop || !query.trim()} onClick={() => void open(true)}>Open Google Maps</Button><Button variant="outline" size="sm" disabled={busy || !label || !isDesktop} onClick={() => void read()}>Import visible results</Button></div>
    {!isDesktop && <p className="place-source">Result import is available in the Windows app.</p>}
    <BlockReveal loading={busy} label="Reading Google research">
      {capture && <div className="google-import-results"><a className="place-source" href={capture.url} target="_blank" rel="noopener noreferrer">Imported from {capture.title || "Google"} ↗</a>
        {capture.selectedName && <strong dir="auto">Selected listing: {capture.selectedName}</strong>}
        {capture.results.length > 0 && <ul className="business-source-results">{capture.results.map(result => <li key={result.url}><div><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title || new URL(result.url).hostname} ↗</a><p dir="auto">{result.snippet}</p></div><div className="google-search-actions">{onRead && !new URL(result.url).hostname.endsWith("google.com") && <Button variant="ghost" size="sm" onClick={() => onRead(result.url)}>Read contacts</Button>}{onCandidate && !new URL(result.url).hostname.endsWith("google.com") && <Button variant="ghost" size="sm" onClick={() => onCandidate("website", result.url, capture.url)}>Use website</Button>}{onLead && <Button variant="ghost" size="sm" onClick={() => { setName(result.title); setLeadSource(result.url); setExcerpt(result.snippet); setConfirmed(false) }}>Use as lead</Button>}</div></li>)}</ul>}
        {onCandidate && (capture.phones.length > 0 || capture.addresses.length > 0) && <div className="google-contact-candidates"><p>Page candidates — check the business and branch before saving.</p>{capture.phones.map(value => <Button variant="ghost" size="sm" key={value} onClick={() => onCandidate("phone", value, capture.url)}>Use phone: {value}</Button>)}{capture.addresses.map(value => <Button variant="ghost" size="sm" key={value} onClick={() => onCandidate("address", value, capture.url)}>Use address: {value}</Button>)}</div>}
        {!capture.results.length && !capture.selectedName && <p className="place-source">No result links found. Select a business in Maps or try Google Search, then import again.</p>}
        <details className="google-page-excerpt"><summary>Read captured page text</summary><pre dir="auto">{capture.text}</pre></details>
        {onLead && center && <div className="google-lead-review"><label htmlFor={`${id}-name`}>Business name (review result titles)</label><Input id={`${id}-name`} value={name} maxLength={180} onChange={event => { setName(event.target.value); setConfirmed(false) }} /><label htmlFor={`${id}-source`}>Lead source</label><Input id={`${id}-source`} value={leadSource} type="url" onChange={event => { setLeadSource(event.target.value); setConfirmed(false) }} /><p className="place-source">This lead has no verified map position or official website yet. Its source and quoted text will travel with the website brief.</p><label className="business-identity-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked that this is a business I want to research.</label><Button variant="outline" size="sm" disabled={busy || !confirmed || !name.trim()} onClick={() => void save()}>Save business lead</Button></div>}
      </div>}
    </BlockReveal>
    {error && <p className="places-error" role="alert">{error}</p>}{notice && <p className="place-source" role="status">{notice}</p>}
  </section>
}
