import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSavedPlaces } from "@/lib/saved-places"
import { useProjects, emptyProjectDraft, projectFromDraft, flushProjects, type ProjectItem } from "@/lib/projects"
import type { MapPlace } from "@/lib/places"

export function placeLink(place: MapPlace) {
  return place.osmType && place.osmId ? `https://www.openstreetmap.org/${place.osmType}/${place.osmId}` : `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}`
}
export function placeNote(place: MapPlace) {
  return [`Place: ${place.name}`, `Address: ${place.address || "Not supplied"}`, `Phone: ${place.tags.phone || place.tags["contact:phone"] || "Not supplied"}`, `Opening hours (source listing): ${place.tags.opening_hours || "Not supplied"}`, `Source: ${placeLink(place)}`, place.provenance ? `Retrieved: ${new Date(place.provenance.fetchedAt).toISOString()}${place.provenance.stale ? " (stale cache)" : ""}` : "Retrieval time unavailable"].join("\n")
}
export function PlaceActions({ place }: { place: MapPlace }) {
  const projects=useProjects(state=>state.projects)
  const collections=useSavedPlaces(state=>state.collections)
  const [mode,setMode]=useState<"task" | "note" | "collection" | null>(null)
  const [projectId,setProjectId]=useState(projects[0]?.id || "new")
  const [title,setTitle]=useState("")
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState<string | null>(null)
  const [error,setError]=useState<string | null>(null)
  const open=(next:typeof mode)=>{setMode(next);setTitle(next === "note" ? `Research: ${place.name}` : next === "task" ? `Visit ${place.name}` : "");setError(null)}
  const create=async (kind: "task" | "note", destination?:string) => {
    await useProjects.getState().hydrate()
    const workspace=useProjects.getState()
    let project=workspace.projects.find(project=>project.id===destination)
    if (!project) {
      const name=kind === "task" ? "Errands" : "Place research"
      project=workspace.projects.find(project=>project.name===name)
      if (!project) {project=projectFromDraft({...emptyProjectDraft,name,kind:kind === "task" ? "general" : "research"});workspace.saveProject(project)}
    }
    const item:ProjectItem={id:crypto.randomUUID(),projectId:project.id,type:kind,title:title.trim() || `${kind === "task" ? "Visit" : "Research:"} ${place.name}`,description:placeNote(place),sourceLinks:[placeLink(place)],status:"todo"}
    workspace.saveItem(item)
    await flushProjects()
    setNotice(`${kind === "task" ? "Errand" : "Research note"} saved in ${project.name}.`)
    return item
  }
  const save=async()=>{
    setBusy(true);setError(null)
    try {
      if (mode==="collection") {
        await useSavedPlaces.getState().save(place)
        const existing=collections.find(collection=>collection.name.toLocaleLowerCase()===title.trim().toLocaleLowerCase())
        await useSavedPlaces.getState().saveCollection({id:existing?.id || crypto.randomUUID(),name:title.trim(),placeIds:[...(existing?.placeIds || []),place.id]})
        setNotice(`Saved in ${title.trim()}.`)
      } else if (mode) {await create(mode,projectId)}
      setMode(null)
    } catch (failure) {setError(String(failure))} finally {setBusy(false)}
  }
  return <section aria-label="Use this place" className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={()=>{setBusy(true);setError(null);void create("task").catch(failure=>setError(String(failure))).finally(()=>setBusy(false))}}>Create errand</Button><Button variant="ghost" size="sm" onClick={()=>open("task")}>Add to project</Button><Button variant="ghost" size="sm" onClick={()=>open("note")}>Save research note</Button><Button variant="ghost" size="sm" onClick={()=>open("collection")}>Save to collection</Button></div>
    {notice && <p role="status" className="place-source">{notice}</p>}{!mode && error && <p role="alert">{error}</p>}
    {mode && <Dialog open onOpenChange={value=>{if(!value && !busy)setMode(null)}}><DialogContent><DialogHeader><DialogTitle>{mode==="collection" ? "Named collection" : mode==="note" ? "Save research note" : "Add errand to project"}</DialogTitle><DialogDescription>{place.name}. The source link and supplied details stay with the record.</DialogDescription></DialogHeader><form onSubmit={event=>{event.preventDefault();void save()}}><FieldGroup><Field><FieldLabel htmlFor="place-record-title">{mode==="collection" ? "Collection name" : "Title"}</FieldLabel><Input id="place-record-title" value={title} onChange={event=>setTitle(event.target.value)} required maxLength={120}/></Field>{mode!=="collection" && <Field><FieldLabel>Project</FieldLabel><Select value={projectId} onValueChange={setProjectId}><SelectTrigger aria-label="Place destination project"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="new">{mode==="note" ? "Place research" : "Errands"} inbox</SelectItem>{projects.map(project=><SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>}{mode==="collection" && collections.length>0 && <p className="place-source">Existing collections: {collections.map(collection=>collection.name).join(", ")}. Use a name to add to it.</p>}{error && <p role="alert">{error}</p>}</FieldGroup><DialogFooter><Button type="button" variant="ghost" onClick={()=>setMode(null)} disabled={busy}>Cancel</Button><Button variant="outline" type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save"}</Button></DialogFooter></form></DialogContent></Dialog>}
  </section>
}
