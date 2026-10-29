// No CDP or WebView diagnostic flags. Quit each audit window through its normal UI.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root = resolve('desktop-test-results/acceptance')
const binary = resolve(root, 'installed/flowplan-personal.exe')
const acceptance = JSON.parse(await readFile(resolve(root, 'report.json'), 'utf8'))
assert.equal(acceptance.passed, true, 'Finish the isolated acceptance run first')
assert.equal(
  createHash('sha256')
    .update(await readFile(binary))
    .digest('hex'),
  acceptance.candidateBinaryHash,
)
const report = process.argv.includes('--resume')
  ? JSON.parse(await readFile(resolve(root, 'normal-startup.json'), 'utf8'))
  : {
      mode: 'production acceptance identity, no CDP; opt-in native timing file only',
      launches: [],
    }
if (process.argv.includes('--resume')) report.resumedAfterInterruption = true
for (let i = report.launches.length; i < 3; i++) {
  const trace = resolve(root, `normal-startup-${Date.now()}-${i}.tsv`)
  const env = { ...process.env, FLOWPLAN_STARTUP_TRACE: trace }
  delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
  delete env.WEBVIEW2_USER_DATA_FOLDER
  delete env.FLOWPLAN_TEST_DATA_DIR
  const start = performance.now()
  const app = spawn(binary, [], { env, windowsHide: true, stdio: 'ignore' })
  const exited = once(app, 'exit')
  // Observe spawn errors immediately, including while polling the trace file.
  exited.catch(() => {})
  let timeout
  let pending
  try {
    let text = ''
    for (let attempt = 0; attempt < 300; attempt++) {
      text = await readFile(trace, 'utf8').catch(() => '')
      if (text.includes('workspace_read_end')) break
      if (app.exitCode !== null) throw Error('Audit exited before its initial workspace read')
      await new Promise((r) => setTimeout(r, 100))
    }
    assert.ok(
      text.includes('workspace_read_end'),
      'No initial workspace snapshot within 30 seconds',
    )
    const snapshotMs = Math.round(performance.now() - start)
    pending = { launch: i + 1, snapshotMs, traceFile: trace, trace: text }
    report.pending = pending
    await writeFile(resolve(root, 'normal-startup.json'), JSON.stringify(report, null, 2))
    console.log(
      JSON.stringify({
        launch: i + 1,
        pid: app.pid,
        snapshotMs,
        trace,
        text,
        instruction: 'Inspect the rendered audit window and use Settings > Quit FlowPlan',
      }),
    )
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          app.kill()
          reject(Error('No UI Quit within five minutes; stopped only the owned audit process'))
        }, 300000)
      }),
    ])
    assert.equal(app.exitCode, 0, 'Normal UI Quit must exit successfully')
    report.launches.push({
      launch: i + 1,
      snapshotMs,
      trace: await readFile(trace, 'utf8'),
      exitCode: app.exitCode,
    })
    delete report.pending
    delete report.failure
    await writeFile(resolve(root, 'normal-startup.json'), JSON.stringify(report, null, 2))
  } catch (error) {
    report.failure = String(error)
    if (pending) report.pending = { ...pending, completedUiQuit: false }
    await writeFile(resolve(root, 'normal-startup.json'), JSON.stringify(report, null, 2))
    throw error
  } finally {
    clearTimeout(timeout)
    if (app.exitCode === null) app.kill()
  }
}
console.log(JSON.stringify(report, null, 2))
