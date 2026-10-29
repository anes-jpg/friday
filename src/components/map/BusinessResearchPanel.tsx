import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BlockReveal } from "@/components/ui/block-reveal"
import { businessPhone, businessWebsite, businessEmail, businessAddress, businessHours } from "@/lib/business-workflow"
import { readBusinessSite, searchBusinessSources, verifiedBusiness, type BusinessSiteFacts } from "@/lib/business-research"
import { isDesktop } from "@/lib/ipc"
import type { MapPlace } from "@/lib/places"
import type { BusinessDetailField } from "@/lib/places"
import { GoogleBusinessSearch } from "./GoogleBusinessSearch"

export function BusinessResearchPanel({ place, onSave }: { place: MapPlace; onSave: (place: MapPlace) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(businessWebsite(place) || "")
  const [phone, setPhone] = useState(businessPhone(place) || "")
  const [email, setEmail] = useState(businessEmail(place) || "")
  const [website, setWebsite] = useState(businessWebsite(place) || "")
  const [address, setAddress] = useState(businessAddress(place) || "")
  const [hours, setHours] = useState(businessHours(place) || "")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([])
  const [site, setSite] = useState<BusinessSiteFacts | null>(null)
  const [googleSource, setGoogleSource] = useState<string | null>(null)
  const search = async () => { setBusy(true); setError(null); try { setSources(await searchBusinessSources(place)) } catch (failure) { setError(String(failure)) } finally { setBusy(false) } }
  const read = async (url: string) => {
    setBusy(true); setError(null); setConfirmed(false)
    try { const result = await readBusinessSite(url); setSite(result); setSource(result.url); if (result.phones[0]) setPhone(result.phones[0]); if (result.emails[0]) setEmail(result.emails[0]); }
    catch (failure) { setError(String(failure)) } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true); setError(null)
    try {
      const values: Partial<Record<BusinessDetailField, string>> = {}
      const fields = { phone, email, website, address, openingHours: hours }
      const original = { phone: businessPhone(place), email: businessEmail(place), website: businessWebsite(place), address: businessAddress(place), openingHours: businessHours(place) }
      for (const field of Object.keys(fields) as BusinessDetailField[]) if (fields[field].trim() !== (original[field] || "").trim()) values[field] = fields[field]
      await onSave(verifiedBusiness(place, values, source, googleSource === source ? "google" : site?.url === source ? "website" : "manual"))
      setNotice("Verified details saved with their source. They will be included in the website brief."); setConfirmed(false)
    }
    catch (failure) { setError(String(failure)) } finally { setBusy(false) }
  }
  return <section className="business-research"><header><div><span className="instrument-label">Free business research</span><p>Find contact details and verify the source.</p></div><Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Close research" : "Research details"}</Button></header>
    {open && <><GoogleBusinessSearch initialQuery={`${place.name} ${businessAddress(place) || place.researchQuery || ""} contact téléphone`} onRead={url => void read(url)} onCandidate={(field, value, url) => { setSource(url); setGoogleSource(url); setSite(null); setConfirmed(false); if (field === "phone") setPhone(value); if (field === "address") setAddress(value); if (field === "website") setWebsite(value) }} /><div className="business-research-search"><Button variant="outline" size="sm" disabled={busy || !isDesktop} onClick={() => void search()}>Find source websites</Button></div>
      <BlockReveal loading={busy && !site && !sources.length} label="Reading public business sources" lines={3}>
        {sources.length > 0 && <ul className="business-source-results">{sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || new URL(item.url).hostname} ↗</a><Button variant="ghost" size="sm" disabled={busy} onClick={() => void read(item.url)}>Read contacts</Button></li>)}</ul>}
        <label className="website-field">Source website<input type="url" value={source} onChange={event => { setSource(event.target.value); setConfirmed(false) }} placeholder="https://business.example/contact" /></label><Button variant="ghost" size="sm" disabled={busy || !source.trim() || !isDesktop} onClick={() => void read(source)}>Read this page</Button>
        {site && <div className="business-site-results"><strong>{site.title}</strong>{site.names.length > 0 && <p>Named in page: {site.names.join(" · ")}</p>}<p>{site.phones.length} phone candidates · {site.emails.length} email candidates. Check that the page belongs to this business.</p><div>{site.phones.map(value => <button type="button" key={value} onClick={() => setPhone(value)}>{value}</button>)}{site.emails.map(value => <button type="button" key={value} onClick={() => setEmail(value)}>{value}</button>)}</div>{site.contactLinks.map(link => <button type="button" className="quiet-action" key={link} disabled={busy} onClick={() => void read(link)}>Read {new URL(link).pathname}</button>)}</div>}
      </BlockReveal>
      <div className="business-verified-fields"><label className="website-field">Phone<input value={phone} onChange={event => setPhone(event.target.value)} /></label><label className="website-field">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="website-field">Business website<input type="url" value={website} onChange={event => setWebsite(event.target.value)} /></label><label className="website-field">Opening hours<input value={hours} onChange={event => setHours(event.target.value)} /></label><label className="website-field">Address<input value={address} onChange={event => setAddress(event.target.value)} /></label></div>
      <label className="business-identity-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked that this source and these details belong to {place.name}.</label><Button variant="outline" disabled={busy || !confirmed || !source.trim()} onClick={() => void save()}>Save verified details</Button>
      {error && <p role="alert" className="places-error">{error}</p>}{notice && <p role="status" className="place-source">{notice}</p>}<p className="place-source">Free sources can be incomplete or unavailable. Saved details keep the source URL and verification time.</p>
    </>}
    {place.details && <div className="business-field-sources">{Object.entries(place.details).map(([field, fact]) => fact && <a key={field} href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">{field} · {fact.provider} · {new Date(fact.fetchedAt).toLocaleDateString()} ↗</a>)}</div>}
  </section>
}
