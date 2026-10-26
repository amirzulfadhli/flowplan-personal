import { invoke, isTauri } from '@tauri-apps/api/core'
import { applyCommand, type Command } from '../domain/commands'
import { workspaceSchema, type Workspace } from '../domain/model'
import type { WorkspaceRepository } from './repository'

export const isDesktop = () => isTauri()
export type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type NativeError = { code: string; message: string }
function isNativeError(error: unknown): error is NativeError {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.message === 'string'
  )
}
export function nativeError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(isNativeError(error) ? error.message : String(error))
}

/** Applies the shared domain commands, then atomically compares and commits revisions in SQLite. */
export class SQLiteRepository implements WorkspaceRepository {
  constructor(private call: NativeInvoke = invoke) {}
  async read(): Promise<Workspace> {
    try {
      return workspaceSchema.parse(await this.call('read_workspace'))
    } catch (error) {
      throw nativeError(error)
    }
  }
  async execute(command: Command): Promise<Workspace> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await this.read()
      const next = applyCommand(current, command)
      try {
        return workspaceSchema.parse(
          await this.call('commit_workspace', {
            expectedRevision: current.revision,
            workspace: next,
            replacement: command.type === 'import',
          }),
        )
      } catch (error) {
        if (isNativeError(error) && error.code === 'CONFLICT') {
          // Replacement must never rebase itself over data the user has not reviewed.
          if (command.type === 'import')
            throw new Error('The workspace changed. Cancel and review the import again.', {
              cause: error,
            })
          continue
        }
        throw nativeError(error)
      }
    }
    throw new Error('The workspace is busy in another window. Please retry your change.')
  }
}
export interface RecoveryCopy {
  id: number
  createdAt: string
  sourceRevision: number
}
export interface StorageInfo {
  path: string
  databaseVersion: number
}
export async function desktopInfo() {
  try {
    return await invoke<StorageInfo>('storage_info')
  } catch (error) {
    throw nativeError(error)
  }
}
export async function recoveryCopies() {
  try {
    return await invoke<RecoveryCopy[]>('list_recovery')
  } catch (error) {
    throw nativeError(error)
  }
}
export async function readRecovery(id: number) {
  try {
    return workspaceSchema.parse(await invoke('read_recovery', { id }))
  } catch (error) {
    throw nativeError(error)
  }
}
export async function exportDesktopBackup(): Promise<boolean> {
  try {
    return (await invoke<string | null>('export_backup')) !== null
  } catch (error) {
    throw nativeError(error)
  }
}
