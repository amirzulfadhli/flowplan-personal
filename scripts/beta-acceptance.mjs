// Explicit opt-in Windows acceptance audit. Only the separate acceptance identity is allowed.
import { chromium, expect } from '@playwright/test'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { waitForDesktop } from './native-test-utils.mjs'

const root = resolve('desktop-test-results/acceptance')
const installed = resolve(root, 'installed')
const binary = resolve(installed, 'flowplan-personal.exe')
const database = resolve(
  process.env.APPDATA,
  'com.amirzulfadhli.flowplan-beta-acceptance/flowplan.sqlite3',
)
const endpoint = 'http://127.0.0.1:9241'
const upgradeRetained = process.argv.includes('--upgrade-retained')
const upgradeSoak = process.argv.includes('--upgrade-soak')
const skipSoak = process.argv.includes('--skip-soak')
const timerSoakOnly = process.argv.includes('--timer-soak-only')
assert.ok(!timerSoakOnly || upgradeSoak, '--timer-soak-only requires --upgrade-soak')
const reportFile = upgradeRetained || upgradeSoak ? 'increasing-version-report.json' : 'report.json'
const phaseSeconds = Number(process.env.FLOWPLAN_SOAK_PHASE_SECONDS || 300)
assert.ok(Number.isInteger(phaseSeconds) && phaseSeconds >= 60 && phaseSeconds <= 3600)
const report = {
  started: new Date().toISOString(),
  checks: [],
  launches: [],
  samples: [],
  phaseSeconds,
  errors: [],
}
const run = promisify(execFile)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  )
const hash = async (p) =>
  createHash('sha256')
    .update(await readFile(p))
    .digest('hex')
const ps = async (command) =>
  (
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
    })
  ).stdout.trim()
const quote = (value) => `'${value.replaceAll("'", "''")}'`
const flush = () => writeFile(resolve(root, reportFile), JSON.stringify(report, null, 2))
const invoke = (page, command, args) =>
  page.evaluate(
    async ({ command, args }) => {
      try {
        return await window.__TAURI_INTERNALS__.invoke(command, args)
      } catch (error) {
        throw new Error(JSON.stringify(error), { cause: error })
      }
    },
    {
      command,
      args,
    },
  )
