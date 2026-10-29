import { Button } from "@/components/ui/button"
import { useDailyWork } from "@/lib/daily-work"
import { useProjects, type ProjectItem } from "@/lib/projects"
import { openOrigin, openSavedSource } from "@/lib/work-navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function SavedNoteContent({ item }: { item: ProjectItem }) {
  return <div className="work-note-content" dir="auto"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => href?.startsWith("#source-") ? <button type="button" className="work-citation" onClick={() => openSavedSource(href.slice(8))}>{children}</button> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{item.description || ""}</ReactMarkdown></div>
}

export function RecordSources({ item }: { item: ProjectItem }) {
  const captures = useDailyWork(state => state.captures)
  const items = useProjects(state => state.items)
  return <div className="work-actions">{item.sourceIds?.map(id => <Button key={id} variant="ghost" size="sm" onClick={() => openSavedSource(id)}>Source: {captures.find(record => record.id === id)?.title || items.find(record => record.id === id)?.title || "Unavailable excerpt"}</Button>)}{item.origin && <Button variant="ghost" size="sm" onClick={() => { if (item.origin) openOrigin(item.origin) }}>Originating message</Button>}</div>
}
