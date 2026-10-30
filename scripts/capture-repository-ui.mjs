import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { mkdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"

// Real UI screenshots with disposable sample records; no native user data.
// node scripts/capture-repository-ui.mjs <node_modules> <chromium executable> [origin] [floorplan HTML]
const [packageRoot, executablePath, origin = "http://127.0.0.1:1421"] = process.argv.slice(2)
assert(packageRoot && executablePath, "Supply an existing Playwright installation and Chromium executable.")
const { chromium } = createRequire(resolve(packageRoot, "../package.json"))("playwright")
await mkdir("docs/images", { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce" })
const page = await context.newPage()
page.setDefaultTimeout(20_000)
const errors = []
page.on("pageerror", error => errors.push(error.message))
const capture = async name => {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `docs/images/${name}.png`, animations: "disabled", ...(name.startsWith("floorplan-") ? { clip: { x: 0, y: 0, width: 1440, height: 800 } } : {}) })
  console.log(`Captured ${name}`)
}
try {
  await context.addInitScript(() => {
    if (localStorage.getItem("friday-gallery-fixture")) return
    localStorage.setItem("friday-gallery-fixture", "true")
    localStorage.setItem("friday_onboarded_v1_0", "true")
    sessionStorage.setItem("friday-work-view", "overview")
    const timestamp = new Date().toISOString()
    const project = { id: "studio", name: "Fieldnotes Studio", directive: "Build a quiet home for ideas, research, and the work that comes next.", kind: "design", responseLanguage: "auto", tags: ["design", "research"], instructions: "Keep decisions clear. Cite sources. Make each next step useful.", created_at: timestamp, updated_at: timestamp }
    const projects = [project, { ...project, id: "research", name: "Open Questions", kind: "research", directive: "Collect sources and turn a good question into a useful answer.", tags: ["research"] }, { ...project, id: "week", name: "The Week Ahead", kind: "general", directive: "A clear plan for everyday work.", tags: ["planning"] }]
    const items = [
      { id: "task-1", projectId: "studio", type: "task", title: "Shape the first experience", description: "Map the first useful action and remove unnecessary setup.", status: "in-progress", priority: "high" },
      { id: "task-2", projectId: "studio", type: "task", title: "Compare the reference sites", description: "Collect three examples and record what works.", status: "todo", priority: "medium" },
      { id: "task-3", projectId: "studio", type: "task", title: "Review the mobile layout", description: "Check navigation, readable text and reachable actions.", status: "todo", priority: "medium" },
      { id: "note-1", projectId: "studio", type: "note", title: "The direction", description: "Less noise. Better context. One useful next step.\n\nKeep the interface quiet and let the work take the foreground.", status: "done" },
    ]
    localStorage.setItem("friday-project-workspace-v2", JSON.stringify({ version: 2, activeId: "studio", projects, items }))
    localStorage.setItem("friday-daily-work-v1", JSON.stringify({ version: 1,
      captures: [{ id: "capture-1", title: "A place for the next idea", text: "Make it easy to capture a thought and return to it with its context intact.", sourceKind: "idea", capturedAt: timestamp, inbox: true }, { id: "capture-2", title: "Notes from the design review", text: "Start with a goal. Keep folders optional. Let people choose their model.", sourceKind: "idea", capturedAt: timestamp, projectId: "studio", inbox: false }],
      routines: [], resumes: [{ id: "resume-1", name: "Design review", projectId: "studio", checkpoint: "The direction is set. Next, turn the first-use flow into a simple prototype.", nextStep: "Shape the first experience", sourceIds: ["capture-2"], updatedAt: timestamp }],
      preferences: { restoreView: false, previousView: "projects", previousWorkView: "overview", shortcut: "Ctrl+Alt+Space", timezone: "Africa/Lagos" } }))
    localStorage.setItem("friday-settings-v2", JSON.stringify({ version: 2, revision: 0, activeProfileId: "local", profiles: [{ id: "local", name: "Local workspace", baseUrl: "http://127.0.0.1:11434/v1", model: "your-local-model", lightModel: "your-local-model", apiMode: "chat", hasKey: false, fallback: false }, { id: "remote", name: "Remote workspace", baseUrl: "https://example.com/v1", model: "your-remote-model", lightModel: "your-remote-model", apiMode: "responses", hasKey: false, fallback: false }], voice: { profile: "en_GB-alba-medium", endpoint: "http://127.0.0.1:8880/v1", style: "calm" }, listening: { enabled: false, sensitivity: .55 }, appearance: { theme: "dark", reducedMotion: true }, monitoring: { previewLimit: 2, storageLimitGb: 10 }, dailySpendCapUsd: 5 }))
  })
  await page.goto(`${origin}/?surface=console`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await page.locator(".project-list button").first().click()
  await page.locator(".project-heading h2").waitFor()
  await capture("workspace")
  await page.getByRole("tab", { name: "Tasks (3)", exact: true }).click()
  await page.locator(".project-task-table").waitFor()
  await capture("project-tasks")
  await page.getByRole("button", { name: "Today", exact: true }).click()
  await page.locator(".work-command-center").waitFor()
  await capture("today")
  await page.getByRole("button", { name: "Create project", exact: true }).click()
  await page.locator("#project-name").fill("A workspace of your own")
  await page.locator("#project-directive").fill("Start with a goal. Bring context when you need it.")
  await capture("project-setup")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Discard draft", exact: true }).click()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("friday:open-onboarding")))
  await page.locator("#guide-heading").waitFor()
  await capture("onboarding")
  await page.getByRole("button", { name: "Do this later", exact: true }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.locator(".settings-workspace").waitFor()
  await capture("providers")
  if (process.argv[5]) {
    await context.addInitScript(() => {
      localStorage.setItem("floorplan:tour-seen:FRIDAY", "true")
    })
    await page.goto(pathToFileURL(resolve(process.argv[5])).href, { waitUntil: "load" })
    await page.waitForFunction(() => window.Floorplan?.state?.bounds)
    await page.locator("#btn-panel").click()
    await page.evaluate(() => window.Floorplan.fit(false))
    await capture("floorplan-overview")
    await page.evaluate(() => window.Floorplan.go("n:desktop"))
    await page.waitForFunction(() => window.Floorplan.state.container === "n:desktop" && document.querySelectorAll(".node").length > 2)
    await page.evaluate(() => window.Floorplan.fit(false))
    await capture("floorplan-desktop")
  }
  assert.deepEqual(errors, [], "UI capture produced browser errors")
} finally {
  await browser.close()
}
