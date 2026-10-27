// Opt-in real-model audit. Never installs/downloads models or accesses personal data.
// Requires an already running loopback Ollama and the desktop-test build.
import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { desktopEnvironment, waitForDesktop } from './native-test-utils.mjs'

const endpoint = process.env.FLOWPLAN_AUDIT_OLLAMA || 'http://127.0.0.1:11435'
const model = process.env.FLOWPLAN_AUDIT_MODEL || 'qwen3:1.7b'
assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+$/)
const root = resolve('desktop-test-results', `local-model-${Date.now()}`)
await mkdir(root, { recursive: true })
const report = { root, endpoint, model, checks: [], responses: [], errors: [] }
const invoke = (page, command, args) =>
  page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
    command,
    args,
  })
const now = '2026-10-27T00:00:00.000Z'
const project = (id, name, notes) => ({
  id,
  name,
  notes,
  description: '',
  color: '#7d87ec',
  due: '',
  createdAt: now,
  updatedAt: now,
})
const task = (id, title, status, description) => ({
  id,
  projectId: 'alpha',
  title,
  description,
  status,
  priority: 'Medium',
  due: '',
  createdAt: now,
  updatedAt: now,
  completedAt: status === 'done' ? now : null,
})
const fixture = {
  schemaVersion: 1,
  revision: 1,
  profile: { name: 'SECRET PROFILE' },
  projects: [
    project(
      'alpha',
      'Local documentation site',
      'Deployment is blocked until the preview build passes. No deadline has been agreed. Next goal: split the preview-build work into two small tasks.',
    ),
    project('beta', 'SECRET BETA', 'SECRET BETA NOTES'),
  ],
  tasks: [
    task('alpha-done', 'Write setup guide', 'done', 'Guide reviewed and complete.'),
    task(
      'alpha-preview',
      'Fix preview build',
      'doing',
      'The preview build fails because image paths are incorrect.',
    ),
    task('alpha-deploy', 'Deploy site', 'todo', 'Blocked by the failing preview build.'),
  ],
  activity: [
    { id: 'alpha-log', projectId: 'alpha', time: now, message: 'Completed setup guide' },
    { id: 'beta-log', projectId: 'beta', time: now, message: 'SECRET BETA ACTIVITY' },
  ],
}
let app, browser
try {
  assert.ok(
    (await (await fetch(`${endpoint}/api/tags`)).json()).models.some((m) => m.name === model),
    'Requested model must already be installed',
  )
  app = spawn(resolve('src-tauri/target/debug/flowplan-personal.exe'), [], {
    windowsHide: true,
    env: desktopEnvironment(root, 9235),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  app.stderr.on('data', (d) => process.stderr.write(d))
  await waitForDesktop(app, 'http://127.0.0.1:9235')
  browser = await chromium.connectOverCDP('http://127.0.0.1:9235')
  const page = browser
    .contexts()[0]
    .pages()
    .find((p) => !p.url().includes('companion=1'))
  page.on('pageerror', (e) => report.errors.push(e.message))
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  assert.equal(
    (await invoke(page, 'storage_info')).path.toLowerCase(),
    resolve(root, 'data/flowplan.sqlite3').toLowerCase(),
  )
  await invoke(page, 'commit_workspace', {
    expectedRevision: 0,
    workspace: fixture,
    replacement: false,
  })
  await page.evaluate(() => {
    location.hash = '/projects/alpha'
  })
  await page.getByRole('tab', { name: 'AI', exact: true }).click()
  await page.getByLabel('Enable local AI for this project').check()
  await page.getByLabel('Ollama address').fill(endpoint)
  await page.getByRole('button', { name: 'Find local models' }).click()
  await expect(page.getByLabel('Local model')).toHaveValue(model)
  const original = await invoke(page, 'read_workspace')
  for (const intent of ['Summary', 'Priorities', 'Blockers', 'Task breakdown']) {
    await page.getByLabel('Assistance').selectOption(intent)
    await page
      .getByLabel('Question or task to break down (optional)')
      .fill(
        intent === 'Task breakdown'
          ? 'Propose exactly two new todo tasks to fix the image paths and verify the preview build. Leave due dates empty.'
          : 'Use only project evidence. Keep advice concise. Do not propose actions for this request.',
      )
    const start = performance.now()
    await page.getByRole('button', { name: 'Generate suggestions' }).click()
    await page
      .getByRole('button', { name: 'Cancel request' })
      .waitFor({ state: 'hidden', timeout: 200000 })
    const error = await page.getByRole('alert').allTextContents()
    const response = {
      intent,
      elapsedMs: Math.round(performance.now() - start),
      error,
      advice: await page.locator('.ai-answer').allTextContents(),
      proposals: await page.locator('.ai-proposal').allTextContents(),
    }
    report.responses.push(response)
    await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(response))
    assert.deepEqual(
      await invoke(page, 'read_workspace'),
      original,
      'Inference must never write tasks',
    )
    if (error.length) continue
    assert.ok(response.advice.length === 2)
    assert.ok(!JSON.stringify(response).includes('SECRET'))
    if (intent !== 'Task breakdown')
      assert.equal(
        response.proposals.length,
        0,
        'Advice-only request should not propose task rewrites',
      )
    else {
      assert.equal(response.proposals.length, 2)
      assert.ok(
        response.proposals.every(
          (p) => p.startsWith('Create:') && p.includes('status—todo') && p.includes('due——'),
        ),
      )
    }
    if (intent === 'Task breakdown' && response.proposals.length) {
      await page.locator('.ai-proposal input[type=checkbox]').first().check()
      await page.getByRole('button', { name: 'Review 1 selected action(s)' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.deepEqual(await invoke(page, 'read_workspace'), original)
      await page.getByRole('button', { name: 'Review 1 selected action(s)' }).click()
      await page.getByRole('button', { name: 'Approve and save selected actions' }).click()
      await page.getByText('Approved actions saved to this project.', { exact: true }).waitFor()
      const saved = await invoke(page, 'read_workspace')
      assert.equal(saved.revision, original.revision + 1)
      assert.equal(saved.tasks.length, original.tasks.length + 1)
      assert.equal(saved.tasks.at(-1).projectId, 'alpha')
      report.checks.push(
        'Actual generated task persisted only after explicit approval; cancelled review preserved data',
      )
    }
  }
  const beforeCancel = await invoke(page, 'read_workspace')
  await page.getByRole('button', { name: 'Generate suggestions' }).click()
  await page.getByRole('button', { name: 'Cancel request' }).click()
  await expect(page.getByRole('button', { name: 'Generate suggestions' })).toBeEnabled()
  assert.deepEqual(await invoke(page, 'read_workspace'), beforeCancel)
  report.checks.push(
    'Actual-model request cancellation preserves SQLite data and re-enables controls',
  )
  await page.getByLabel('Ollama address').fill('http://127.0.0.1:1')
  await page.getByRole('button', { name: 'Find local models' }).click()
  await page.getByRole('alert').waitFor()
  assert.deepEqual(await invoke(page, 'read_workspace'), beforeCancel)
  await page.getByLabel('Ollama address').fill(endpoint)
  await page.getByRole('button', { name: 'Find local models' }).click()
  await expect(page.getByLabel('Local model')).toHaveValue(model)
  report.checks.push(
    'Unavailable endpoint reports an error; reconnect discovers the installed model',
  )
  report.passed =
    report.responses.every((r) => !r.error.length) &&
    report.checks.length === 3 &&
    !report.errors.length
} catch (error) {
  report.failure = String(error.stack || error)
  report.passed = false
} finally {
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  if (app && app.exitCode === null) {
    const exit = once(app, 'exit')
    app.kill()
    await exit
  }
  console.log(
    JSON.stringify({ root, passed: report.passed, checks: report.checks, failure: report.failure }),
  )
}
if (!report.passed) process.exitCode = 1
