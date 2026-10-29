import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BlockReveal } from "@/components/ui/block-reveal"
import { builderRecipes, builderBlocks, recipeFor, prepareBuilderKit, type BuilderRecipeId, type BuilderBlockId } from "@/lib/builder-recipes"
import type { WorkspaceProject } from "@/lib/projects"
import { starterBlockPreview } from "@/lib/website-preview"

export function BuilderStudio({ project, onPrepare }: { project: WorkspaceProject; onPrepare: (request: string, sourceId: string) => void }) {
  const [recipeId, setRecipeId] = useState<BuilderRecipeId>(recipeFor(project).id)
  const [blocks, setBlocks] = useState<BuilderBlockId[]>(["offer", "services", "contact"])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recipe = builderRecipes.find(item => item.id === recipeId) || builderRecipes[0]
  const prepare = async () => { setBusy(true); setError(null); try { const kit = await prepareBuilderKit(project, recipeId, blocks); onPrepare(kit.request, kit.sourceId) } catch (failure) { setError(String(failure)) } finally { setBusy(false) } }
  return <section className="builder-studio"><header><div><span className="instrument-label">Stack & component library</span><h3>Choose what this project needs.</h3><p>Free source references and selected blocks travel with the implementation request.</p></div><Button variant="outline" disabled={busy || !blocks.length} onClick={() => void prepare()}>{busy ? "Preparing kit…" : "Prepare implementation"}</Button></header>
    <div className="builder-layout"><nav aria-label="Builder recipes">{builderRecipes.map(item => <button type="button" key={item.id} aria-pressed={recipeId === item.id} onClick={() => setRecipeId(item.id)}><strong>{item.name}</strong><small>{item.stack}</small></button>)}</nav><BlockReveal key={recipeId} className="builder-recipe"><span className="instrument-label">{recipe.stack}</span><h4>{recipe.name}</h4><p>{recipe.summary}</p><a href={recipe.source} target="_blank" rel="noopener noreferrer">Source & documentation ↗</a>{recipeId === "dioramas" && <p>Uses supplied assets or procedural geometry. Image generation and paid services are excluded. Its 3D engine belongs to the generated website workspace.</p>}<div className="builder-blocks">{builderBlocks.map(block => <article key={block.id}><label><input type="checkbox" checked={blocks.includes(block.id)} onChange={event => setBlocks(current => event.target.checked ? [...current, block.id] : current.filter(id => id !== block.id))} /><strong>{block.name}</strong></label><p>{block.description}</p><details><summary>Preview & inspect starter</summary><iframe className="builder-block-preview" title={`${block.name} starter preview`} srcDoc={starterBlockPreview(block.code)} sandbox="" referrerPolicy="no-referrer" /><pre>{block.code}</pre><p>Placeholder structure for review; replace with verified project content.</p></details><a href={block.source} target="_blank" rel="noopener noreferrer">Free source reference ↗</a></article>)}</div><p>FRIDAY adapts the selected blocks to this project's brief. Verify services and contact facts before publishing.</p></BlockReveal></div>
    {busy && <BlockReveal loading label="Saving recipe, working folder, and source kit" lines={3} />}{error && <p role="alert" className="project-error">{error}</p>}
  </section>
}
