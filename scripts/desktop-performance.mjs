// Observational benchmark, not a hardware-independent pass/fail performance budget.
// Uses only an isolated desktop-test profile. Run without concurrent model inference/builds.
import { chromium } from '@playwright/test'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { desktopEnvironment, waitForDesktop } from './native-test-utils.mjs'

const root = resolve('desktop-test-results', `performance-${Date.now()}`)
await mkdir(root, { recursive: true })
const report = {
  root,
  build: 'debug desktop-test',
  restart: 'graceful Quit',
  launches: [],
  idle: [],
}
const invoke = (page, command, args) =>
  page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
    command,
    args,
  })
let app, browser
async function sample() {
  // Read only this app's process tree, including its WebView2 children.
  const { stdout } = await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$all = Get-CimInstance Win32_Process; $ids = [System.Collections.Generic.HashSet[int]]::new(); [void]$ids.Add(${app.pid}); do { $changed = $false; foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)) { $changed = $true } } } while ($changed); $items = @(foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { @{ name=$p.ProcessName; id=$id; cpuSeconds=$p.CPU; workingSetBytes=$p.WorkingSet64; privateBytes=$p.PrivateMemorySize64 } } }); ConvertTo-Json -InputObject $items -Compress`,
    ],
    { windowsHide: true },
  )
  const processes = JSON.parse(stdout.trim())
  return {
    at: Date.now(),
    processes,
    cpuSeconds: processes.reduce((n, p) => n + p.cpuSeconds, 0),
    workingSetMiB: processes.reduce((n, p) => n + p.workingSetBytes, 0) / 1048576,
    privateMiB: processes.reduce((n, p) => n + p.privateBytes, 0) / 1048576,
  }
}
async function stop() {
  if (app && app.exitCode === null) {
    const exit = once(app, 'exit')
    const fallback = setTimeout(() => app?.kill(), 10000)
    try {
      const main = browser
        ?.contexts()[0]
        ?.pages()
        .find((p) => !p.url().includes('companion=1'))
      if (main) await invoke(main, 'desktop_action', { action: 'quit' }).catch(() => undefined)
      else app.kill()
      await exit
    } finally {
      clearTimeout(fallback)
    }
  }
  await browser?.close().catch(() => undefined)
  browser = undefined
  app = undefined
}
try {
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    app = spawn(resolve('src-tauri/target/debug/flowplan-personal.exe'), [], {
      windowsHide: true,
      env: desktopEnvironment(root, 9236),
      stdio: 'ignore',
    })
    const spawnedMs = performance.now() - start
    await waitForDesktop(app, 'http://127.0.0.1:9236')
    const endpointMs = performance.now() - start
    browser = await chromium.connectOverCDP('http://127.0.0.1:9236', { noDefaults: true })
    const connectedMs = performance.now() - start
    const main = browser
      .contexts()[0]
      .pages()
      .find((p) => !p.url().includes('companion=1'))
    await main.getByRole('navigation', { name: 'Main navigation' }).waitFor()
    const readyMs = performance.now() - start
    const databaseStart = performance.now()
    await invoke(main, 'read_workspace')
    const databaseRoundTripMs = performance.now() - databaseStart
    report.launches.push({
      profile: i === 0 ? 'fresh' : 'existing',
      readyMs: Math.round(readyMs),
      spawnedMs: Math.round(spawnedMs),
      endpointMs: Math.round(endpointMs),
      connectedMs: Math.round(connectedMs),
      databaseRoundTripMs: Math.round(databaseRoundTripMs),
      navigation: await main.evaluate(() =>
        performance.getEntriesByType('navigation')[0]?.toJSON(),
      ),
    })
    assert.equal(
      (await invoke(main, 'storage_info')).path.toLowerCase(),
      resolve(root, 'data/flowplan.sqlite3').toLowerCase(),
    )
    if (i < 2) {
      await stop()
      continue
    }
    await invoke(main, 'desktop_action', { action: 'show' })
    let widget
    for (let n = 0; n < 100; n++) {
      widget = browser
        .contexts()[0]
        .pages()
        .find((p) => p.url().includes('companion=1'))
      if (widget) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await widget.getByRole('button', { name: 'Expand companion' }).waitFor()
    report.display = await widget.evaluate(() => ({
      scale: devicePixelRatio,
      width: screen.width,
      height: screen.height,
      availableWidth: screen.availWidth,
      availableHeight: screen.availHeight,
    }))
    const sessions = await Promise.all(
      [main, widget].map(async (page) => {
        const s = await page.context().newCDPSession(page)
        await s.send('Performance.enable')
        return s
      }),
    )
    for (const mode of ['visible-island', 'hidden']) {
      if (mode === 'hidden') {
        await invoke(main, 'desktop_action', { action: 'closeMain' })
        await invoke(main, 'desktop_action', { action: 'hide' })
      }
      const before = await sample()
      const beforeJS = await Promise.all(sessions.map((s) => s.send('Performance.getMetrics')))
      await new Promise((r) => setTimeout(r, 15000))
      const afterJS = await Promise.all(sessions.map((s) => s.send('Performance.getMetrics')))
      const after = await sample()
      report.idle.push({
        mode,
        elapsedSeconds: (after.at - before.at) / 1000,
        cpuSeconds: after.cpuSeconds - before.cpuSeconds,
        workingSetMiB: after.workingSetMiB,
        privateMiB: after.privateMiB,
        workingSetDeltaMiB: after.workingSetMiB - before.workingSetMiB,
        js: afterJS.map((v, i) =>
          Object.fromEntries(
            v.metrics
              .filter((m) => ['TaskDuration', 'ScriptDuration', 'JSHeapUsedSize'].includes(m.name))
              .map((m) => [
                m.name,
                m.value - beforeJS[i].metrics.find((b) => b.name === m.name).value,
              ]),
          ),
        ),
        processes: after.processes,
      })
    }
  }
  report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.passed = false
} finally {
  await stop()
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
if (!report.passed) process.exitCode = 1
