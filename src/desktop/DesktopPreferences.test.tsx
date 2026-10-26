import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import DesktopPreferences from './DesktopPreferences'
import { useCompanion, type CompanionState } from './bridge'

vi.mock('./bridge', () => ({ useCompanion: vi.fn() }))
const initial: CompanionState = {
  revision: 1,
  projectId: null,
  taskId: null,
  alwaysOnTop: false,
  closeToTray: true,
  shortcut: 'Control+Shift+Space',
  shortcutError: null,
  visible: false,
  expanded: false,
  position: null,
  durationMinutes: 25,
  remainingMs: 1500000,
  endsAt: null,
}
let current: CompanionState
const update = vi.fn()
beforeEach(() => {
  current = { ...initial }
  update.mockReset().mockResolvedValue(true)
  vi.mocked(useCompanion).mockImplementation(() => ({
    state: current,
    error: '',
    busy: false,
    update,
    action: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  }))
})
it('retains a draft when another window changes preferences and requires explicit reload', async () => {
  const user = userEvent.setup()
  const view = render(<DesktopPreferences />)
  const shortcut = screen.getByLabelText('Global Quick Add shortcut')
  await user.clear(shortcut)
  await user.type(shortcut, 'Control+Shift+F8')
  current = { ...current, revision: 2, alwaysOnTop: true }
  view.rerender(<DesktopPreferences />)
  expect(shortcut).toHaveValue('Control+Shift+F8')
  expect(screen.getByRole('alert')).toHaveTextContent('Settings changed in another window')
  expect(screen.getByRole('button', { name: 'Save companion settings' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Reload companion settings' }))
  expect(screen.getByLabelText('Global Quick Add shortcut')).toHaveValue(initial.shortcut)
  expect(screen.getByLabelText('Keep widget above other windows')).toBeChecked()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('keeps the save confirmation after receiving its own settings update', async () => {
  const user = userEvent.setup()
  const view = render(<DesktopPreferences />)
  await user.click(screen.getByLabelText('Keep widget above other windows'))
  await user.click(screen.getByRole('button', { name: 'Save companion settings' }))
  current = { ...current, revision: 2, alwaysOnTop: true }
  view.rerender(<DesktopPreferences />)
  expect(screen.getByRole('status')).toHaveTextContent('Companion settings saved')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ expectedRevision: 1, alwaysOnTop: true }),
  )
})
