import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { applyCommand } from '../src/domain/commands'
import { dateKey, dayOffset } from '../src/domain/dates'
import { emptyWorkspace, type Workspace } from '../src/domain/model'

// Explicit test-only demonstration data. Production never seeds a workspace.
function demoFixture() {
  let data = emptyWorkspace()
  for (const [index, name] of [
    'Demo · FilePilot',
    'Demo · BrillyPark',
    'Demo · SmartShoe',
  ].entries()) {
    data = applyCommand(data, {
      type: 'saveProject',
      input: {
        name,
        description: [
          'A lightweight Windows utility for everyday file workflows.',
          'Smart parking hardware and companion software.',
          'A wearable safety prototype with sensors and GPS.',
        ][index],
        color: ['#7d87ec', '#6dc3a4', '#eea77f'][index],
        due: dayOffset(index + 2),
      },
    })
    for (let i = 0; i < 5; i++) {
      data = applyCommand(
        data,
        {
          type: 'saveTask',
          input: {
            projectId: data.projects[index].id,
            title: [
              'Refine keyboard navigation',
              'Review installer experience',
              'Write release notes',
              'Test the next milestone',
              'Document the workflow',
            ][i],
            description: 'Check clarity, reliability, and the smallest useful next step.',
            status: i < index + 1 ? 'done' : i === 3 ? 'doing' : i === 4 ? 'review' : 'todo',
            priority: i === 3 ? 'High' : 'Medium',
            due: dayOffset(i - 2),
          },
        },
        new Date(`${dayOffset(i - 5)}T12:00:00`).toISOString(),
      )
    }
  }
  return data
}
async function importBackup(page: Page, data: Workspace) {
  await page.goto('/#/settings')
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'explicit-demo-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('checkbox', { name: 'I have a backup' }).check()
  await page.getByRole('button', { name: 'Replace workspace' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByText('Backup restored successfully.')).toBeVisible()
}
async function createProject(page: Page, name: string) {
  await page.goto('/#/projects')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name', { exact: true }).fill(name)
  await page.getByLabel('Description', { exact: true }).fill('A real local project')
  await page.getByLabel('Project deadline').fill(dateKey())
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}
async function addTask(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Task title').fill(title)
  await dialog.getByLabel('Due date').fill(dateKey())
  await dialog.getByLabel('Priority').selectOption('High')
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}
test('project AI is opt-in, scoped, reviewable, and persists only approved browser tasks', async ({
  page,
}) => {
  const data = demoFixture()
  const projectId = data.projects[0].id
  const calls: string[] = []
  await page.route('http://127.0.0.1:11434/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    calls.push(path)
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    let json: unknown
    if (path === '/api/tags')
      json = {
        models: [
          { name: 'local-test:latest', size: 100, digest: 'test', details: { format: 'gguf' } },
        ],
      }
    else if (path === '/api/show') json = { model_info: {}, capabilities: ['completion'] }
    else {
      const body = route.request().postDataJSON()
      expect(body.messages[1].content).toContain(projectId)
      expect(body.messages[1].content).not.toContain(data.projects[1].id)
      expect(body.messages[1].content).not.toContain(data.projects[2].name)
      json = {
        done: true,
        message: {
          content: JSON.stringify({
            summary: 'Browser project advice',
            reasoningSummary: 'Based on the selected project.',
            actions: [
              {
                kind: 'create',
                taskId: null,
                title: 'Approved browser AI task',
                description: 'Local test suggestion',
                due: '',
                status: 'todo',
                priority: 'Medium',
                reason: 'A suggested next step',
              },
            ],
          }),
        },
      }
    }
    await route.fulfill({ headers, json })
  })
  await importBackup(page, data)
  await page.goto(`/#/projects/${projectId}`)
  await page.getByRole('tab', { name: 'AI', exact: true }).click()
  await expect(page.getByLabel('Enable local AI for this project')).not.toBeChecked()
  expect(calls).toHaveLength(0)
  await page.getByLabel('Enable local AI for this project').check()
  await page.getByRole('button', { name: 'Find local models' }).click()
  await expect(page.getByLabel('Local model')).toHaveValue('local-test:latest')
  await page.getByRole('button', { name: 'Generate suggestions' }).click()
  await expect(page.getByText('Browser project advice', { exact: true })).toBeVisible()
  await page.getByLabel('Create: Approved browser AI task').check()
  await page.getByRole('button', { name: 'Review 1 selected action(s)' }).click()
  await page.getByRole('button', { name: 'Approve and save selected actions' }).click()
  await expect(page.getByText('Approved actions saved to this project.')).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Tasks', exact: false }).click()
  await expect(
    page.getByRole('button', { name: 'Approved browser AI task', exact: true }),
  ).toBeVisible()
  await page.goto(`/#/projects/${data.projects[1].id}`)
  await page.getByRole('tab', { name: 'AI', exact: true }).click()
  await expect(page.getByLabel('Enable local AI for this project')).not.toBeChecked()
  await expect(page.getByText('Browser project advice', { exact: true })).toHaveCount(0)
})
test('creates, edits, moves, completes, persists, and deletes real work', async ({ page }) => {
  await createProject(page, 'My first project')
  await page.goto('/#/tasks')
  await addTask(page, 'Ship Phase 1')
  await page.getByRole('button', { name: 'Ship Phase 1', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Task title').fill('Ship a useful first version')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.goto('/#/board')
  const task = page.locator('.kanban-task').filter({ hasText: 'Ship a useful first version' })
  await task.dragTo(page.getByRole('region', { name: 'In progress', exact: true }))
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('button', { name: 'Ship a useful first version' }),
  ).toBeVisible()
  await page.getByLabel('Status of Ship a useful first version').selectOption('done')
  await page.reload()
  await expect(
    page
      .getByRole('region', { name: 'Done', exact: true })
      .getByRole('button', { name: 'Ship a useful first version' }),
  ).toBeVisible()
  await page.goto('/#/insights')
  await expect(page.getByText('100%', { exact: true }).first()).toBeVisible()
  await page.goto('/#/tasks')
  await page.getByRole('button', { name: 'Ship a useful first version', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete task', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Ship a useful first version', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Your projects' })
    .getByRole('link', { name: 'My first project' })
    .click()
  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByLabel('Project name', { exact: true }).fill('Renamed project')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Renamed project', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit project' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete project', exact: true }).click()
  await expect(page.getByText('This project no longer exists.')).toBeVisible()
})
test('keeps notes and activity isolated and includes project deadlines in calendar', async ({
  page,
}) => {
  const data = demoFixture()
  await importBackup(page, data)
  await page.goto(`/#/projects/${data.projects[0].id}`)
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await page
    .getByLabel('Project notes', { exact: true })
    .fill('Decision: keep this project offline.')
  await page.getByRole('button', { name: 'Save notes' }).click()
  await expect(page.getByText('Notes saved on this device.')).toBeVisible()
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByText('Updated project notes', { exact: true })).toBeVisible()
  await page.goto(`/#/projects/${data.projects[1].id}`)
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByText('Updated project notes', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await expect(page.getByLabel('Project notes', { exact: true })).toHaveValue('')
  await page.goto('/#/calendar')
  await page.getByLabel('Calendar project').selectOption(data.projects[0].id)
  await expect(
    page.getByRole('button', { name: /Demo · FilePilot deadline/ }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.locator('.day.today')).toHaveCount(1)
})
test('exports and restores full backups and rejects invalid imports without losing data', async ({
  page,
}) => {
  const data = demoFixture()
  await importBackup(page, data)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const download = await pending
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8')) as Workspace
  expect(exported.projects).toEqual(data.projects)
  expect(exported.tasks).toEqual(data.tasks)
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  })
  await expect(page.getByRole('alert')).toContainText('not a valid FlowPlan v1 backup')
  await expect(
    page.getByRole('navigation', { name: 'Your projects' }).getByRole('link'),
  ).toHaveCount(3)
  await importBackup(page, emptyWorkspace())
  await expect(
    page.getByRole('navigation', { name: 'Your projects' }).getByRole('link'),
  ).toHaveCount(0)
  await importBackup(page, exported)
  await page.reload()
  await expect(
    page.getByRole('navigation', { name: 'Your projects' }).getByRole('link'),
  ).toHaveCount(3)
})
test('reopens offline with saved data and cached analytics', async ({ page, context }) => {
  const data = demoFixture()
  await importBackup(page, data)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/#/insights')
  await expect(page.getByRole('heading', { name: 'Project completion over time' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Project completion over time' })).toBeVisible()
  await page.goto('/#/tasks')
  await expect(
    page.getByRole('button', { name: 'Refine keyboard navigation', exact: true }),
  ).toHaveCount(3)
  await context.setOffline(false)
})
test('updates another open tab after a saved change', async ({ page, context }) => {
  await createProject(page, 'Shared local workspace')
  const second = await context.newPage()
  await second.goto('/#/projects')
  await expect(
    second
      .getByRole('navigation', { name: 'Your projects' })
      .getByRole('link', { name: 'Shared local workspace' }),
  ).toBeVisible()
  await page.goto('/#/tasks')
  await addTask(page, 'Visible across tabs')
  await second.goto('/#/tasks')
  await expect(
    second.getByRole('button', { name: 'Visible across tabs', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Status of Visible across tabs').selectOption('done')
  await expect(second.getByLabel('Status of Visible across tabs')).toHaveValue('done')
  await second.close()
})
test('renders desktop and mobile routes without page overflow or runtime errors', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const data = demoFixture()
  await importBackup(page, data)
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of [
      '/',
      '/projects',
      '/tasks',
      '/board',
      '/calendar',
      '/insights',
      `/projects/${data.projects[0].id}`,
      '/settings',
    ]) {
      await page.goto(`/#${path}`)
      await expect(page.locator('main h1')).toBeVisible()
      if (width > 700) {
        await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0)
      }
      if (path === '/insights')
        await expect(
          page.getByRole('heading', { name: 'Project completion over time' }),
        ).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${path} at ${width}px`,
      ).toBe(true)
      if (
        (width === 1440 && ['/', '/calendar', '/insights'].includes(path)) ||
        (width === 390 && path === '/board')
      ) {
        await page.screenshot({
          path: testInfo.outputPath(`demo-${width}-${path.replaceAll('/', '') || 'home'}.png`),
          fullPage: true,
        })
      }
    }
  }
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Insights' })
    .click()
  await expect(page.getByRole('heading', { name: 'Insights', exact: true })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog').getByLabel('Search workspace').fill('FilePilot')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Demo · FilePilot Project/ })
    .click()
  await expect(page.getByRole('heading', { name: 'Demo · FilePilot', exact: true })).toBeVisible()
  const previousUrl = page.url()
  await page.getByRole('link', { name: 'Skip to content' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
  expect(page.url()).toBe(previousUrl)
})
