import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Monitor, Smartphone, RefreshCw, Sparkles, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { readProjectFile } from "@/lib/workflow"
import { isDesktop } from "@/lib/ipc"
import type { WorkspaceProject } from "@/lib/projects"
import { localPreviewUrl } from "@/lib/website-preview"
import { BlockReveal } from "@/components/ui/block-reveal"

export function WebsitePreview({ project, onGenerate, onFiles }: { project: WorkspaceProject; onGenerate: () => void; onFiles: () => void }) {
  const [device, setDevice] = useState("desktop")
  const [serverInput, setServerInput] = useState("")
  const [serverUrl, setServerUrl] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const connect = () => {
    try { setServerUrl(localPreviewUrl(serverInput, window.location.origin)); setServerError(null) }
    catch (failure) { setServerError(String(failure)) }
  }
  const file = `${project.rootPath?.replace(/[\\/]$/, "") || ""}/index.html`
  const preview = useQuery({ queryKey: ["website-preview", project.id, file], enabled: !serverUrl && isDesktop && Boolean(project.rootPath), queryFn: async () => {
    const text = await readProjectFile(file)
    if (text.length > 2_000_000) throw new Error("Preview is larger than 2 MB. Open the file in Files to review it.")
    return text
  }, retry: false, staleTime: 0 })
  return <section className="website-preview" data-device={device}><header><div><span className="instrument-label">Local website / index.html</span><h3>Website preview</h3></div><div><Button variant="ghost" size="icon" aria-label="Desktop preview" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={16} /></Button><Button variant="ghost" size="icon" aria-label="Mobile preview" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={16} /></Button><Button variant="outline" size="sm" disabled={!serverUrl && (preview.isFetching || !project.rootPath || !isDesktop)} onClick={() => { if (serverUrl) setRevision(value => value + 1); else void preview.refetch() }}><RefreshCw size={14} />Refresh</Button><Button variant="ghost" size="sm" onClick={onFiles}><FileCode size={14} />Files</Button></div></header>
    <form className="website-server-preview" onSubmit={event => { event.preventDefault(); connect() }}><label htmlFor={`preview-server-${project.id}`}>React / Dioramas development URL</label><div><input id={`preview-server-${project.id}`} type="url" value={serverInput} onChange={event => setServerInput(event.target.value)} placeholder="http://localhost:5173" /><Button variant="outline" size="sm" type="submit" disabled={!serverInput.trim()}>Use local server</Button>{serverUrl && <Button variant="ghost" size="sm" type="button" onClick={() => setServerUrl("")}>Use index.html</Button>}</div><p className="place-source">Ask FRIDAY to start the project's development server and report its actual URL. Module previews need the server to allow this isolated frame; open the local app for full browser behavior.</p>{serverError && <p className="project-error" role="alert">{serverError}</p>}</form>
    {!serverUrl && preview.isError && <p className="place-source">The file preview could not be read: {preview.error.message}</p>}
    <BlockReveal loading={!serverUrl && preview.isFetching && !preview.data} label="Reading local website files" lines={5}>
      {serverUrl || preview.data ? <><div className="website-preview-stage"><iframe key={`${serverUrl || "file"}:${revision}`} title={`${project.name} website preview`} src={serverUrl || `data:text/html;charset=utf-8,${encodeURIComponent(preview.data || "")}`} sandbox="allow-scripts" referrerPolicy="no-referrer" /></div><p className="place-source">{device === "mobile" ? "390px mobile viewport" : "Desktop viewport"} · Review content and contact details before publishing. {serverUrl && <a href={serverUrl} target="_blank" rel="noopener noreferrer">Open local app ↗</a>}</p></> : !preview.isFetching && <div className="website-preview-empty"><h4>From listing to a working website.</h4><p>Generate a local website with FRIDAY, then review index.html or connect its development server here.</p><Button variant="outline" onClick={onGenerate}><Sparkles size={16} />Prepare website draft</Button>{!isDesktop && <p>Local file generation requires the Windows app.</p>}</div>}
    </BlockReveal>
  </section>
}
