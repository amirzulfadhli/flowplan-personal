import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { emptyWorkspace, parseImport } from './model'
import { chartData, progress, sortedTasks } from './selectors'
import { dateKey, dayOffset, monthDays } from './dates'
import { fixture } from '../test/fixtures'

describe('workspace commands', () => {
  it('starts with no fabricated progress', () => {
    expect(emptyWorkspace().tasks).toEqual([])
    expect(progress([])).toEqual({ total: 0, done: 0, percent: 0 })
    expect(chartData(emptyWorkspace(), 7).every((row) => row.total === 0)).toBe(true)
  })
  it('records completion, preserves it through edits, clears it when reopened', () => {
    const data = fixture()
    const task = data.tasks[0]
    const done = applyCommand(
      data,
      { type: 'saveTask', id: task.id, input: { ...task, status: 'done' } },
      '2026-01-02T12:00:00.000Z',
    )
    expect(done.tasks[0].completedAt).toBe('2026-01-02T12:00:00.000Z')
    const renamed = applyCommand(done, {
      type: 'saveTask',
      id: task.id,
      input: { ...done.tasks[0], title: 'New name' },
    })
    expect(renamed.tasks[0].completedAt).toBe(done.tasks[0].completedAt)
    const reopened = applyCommand(renamed, {
      type: 'saveTask',
      id: task.id,
      input: { ...renamed.tasks[0], status: 'review' },
    })
    expect(reopened.tasks[0].completedAt).toBeNull()
    expect(data.tasks[0].status).toBe('todo')
  })
  it('cascades project deletion without affecting another project', () => {
    const data = fixture()
    const deleted = applyCommand(data, { type: 'deleteProject', id: data.projects[0].id })
    expect(deleted.projects.map((p) => p.name)).toEqual(['Beta'])
    expect(deleted.tasks).toEqual([])
    expect(deleted.activity.every((a) => a.projectId === data.projects[1].id)).toBe(true)
  })
  it('keeps notes and activity scoped to their project', () => {
    const data = fixture()
    const next = applyCommand(data, {
      type: 'notes',
      id: data.projects[1].id,
      notes: 'A private project decision',
    })
    expect(next.projects[0].notes).toBe('')
    expect(next.activity[0].projectId).toBe(data.projects[1].id)
    expect(next.activity[0].message).toBe('Updated project notes')
  })
  it('logs task moves in both projects', () => {
    const data = fixture()
    const task = data.tasks[0]
    const next = applyCommand(data, {
      type: 'saveTask',
      id: task.id,
      input: { ...task, projectId: data.projects[1].id },
    })
    expect(new Set(next.activity.slice(0, 2).map((a) => a.projectId))).toEqual(
      new Set(data.projects.map((p) => p.id)),
    )
  })
  it('rejects editing deleted entities and orphan tasks', () => {
    const data = fixture()
    expect(() => applyCommand(data, { type: 'notes', id: 'missing', notes: '' })).toThrow()
    expect(() =>
      applyCommand(data, { type: 'saveTask', input: { ...data.tasks[0], projectId: 'missing' } }),
    ).toThrow()
    expect(() =>
      applyCommand(data, { type: 'saveTask', id: 'missing', input: data.tasks[0] }),
    ).toThrow()
  })
})
describe('backup validation', () => {
  it('round trips all data without changing IDs or timestamps', () => {
    const data = fixture()
    expect(parseImport(JSON.stringify(data))).toEqual(data)
  })
  it.each(['not JSON', '{}', '{"schemaVersion":2}'])(
    'rejects malformed or unsupported backup %s',
    (text) => expect(() => parseImport(text)).toThrow(),
  )
  it('rejects duplicate IDs, dangling references, invalid dates, and inconsistent completion', () => {
    const data = fixture()
    for (const bad of [
      { ...data, projects: [data.projects[0], data.projects[0]] },
      { ...data, tasks: [{ ...data.tasks[0], projectId: 'missing' }] },
      { ...data, tasks: [{ ...data.tasks[0], due: '2026-02-30' }] },
      { ...data, tasks: [{ ...data.tasks[0], status: 'done', completedAt: null }] },
      { ...data, projects: [{ ...data.projects[0], color: 'url(javascript:bad)' }] },
    ])
      expect(() => parseImport(JSON.stringify(bad))).toThrow()
  })
  it('replaces atomically with a monotonic local revision', () => {
    const data = fixture()
    const next = applyCommand(data, { type: 'import', data: emptyWorkspace() })
    expect(next.tasks).toEqual([])
    expect(next.revision).toBe(data.revision + 1)
  })
})
describe('dates and real analytics', () => {
  it('keeps calendar dates in local time and handles month/year boundaries', () => {
    expect(dateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
    expect(dayOffset(-1, new Date(2026, 0, 1))).toBe('2025-12-31')
    const days = monthDays(new Date(2024, 1, 1))
    expect(days).toHaveLength(42)
    expect(days[0].getDay()).toBe(1)
    expect(days.map(dateKey)).toContain('2024-02-29')
  })
  it('derives layered daily and cumulative totals, including completions before the window', () => {
    let data = fixture()
    const task = data.tasks[0]
    data = applyCommand(
      data,
      { type: 'saveTask', id: task.id, input: { ...task, status: 'done' } },
      '2026-01-02T12:00:00.000Z',
    )
    data = applyCommand(
      data,
      {
        type: 'saveTask',
        input: { ...task, title: 'Second', status: 'done', projectId: data.projects[1].id },
      },
      '2026-01-04T12:00:00.000Z',
    )
    const rows = chartData(data, 3, new Date(2026, 0, 5, 12))
    expect(rows.map((row) => row.total)).toEqual([0, 1, 0])
    expect(rows[0][`cumulative_${data.projects[0].id}`]).toBe(1)
    expect(rows[2][`cumulative_${data.projects[1].id}`]).toBe(1)
    expect(progress(data.tasks).percent).toBe(100)
  })
  it('orders open tasks by date and priority without mutating input', () => {
    const task = fixture().tasks[0]
    const tasks = [
      { ...task, id: 'done', status: 'done' as const },
      { ...task, id: 'later', due: '' },
      { ...task, id: 'first' },
    ]
    expect(sortedTasks(tasks).map((t) => t.id)).toEqual(['first', 'later', 'done'])
    expect(tasks[0].id).toBe('done')
  })
})
