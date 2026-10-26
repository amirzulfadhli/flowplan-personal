// Read-only verification of an installed production app. Never imports or changes user records.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const executable = process.argv[2]
if (!executable) throw new Error('Pass the full path to the installed flowplan-personal.exe')
const root = resolve('desktop-test-results', `installed-${Date.now()}`)
await mkdir(root, { recursive: true })
const endpoint = 'http://127.0.0.1:9228'
const report = { checks: [] }
let app, connection
async function open() {
  app = spawn(executable, [], {
    windowsHide: true,
    env: {
      ...process.env,
      // Production must ignore the test-only database override.
      FLOWPLAN_TEST_DATA_DIR: resolve(root, 'must-not-be-used'),
      WEBVIEW2_USER_DATA_FOLDER: resolve(root, 'webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
        '--remote-debugging-port=9228 --remote-debugging-address=127.0.0.1',
    },
    stdio: 'ignore',
  })
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) throw new Error('Close any running FlowPlan instance before testing')
    try {
      if ((await fetch(`${endpoint}/json/version`)).ok) break
    } catch {
      /* WebView2 starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  connection = await chromium.connectOverCDP(endpoint)
  const page = connection.contexts()[0].pages()[0]
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('storage_info'))
  assert.ok(!info.path.toLowerCase().startsWith(root.toLowerCase()))
  assert.equal(info.databaseVersion, 2)
  report.database = info
  return page
}
async function close() {
  await connection?.close()
  connection = undefined
  if (app && app.exitCode === null) {
    const closed = once(app, 'exit')
    app.kill()
    await closed
  }
  app = undefined
  await new Promise((resolve) => setTimeout(resolve, 500))
}
async function read(page) {
  return page.evaluate(() => window.__TAURI_INTERNALS__.invoke('read_workspace'))
}
try {
  const page = await open()
  const before = await read(page)
  report.checks.push('Installed app uses the production database and ignores the test override')
  const second = spawn(executable, [], { windowsHide: true, stdio: 'ignore' })
  const timer = setTimeout(() => second.kill(), 10000)
  try {
    const [code] = await once(second, 'exit')
    assert.equal(code, 0, 'Second launch must exit successfully rather than start another instance')
    assert.equal(app.exitCode, null)
  } finally {
    clearTimeout(timer)
  }
  report.checks.push('Second launch exits while the original single instance remains running')
  await page.context().setOffline(true)
  await page.reload()
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  assert.deepEqual(await read(page), before)
  report.checks.push('Installed local assets and SQLite read work offline')
  await close()
  const restarted = await open()
  assert.deepEqual(await read(restarted), before)
  report.checks.push('Installed application restarts with the identical stored workspace')
  report.passed = true
} catch (error) {
  report.passed = false
  report.failure = error.stack ?? String(error)
  process.exitCode = 1
} finally {
  await close()
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
