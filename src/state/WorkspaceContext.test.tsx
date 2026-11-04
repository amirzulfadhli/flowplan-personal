import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext'
import { emptyWorkspace } from '../domain/model'

const native = vi.hoisted(() => ({ listen: vi.fn() }))
vi.mock('../storage/desktop', () => ({ isDesktop: () => true }))
vi.mock('../storage/factory', () => ({ createRepository: () => ({}) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }))

it('subscribes before the single initial native read and still receives later commits', async () => {
  let subscribed!: () => void
  let changed!: () => void
  const stop = vi.fn()
  native.listen.mockImplementation((_event, callback) => {
    changed = callback
    return new Promise((resolve) => {
      subscribed = () => resolve(stop)
    })
  })
  let data = emptyWorkspace()
  const repo = { read: vi.fn(async () => data), execute: vi.fn() }
  function Consumer() {
    return <p>{useWorkspace().data.profile.name}</p>
  }
  const view = render(
    <WorkspaceProvider repository={repo}>
      <Consumer />
    </WorkspaceProvider>,
  )
  expect(repo.read).not.toHaveBeenCalled()
  await act(async () => subscribed())
  await screen.findByText('My workspace')
  expect(repo.read).toHaveBeenCalledTimes(1)
  data = { ...data, revision: 1, profile: { name: 'New commit' } }
  await act(async () => changed())
  await screen.findByText('New commit')
  expect(repo.read).toHaveBeenCalledTimes(2)
  view.unmount()
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
})
