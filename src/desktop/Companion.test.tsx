import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import Companion from './Companion'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import { fixture } from '../test/fixtures'
import { useCompanion, type CompanionState } from './bridge'

const events = vi.hoisted(() => ({ capture: () => {} }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name, handler) => {
    if (name === 'companion-capture') events.capture = handler
    return () => {}
  }),
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ isFocused: async () => false }),
}))
vi.mock('./bridge', async (original) => ({
  ...(await original<typeof import('./bridge')>()),
  useCompanion: vi.fn(),
}))
it('retains Quick Add focus intent when the native event precedes the expanded input', async () => {
  let state: CompanionState = {
    revision: 0,
    projectId: null,
    taskId: null,
    alwaysOnTop: false,
    closeToTray: true,
    shortcut: '',
    shortcutError: null,
    visible: true,
    expanded: false,
    position: null,
    durationMinutes: 25,
    remainingMs: 1500000,
    endsAt: null,
  }
  vi.mocked(useCompanion).mockImplementation(() => ({
    state,
    error: '',
    busy: false,
    update: vi.fn(),
    action: vi.fn(),
    refresh: vi.fn(),
  }))
  const repository = { read: async () => fixture(), execute: vi.fn() }
  const ui = () => (
    <WorkspaceProvider repository={repository}>
      <Companion />
    </WorkspaceProvider>
  )
  const view = render(ui())
  await screen.findByRole('button', { name: 'Expand companion' })
  await act(async () => events.capture())
  state = { ...state, expanded: true, revision: 1 }
  view.rerender(ui())
  expect(await screen.findByLabelText('Quick task')).toHaveFocus()
})
