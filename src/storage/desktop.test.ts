import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../domain/commands'
import { emptyWorkspace, type Workspace } from '../domain/model'
import { SQLiteRepository, type NativeInvoke } from './desktop'
import { createRepository } from './factory'
import { IndexedDBRepository } from './repository'
import { fixture } from '../test/fixtures'

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => Reflect.has(window, '__TAURI_INTERNALS__'),
  invoke: vi.fn(),
}))
afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
})
function bridge(initial = emptyWorkspace()) {
  let data = initial
  const call = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'read_workspace') return structuredClone(data)
    if (args?.expectedRevision !== data.revision) throw { code: 'CONFLICT', message: 'Changed' }
    data = structuredClone(args.workspace) as Workspace
    return data
  }) as unknown as NativeInvoke
  return { call, read: () => data }
}
describe('desktop repository boundary', () => {
  it('selects IndexedDB in browsers and SQLite only with a native bridge', () => {
    expect(createRepository()).toBeInstanceOf(IndexedDBRepository)
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
    expect(createRepository()).toBeInstanceOf(SQLiteRepository)
  })
  it('preserves shared command behavior and imported Phase 1 data', async () => {
    const native = bridge()
    const repo = new SQLiteRepository(native.call)
    const source = fixture()
    const imported = await repo.execute({ type: 'import', data: source, expectedRevision: 0 })
    expect(imported.projects).toEqual(source.projects)
    expect(imported.tasks).toEqual(source.tasks)
    expect(imported.activity).toEqual(source.activity)
    const next = await repo.execute({
      type: 'notes',
      id: imported.projects[0].id,
      notes: 'Native notes',
    })
    expect(next.projects[0].notes).toBe('Native notes')
    expect(native.read()).toEqual(next)
  })
  it('rebases an ordinary write after a revision conflict', async () => {
    const base = emptyWorkspace()
    let data = base
    let conflict = true
    const call: NativeInvoke = async <T>(command: string, args?: Record<string, unknown>) => {
      if (command === 'read_workspace') return structuredClone(data) as T
      if (conflict) {
        conflict = false
        data = applyCommand(data, {
          type: 'saveProject',
          input: { name: 'Other change', description: '', due: '', color: '#7d87ec' },
        })
        throw { code: 'CONFLICT', message: 'Changed' }
      }
      data = args?.workspace as Workspace
      return data as T
    }
    const next = await new SQLiteRepository(call).execute({ type: 'profile', name: 'Me' })
    expect(next.projects[0].name).toBe('Other change')
    expect(next.profile.name).toBe('Me')
    expect(next.revision).toBe(2)
  })
  it('does not silently retry a replacement over a concurrent edit', async () => {
    const call: NativeInvoke = async <T>(command: string) => {
      if (command === 'read_workspace') return emptyWorkspace() as T
      throw { code: 'CONFLICT', message: 'Changed' }
    }
    await expect(
      new SQLiteRepository(call).execute({ type: 'import', data: fixture(), expectedRevision: 0 }),
    ).rejects.toThrow('review the import again')
  })
  it('rejects stale confirmation and does not send a write', async () => {
    const native = bridge(fixture())
    const repo = new SQLiteRepository(native.call)
    await expect(
      repo.execute({ type: 'import', data: emptyWorkspace(), expectedRevision: 0 }),
    ).rejects.toThrow('review the import again')
    expect(native.call).toHaveBeenCalledTimes(1)
  })
  it('propagates native errors without falling back or reporting success', async () => {
    const call: NativeInvoke = async () => {
      throw { code: 'DATABASE', message: 'Disk is full' }
    }
    await expect(new SQLiteRepository(call).read()).rejects.toThrow('Disk is full')
    await expect(
      new SQLiteRepository(call).execute({ type: 'profile', name: 'Me' }),
    ).rejects.toThrow('Disk is full')
  })
  it('validates native responses before exposing them to UI', async () => {
    const call: NativeInvoke = async <T>() => ({ schemaVersion: 999 }) as T
    await expect(new SQLiteRepository(call).read()).rejects.toThrow()
  })
})
