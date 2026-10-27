// Real two-window WebView2 + Rust + SQLite verification. All writes use an isolated profile.
import { chromium, expect } from '@playwright/test'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { desktopEnvironment, waitForDesktop } from './native-test-utils.mjs'

const root = resolve('desktop-test-results', `companion-${Date.now()}`)
await mkdir(root, { recursive: true })
const report = { root, checks: [], errors: [] }
let app, browser, blocker, blockerBrowser
const endpoint = 'http://127.0.0.1:9229'
async function foregroundWindow() {
  // Read the actual Windows foreground HWND. WebView2/Tauri focus caches can
  // disagree during startup, and CDP document focus is not OS activation.
  const { stdout } = await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class FlowPlanFocusProbe { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId); }'; $window = [FlowPlanFocusProbe]::GetForegroundWindow(); $ownerId = [uint32]0; [void][FlowPlanFocusProbe]::GetWindowThreadProcessId($window, [ref]$ownerId); $owner = Get-Process -Id $ownerId; @{ hwnd=$window.ToInt64().ToString(); process=$owner.ProcessName; title=$owner.MainWindowTitle } | ConvertTo-Json -Compress`,
    ],
    { windowsHide: true },
  )
  const foreground = JSON.parse(stdout.trim())
  assert.match(foreground.hwnd, /^[1-9][0-9]*$/, 'Windows must have an active foreground window')
  return foreground
}
async function launch() {
  app = spawn(resolve('src-tauri/target/debug/flowplan-personal.exe'), [], {
    windowsHide: true,
    env: desktopEnvironment(root, 9229),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  app.stderr.on('data', (data) => process.stderr.write(data))
  await waitForDesktop(app, endpoint)
  browser = await chromium.connectOverCDP(endpoint, { noDefaults: true })
  browser
    .contexts()[0]
    .on('page', (page) => page.on('pageerror', (error) => report.errors.push(error.message)))
  const main = browser
    .contexts()[0]
    .pages()
    .find((p) => !p.url().includes('companion=1'))
  main.on('pageerror', (error) => report.errors.push(error.message))
  await main.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  const info = await invoke(main, 'storage_info')
  assert.equal(info.path.toLowerCase(), resolve(root, 'data', 'flowplan.sqlite3').toLowerCase())
  return main
}
const invoke = (page, command, args) =>
  page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
    command,
    args,
  })
