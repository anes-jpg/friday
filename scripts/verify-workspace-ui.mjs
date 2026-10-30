import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { mkdir } from "node:fs/promises"

// Uses an existing Playwright installation; does not add a project dependency.
// node scripts/verify-workspace-ui.mjs <node_modules> <chromium executable> [origin]
const packageRoot = process.argv[2]
const executablePath = process.argv[3]
const origin = process.argv[4] || "http://127.0.0.1:1420"
assert(packageRoot && executablePath, "Provide the existing node_modules directory and Chromium executable.")
const { chromium } = createRequire(resolve(packageRoot, "../package.json"))("playwright")
await mkdir("scratch", { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath })
const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" })
const page = await context.newPage()
page.setDefaultTimeout(15_000)
const errors = []
page.on("pageerror", error => errors.push(error.message))
const heading = () => page.locator(".project-heading h2")
const dialog = () => page.locator(".project-setup-dialog")
const choose = async (id, label) => {
  await page.locator(id).click()
  await page.getByRole("option", { name: label, exact: true }).click()
}
const reopenGuide = async () => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("friday:open-onboarding")))
  await page.locator("#guide-heading").waitFor()
}

try {
  await context.addInitScript(() => {
    if (localStorage.getItem("friday-ui-fixture")) return
    localStorage.setItem("friday-ui-fixture", "true")
    localStorage.setItem("friday_onboarded_v1_0", "true")
    sessionStorage.setItem("friday-work-view", "overview")
    const timestamp = new Date().toISOString()
    localStorage.setItem("friday-project-workspace-v2", JSON.stringify({ version: 2, activeId: "alpha", projects: ["Alpha", "Beta", "Gamma"].map(name => ({ id: name.toLowerCase(), name, kind: "general", responseLanguage: "auto", created_at: timestamp, updated_at: timestamp })), items: [] }))
    localStorage.setItem("friday-settings-v2", JSON.stringify({ version: 2, revision: 0, activeProfileId: "primary", profiles: [{ id: "primary", name: "Primary provider", baseUrl: "http://127.0.0.1:8000/v1", model: "primary-model", lightModel: "primary-model", apiMode: "chat", hasKey: false, fallback: false }, { id: "other", name: "Other compatible provider", baseUrl: "https://example.com/v1", model: "custom-model", lightModel: "custom-model", apiMode: "chat", hasKey: false, fallback: false }], voice: { profile: "en_GB-alba-medium", endpoint: "http://127.0.0.1:8880/v1", style: "calm" }, listening: { enabled: false, sensitivity: .55 }, appearance: { theme: "dark", reducedMotion: true }, monitoring: { previewLimit: 2, storageLimitGb: 10 }, dailySpendCapUsd: 5 }))
  })
  await page.goto(`${origin}/?surface=console`, { waitUntil: "domcontentloaded" })
  await page.locator(".project-list button").first().waitFor()
  await page.locator(".project-list button").first().click()
  await heading().waitFor()
  for (let index = 0; index < 30; index++) {
    await page.locator(".project-list button").nth(index % 3).click()
    assert.deepEqual(await heading().allTextContents(), [["Alpha", "Beta", "Gamma"][index % 3]])
    assert.equal(await page.locator(".project-provider-context").count(), 1)
    assert.equal(await page.locator(".project-list button").count(), 3)
    if (index % 5 === 0) {
      await page.getByRole("tab", { name: "Notes (0)", exact: true }).click()
      assert.equal(await heading().count(), 1)
    }
  }
  console.log("PASS: 30 project switches keep one heading, one context row, and three saved projects.")

  await page.getByRole("button", { name: "Create project", exact: true }).click()
  await dialog().waitFor()
  assert.equal(await page.locator("#project-name").evaluate(element => element === document.activeElement), true)
  await page.getByRole("button", { name: "Next: context", exact: true }).click()
  assert.match(await page.locator("#project-setup-error").innerText(), /name/)
  assert.equal(await page.locator("#project-name").evaluate(element => element === document.activeElement), true)
  await page.locator("#project-name").fill("Flexible workspace")
  await page.locator("#project-directive").fill("My own goal — بحث وتصميم")
  await choose("#project-preset", "Research")
  assert.equal(await page.locator("#project-directive").inputValue(), "My own goal — بحث وتصميم")
  await choose("#project-kind", "Design & content")
  await page.getByRole("button", { name: "Next: context", exact: true }).click()
  await choose("#project-providerId", "Other compatible provider · custom-model")
  await page.locator("#project-responseLanguage").fill("")
  await page.getByRole("button", { name: "Review setup", exact: true }).click()
  assert.equal(await page.locator("#project-responseLanguage").evaluate(element => element === document.activeElement), true)
  await page.locator("#project-responseLanguage").fill("Español")
  await page.locator("#project-contextLinks").fill("javascript:alert(1)")
  await page.getByRole("button", { name: "Review setup", exact: true }).click()
  assert.equal(await page.locator("#project-contextLinks").evaluate(element => element === document.activeElement), true)
  await page.getByRole("button", { name: "Review setup", exact: true }).click()
  assert.equal(await page.locator("#project-contextLinks").evaluate(element => element === document.activeElement), true)
  await page.locator("#project-contextLinks").fill("https://example.com/reference\nhttp://localhost:3000/context")
  await page.locator("#project-instructions").fill("Follow my conventions.\nKeep sources visible.")
  await page.locator("#project-tags").fill("custom, custom, diseño")
  await page.locator("#project-expanded").uncheck()
  await page.getByRole("button", { name: "Review setup", exact: true }).click()
  await page.locator("#project-starting-tasks").fill("My edited task\nAnother task")
  await dialog().locator(".project-setup-steps button").nth(0).click()
  await choose("#project-preset", "Development")
  assert.equal(await page.locator("#project-directive").inputValue(), "My own goal — بحث وتصميم")
  assert.match(await page.locator("#project-kind").innerText(), /Design/)
  await dialog().locator(".project-setup-steps button").nth(2).click()
  assert.equal(await page.locator("#project-starting-tasks").inputValue(), "My edited task\nAnother task")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Keep editing", exact: true }).click()
  await page.getByRole("button", { name: "Create workspace", exact: true }).click()
  await dialog().waitFor({ state: "detached" })
  assert.deepEqual(await heading().allTextContents(), ["Flexible workspace"])
  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("friday-project-workspace-v2"))
    return { project: state.projects.find(project => project.name === "Flexible workspace"), items: state.items }
  })
  assert.equal(saved.project.kind, "design")
  assert.equal(saved.project.responseLanguage, "Español")
  assert.equal(saved.project.providerId, "other")
  assert.equal(saved.project.expanded, false)
  assert.deepEqual(saved.project.tags, ["custom", "diseño"])
  assert.deepEqual(saved.items.map(item => item.title), ["My edited task", "Another task"])
  console.log("PASS: validation focuses the correct field; custom goals, language, provider, type, tasks, and tags survive presets/back/discard protection.")

  await page.getByRole("button", { name: "Customize", exact: true }).click()
  await page.locator("#project-rootPath").fill("C:\\a-folder-in-the-desktop-app")
  await dialog().locator(".project-setup-steps button").nth(2).click()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await page.locator("#project-rootPath").waitFor()
  await page.waitForFunction(() => document.activeElement?.id === "project-rootPath")
  assert.equal(await page.locator("#project-rootPath").evaluate(element => element === document.activeElement), true)
  assert.match(await page.locator("#project-setup-error").innerText(), /Windows app/)
  await page.getByRole("button", { name: "Use a planning workspace", exact: true }).click()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Discard draft", exact: true }).click()

  await page.evaluate(() => {
    localStorage.removeItem("friday_onboarded_v1_0")
    localStorage.removeItem("friday_onboarded")
    localStorage.removeItem("friday-guide-deferred-v1")
    localStorage.removeItem("friday-guide-step-v1")
  })
  await reopenGuide()
  assert.equal(await page.locator("#guide-heading").evaluate(element => element === document.activeElement), true)
  await page.getByRole("button", { name: "Next: Your model", exact: true }).click()
  await page.getByRole("button", { name: "Open provider settings", exact: true }).click()
  await page.locator(".friday-guide").waitFor({ state: "detached" })
  assert.equal(await page.evaluate(() => localStorage.getItem("friday_onboarded_v1_0")), null)
  await reopenGuide()
  assert.match(await page.locator("#guide-heading").innerText(), /model that suits/)
  await page.keyboard.press("Escape")
  await page.locator(".friday-guide").waitFor({ state: "detached" })
  assert.equal(await page.evaluate(() => localStorage.getItem("friday_onboarded_v1_0")), null)
  await reopenGuide()
  await page.locator(".friday-guide nav button").first().click()
  await page.getByRole("button", { name: "Research a question", exact: false }).click()
  await dialog().waitFor()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem("friday_onboarded_v1_0")), null)
  await reopenGuide()
  await page.screenshot({ path: "scratch/onboarding-after.png" })
  console.log("PASS: opening Settings or a workspace saves guide progress without marking completion; Escape defers it; direct actions open working setup.")

  for (const viewport of [{ width: 640, height: 480 }, { width: 390, height: 640 }]) {
    await page.setViewportSize(viewport)
    for (let index = 0; index < 5; index++) {
      const destination = page.locator(".friday-guide nav button").nth(index)
      const alreadyCurrent = await destination.getAttribute("aria-current") === "step"
      await destination.click()
      const dimensions = await page.locator(".friday-guide-dialog").evaluate(element => ({ rect: element.getBoundingClientRect().toJSON(), width: element.clientWidth, scroll: element.scrollWidth }))
      assert(dimensions.rect.top >= 0 && dimensions.rect.bottom <= viewport.height)
      assert(dimensions.scroll <= dimensions.width + 1, "Guide must not overflow horizontally")
      if (!alreadyCurrent) await page.waitForFunction(() => document.activeElement?.id === "guide-heading")
      else assert.equal(await destination.evaluate(element => element === document.activeElement), true)
      const footer = await page.locator(".guide-body > footer").boundingBox()
      assert(footer.y + footer.height <= viewport.height, "Guide actions must remain reachable")
    }
  }
  await page.screenshot({ path: "scratch/onboarding-small.png" })
  await page.getByRole("button", { name: "Finish guide", exact: true }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem("friday_onboarded_v1_0")), "true")
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await page.getByRole("button", { name: "Create project", exact: true }).click()
  await page.locator("#project-name").fill("Small window")
  await page.locator("#project-directive").fill("A long custom goal.\n".repeat(20))
  const footer = await dialog().locator("[data-slot=dialog-footer]").boundingBox()
  assert(footer.y + footer.height <= 640, "Project setup buttons must remain reachable")
  assert.equal(await dialog().evaluate(element => element.scrollWidth <= element.clientWidth + 1), true)
  await page.screenshot({ path: "scratch/project-setup-small.png" })
  await page.locator("#project-name").fill("x".repeat(120))
  await page.locator("#project-directive").fill("y".repeat(600))
  await dialog().locator(".project-setup-steps button").nth(2).click()
  assert.equal(await page.locator(".project-setup-review h3").evaluate(element => element.scrollWidth <= element.clientWidth + 1), true)
  assert.equal(await page.locator(".project-setup-fields").evaluate(element => element.scrollWidth <= element.clientWidth + 1), true)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Discard draft", exact: true }).click()
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.locator(".project-list button").first().waitFor()
  assert.equal(await page.locator(".project-list button").count(), 4)
  assert.equal(await page.locator(".friday-guide").count(), 0)
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("friday-project-workspace-v2")))
  assert.equal(restored.projects.find(project => project.name === "Flexible workspace").responseLanguage, "Español")
  assert.deepEqual(restored.items.map(item => item.title), ["My edited task", "Another task"])
  assert.deepEqual(errors, [], "No browser runtime errors")
  console.log("PASS: small windows, long content, reduced motion, visible footer actions, keyboard focus, explicit guide completion, and saved work after reload. No runtime errors.")
} catch (failure) {
  console.error((await page.locator("body").innerText()).slice(0,5000))
  await page.screenshot({ path: "scratch/workspace-ui-failure.png" })
  throw failure
} finally {
  await context.close()
  await browser.close()
}
