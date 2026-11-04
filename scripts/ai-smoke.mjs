// A deterministic, loopback-only Ollama fixture exercises real WebView2/Rust/SQLite.
// It verifies integration and privacy, not the quality of a downloaded language model.
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { desktopEnvironment, waitForDesktop } from './native-test-utils.mjs'

const root = resolve('desktop-test-results', `ai-${Date.now()}`)
await mkdir(root, { recursive: true })
const report = { root, checks: [], errors: [] }
const requests = []
let mode = 'valid',
  cancelled = 0,
  redirects = 0,
  app,
  browser
const proposal = {
  kind: 'create',
  taskId: null,
  title: 'Approved AI task',
  description: 'Test-only local suggestion',
  status: 'todo',
  priority: 'Medium',
  due: '',
  reason: 'A concrete next step.',
}
const answer = {
  summary: 'Alpha project advice',
  reasoningSummary: 'Based only on Alpha tasks and notes.',
  actions: [
    proposal,
    {
      ...proposal,
      kind: 'update',
      taskId: 'alpha-task',
      title: 'Existing Alpha task',
      priority: 'High',
    },
  ],
}
const server = createServer(async (req, res) => {
  let raw = ''
  for await (const part of req) raw += part
  const body = raw ? JSON.parse(raw) : undefined
  requests.push({ path: req.url, body })
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/trap') {
    redirects++
    res.end('{}')
    return
  }
  if (mode === 'redirect') {
    res.writeHead(307, { Location: '/trap' })
    res.end()
    return
  }
  if (req.url === '/api/tags') {
    res.end(
      JSON.stringify({
        models: [
          {
            name: 'local-test:latest',
            size: 1024,
            digest: 'test-digest',
            details: { format: 'gguf' },
            ...(mode === 'cloud'
              ? { remote_host: 'https://ollama.com', remote_model: 'cloud-model' }
              : {}),
          },
        ],
      }),
    )
    return
  }
  if (req.url === '/api/show') {
    res.end(JSON.stringify({ model_info: {}, capabilities: ['completion'] }))
    return
  }
  if (req.url === '/api/chat') {
    if (mode === 'delay') {
      res.on('close', () => {
        cancelled++
      })
      return
    }
    if (mode === 'failure') {
      res.writeHead(503)
      res.end('{}')
      return
    }
    const content =
      mode === 'invalid'
        ? 'not JSON'
        : JSON.stringify(
            mode === 'foreign'
              ? { ...answer, actions: [{ ...proposal, kind: 'update', taskId: 'beta-task' }] }
              : answer,
          )
    res.end(
      JSON.stringify({ done: true, done_reason: 'stop', message: { role: 'assistant', content } }),
    )
    return
  }
  res.writeHead(404)
  res.end('{}')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const endpoint = `http://127.0.0.1:${server.address().port}`
const invoke = (page, command, args) =>
  page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
    command,
    args,
  })
