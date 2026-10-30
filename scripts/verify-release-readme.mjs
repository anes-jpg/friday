// Uses a supplied, already installed marked + Playwright runtime.
// node scripts/verify-release-readme.mjs <runtime package.json> <Chromium executable>
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { readFile, writeFile, access, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const [packageFile, executablePath] = process.argv.slice(2)
assert(packageFile && executablePath, 'Supply existing runtime package.json and Chromium paths.')
const require = createRequire(resolve(packageFile))
const { marked } = await import(pathToFileURL(require.resolve('marked')).href)
const { chromium } = require('playwright')
const source = await readFile('README.md', 'utf8')
const html = marked.parse(source)
const localLinks = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1]).filter(link => !/^(https?:|#)/.test(link))
for (const link of localLinks) await access(link.split('#')[0])
assert.equal([...source.matchAll(/^## (.*)$/gm)].at(-1)[1], '2026 rollout roadmap')
assert.equal((html.match(/<img /g) || []).length, 12)
assert(!/Your work\. Your model\.|A workspace\. A voice\./.test(source))
const manifest = JSON.parse(await readFile('scratch/release-upload/release-manifest.json', 'utf8'))
const names = new Set([...manifest.assets.map(asset => asset.name), 'SHA256SUMS.txt', 'release-manifest.json'])
for (const match of source.matchAll(/releases\/download\/([^/]+)\/([^\s)"<>]+)/g)) {
  assert.equal(match[1], manifest.tag)
  assert(names.has(match[2]), `README links to an unprepared asset: ${match[2]}`)
}
await mkdir('scratch', { recursive: true })
await writeFile('scratch/readme-preview.html', `<!doctype html><meta charset="utf-8"><base href="${pathToFileURL(resolve('.')).href}/"><style>body{margin:0;background:#0d1117;color:#e6edf3;font:16px/1.6 system-ui,sans-serif}.markdown-body{max-width:980px;margin:32px auto;padding:32px;border:1px solid #30363d;border-radius:8px}h1,h2,h3{line-height:1.3;margin:24px 0 16px}h1,h2{padding-bottom:8px;border-bottom:1px solid #30363d}a{color:#58a6ff}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #30363d;padding:8px}tr:nth-child(2n){background:#161b22}pre{padding:16px;background:#161b22;border-radius:8px;overflow:auto}code{font-size:13px}details{border:1px solid #30363d;padding:16px;border-radius:8px}summary{cursor:pointer}p{margin:16px 0}</style><article class="markdown-body">${html}</article>`)
const browser = await chromium.launch({ headless: true, executablePath })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(pathToFileURL(resolve('scratch/readme-preview.html')).href)
  await page.locator('details').evaluate(element => { element.open = true })
  const images = await page.locator('img').evaluateAll(elements => elements.map(image => ({ complete: image.complete, width: image.naturalWidth })))
  assert(images.every(image => image.complete && image.width > 0))
  await page.screenshot({ path: 'scratch/readme-preview.png', fullPage: true })
  await page.locator('h2').filter({ hasText: 'Downloads' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'scratch/readme-downloads-preview.png' })
  console.log(`README verified: ${localLinks.length} local links, ${images.length} images, matching download assets, roadmap last.`)
} finally {
  await browser.close()
}