let app, browser, main
async function install(name) {
  const installer = resolve(root, name)
  assert.equal(
    await ps(`(Get-Item -LiteralPath ${quote(installer)}).VersionInfo.ProductName`),
    'FlowPlan Beta Acceptance',
  )
  await run(installer, ['/S', `/D=${installed}`], { windowsHide: true, timeout: 120000 })
  assert.ok(await exists(binary))
  assert.equal(
    await ps(`(Get-Item -LiteralPath ${quote(binary)}).VersionInfo.ProductName`),
    'FlowPlan Beta Acceptance',
  )
}
async function open(label) {
  const start = performance.now()
  app = spawn(binary, [], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
        '--remote-debugging-port=9241 --remote-debugging-address=127.0.0.1',
      FLOWPLAN_STARTUP_TRACE: resolve(root, `startup-${report.launches.length}.tsv`),
    },
  })
  await waitForDesktop(app, endpoint)
  browser = await chromium.connectOverCDP(endpoint, { noDefaults: true })
  await expect
    .poll(() => {
      main = browser
        .contexts()[0]
        .pages()
        .find((p) => {
          const url = new URL(p.url())
          return url.hostname === 'tauri.localhost' && !url.searchParams.has('companion')
        })
      return Boolean(main)
    })
    .toBe(true)
  await main.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  const readyMs = Math.round(performance.now() - start)
  assert.equal((await invoke(main, 'storage_info')).path.toLowerCase(), database.toLowerCase())
  report.launches.push({ label, readyMs, webview: browser.version() })
  for (const page of browser.contexts()[0].pages())
    page.on('pageerror', (e) => report.errors.push(e.message))
  await flush()
  return main
}
async function close() {
  if (app && app.exitCode === null) {
    const exited = once(app, 'exit')
    await invoke(main, 'desktop_action', { action: 'quit' }).catch(() => undefined)
    let timeout
    try {
      await Promise.race([
        exited,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(Error('Quit failed')), 10000)
        }),
      ])
    } finally {
      clearTimeout(timeout)
    }
  }
  await browser?.close().catch(() => undefined)
  browser = undefined
  app = undefined
  main = undefined
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(500) })
    } catch {
      return
    }
    await sleep(100)
  }
  throw Error('WebView endpoint still active after Quit')
}
function fixture() {
  const time = '2026-10-28T12:00:00.000Z'
  const projects = Array.from({ length: 40 }, (_, i) => ({
    id: `accept-p${i}`,
    name: `Synthetic project ${i}`,
    description: 'Acceptance fixture, not user data',
    color: '#7d87ec',
    due: '2026-11-30',
    notes: `Notes retained for ${i}`,
    createdAt: time,
    updatedAt: time,
  }))
  const tasks = Array.from({ length: 2000 }, (_, i) => ({
    id: `accept-t${i}`,
    projectId: projects[i % 40].id,
    title: `Synthetic task ${i}`,
    description: 'Populated acceptance workload',
    status: ['todo', 'doing', 'review', 'done'][i % 4],
    priority: ['Low', 'Medium', 'High'][i % 3],
    due: '2026-11-15',
    createdAt: time,
    updatedAt: time,
    completedAt: i % 4 === 3 ? time : null,
  }))
  const activity = Array.from({ length: 4000 }, (_, i) => ({
    id: `accept-a${i}`,
    projectId: projects[i % 40].id,
    message: `Synthetic activity ${i}`,
    time,
  }))
  return {
    schemaVersion: 1,
    revision: 0,
    profile: { name: 'Isolated acceptance fixture' },
    projects,
    tasks,
    activity,
  }
}
async function preferences() {
  const c = await invoke(main, 'companion_read')
  return Object.fromEntries(
    ['projectId', 'taskId', 'alwaysOnTop', 'closeToTray', 'shortcut', 'durationMinutes'].map(
      (k) => [k, c[k]],
    ),
  )
}
async function sample(mode) {
  const processes = JSON.parse(
    await ps(
      `$all = Get-CimInstance Win32_Process; $ids = [System.Collections.Generic.HashSet[int]]::new(); [void]$ids.Add(${app.pid}); do { $changed = $false; foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)) { $changed = $true } } } while ($changed); $items = @(foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { @{ id=$id; cpu=$p.CPU; private=$p.PrivateMemorySize64; working=$p.WorkingSet64 } } }); ConvertTo-Json -InputObject $items -Compress`,
    ),
  )
  report.samples.push({
    mode,
    at: Date.now(),
    cpuSeconds: processes.reduce((n, p) => n + p.cpu, 0),
    privateMiB: processes.reduce((n, p) => n + p.private, 0) / 1048576,
    workingSetMiB: processes.reduce((n, p) => n + p.working, 0) / 1048576,
    processes: processes.length,
  })
  await flush()
}
await mkdir(root, { recursive: true })
const resumeEmpty = process.argv.includes('--resume-empty')
const resumeSoak = process.argv.includes('--soak-only') || upgradeSoak
let seeded
if (upgradeRetained) {
  assert.ok(!resumeSoak && !resumeEmpty, 'Choose one audit mode')
  assert.ok(!(await exists(resolve(root, reportFile))), 'Preserve the previous upgrade report')
  const previous = JSON.parse(await readFile(resolve(root, 'report.json'), 'utf8'))
  assert.equal(previous.passed, true, 'Finish the original isolated audit first')
  seeded = JSON.parse(await readFile(resolve(root, 'external-backup.json'), 'utf8'))
  assert.ok(await exists(database), 'Requires the retained synthetic acceptance profile')
  assert.ok(!(await exists(binary)), 'Close/uninstall the previous audit installation first')
} else if (resumeSoak) {
  const previous = JSON.parse(await readFile(resolve(root, reportFile), 'utf8'))
  assert.equal(await hash(binary), previous.candidateBinaryHash)
  assert.ok(previous.checks.length >= (upgradeSoak ? 1 : 3))
  await writeFile(
    resolve(root, `before-soak-${Date.now()}.json`),
    JSON.stringify(previous, null, 2),
  )
  Object.assign(report, previous, {
    phaseSeconds,
    samples: [],
    errors: [],
    passed: undefined,
    failure: undefined,
    finished: undefined,
  })
  seeded = JSON.parse(await readFile(resolve(root, 'external-backup.json'), 'utf8'))
} else if (resumeEmpty) {
  const previous = JSON.parse(await readFile(resolve(root, 'report.json'), 'utf8'))
  assert.equal(previous.passed, false)
  assert.equal(await hash(binary), previous.previousBinaryHash)
  await writeFile(
    resolve(root, `interrupted-${Date.now()}.json`),
    JSON.stringify(previous, null, 2),
  )
} else {
  assert.ok(!(await exists(database)), 'Acceptance profile already exists; preserve it')
  assert.ok(!(await exists(binary)), 'Acceptance installation already exists')
}
try {
  if (upgradeRetained) {
    await install('candidate-setup.exe')
    const version = () => ps(`(Get-Item -LiteralPath ${quote(binary)}).VersionInfo.ProductVersion`)
    report.previousVersion = await version()
    assert.match(report.previousVersion, /^0\.4\.0(?:\.|$)/)
    await open('Retained 0.4.0 baseline')
    assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    const expectedPreferences = await preferences()
    report.expectedPreferences = expectedPreferences
    await flush()
    await close()
    await install('candidate-setup-0.4.1.exe')
    report.candidateVersion = await version()
    assert.match(report.candidateVersion, /^0\.4\.1(?:\.|$)/)
    report.candidateBinaryHash = await hash(binary)
    await open('Increasing-version 0.4.1 upgrade')
    assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    assert.deepEqual(await preferences(), expectedPreferences)
    report.checks.push(
      'Real 0.4.0 to 0.4.1 installer upgrade retained all workspace fields and selected preferences',
    )
    await close()
  } else if (!resumeSoak) {
    if (!resumeEmpty) await install('previous-setup.exe')
    report.previousBinaryHash = await hash(binary)
    await open('Phase 5 clean audit installation')
    const empty = await invoke(main, 'read_workspace')
    assert.equal(empty.projects.length, 0)
    seeded = await invoke(main, 'commit_workspace', {
      expectedRevision: empty.revision,
      workspace: { ...fixture(), revision: empty.revision + 1 },
      replacement: true,
    })
    await writeFile(resolve(root, 'external-backup.json'), JSON.stringify(seeded, null, 2))
    let c = await invoke(main, 'companion_read')
    await invoke(main, 'companion_update', {
      update: {
        type: 'preferences',
        alwaysOnTop: true,
        closeToTray: true,
        shortcut: '',
        expectedRevision: c.revision,
      },
    })
    await invoke(main, 'companion_update', { update: { type: 'project', id: 'accept-p0' } })
    await invoke(main, 'companion_update', { update: { type: 'task', id: 'accept-t0' } })
    await invoke(main, 'companion_update', {
      update: { type: 'timer', action: 'duration', minutes: 15 },
    })
    const expectedPreferences = await preferences()
    await close()
    report.checks.push(
      'Fresh audit installation created a separate SQLite database and external synthetic backup',
    )
    await install('candidate-setup.exe')
    report.candidateBinaryHash = await hash(binary)
    assert.notEqual(report.candidateBinaryHash, report.previousBinaryHash)
    await open('Phase 6 same-version upgrade')
    assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    assert.deepEqual(await preferences(), expectedPreferences)
    await close()
    report.checks.push(
      'Phase 5 to Phase 6 same-version installer replacement preserved every workspace field and selected companion preferences',
    )
    await run(resolve(installed, 'uninstall.exe'), ['/S'], { windowsHide: true, timeout: 120000 })
    await expect.poll(() => exists(binary), { timeout: 30000 }).toBe(false)
    assert.ok(
      await exists(database),
      'Default uninstall unexpectedly removed the audit database; external backup retained',
    )
    await install('candidate-setup.exe')
    await open('Reinstall with retained data')
    assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    assert.deepEqual(await preferences(), expectedPreferences)
    report.checks.push(
      'Default silent uninstall removed the executable and retained data; reinstall recovered every workspace field and selected preferences',
    )
    await close()
    for (let i = 0; i < 3; i++) {
      await open(`Populated candidate reopen ${i + 1}`)
      assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
      await close()
    }
  }
  if (!skipSoak) {
    await open('Populated resource soak')
    assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    await invoke(main, 'desktop_action', { action: 'show' })
    await main.goto('http://tauri.localhost/#/tasks')
    await main.locator('main h1').waitFor()
    await sleep(15000)
    for (const mode of timerSoakOnly
      ? ['hidden-timer']
      : ['visible-idle', 'hidden-idle', 'hidden-timer']) {
      if (mode !== 'visible-idle') {
        await invoke(main, 'desktop_action', { action: 'closeMain' })
        await invoke(main, 'desktop_action', { action: 'hide' })
      }
      if (mode === 'hidden-timer') {
        await invoke(main, 'companion_update', {
          update: { type: 'timer', action: 'duration', minutes: Math.ceil(phaseSeconds / 60) + 5 },
        })
        await invoke(main, 'companion_update', { update: { type: 'timer', action: 'start' } })
      }
      const end = Date.now() + phaseSeconds * 1000
      console.log(`Starting ${mode}: ${phaseSeconds}s`)
      do {
        await sample(mode)
        await sleep(Math.min(10000, Math.max(0, end - Date.now())))
      } while (Date.now() < end)
      await sample(mode)
      assert.deepEqual(await invoke(main, 'read_workspace'), seeded)
    }
    assert.deepEqual(report.errors, [])
    report.checks.push(
      timerSoakOnly
        ? 'Populated hidden-timer soak completed without workspace changes or renderer errors; earlier idle stages are in the archived report'
        : 'Populated visible, hidden, and hidden-timer soak completed without workspace changes or renderer errors',
    )
  }
  report.passed = true
} catch (error) {
  report.passed = false
  report.failure = error.stack || JSON.stringify(error)
  report.failureDetails = { code: error.code, stdout: error.stdout, stderr: error.stderr }
  process.exitCode = 1
} finally {
  await close().catch((error) => {
    report.passed = false
    report.cleanupError = String(error)
    if (app?.exitCode === null) app.kill()
    process.exitCode = 1
  })
  report.finished = new Date().toISOString()
  await flush()
  console.log(JSON.stringify(report, null, 2))
}
