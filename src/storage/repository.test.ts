import { describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import { IndexedDBRepository } from './repository'
import { fixture } from '../test/fixtures'
import { parseImport, serializeBackup } from '../domain/model'

describe('IndexedDB repository', () => {
  it('rejects an oversized UTF-8 write atomically and retains an importable backup', async () => {
    const repo = new IndexedDBRepository(crypto.randomUUID())
    const before = await repo.execute({ type: 'import', data: fixture() })
    const oversized = fixture()
    oversized.projects = Array.from({ length: 400 }, (_, i) => ({
      ...oversized.projects[0],
      id: `large-${i}`,
      notes: '界'.repeat(20000),
    }))
    oversized.tasks = []
    oversized.activity = []
    await expect(repo.execute({ type: 'import', data: oversized })).rejects.toThrow('20 MB')
    expect(await repo.read()).toEqual(before)
    expect(parseImport(serializeBackup(await repo.read()))).toEqual(before)
  })
  it('preserves a newer note when a stale browser tab tries to save its draft', async () => {
    const name = crypto.randomUUID()
    const repo = new IndexedDBRepository(name)
    const before = await repo.execute({ type: 'import', data: fixture() })
    const id = before.projects[0].id
    const newer = await new IndexedDBRepository(name).execute({
      type: 'notes',
      id,
      notes: 'Newer decision',
    })
    await expect(
      repo.execute({ type: 'notes', id, notes: 'Stale draft', expectedNotes: '' }),
    ).rejects.toThrow('changed in another window')
    expect(await repo.read()).toEqual(newer)
  })
  it('persists across adapter instances', async () => {
    const name = crypto.randomUUID()
    const repo = new IndexedDBRepository(name)
    const saved = await repo.execute({ type: 'import', data: fixture() })
    expect(await new IndexedDBRepository(name).read()).toEqual(saved)
  })
  it('serializes concurrent writes without dropping projects', async () => {
    const name = crypto.randomUUID()
    const a = new IndexedDBRepository(name)
    const b = new IndexedDBRepository(name)
    await Promise.all([
      a.execute({
        type: 'saveProject',
        input: { name: 'One', description: '', color: '#7d87ec', due: '' },
      }),
      b.execute({
        type: 'saveProject',
        input: { name: 'Two', description: '', color: '#6dc3a4', due: '' },
      }),
    ])
    expect((await a.read()).projects).toHaveLength(2)
    expect((await a.read()).revision).toBe(2)
  })
  it('leaves saved data intact after a failed mutation', async () => {
    const repo = new IndexedDBRepository(crypto.randomUUID())
    const before = await repo.execute({ type: 'import', data: fixture() })
    await expect(repo.execute({ type: 'notes', id: 'missing', notes: 'Nope' })).rejects.toThrow()
    expect(await repo.read()).toEqual(before)
  })
  it('rejects a replacement reviewed before another browser tab saved changes', async () => {
    const name = crypto.randomUUID()
    const repo = new IndexedDBRepository(name)
    const reviewed = await repo.execute({ type: 'import', data: fixture() })
    const newer = await new IndexedDBRepository(name).execute({
      type: 'profile',
      name: 'Preserve this newer change',
    })
    await expect(
      repo.execute({ type: 'import', data: fixture(), expectedRevision: reviewed.revision }),
    ).rejects.toThrow('Cancel and review the import again')
    expect(await repo.read()).toEqual(newer)
  })
  it('refuses to overwrite an unknown or corrupted stored schema', async () => {
    const name = crypto.randomUUID()
    const repo = new IndexedDBRepository(name)
    await repo.read()
    const db = await openDB(name, 1)
    await db.put('workspace', { schemaVersion: 900 }, 'current')
    await expect(repo.read()).rejects.toThrow()
    await expect(repo.execute({ type: 'profile', name: 'New' })).rejects.toThrow()
    expect(await db.get('workspace', 'current')).toEqual({ schemaVersion: 900 })
    db.close()
  })
})
