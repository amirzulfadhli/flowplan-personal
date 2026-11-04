import { openDB, type IDBPDatabase } from 'idb'
import { applyCommand, type Command } from '../domain/commands'
import { emptyWorkspace, serializeBackup, workspaceSchema, type Workspace } from '../domain/model'

export interface WorkspaceRepository {
  read(): Promise<Workspace>
  execute(command: Command): Promise<Workspace>
}

export class IndexedDBRepository implements WorkspaceRepository {
  private database?: Promise<IDBPDatabase>
  constructor(private name = 'flowplan-personal') {}
  private db() {
    this.database ??= openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore('workspace')
      },
      blocking: () => {
        void this.database?.then((db) => db.close())
        this.database = undefined
      },
      terminated: () => {
        this.database = undefined
      },
    }).catch((error) => {
      this.database = undefined
      throw error
    })
    return this.database
  }
  async read() {
    const db = await this.db()
    const stored: unknown = await db.get('workspace', 'current')
    // Invalid saved data must never be silently overwritten with a fresh workspace.
    return stored === undefined ? emptyWorkspace() : workspaceSchema.parse(stored)
  }
  async execute(command: Command) {
    const db = await this.db()
    const tx = db.transaction('workspace', 'readwrite')
    try {
      const stored: unknown = await tx.store.get('current')
      const current = stored === undefined ? emptyWorkspace() : workspaceSchema.parse(stored)
      const next = applyCommand(current, command)
      serializeBackup(next)
      await tx.store.put(next, 'current')
      await tx.done
      return next
    } catch (error) {
      try {
        tx.abort()
      } catch {
        /* already aborted or completed */
      }
      await tx.done.catch(() => undefined)
      throw error
    }
  }
}
