import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Monitor, Smartphone, RefreshCw, Sparkles, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AsciiLoader } from "@/components/ui/ascii-loader"
import { readProjectFile } from "@/lib/workflow"
import { isDesktop } from "@/lib/ipc"
import type { WorkspaceProject } from "@/lib/projects"

export function WebsitePreview({ project, onGenerate, onFiles }: { project: WorkspaceProject; onGenerate: () => void; onFiles: () => void }) {
  const [device, setDevice] = useState("desktop")
  const file = `${project.rootPath?.replace(/[\\/]$/, "") || ""}/index.html`
  const preview = useQuery({ queryKey: ["website-preview", project.id, file], enabled: isDesktop && Boolean(project.rootPath), queryFn: async () => {
    const text = await readProjectFile(file)
    if (text.length > 2_000_000) throw new Error("Preview is larger than 2 MB. Open the file in Files to review it.")
    return text
  }, retry: false, staleTime: 0 })
  return <section className="website-preview" data-device={device}><header><div><span className="instrument-label">Local website / index.html</span><h3>Website preview</h3></div><div><Button variant="ghost" size="icon" aria-label="Desktop preview" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={16} /></Button><Button variant="ghost" size="icon" aria-label="Mobile preview" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={16} /></Button><Button variant="outline" size="sm" disabled={preview.isFetching || !project.rootPath || !isDesktop} onClick={() => void preview.refetch()}><RefreshCw size={14} />Refresh</Button><Button variant="ghost" size="sm" onClick={onFiles}><FileCode size={14} />Files</Button></div></header>
    {preview.isFetching && <AsciiLoader label="Reading local website files" />}
    {preview.isError && <p className="place-source">The preview could not be read: {preview.error.message}</p>}
    {preview.data ? <><div className="website-preview-stage"><iframe title={`${project.name} website preview`} src={`data:text/html;charset=utf-8,${encodeURIComponent(preview.data)}`} sandbox="allow-scripts" referrerPolicy="no-referrer" /></div><p className="place-source">{device === "mobile" ? "390px mobile viewport" : "Desktop viewport"} · Refresh after FRIDAY writes a new draft. Review content and contact details before publishing.</p></> : !preview.isFetching && <div className="website-preview-empty"><h4>From listing to a working website.</h4><p>Generate a complete local index.html with FRIDAY, then review its desktop and mobile layout here.</p><Button variant="outline" onClick={onGenerate}><Sparkles size={16} />Prepare website draft</Button>{!isDesktop && <p>Local file generation and preview require the Windows app.</p>}</div>}
  </section>
}
