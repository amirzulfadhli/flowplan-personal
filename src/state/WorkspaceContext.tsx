import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Command } from '../domain/commands'
import type { Workspace } from '../domain/model'
import { IndexedDBRepository, type WorkspaceRepository } from '../storage/repository'

const defaultRepository = new IndexedDBRepository()
type Context = {
  data: Workspace
  execute: (command: Command) => Promise<boolean>
  busy: boolean
  error: string
  clearError: () => void
}
const WorkspaceContext = createContext<Context | null>(null)
export function WorkspaceProvider({
  children,
  repository = defaultRepository,
}: {
  children: ReactNode
  repository?: WorkspaceRepository
}) {
  const [data, setData] = useState<Workspace | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)
  const channel = useRef<BroadcastChannel | null>(null)
  const accept = useCallback(
    (next: Workspace) =>
      setData((previous) => (!previous || next.revision >= previous.revision ? next : previous)),
    [],
  )
  const reload = useCallback(async () => {
    try {
      accept(await repository.read())
      setError('')
    } catch {
      setError(
        'FlowPlan could not read local storage. Check browser storage permissions, then retry. Existing data has not been replaced.',
      )
    }
  }, [repository, accept])
  useEffect(() => {
    let active = true
    void repository
      .read()
      .then((next) => {
        if (active) accept(next)
      })
      .catch(() => {
        if (active)
          setError(
            'FlowPlan could not read local storage. Check browser storage permissions, then retry. Existing data has not been replaced.',
          )
      })
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('flowplan-changes')
      channel.current.onmessage = () => {
        void reload()
      }
    }
    const focus = () => {
      void reload()
    }
    window.addEventListener('focus', focus)
    return () => {
      active = false
      channel.current?.close()
      window.removeEventListener('focus', focus)
    }
  }, [reload, repository, accept])
  const execute = useCallback(
    async (command: Command) => {
      setPending((n) => n + 1)
      try {
        accept(await repository.execute(command))
        setError('')
        channel.current?.postMessage('changed')
        return true
      } catch (error) {
        setError(
          error instanceof Error && !error.message.startsWith('[')
            ? `Changes were not saved. ${error.message}`
            : 'Changes were not saved. Check available storage and try again.',
        )
        return false
      } finally {
        setPending((n) => n - 1)
      }
    },
    [repository, accept],
  )
  if (!data)
    return (
      <main className="startup">
        <h1>FlowPlan</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn primary" onClick={() => void reload()}>
              Retry storage
            </button>
          </>
        ) : (
          <p role="status">Opening your local workspace…</p>
        )}
      </main>
    )
  return (
    <WorkspaceContext.Provider
      value={{ data, execute, busy: pending > 0, error, clearError: () => setError('') }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('WorkspaceProvider is required')
  return context
}
