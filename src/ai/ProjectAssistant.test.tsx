import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import { IndexedDBRepository } from '../storage/repository'
import { fixture } from '../test/fixtures'
import ProjectAssistant from './ProjectAssistant'
import { generate, listModels } from './client'

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  generate: vi.fn(),
  listModels: vi.fn(),
}))
const proposal = {
  kind: 'create',
  taskId: null,
  title: 'AI proposed task',
  description: 'Reviewed description',
  status: 'todo',
  priority: 'High',
  due: '',
  reason: 'A suggested next step.',
}
beforeEach(() => {
  localStorage.clear()
  vi.mocked(listModels).mockResolvedValue(['local:latest'])
  vi.mocked(generate).mockResolvedValue(
    JSON.stringify({
      summary: '<script>unsafe()</script>',
      reasoningSummary: 'Evidence from this project.',
      actions: [proposal],
    }),
  )
})
it('does nothing until enabled, renders text safely, and saves only after explicit selection and confirmation', async () => {
  const user = userEvent.setup(),
    repo = new IndexedDBRepository(`ai-ui-${crypto.randomUUID()}`)
  const data = await repo.execute({ type: 'import', data: fixture() })
  render(
    <WorkspaceProvider repository={repo}>
      <ProjectAssistant projectId={data.projects[0].id} />
    </WorkspaceProvider>,
  )
  await screen.findByText('Enable local AI for this project')
  expect(generate).not.toHaveBeenCalled()
  expect(listModels).not.toHaveBeenCalled()
  await user.click(screen.getByLabelText('Enable local AI for this project'))
  await user.click(screen.getByRole('button', { name: 'Find local models' }))
  await user.click(screen.getByRole('button', { name: 'Generate suggestions' }))
  expect(await screen.findByText('<script>unsafe()</script>')).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
  expect(await repo.read()).toEqual(data)
  await user.click(screen.getByLabelText('Create: AI proposed task'))
  await user.click(screen.getByRole('button', { name: 'Review 1 selected action(s)' }))
  expect(await repo.read()).toEqual(data)
  await user.click(screen.getByRole('button', { name: 'Approve and save selected actions' }))
  await screen.findByText('Approved actions saved to this project.')
  expect((await repo.read()).tasks.at(-1)?.title).toBe('AI proposed task')
})
it('cancels and discards late answers when leaving the project panel', async () => {
  const user = userEvent.setup(),
    repo = new IndexedDBRepository(`ai-cancel-${crypto.randomUUID()}`)
  const data = await repo.execute({ type: 'import', data: fixture() })
  let signal: AbortSignal | undefined
  let finish: (value: string) => void = () => {}
  vi.mocked(generate).mockImplementation(async (...args) => {
    signal = args[6]
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  const view = render(
    <WorkspaceProvider repository={repo}>
      <ProjectAssistant projectId={data.projects[0].id} />
    </WorkspaceProvider>,
  )
  await user.click(await screen.findByLabelText('Enable local AI for this project'))
  await user.click(screen.getByRole('button', { name: 'Find local models' }))
  await user.click(screen.getByRole('button', { name: 'Generate suggestions' }))
  await user.click(screen.getByRole('button', { name: 'Cancel request' }))
  expect(signal?.aborted).toBe(true)
  await act(async () =>
    finish(JSON.stringify({ summary: 'Late answer', reasoningSummary: 'Late', actions: [] })),
  )
  expect(screen.queryByText('Late answer')).not.toBeInTheDocument()
  expect(await repo.read()).toEqual(data)
  await user.click(screen.getByRole('button', { name: 'Generate suggestions' }))
  view.unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () =>
    finish(JSON.stringify({ summary: 'After leaving', reasoningSummary: 'Late', actions: [] })),
  )
})