const action = (page, action) => invoke(page, 'desktop_action', { action })
const state = (page) => invoke(page, 'companion_read')
async function companion() {
  for (let n = 0; n < 100; n++) {
    const widget = browser
      .contexts()[0]
      .pages()
      .find((p) => p.url().includes('companion=1'))
    if (widget) {
      await widget.getByRole('main').waitFor()
      return widget
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw Error('Companion window did not open')
}
async function stop() {
  await browser?.close()
  browser = undefined
  if (app && app.exitCode === null) {
    const exit = once(app, 'exit')
    app.kill()
    await exit
  }
  app = undefined
  await new Promise((resolve) => setTimeout(resolve, 500))
}
try {
  let main = await launch()
  await main.getByRole('button', { name: 'Create your first project' }).click()
  await main.getByLabel('Project name', { exact: true }).fill('Companion verification')
  await main.getByRole('button', { name: 'Create project', exact: true }).click()
  await action(main, 'open')
  const foregroundBeforeShow = await foregroundWindow()
  await action(main, 'show')
  let widget = await companion()
  await widget.getByRole('button', { name: 'Expand companion' }).waitFor()
  const foregroundAfterShow = await foregroundWindow()
  report.foreground = { before: foregroundBeforeShow, after: foregroundAfterShow }
  assert.equal(
    foregroundAfterShow.hwnd,
    foregroundBeforeShow.hwnd,
    'Passive show must preserve the actual Windows foreground window',
  )
  await widget.screenshot({ path: resolve(root, 'collapsed.png') })
  report.checks.push('Collapsed island opens without changing the Windows foreground window')
  await action(main, 'quickAdd')
  await expect(widget.getByLabel('Quick task', { exact: true })).toBeFocused()
  await widget.getByLabel('Quick task', { exact: true }).fill('Captured from the island')
  await widget.getByRole('button', { name: 'Capture task', exact: true }).click()
  await main.getByRole('button', { name: 'Captured from the island', exact: true }).waitFor()
  await widget.getByRole('button', { name: 'Complete current task' }).click()
  await expect.poll(async () => (await invoke(main, 'read_workspace')).tasks[0].status).toBe('done')
  await main.getByLabel('Quick task title').fill('Written from main')
  await main.getByRole('button', { name: 'Add ↵' }).click()
  await expect(widget.getByLabel('Current task', { exact: true })).toContainText(
    'Written from main',
  )
  report.checks.push(
    'Quick Add focuses capture; task creation and completion synchronize in both directions',
  )

  await action(main, 'hide')
  await action(main, 'open')
  const beforeExpandedShow = await foregroundWindow()
  await action(main, 'show')
  assert.equal((await foregroundWindow()).hwnd, beforeExpandedShow.hwnd)
  await widget.getByLabel('Quick task', { exact: true }).click()
  await expect(widget.getByLabel('Quick task', { exact: true })).toBeFocused()
  report.checks.push('Expanded passive show preserves OS focus and capture remains interactive')

  await main.getByRole('button', { name: 'Project', exact: true }).click()
  await main.getByLabel('Project name', { exact: true }).fill('Second project')
  await main.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(widget.getByLabel('Companion project')).toContainText('Second project')
  await widget.getByLabel('Companion project').selectOption({ label: 'Second project' })
  await widget.getByLabel('Quick task', { exact: true }).fill('Scoped capture')
  await widget.getByRole('button', { name: 'Capture task', exact: true }).click()
  await expect(widget.getByLabel('Current task', { exact: true })).toContainText('Scoped capture')
  const scoped = await invoke(main, 'read_workspace')
  assert.equal(
    scoped.tasks.find((t) => t.title === 'Scoped capture').projectId,
    scoped.projects.find((p) => p.name === 'Second project').id,
  )
  await widget.getByLabel('Companion project').selectOption({ label: 'Companion verification' })
  report.checks.push('Project selection scopes capture and current-task lists correctly')

  // A second isolated test process reserves a real OS hotkey. No other app is modified.
  blocker = spawn(resolve('src-tauri/target/debug/flowplan-personal.exe'), [], {
    windowsHide: true,
    env: {
      ...process.env,
      FLOWPLAN_TEST_DATA_DIR: resolve(root, 'blocker-data'),
      WEBVIEW2_USER_DATA_FOLDER: resolve(root, 'blocker-webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
        '--remote-debugging-port=9230 --remote-debugging-address=127.0.0.1',
    },
    stdio: 'ignore',
  })
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch('http://127.0.0.1:9230/json/version')).ok) break
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  blockerBrowser = await chromium.connectOverCDP('http://127.0.0.1:9230', { noDefaults: true })
  const blockerPage = blockerBrowser.contexts()[0].pages()[0]
  await blockerPage.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  const blockerState = await state(blockerPage)
  assert.ok(
    blockerState.shortcutError,
    'Second test process must report the occupied default shortcut',
  )
  await invoke(blockerPage, 'companion_update', {
    update: {
      type: 'preferences',
      expectedRevision: blockerState.revision,
      alwaysOnTop: false,
      closeToTray: true,
      shortcut: 'Control+Shift+F9',
    },
  })
  const originalPreferences = await state(main)
  await assert.rejects(() =>
    invoke(main, 'companion_update', {
      update: {
        type: 'preferences',
        expectedRevision: originalPreferences.revision,
        alwaysOnTop: false,
        closeToTray: true,
        shortcut: 'Control+Shift+F9',
      },
    }),
  )
  assert.deepEqual(await state(main), originalPreferences)
  await blockerBrowser.close()
  blockerBrowser = undefined
  const blockerExit = once(blocker, 'exit')
  blocker.kill()
  await blockerExit
  blocker = undefined
  report.checks.push(
    'An actual OS shortcut conflict reports an error and preserves the previous binding',
  )

  const initial = await state(main)
  await invoke(main, 'companion_update', {
    update: {
      type: 'preferences',
      expectedRevision: initial.revision,
      alwaysOnTop: true,
      closeToTray: true,
      shortcut: 'Control+Shift+F9',
    },
  })
  await expect(widget.getByRole('button', { name: 'Always on top', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const beforeInvalid = await state(main)
  await assert.rejects(() =>
    invoke(main, 'companion_update', {
      update: {
        type: 'preferences',
        expectedRevision: beforeInvalid.revision,
        alwaysOnTop: false,
        closeToTray: true,
        shortcut: 'Space',
      },
    }),
  )
  assert.deepEqual(await state(main), beforeInvalid)
  report.checks.push(
    'Desktop preferences synchronize and invalid shortcuts preserve prior settings',
  )

  await widget.getByLabel('Focus duration', { exact: true }).selectOption('5')
  await widget.getByRole('button', { name: 'Start focus' }).click()
  await expect(widget.getByLabel('Time remaining', { exact: true })).not.toHaveText('05:00', {
    timeout: 5000,
  })
  await widget.getByRole('button', { name: 'Pause focus' }).click()
  const paused = await state(main)
  assert.equal(paused.endsAt, null)
  assert.ok(paused.remainingMs > 0 && paused.remainingMs < 300_000)
  const pausedDisplay = await widget.getByLabel('Time remaining', { exact: true }).textContent()
  await widget.waitForTimeout(1300)
  assert.equal(
    await widget.getByLabel('Time remaining', { exact: true }).textContent(),
    pausedDisplay,
  )
  await widget.getByRole('button', { name: 'Start focus' }).click()
  const running = await state(main)
  const beforeRestart = await invoke(main, 'read_workspace')
  await widget.screenshot({ path: resolve(root, 'expanded.png') })
  const overflow = await widget.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  assert.equal(overflow, false)
  report.checks.push(
    'Timer counts down, pauses without drifting, and resumes; expanded layout fits its window',
  )
  await stop()
  main = await launch()
  widget = await companion()
  const restored = await state(main)
  assert.equal(restored.endsAt, running.endsAt)
  assert.equal(restored.alwaysOnTop, true)
  assert.equal(restored.shortcut, 'Control+Shift+F9')
  assert.deepEqual(await invoke(main, 'read_workspace'), beforeRestart)
  await widget.getByRole('button', { name: 'Reset focus' }).click()
  await expect(widget.getByLabel('Time remaining', { exact: true })).toHaveText('05:00')
  report.checks.push(
    'Timer deadline, preferences, window visibility, and workspace survive process restart',
  )

  const metrics = await widget.context().newCDPSession(widget)
  await metrics.send('Performance.enable')
  await action(main, 'closeMain')
  // Closing main persists position and advances the companion revision. The still-visible
  // widget must receive it before its next preference write, rather than fail as stale.
  const pin = widget.getByRole('button', { name: 'Always on top', exact: true })
  await pin.click()
  await expect(pin).toHaveAttribute('aria-pressed', 'false')
  await pin.click()
  await expect(pin).toHaveAttribute('aria-pressed', 'true')
  await action(main, 'hide')
  assert.equal(app.exitCode, null)
  assert.equal(await invoke(main, 'plugin:window|is_visible', { label: 'main' }), false)
  assert.equal(await invoke(main, 'plugin:window|is_visible', { label: 'companion' }), false)
  const hiddenRevision = (await state(main)).revision
  const beforeIdle = await metrics.send('Performance.getMetrics')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const afterIdle = await metrics.send('Performance.getMetrics')
  assert.equal((await state(main)).revision, hiddenRevision)
  report.hiddenWidgetMetrics = Object.fromEntries(
    afterIdle.metrics
      .filter((m) => ['JSHeapUsedSize', 'TaskDuration', 'ScriptDuration'].includes(m.name))
      .map((m) => [
        m.name,
        {
          value: m.value,
          deltaOver5Seconds:
            m.value - (beforeIdle.metrics.find((b) => b.name === m.name)?.value ?? 0),
        },
      ]),
  )
  await action(main, 'open')
  await action(main, 'resetPosition')
  await expect.poll(async () => (await state(main)).visible).toBe(true)
  const bounds = await widget.evaluate(() => ({
    x: screenX,
    y: screenY,
    width: outerWidth,
    height: outerHeight,
    left: screen.availLeft,
    top: screen.availTop,
    availableWidth: screen.availWidth,
    availableHeight: screen.availHeight,
  }))
  assert.ok(bounds.x >= bounds.left && bounds.y >= bounds.top)
  assert.ok(bounds.x + bounds.width <= bounds.left + bounds.availableWidth + 1)
  assert.ok(bounds.y + bounds.height <= bounds.top + bounds.availableHeight + 1)
  report.bounds = bounds
  report.checks.push(
    'Close-to-tray retains the process; idle hidden companion makes no persisted changes; reset position stays inside the work area',
  )
  // Run the artificial lifecycle test last: CDP leaves visibility hidden after resume.
  await widget.getByRole('button', { name: 'Start focus' }).click()
  // Suspend only this test renderer, never the user's Windows session or system clock.
  const deadlineBeforeFreeze = (await state(main)).endsAt
  const frozenDisplay = await widget.getByLabel('Time remaining', { exact: true }).textContent()
  const suspension = await widget.context().newCDPSession(widget)
  await suspension.send('Page.setWebLifecycleState', { state: 'frozen' })
  try {
    await new Promise((resolve) => setTimeout(resolve, 6500))
  } finally {
    await suspension.send('Page.setWebLifecycleState', { state: 'active' })
  }
  const seconds = (text) =>
    text.split(':').reduce((minutes, part) => minutes * 60 + Number(part), 0)
  await expect
    .poll(
      async () =>
        seconds(frozenDisplay) -
        seconds(await widget.getByLabel('Time remaining', { exact: true }).textContent()),
      { timeout: 5000 },
    )
    .toBeGreaterThanOrEqual(6)
  assert.equal((await state(main)).endsAt, deadlineBeforeFreeze)
  report.rendererResume = await widget.evaluate(() => ({
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }))
  await suspension.detach()
  report.checks.push(
    'Renderer suspension/resume catches up from the persisted deadline without shifting it (not a physical Windows sleep test)',
  )
  await action(main, 'quit').catch(() => undefined)
  await expect.poll(() => app.exitCode, { timeout: 10000 }).not.toBe(null)
  report.checks.push('Explicit Quit exits the native process')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false
  report.failure = error.stack ?? String(error)
  report.focusDiagnostics = await Promise.all(
    (browser?.contexts()[0]?.pages() ?? []).map(async (page) => ({
      url: page.url(),
      state: await page
        .evaluate(() => ({
          focused: document.hasFocus(),
          active: document.activeElement?.tagName,
          label: document.activeElement?.getAttribute('aria-label'),
        }))
        .catch(() => null),
    })),
  )
  process.exitCode = 1
  for (const page of browser?.contexts()[0]?.pages() ?? [])
    await page
      .screenshot({
        path: resolve(
          root,
          page.url().includes('companion=1') ? 'failure-widget.png' : 'failure-main.png',
        ),
      })
      .catch(() => undefined)
} finally {
  await blockerBrowser?.close()
  if (blocker && blocker.exitCode === null) blocker.kill()
  await stop()
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
