import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import { IndexedDBRepository, type WorkspaceRepository } from '../storage/repository'
import { fixture } from '../test/fixtures'
import { emptyWorkspace } from '../domain/model'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false],
    needRefresh: [false],
    updateServiceWorker: vi.fn(),
  }),
}))
function mount(repository: WorkspaceRepository, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceProvider repository={repository}>
        <App />
      </WorkspaceProvider>
    </MemoryRouter>,
  )
}
describe('user workflows', () => {
  it('keeps a notes draft during an external change and requires loading the newer notes', async () => {
    const user = userEvent.setup()
    const repo = new IndexedDBRepository(crypto.randomUUID())
    const source = fixture()
    const id = source.projects[0].id
    await repo.execute({ type: 'import', data: source })
    mount(repo, `/projects/${id}`)
    await user.click(await screen.findByRole('tab', { name: 'Notes' }))
    await user.type(screen.getByLabelText('Project notes'), 'My draft')
    await repo.execute({ type: 'notes', id, notes: 'New external decision' })
    await act(async () => window.dispatchEvent(new Event('focus')))
    await screen.findByRole('button', { name: 'Load latest notes' })
    expect(screen.getByLabelText('Project notes')).toHaveValue('My draft')
    expect(screen.getByRole('button', { name: 'Save notes' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Load latest notes' }))
    expect(screen.getByLabelText('Project notes')).toHaveValue('New external decision')
    await user.type(screen.getByLabelText('Project notes'), ' plus reviewed detail')
    await user.click(screen.getByRole('button', { name: 'Save notes' }))
    await waitFor(async () =>
      expect((await repo.read()).projects[0].notes).toBe(
        'New external decision plus reviewed detail',
      ),
    )
  })
  it('bounds task rows while preserving pagination, search, and editing', async () => {
    const user = userEvent.setup()
    const data = fixture()
    data.tasks = Array.from({ length: 205 }, (_, i) => ({
      ...data.tasks[0],
      id: `task-${i}`,
      title: `Task ${String(i).padStart(3, '0')}`,
    }))
    const repo = new IndexedDBRepository(crypto.randomUUID())
    await repo.execute({ type: 'import', data })
    mount(repo, '/tasks')
    await screen.findByRole('button', { name: 'Task 000' })
    expect(screen.queryByRole('button', { name: 'Task 100' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next tasks' }))
    await user.click(screen.getByRole('button', { name: 'Next tasks' }))
    expect(screen.getByRole('button', { name: 'Next tasks' })).toBeDisabled()
    await user.click(screen.getByLabelText('Search tasks'))
    await user.paste('Task 050')
    await user.click(screen.getByRole('button', { name: 'Task 050' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Task title')).toHaveValue('Task 050')
  }, 15000)
  it('creates a real project and task from an empty workspace', async () => {
    const user = userEvent.setup()
    const repo = new IndexedDBRepository(crypto.randomUUID())
    mount(repo)
    await user.click(await screen.findByRole('button', { name: 'Create your first project' }))
    await user.type(screen.getByLabelText('Project name'), 'My app')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    await screen.findByRole('link', { name: 'My app' })
    await user.type(screen.getByLabelText('Quick task title'), 'Ship a small feature')
    await user.click(screen.getByRole('button', { name: 'Add ↵' }))
    expect(await screen.findByRole('button', { name: 'Ship a small feature' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Complete Ship a small feature' }))
    await waitFor(async () => expect((await repo.read()).tasks[0].status).toBe('done'))
    expect(
      screen
        .getAllByRole('progressbar')
        .every((bar) => bar.getAttribute('aria-valuenow') === '100'),
    ).toBe(true)
  })
  it('edits priorities and workflow status through the task dialog', async () => {
    const user = userEvent.setup()
    const repo = new IndexedDBRepository(crypto.randomUUID())
    await repo.execute({ type: 'import', data: fixture() })
    mount(repo, '/tasks')
    await user.click(await screen.findByRole('button', { name: 'Build the thing' }))
    const modal = screen.getByRole('dialog')
    await user.selectOptions(within(modal).getByLabelText('Status'), 'review')
    await user.selectOptions(within(modal).getByLabelText('Priority'), 'Low')
    await user.click(within(modal).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await repo.read()).tasks[0]).toMatchObject({ status: 'review', priority: 'Low' })
  })
  it('shows a save failure without pretending data was saved or closing the editor', async () => {
    const user = userEvent.setup()
    const repo = {
      read: async () => emptyWorkspace(),
      execute: async () => {
        throw new Error('Storage quota exceeded')
      },
    }
    mount(repo)
    await user.click(await screen.findByRole('button', { name: 'Create your first project' }))
    await user.type(screen.getByLabelText('Project name'), 'Not yet saved')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
      'Changes were not saved',
    )
    expect(screen.getByLabelText('Project name')).toHaveValue('Not yet saved')
  })
  it('offers recovery when storage cannot be read', async () => {
    mount({
      read: async () => {
        throw new Error('Denied')
      },
      execute: vi.fn(),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Existing data has not been replaced',
    )
    expect(screen.getByRole('button', { name: 'Retry storage' })).toBeVisible()
  })
})
