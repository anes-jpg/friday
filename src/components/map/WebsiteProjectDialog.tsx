import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { placeDetails, type MapPlace } from "@/lib/places"
import { businessPhone, businessWebsite, createWebsiteProject, type WebsiteProjectOptions } from "@/lib/business-workflow"
import { prepareWorkRequest } from "@/lib/work-navigation"
import { isDesktop } from "@/lib/ipc"
import { useProjects } from "@/lib/projects"

export function WebsiteProjectDialog({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  const details = useQuery({ queryKey: ["place-details", place.id], queryFn: ({ signal }) => placeDetails(place, signal), staleTime: 30 * 60_000 })
  const business = details.data ?? place
  const existing = useProjects(state => state.projects.find(project => project.tags.includes(`business:${encodeURIComponent(business.id)}`)))
  const [language, setLanguage] = useState<WebsiteProjectOptions["language"]>("fr")
  const [goal, setGoal] = useState(`Create a website that helps customers discover ${place.name} and get in touch.`)
  const [direction, setDirection] = useState("A distinctive, clear business identity. Strong typography, mobile-first layout, services, location, and one clear contact action.")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    setBusy(true); setError(null)
    try {
      const result = await createWebsiteProject(business, { language, goal, direction })
      prepareWorkRequest(result.project.id, result.request, [result.sourceId])
      onClose()
    } catch (failure) { setError(`Could not finish preparing the project: ${String(failure)}. You can retry; saved records will be reused.`) }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent className="website-project-dialog"><DialogHeader><DialogTitle>Build for {business.name}</DialogTitle><DialogDescription>Turn this business into a website project with its source, a brief, and a review queue.</DialogDescription></DialogHeader>
    {details.isFetching && <AsciiLoader label="Reading the business listing" />}
    {details.isError && <p className="place-source">Detailed listing unavailable. Only the displayed information will be included.</p>}
    <dl className="website-business-facts"><dt>Business</dt><dd>{business.category.replaceAll("_", " ")} · {business.address || "Address not supplied"}</dd><dt>Contact</dt><dd>{businessPhone(business) || "Phone not supplied"}</dd><dt>Current website</dt><dd>{businessWebsite(business) || "Not supplied by this listing. Verify independently."}</dd></dl>
    {existing ? <p className="place-source">Continue {existing.name}. Its brief, language, and task progress will be preserved. Edit them in the project workspace.</p> : <><label className="website-field">Website goal<Textarea value={goal} onChange={event => setGoal(event.target.value)} rows={2} maxLength={2000} /></label><label className="website-field">Design direction<Textarea value={direction} onChange={event => setDirection(event.target.value)} rows={3} maxLength={4000} /></label><label className="website-field">Customer-facing language<select value={language} onChange={event => setLanguage(event.target.value as WebsiteProjectOptions["language"])}><option value="fr">French</option><option value="ar">Arabic</option><option value="en">English</option></select></label></>}
    <p className="place-source">{isDesktop ? "A local working folder is created automatically. Review the request next, generate the files with FRIDAY, then inspect the Website preview." : "The brief and tasks are saved in this browser. Open Windows to generate and preview local website files."}</p>
    {busy && <AsciiLoader label="Preparing folder, source, and tasks" />}{error && <p role="alert" className="places-error">{error}</p>}
    <DialogFooter><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="outline" disabled={busy || details.isFetching || !goal.trim()} onClick={() => void create()}>{existing ? "Continue project & prepare draft" : "Create project & prepare draft"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
