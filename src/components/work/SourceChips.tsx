import { useDailyWork } from "@/lib/daily-work"
import { useProjects } from "@/lib/projects"
import { Button } from "@/components/ui/button"

export function SourceChips() {
  const { selectedSourceIds, captures, selectedTaskId } = useDailyWork()
  const items = useProjects(state => state.items)
  return <div className="work-source-bar"><div className="work-actions">{selectedSourceIds.map(id => <Button key={id} variant="outline" size="sm" onClick={() => useDailyWork.getState().selectSource(id, false)} title="Remove from the next request">{captures.find(record => record.id === id)?.title || items.find(record => record.id === id)?.title || "Missing source"} ×</Button>)}{selectedTaskId && <Button variant="outline" size="sm" onClick={() => useDailyWork.setState({ selectedTaskId: undefined })}>Task: {items.find(record => record.id === selectedTaskId)?.title} ×</Button>}<Button variant="ghost" size="sm" onClick={() => useDailyWork.getState().openCapture()}>Attach source</Button></div>{selectedSourceIds.length > 0 && <p className="work-meta">Only these sources accompany the next request. Remove a chip to exclude it.</p>}</div>
}
