// Explicit synthetic data in a fresh browser context; never opens a personal profile.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('desktop-test-results', `beta-ui-${Date.now()}`)
await mkdir(root, { recursive: true })
const port = 4191
const preview = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { windowsHide: true, stdio: 'ignore' },
)
let browser
const report = { observations: [], errors: [] }
const now = new Date()
const day = (offset) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fixture(projectCount, taskCount, activityCount) {
  const time = now.toISOString()
  const projects = Array.from({ length: projectCount }, (_, i) => ({
    id: `beta-p${i}`,
    name:
      i === 0
        ? 'Beta fixture · A deliberately long project name for compact layout verification'
        : `Beta fixture · Project ${i + 1}`,
    description: 'Synthetic beta audit data; not actual user progress.',
    color: ['#7d87ec', '#6dc3a4', '#eea77f', '#bd8ce4'][i % 4],
    due: day(i % 20),
    notes: 'Original fixture notes',
    createdAt: time,
    updatedAt: time,
  }))
  const tasks = Array.from({ length: taskCount }, (_, i) => ({
    id: `beta-t${i}`,
    projectId: projects[i % projectCount].id,
    title: `Fixture task ${i + 1}: ${i % 9 === 0 ? 'LongUnbrokenIdentifier'.repeat(5) : 'Verify a compact, readable workflow'}`,
    description: 'Synthetic task for layout and performance measurement.',
    status: ['todo', 'doing', 'review', 'done'][i % 4],
    priority: ['High', 'Medium', 'Low'][i % 3],
    due: day((i % 30) - 10),
    createdAt: time,
    updatedAt: time,
    completedAt: i % 4 === 3 ? new Date(`${day(-(i % 25))}T12:00:00`).toISOString() : null,
  }))
  const activity = Array.from({ length: activityCount }, (_, i) => ({
    id: `beta-a${i}`,
    projectId: projects[i % projectCount].id,
    message: `Fixture activity ${i + 1}: ${i % 7 === 0 ? 'LongUnbrokenIdentifier'.repeat(8) : 'Updated task details in this project only.'}`,
    time,
  }))
  return {
    schemaVersion: 1,
    revision: 0,
    profile: { name: 'Beta audit fixture' },
    projects,
    tasks,
    activity,
  }
}
async function seed(page, data) {
  await page.goto(`http://127.0.0.1:${port}/#/settings`)
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'beta-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await page.getByRole('checkbox', { name: 'I have a backup' }).check()
  await page.getByRole('button', { name: 'Replace workspace', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
}
async function inspect(page, route, label, screenshot) {
  const start = performance.now()
  await page.goto(`http://127.0.0.1:${port}/#/${route}`)
  await page.locator('main h1').waitFor()
  if (route === 'insights') await page.locator('.recharts-surface').first().waitFor()
  if (route.startsWith('projects/'))
    await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const renderedMs = Math.round(performance.now() - start)
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    nodes: document.querySelectorAll('*').length,
    overflow: [...document.querySelectorAll('main *')]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > innerWidth + 2 &&
          getComputedStyle(e).position !== 'fixed',
      )
      .slice(0, 6)
      .map((e) => ({ tag: e.tagName, class: e.className, text: e.textContent?.slice(0, 70) })),
  }))
  report.observations.push({ label, route, renderedMs, ...metrics })
  if (screenshot)
    await page.screenshot({
      path: resolve(root, `${label}-${route.replaceAll('/', '-')}.png`),
      fullPage: true,
    })
}
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => report.errors.push(error.message))
  await seed(page, fixture(8, 80, 320))
  for (const [label, width] of [
    ['desktop', 1440],
    ['zoom-equivalent', 720],
    ['mobile', 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['calendar', 'insights', 'projects/beta-p0'])
      await inspect(page, route, label, true)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seed(page, fixture(40, 2000, 4000))
  for (const route of ['projects', 'calendar', 'insights', 'tasks', 'projects/beta-p0'])
    await inspect(page, route, 'large-workspace', false)
  report.passed =
    report.errors.length === 0 && report.observations.every((r) => r.scrollWidth <= r.width)
} catch (error) {
  report.failure = String(error.stack || error)
  report.passed = false
} finally {
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  preview.kill()
  console.log(JSON.stringify({ root, ...report }, null, 2))
}
if (!report.passed) process.exitCode = 1