const read = (page) => invoke(page, 'read_workspace')
async function start() {
  app = spawn(resolve('src-tauri/target/debug/flowplan-personal.exe'), [], {
    windowsHide: true,
    env: desktopEnvironment(root, 9231),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  app.stderr.on('data', (data) => process.stderr.write(data))
  await waitForDesktop(app, 'http://127.0.0.1:9231')
  browser = await chromium.connectOverCDP('http://127.0.0.1:9231')
  const main = browser
    .contexts()[0]
    .pages()
    .find((p) => !p.url().includes('companion=1'))
  main.on('pageerror', (error) => report.errors.push(error.message))
  await main.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  assert.equal(
    (await invoke(main, 'storage_info')).path.toLowerCase(),
    resolve(root, 'data/flowplan.sqlite3').toLowerCase(),
  )
  return main
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
async function panel(page, projectId = 'alpha') {
  await page.evaluate((id) => {
    location.hash = `/projects/${id}`
  }, projectId)
  await page.getByRole('tab', { name: 'AI', exact: true }).click()
  await page.getByLabel('Enable local AI for this project').check()
  await page.getByLabel('Ollama address').fill(endpoint)
  await page.getByRole('button', { name: 'Find local models' }).click()
  await expect(page.getByLabel('Local model')).toHaveValue('local-test:latest')
}
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
const task = (projectId, title) => ({
  id: `${projectId}-task`,
  projectId,
  title,
  description: '',
  status: 'todo',
  priority: 'Low',
  due: '',
  createdAt: now,
  updatedAt: now,
  completedAt: null,
})
const fixture = {
  schemaVersion: 1,
  revision: 1,
  profile: { name: 'SECRET PROFILE' },
  projects: [
    project('alpha', 'Alpha', 'Alpha notes'),
    project('beta', 'Beta', 'SECRET BETA NOTES'),
  ],
  tasks: [task('alpha', 'Existing Alpha task'), task('beta', 'SECRET BETA TASK')],
  activity: [{ id: 'beta-log', projectId: 'beta', message: 'SECRET BETA ACTIVITY', time: now }],
}
try {
  let main = await start()
  await invoke(main, 'commit_workspace', {
    expectedRevision: 0,
    workspace: fixture,
    replacement: false,
  })
  await main.evaluate(() => {
    location.hash = '/projects/alpha'
  })
  await main.getByRole('tab', { name: 'AI', exact: true }).click()
  await main.getByLabel('Enable local AI for this project').waitFor()
  assert.equal(requests.length, 0, 'AI must make no automatic requests')
  await panel(main)
  assert.ok(requests.every((r) => r.path === '/api/tags' && !r.body))
  const before = await read(main)
  await main.getByRole('button', { name: 'Generate suggestions' }).click()
  await main.getByText('Alpha project advice', { exact: true }).waitFor()
  const chat = requests.find((r) => r.path === '/api/chat').body
  assert.ok(!JSON.stringify(chat).includes('SECRET'))
  assert.ok(!JSON.stringify(chat).includes('beta-task'))
  assert.equal(chat.think, false)
  assert.equal(chat.tools, undefined)
  assert.deepEqual(await read(main), before)
  report.checks.push(
    'Opt-in only; discovery sends no project data; native prompt excludes other projects and profile; inference never writes tasks',
  )
  await main.getByLabel('Create: Approved AI task').check()
  await main.getByLabel('Update: Existing Alpha task').check()
  await main.getByRole('button', { name: 'Review 2 selected action(s)' }).click()
  await main.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.deepEqual(await read(main), before)
  await main.getByRole('button', { name: 'Review 2 selected action(s)' }).click()
  await main.getByRole('button', { name: 'Approve and save selected actions' }).click()
  await main.getByText('Approved actions saved to this project.', { exact: true }).waitFor()
  const approved = await read(main)
  assert.equal(approved.revision, before.revision + 1)
  assert.equal(approved.tasks.length, before.tasks.length + 1)
  assert.equal(approved.tasks.find((t) => t.id === 'alpha-task').priority, 'High')
  assert.deepEqual(
    approved.tasks.find((t) => t.id === 'beta-task'),
    before.tasks.find((t) => t.id === 'beta-task'),
  )
  report.checks.push(
    'Cancel review preserves data; explicit approval atomically creates and updates selected-project tasks',
  )
  await main.getByRole('button', { name: 'Generate suggestions' }).click()
  await main.getByText('Alpha project advice', { exact: true }).waitFor()
  await main.getByLabel('Create: Approved AI task').check()
  const concurrent = structuredClone(approved)
  concurrent.revision++
  concurrent.projects[0].notes = 'A concurrent edit'
  await invoke(main, 'commit_workspace', {
    expectedRevision: approved.revision,
    workspace: concurrent,
    replacement: false,
  })
  await expect(main.getByRole('button', { name: 'Review 1 selected action(s)' })).toBeDisabled()
  report.checks.push(
    'A concurrent workspace change invalidates approval instead of silently overwriting it',
  )
  for (const [testMode, message] of [
    ['invalid', 'invalid structured response'],
    ['foreign', 'out-of-project task'],
    ['failure', 'HTTP 503'],
  ]) {
    mode = testMode
    await main.getByRole('button', { name: 'Generate suggestions' }).click()
    await expect(main.getByRole('alert')).toContainText(message)
  }
  const unchanged = await read(main)
  assert.equal(unchanged.tasks.length, approved.tasks.length)
  report.checks.push(
    'Malformed responses, cross-project actions, and server failures preserve the stored workspace',
  )
  mode = 'delay'
  const chatCount = requests.filter((r) => r.path === '/api/chat').length
  await main.getByRole('button', { name: 'Generate suggestions' }).click()
  await expect.poll(() => requests.filter((r) => r.path === '/api/chat').length).toBe(chatCount + 1)
  await main.getByRole('button', { name: 'Cancel request' }).click()
  await expect.poll(() => cancelled).toBeGreaterThan(0)
  assert.deepEqual(await read(main), unchanged)
  mode = 'valid'
  await main.getByRole('button', { name: 'Generate suggestions' }).click()
  await main.getByText('Alpha project advice', { exact: true }).waitFor()
  await main.screenshot({ path: resolve(root, 'project-ai.png'), fullPage: true })
  report.checks.push(
    'Cancellation closes the native HTTP request and a later request succeeds without changing tasks',
  )
  async function direct(request) {
    const id = await invoke(main, 'ai_begin')
    return invoke(main, 'ai_request', { id, request })
  }
  await assert.rejects(() => direct({ operation: 'models', endpoint: 'https://ollama.com' }))
  mode = 'redirect'
  await assert.rejects(() => direct({ operation: 'models', endpoint }))
  assert.equal(redirects, 0)
  mode = 'cloud'
  const count = requests.filter((r) => r.path === '/api/chat').length
  await assert.rejects(() =>
    direct({
      operation: 'generate',
      endpoint,
      projectId: 'alpha',
      expectedRevision: unchanged.revision,
      model: 'local-test:latest',
      intent: 'Summary',
      question: '',
    }),
  )
  assert.equal(requests.filter((r) => r.path === '/api/chat').length, count)
  report.checks.push(
    'Native transport blocks remote destinations, redirects, and cloud-model aliases before sending project content',
  )
  mode = 'valid'
  await invoke(main, 'desktop_action', { action: 'show' })
  await expect
    .poll(() =>
      browser
        .contexts()[0]
        .pages()
        .some((p) => p.url().includes('companion=1')),
    )
    .toBe(true)
  const widget = browser
    .contexts()[0]
    .pages()
    .find((p) => p.url().includes('companion=1'))
  await widget.getByRole('main').waitFor()
  await assert.rejects(() => invoke(widget, 'ai_begin'))
  await invoke(main, 'desktop_action', { action: 'hide' })
  report.checks.push('Companion window has no AI network capability')
  await stop()
  main = await start()
  assert.deepEqual(await read(main), unchanged)
  await main.evaluate(() => {
    location.hash = '/projects/beta'
  })
  await main.getByRole('tab', { name: 'AI', exact: true }).click()
  await expect(main.getByLabel('Enable local AI for this project')).not.toBeChecked()
  assert.equal(await main.getByText('Alpha project advice', { exact: true }).count(), 0)
  report.checks.push(
    'Approved tasks survive restart; a different project starts without AI consent or another project’s response',
  )
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false
  report.failure = error.stack ?? String(error)
  process.exitCode = 1
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.screenshot({ path: resolve(root, 'failure.png'), fullPage: true })
    .catch(() => undefined)
} finally {
  await stop()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await writeFile(resolve(root, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
