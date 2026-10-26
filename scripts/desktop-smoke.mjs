// Exercises real WebView2 + Rust IPC + SQLite with isolated test data, never the user's workspace.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('desktop-test-results', `smoke-${Date.now()}`)
await mkdir(root, { recursive: true })
const executable = resolve('src-tauri/target/debug/flowplan-personal.exe')
const browserPort = 4187
const debugPort = 9227
const endpoint = `http://127.0.0.1:${debugPort}`
const report = { root, checks: [], errors: [] }
let preview, browser, desktop, connection

async function waitForUrl(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      /* app starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}
async function startDesktop() {
  desktop = spawn(executable, [], {
    windowsHide: true,
    env: {
      ...process.env,
      FLOWPLAN_TEST_DATA_DIR: resolve(root, 'data'),
      WEBVIEW2_USER_DATA_FOLDER: resolve(root, 'webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort} --remote-debugging-address=127.0.0.1`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  desktop.stderr.on('data', (chunk) => process.stderr.write(chunk))
  await waitForUrl(`${endpoint}/json/version`)
  connection = await chromium.connectOverCDP(endpoint)
  const page =
    connection.contexts()[0].pages()[0] ?? (await connection.contexts()[0].waitForEvent('page'))
  page.on('pageerror', (error) => report.errors.push(error.message))
  await page.waitForSelector('main h1')
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('storage_info'))
  assert.equal(
    info.path.toLowerCase(),
    resolve(root, 'data', 'flowplan.sqlite3').toLowerCase(),
    'Test build must use isolated database',
  )
  assert.equal(
    await page.evaluate(async () =>
      'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    ),
    0,
  )
  return page
}
async function stopDesktop() {
  if (connection) {
    await connection.close()
    connection = undefined
  }
  if (desktop && desktop.exitCode === null) {
    const closed = once(desktop, 'exit')
    desktop.kill()
    await closed
  }
  desktop = undefined
  await new Promise((resolve) => setTimeout(resolve, 500))
}
async function inspectNative(page) {
  return page.evaluate(() => window.__TAURI_INTERNALS__.invoke('read_workspace'))
}
async function restoreViaUI(page, backup) {
  await page
    .getByRole('navigation', { name: 'Preferences' })
    .getByRole('link', { name: 'Settings', exact: true })
    .click()
  await page.getByLabel('Import JSON backup').setInputFiles(backup)
  await page.getByRole('checkbox', { name: 'I have a backup' }).check()
  await page.getByRole('button', { name: 'Replace workspace', exact: true }).click()
  await page.getByText('Backup restored successfully.').waitFor()
}
try {
  preview = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(browserPort),
      '--strictPort',
    ],
    { windowsHide: true, stdio: 'ignore' },
  )
  await waitForUrl(`http://127.0.0.1:${browserPort}`)
  browser = await chromium.launch()
  const web = await browser.newPage({ acceptDownloads: true })
  await web.goto(`http://127.0.0.1:${browserPort}`)
  await web.getByRole('button', { name: 'Create your first project' }).click()
  await web.getByLabel('Project name', { exact: true }).fill('Desktop migration test')
  await web.getByRole('button', { name: 'Create project', exact: true }).click()
  await web.getByLabel('Quick task title').fill('Preserve my browser progress')
  await web.getByRole('button', { name: 'Add ↵' }).click()
  await web.getByRole('button', { name: 'Complete Preserve my browser progress' }).click()
  await web
    .getByRole('navigation', { name: 'Preferences' })
    .getByRole('link', { name: 'Settings', exact: true })
    .click()
  const downloading = web.waitForEvent('download')
  await web.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const exported = resolve(root, 'browser-export.json')
  await (await downloading).saveAs(exported)
  const source = JSON.parse(await readFile(exported, 'utf8'))
  assert.equal(source.tasks[0].status, 'done')
  const page = await startDesktop()
  await restoreViaUI(page, exported)
  let stored = await inspectNative(page)
  assert.deepEqual(stored.projects, source.projects)
  assert.deepEqual(stored.tasks, source.tasks)
  assert.deepEqual(stored.activity, source.activity)
  report.checks.push(
    'Browser export migrates to native SQLite with IDs, task completion, and activity intact',
  )
  await web.reload()
  await web
    .getByRole('navigation', { name: 'Your projects' })
    .getByRole('link', { name: 'Desktop migration test', exact: true })
    .waitFor()
  assert.equal(
    await web.getByRole('navigation', { name: 'Your projects' }).getByRole('link').count(),
    1,
  )
  report.checks.push('Browser source remains intact')
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Board', exact: true })
    .click()
  await page
    .locator('.kanban-task')
    .dragTo(page.getByRole('region', { name: 'In progress', exact: true }))
  await page
    .getByRole('region', { name: 'In progress', exact: true })
    .locator('.kanban-task')
    .waitFor()
  assert.equal((await inspectNative(page)).tasks[0].status, 'doing')
  await page.getByLabel('Status of Preserve my browser progress').selectOption('done')
  await page.getByRole('region', { name: 'Done', exact: true }).locator('.kanban-task').waitFor()
  report.checks.push('Native Kanban HTML drag-and-drop and status menus persist workflow changes')
  await page.getByRole('navigation', { name: 'Your projects' }).getByRole('link').click()
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await page
    .getByLabel('Project notes', { exact: true })
    .fill('Saved in SQLite before a process restart.')
  await page.getByRole('button', { name: 'Save notes' }).click()
  await page.getByText('Notes saved on this device.').waitFor()
  stored = await inspectNative(page)
  await stopDesktop()
  const reopened = await startDesktop()
  assert.deepEqual(await inspectNative(reopened), stored)
  report.checks.push(
    'Committed tasks, notes, and activity survive native process termination and restart',
  )
  await reopened.screenshot({ path: resolve(root, 'desktop-restarted.png') })
  await reopened
    .getByRole('navigation', { name: 'Preferences' })
    .getByRole('link', { name: 'Settings', exact: true })
    .click()
  await reopened.getByLabel('Import JSON backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":999}'),
  })
  await reopened
    .getByText('This is not a valid FlowPlan v1 backup. No data has been changed.')
    .waitFor()
  assert.deepEqual(await inspectNative(reopened), stored)
  report.checks.push('Invalid native import leaves saved workspace unchanged')
  await restoreViaUI(reopened, exported)
  await reopened.getByLabel('Recovery copy').selectOption({ index: 1 })
  await reopened.getByRole('button', { name: 'Review recovery copy' }).click()
  await reopened.getByRole('checkbox', { name: 'I have a backup' }).check()
  await reopened.getByRole('button', { name: 'Replace workspace', exact: true }).click()
  await reopened.getByRole('dialog').waitFor({ state: 'hidden' })
  const recovered = await inspectNative(reopened)
  assert.deepEqual(recovered.projects, stored.projects)
  assert.deepEqual(recovered.tasks, stored.tasks)
  assert.deepEqual(recovered.activity, stored.activity)
  report.checks.push(
    'Reviewing and restoring an automatic recovery copy recovers the previous desktop workspace',
  )
  await reopened
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Insights' })
    .click()
  await reopened.getByRole('heading', { name: 'Project completion over time' }).waitFor()
  await reopened.screenshot({ path: resolve(root, 'desktop-insights.png'), fullPage: true })
  report.checks.push('Packaged local assets render native analytics without a service worker')
  await reopened.context().setOffline(true)
  await reopened.reload()
  await reopened.getByRole('heading', { name: 'Project completion over time' }).waitFor()
  assert.deepEqual(await inspectNative(reopened), recovered)
  report.checks.push('Native analytics and SQLite remain available after an offline reload')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false
  report.failure = error.stack ?? String(error)
  process.exitCode = 1
} finally {
  await stopDesktop()
  await browser?.close()
  preview?.kill()
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
