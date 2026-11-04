import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'
import { nativeError } from '../storage/desktop'

export interface CompanionState {
  revision: number
  projectId: string | null
  taskId: string | null
  alwaysOnTop: boolean
  closeToTray: boolean
  shortcut: string
  shortcutError: string | null
  visible: boolean
  expanded: boolean
  position: [number, number] | null
  durationMinutes: number
  remainingMs: number
  endsAt: number | null
}
export type CompanionUpdate =
  | { type: 'project' | 'task'; id: string | null }
  | { type: 'timer'; action: 'start' | 'pause' | 'reset' | 'duration'; minutes?: number }
  | {
      type: 'preferences'
      alwaysOnTop: boolean
      closeToTray: boolean
      shortcut: string
      expectedRevision: number
    }
export const desktopAction = (action: string) => invoke<void>('desktop_action', { action })
export function remainingSeconds(
  state: Pick<CompanionState, 'endsAt' | 'remainingMs'>,
  now: number,
) {
  return Math.ceil(
    Math.max(0, state.endsAt === null ? state.remainingMs : state.endsAt - now) / 1000,
  )
}
export function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
export function useCompanion() {
  const [state, setState] = useState<CompanionState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const accept = useCallback(
    (next: CompanionState) =>
      setState((old) => (!old || next.revision >= old.revision ? next : old)),
    [],
  )
  const refresh = useCallback(async () => {
    try {
      accept(await invoke<CompanionState>('companion_read'))
      setError('')
    } catch (error) {
      setError(nativeError(error).message)
    }
  }, [accept])
  useEffect(() => {
    let active = true
    const subscriptions = [
      listen<CompanionState>('companion-changed', (event) => {
        if (active) accept(event.payload)
      }),
      listen<string>('desktop-error', (event) => {
        if (active) setError(event.payload)
      }),
    ]
    void Promise.all(subscriptions)
      .then(() => {
        if (active) void refresh()
      })
      .catch((error) => {
        if (active) setError(nativeError(error).message)
      })
    return () => {
      active = false
      subscriptions.forEach((p) => {
        void p.then((stop) => stop()).catch(() => undefined)
      })
    }
  }, [accept, refresh])
  async function update(update: CompanionUpdate) {
    setBusy(true)
    try {
      accept(await invoke<CompanionState>('companion_update', { update }))
      setError('')
      return true
    } catch (error) {
      setError(nativeError(error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  async function action(name: string) {
    try {
      await desktopAction(name)
      setError('')
    } catch (error) {
      setError(nativeError(error).message)
    }
  }
  return { state, error, busy, update, action, refresh }
}
