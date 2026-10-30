import { useEffect, useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { emptyProjectDraft, projectDraftIssue, projectFromDraft, projectPresets, presetItems, flushProjects, useProjects, type ProjectDraft, type ProjectPreset, type WorkspaceProject } from "@/lib/projects"
import { useSettings } from "@/lib/settings"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { ProjectMetadata } from "@/lib/types"

const languages: Record<string, string> = { auto: "Match my request", en: "English", fr: "Français", ar: "العربية" }

export function ProjectSetup({ project, onClose }: { project?: WorkspaceProject; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [preset, setPreset] = useState<ProjectPreset>("blank")
  const [startingTasks, setStartingTasks] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<keyof ProjectDraft | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const [folderBusy, setFolderBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const profiles = useSettings(state => state.saved.profiles)
  const form = useForm({
    defaultValues: project ? { name: project.name, directive: project.directive, rootPath: project.rootPath || "", kind: project.kind, instructions: project.instructions, responseLanguage: project.responseLanguage, tags: project.tags.join(", "), contextLinks: project.contextLinks.join("\n"), providerId: project.providerId, expanded: project.expanded } : { ...emptyProjectDraft },
    onSubmit: async ({ value }) => {
      if (!validate(value)) return
      try {
        const record = projectFromDraft(value, project)
        if (record.rootPath) {
          try {
            if (!isDesktop) throw new Error("Attach a folder in the Windows app, or leave this field empty to plan here.")
            const metadata = await invokeCommand<ProjectMetadata>("inspect_project_metadata", { path: record.rootPath })
            record.framework = metadata.framework
          } catch (failure) {
            setError(String(failure instanceof Error ? failure.message : failure)); setErrorField("rootPath"); setStep(0); setFocusRequest(value => value + 1)
            return
          }
        }
        useProjects.getState().saveProject(record)
        if (!project) for (const item of presetItems(record.id, preset, startingTasks.split("\n"))) useProjects.getState().saveItem(item)
        await flushProjects()
        onClose()
      } catch (failure) {
        setError(String(failure instanceof Error ? failure.message : failure))
        setErrorField(null)
      }
    },
  })
  const busy = useStore(form.store, state => state.isSubmitting)
  const dirty = useStore(form.store, state => state.isDirty) || Boolean(startingTasks.trim())
  function validate(value: ProjectDraft): boolean {
    const problem = projectDraftIssue(value) ?? (value.providerId && !profiles.some(profile => profile.id === value.providerId) ? { field: "providerId" as const, message: "This provider is no longer saved. Choose the current provider or another saved provider." } : undefined)
    setError(problem?.message || null)
    setErrorField(problem?.field || null)
    if (problem) { setStep(problem.field === "name" ? 0 : 1); setFocusRequest(value => value + 1) }
    return !problem
  }
  const requestClose = () => {
    if (busy || folderBusy) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  useEffect(() => {
    if (busy || folderBusy) return
    if (discard) { document.getElementById("project-keep-editing")?.focus(); return }
    if (errorField) document.getElementById(`project-${errorField}`)?.focus()
    else document.getElementById(step === 0 ? "project-name" : step === 1 ? "project-instructions" : "project-review-heading")?.focus()
  }, [step, errorField, focusRequest, busy, folderBusy, discard])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const next = () => {
    if (!validate(form.state.values)) return
    const target = Math.min(2, step + 1)
    setStep(target)
  }
  const textField = (name: "name" | "directive" | "instructions" | "tags" | "contextLinks", label: string, multiline = false, hint?: string) => <form.Field name={name} key={name}>{field => <Field data-invalid={errorField === name}>
    <FieldLabel htmlFor={`project-${name}`}>{label}</FieldLabel>
    {multiline ? <Textarea id={`project-${name}`} name={name} value={field.state.value} onChange={event => field.handleChange(event.target.value)} onBlur={field.handleBlur} rows={3} dir="auto" aria-invalid={errorField === name} aria-describedby={errorField === name ? "project-setup-error" : hint ? `project-${name}-hint` : undefined} />
      : <Input id={`project-${name}`} name={name} autoComplete="off" maxLength={name === "name" ? 120 : undefined} value={field.state.value} onChange={event => field.handleChange(event.target.value)} onBlur={field.handleBlur} dir="auto" aria-invalid={errorField === name} aria-describedby={errorField === name ? "project-setup-error" : hint ? `project-${name}-hint` : undefined} />}
    {hint && <FieldDescription id={`project-${name}-hint`}>{hint}</FieldDescription>}
  </Field>}</form.Field>
  const pickFolder = async () => {
    setFolderBusy(true); setError(null); setErrorField(null)
    try { const path = await invokeCommand<string | null>("choose_project_folder"); if (path) form.setFieldValue("rootPath", path) }
    catch (failure) { setError(String(failure)); setErrorField("rootPath"); setFocusRequest(value => value + 1) }
    finally { setFolderBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open) requestClose() }}><DialogContent className="project-setup-dialog" onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("project-name")?.focus() }}>
    <DialogHeader><span className="instrument-label">{project ? "Customize workspace" : "New workspace"} / {step + 1} of 3</span><DialogTitle>{["Start with your goal.", "Choose how FRIDAY helps.", "Review your workspace."][step]}</DialogTitle><DialogDescription>{["Only a name is required. Add a goal, bring a folder, or start with a blank plan.", "Use any saved provider and add the language, references and instructions that suit your work.", "Check your choices. Creating a workspace saves your setup; it does not run tasks."][step]}</DialogDescription></DialogHeader>
    <ol className="project-setup-steps" aria-label="Project setup steps">{["Basics", "Context", "Review"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><button type="button" disabled={busy || folderBusy} onClick={() => { if (index > step && !validate(form.state.values)) return; setStep(index) }}><span>{index + 1}</span>{label}</button></li>)}</ol>
    <form className="project-setup-form" onSubmit={event => { event.preventDefault(); if (step < 2) next(); else void form.handleSubmit() }}>
      <div className="project-setup-fields"><fieldset disabled={busy || folderBusy}><FieldGroup>
        {step === 0 && <>
          {textField("name", "Workspace name")}{textField("directive", "What do you want to achieve? (optional)", true, "A research question, an app to build, a design brief, or a goal of your own.")}
          {!project && <Field><FieldLabel htmlFor="project-preset">Starting preset (optional)</FieldLabel><Select value={preset} onValueChange={value => {
            const selected = value as ProjectPreset
            const previous = projectPresets[preset], upcoming = projectPresets[selected]
            if (form.state.values.directive === previous.directive) form.setFieldValue("directive", upcoming.directive)
            if (form.state.values.kind === previous.kind) form.setFieldValue("kind", upcoming.kind)
            if (startingTasks === previous.tasks.join("\n")) setStartingTasks(upcoming.tasks.join("\n"))
            setPreset(selected)
          }}><SelectTrigger id="project-preset"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(projectPresets).map(([id, option]) => <SelectItem key={id} value={id}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription>Your own goal and edited tasks stay intact when you change presets.</FieldDescription></Field>}
          <form.Field name="kind">{field => <Field><FieldLabel htmlFor="project-kind">Workspace type</FieldLabel><Select value={field.state.value} onValueChange={value => field.handleChange(value as ProjectDraft["kind"])}><SelectTrigger id="project-kind"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{[["general", "Custom / planning"], ["code", "Code & development"], ["research", "Research & learning"], ["design", "Design & content"]].map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>}</form.Field>
          <form.Field name="rootPath">{field => <Field data-invalid={errorField === "rootPath"}><FieldLabel htmlFor="project-rootPath">Local folder (optional)</FieldLabel><div className="project-folder-input"><Input id="project-rootPath" name="rootPath" autoComplete="off" spellCheck={false} value={field.state.value} onChange={event => field.handleChange(event.target.value)} onBlur={field.handleBlur} aria-invalid={errorField === "rootPath"} aria-describedby={errorField === "rootPath" ? "project-setup-error" : "project-folder-hint"} /><Button type="button" variant="outline" disabled={!isDesktop || folderBusy} onClick={() => void pickFolder()}><FolderOpen aria-hidden="true" size={16} />{folderBusy ? "Choosing…" : "Browse"}</Button></div><FieldDescription id="project-folder-hint">{isDesktop ? "Choose an existing folder or enter its full path. Leave empty for planning." : "Planning, notes and tasks work here. Attach local files in the Windows app."}</FieldDescription>{field.state.value && <Button type="button" variant="ghost" size="sm" onClick={() => field.handleChange("")}>Use a planning workspace</Button>}</Field>}</form.Field>
        </>}
        {step === 1 && <>
          <form.Field name="providerId">{field => <Field data-invalid={errorField === "providerId"}><FieldLabel htmlFor="project-providerId">Conversation provider</FieldLabel><Select name="providerId" value={field.state.value || "inherit"} onValueChange={value => field.handleChange(value === "inherit" ? "" : value)}><SelectTrigger id="project-providerId" aria-invalid={errorField === "providerId"} aria-describedby={errorField === "providerId" ? "project-setup-error" : "project-provider-hint"}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="inherit">Use current provider</SelectItem>{profiles.map(profile => <SelectItem value={profile.id} key={profile.id}>{profile.name} · {profile.model}</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription id="project-provider-hint">Any provider configured in Settings is available here. Add or change providers there whenever you need.</FieldDescription></Field>}</form.Field>
          <form.Field name="responseLanguage">{field => <Field data-invalid={errorField === "responseLanguage"}><FieldLabel htmlFor="project-responseLanguage">Response language</FieldLabel><Input id="project-responseLanguage" name="responseLanguage" list="project-languages" autoComplete="off" maxLength={80} value={field.state.value} onChange={event => field.handleChange(event.target.value)} onBlur={field.handleBlur} aria-invalid={errorField === "responseLanguage"} aria-describedby={errorField === "responseLanguage" ? "project-setup-error" : "project-language-hint"} /><datalist id="project-languages">{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</datalist><FieldDescription id="project-language-hint">Use auto to follow your request, a language code, or a language name such as Spanish.</FieldDescription></Field>}</form.Field>
          {textField("instructions", "Project instructions (optional)", true, "Conventions, constraints and what a good result looks like.")}{textField("contextLinks", "Reference links (optional)", true, "One complete HTTP or HTTPS URL per line. FRIDAY reads sources when you request it.")}{textField("tags", "Tags (optional)", false, "Separate tags with commas.")}
          <form.Field name="expanded">{field => <Field orientation="horizontal"><FieldLabel htmlFor="project-expanded">Detailed responses</FieldLabel><input id="project-expanded" name="expanded" type="checkbox" checked={field.state.value} onChange={event => field.handleChange(event.target.checked)} /></Field>}</form.Field>
        </>}
        {step === 2 && <><form.Subscribe selector={state => state.values}>{values => <div className="project-setup-review"><h3 id="project-review-heading" tabIndex={-1} dir="auto">{values.name}</h3><p dir="auto">{values.directive || "Start with a blank plan and add your first goal later."}</p><dl><dt>Workspace</dt><dd>{values.kind}</dd><dt>Folder</dt><dd>{values.rootPath || "Planning workspace"}</dd><dt>Provider</dt><dd>{profiles.find(profile => profile.id === values.providerId)?.name || "Current provider"}</dd><dt>Language</dt><dd>{languages[values.responseLanguage] || values.responseLanguage}</dd><dt>Instructions</dt><dd dir="auto">{values.instructions || "No custom instructions"}</dd><dt>References</dt><dd>{values.contextLinks || "No reference links"}</dd><dt>Response</dt><dd>{values.expanded ? "Detailed" : "Concise"}</dd></dl></div>}</form.Subscribe>{!project && <Field><FieldLabel htmlFor="project-starting-tasks">Starting tasks (optional, one per line)</FieldLabel><Textarea id="project-starting-tasks" name="startingTasks" value={startingTasks} onChange={event => setStartingTasks(event.target.value)} rows={3} /><FieldDescription>Edit or remove any task. Suggested tasks start as to do.</FieldDescription></Field>}</>}
      </FieldGroup></fieldset>{error && <p id="project-setup-error" className="project-error" role="alert">{error}</p>}
      {discard && <div className="project-discard-draft" role="status"><p>Your workspace setup has unsaved changes.</p><Button id="project-keep-editing" type="button" variant="outline" onClick={() => setDiscard(false)}>Keep editing</Button><Button type="button" variant="ghost" onClick={onClose}>Discard draft</Button></div>}</div>
      <DialogFooter><Button type="button" variant="ghost" disabled={busy || folderBusy} onClick={step ? () => setStep(value => value - 1) : requestClose}>{step ? "Back" : "Cancel"}</Button><Button type="submit" variant="outline" disabled={busy || folderBusy}>{busy ? "Saving workspace…" : step === 0 ? "Next: context" : step === 1 ? "Review setup" : project ? "Save changes" : "Create workspace"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}
