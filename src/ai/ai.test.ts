import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixture } from '../test/fixtures'
import { applyCommand } from '../domain/commands'
import { IndexedDBRepository } from '../storage/repository'
import { SQLiteRepository, type NativeInvoke } from '../storage/desktop'
import { localEndpoint, localModels, generate, listModels } from './client'
import { projectContext, parseAnswer, type Proposal } from './protocol'

const proposal: Proposal = {
  kind: 'create',
  taskId: null,
  title: 'Plan implementation',
  description: 'Check the local requirements',
  priority: 'Medium',
  status: 'todo',
  due: '',
  reason: 'The next concrete step.',
}
const answer = {
  summary: 'Project summary',
  reasoningSummary: 'Based on saved tasks.',
  actions: [proposal],
}
afterEach(() => vi.unstubAllGlobals())
describe('AI boundaries', () => {
  it('includes only the selected project, tasks, notes, and activity, never profile data', () => {
    let data = fixture()
    const alpha = data.projects[0].id,
      beta = data.projects[1].id
    data = applyCommand(data, { type: 'notes', id: beta, notes: 'SECRET BETA' })
    data = applyCommand(data, {
      type: 'saveTask',
      input: {
        projectId: beta,
        title: 'SECRET TASK',
        description: '',
        priority: 'Low',
        status: 'todo',
        due: '',
      },
    })
    data.profile.name = 'SECRET PROFILE'
    const context = JSON.stringify(projectContext(data, alpha))
    expect(context).toContain('Build the thing')
    expect(context).not.toContain('SECRET')
    expect(context).not.toContain(beta)
    expect(() => projectContext(data, 'missing')).toThrow('no longer exists')
    data.projects[0].notes = 'x'.repeat(60_000)
    expect(() => projectContext(data, alpha)).toThrow('60 KB')
  })
  it.each([
    'https://ollama.com',
    'http://192.168.0.1:11434',
    'http://127.0.0.1.evil.com',
    'http://user:pass@127.0.0.1',
    'http://127.1',
    'http://2130706433',
    'http://localhost/api',
    'http://localhost?x=1',
    'http://localhost:0',
  ])('rejects unsafe endpoint %s', (value) => {
    expect(() => localEndpoint(value)).toThrow()
  })
  it('canonicalizes loopback and filters cloud aliases and incomplete model metadata', () => {
    expect(localEndpoint('http://localhost:11434/')).toBe('http://127.0.0.1:11434')
    const local = { name: 'local:latest', size: 123, digest: 'abc', details: { format: 'gguf' } }
    expect(
      localModels({
        models: [
          local,
          { ...local, name: 'alias', remote_host: 'https://ollama.com' },
          { ...local, name: 'model:cloud' },
          { name: 'unknown' },
        ],
      }),
    ).toEqual(['local:latest'])
  })
  it('rejects malformed, extra-field, cross-project, duplicate, and invalid date proposals', () => {
    const data = fixture(),
      id = data.projects[0].id
    expect(parseAnswer(JSON.stringify(answer), data, id)).toEqual(answer)
    for (const raw of [
      'not json',
      JSON.stringify({ ...answer, execute: true }),
      JSON.stringify({ ...answer, actions: [{ ...proposal, projectId: data.projects[1].id }] }),
      JSON.stringify({ ...answer, actions: [{ ...proposal, due: '2026-02-30' }] }),
      JSON.stringify({ ...answer, actions: [{ ...proposal, kind: 'update', taskId: 'unknown' }] }),
    ])
      expect(() => parseAnswer(raw, data, id)).toThrow()
    const update = { ...proposal, kind: 'update', taskId: data.tasks[0].id }
    expect(() =>
      parseAnswer(JSON.stringify({ ...answer, actions: [update, update] }), data, id),
    ).toThrow('duplicate')
  })
  it('applies only approved actions atomically, refuses stale reviews, and cannot edit another project', async () => {
    const repo = new IndexedDBRepository(`ai-${crypto.randomUUID()}`)
    let data = await repo.execute({ type: 'import', data: fixture() })
    const id = data.projects[0].id
    const before = await repo.read()
    await expect(
      repo.execute({
        type: 'approveAiActions',
        projectId: data.projects[1].id,
        expectedRevision: data.revision,
        actions: [proposal, { ...proposal, kind: 'update', taskId: data.tasks[0].id }],
      }),
    ).rejects.toThrow('within this project')
    expect(await repo.read()).toEqual(before)
    data = await repo.execute({
      type: 'approveAiActions',
      projectId: id,
      expectedRevision: data.revision,
      actions: [proposal],
    })
    expect(data.tasks.at(-1)?.projectId).toBe(id)
    expect(data.revision).toBe(before.revision + 1)
    await expect(
      repo.execute({
        type: 'approveAiActions',
        projectId: id,
        expectedRevision: before.revision,
        actions: [proposal],
      }),
    ).rejects.toThrow('workspace changed')
    expect(await repo.read()).toEqual(data)
  })
  it('never rebases an approved desktop action over a competing write', async () => {
    const data = fixture()
    const call = vi.fn(async (command: string) => {
      if (command === 'read_workspace') return data
      throw { code: 'CONFLICT', message: 'Changed' }
    })
    await expect(
      new SQLiteRepository(call as NativeInvoke).execute({
        type: 'approveAiActions',
        projectId: data.projects[0].id,
        expectedRevision: data.revision,
        actions: [proposal],
      }),
    ).rejects.toThrow('fresh AI suggestions')
    expect(call).toHaveBeenCalledTimes(2)
  })
  it('sends no project data during discovery and blocks remote model aliases before chat', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'remote-alias',
              remote_host: 'https://ollama.com',
              size: 123,
              digest: 'abc',
              details: { format: 'gguf' },
            },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    const data = fixture(),
      signal = new AbortController().signal
    expect(await listModels('http://localhost:11434', signal)).toEqual([])
    expect(fetch.mock.calls[0][1].body).toBeUndefined()
    fetch.mockResolvedValue(new Response(JSON.stringify({ models: [] })))
    await expect(
      generate(
        data,
        data.projects[0].id,
        'http://localhost:11434',
        'remote-alias',
        'Summary',
        '',
        signal,
      ),
    ).rejects.toThrow('cloud models')
    expect(fetch.mock.calls.every((call) => String(call[0]).endsWith('/api/tags'))).toBe(true)
  })
  it('uses bounded local chat with no tools, credentials, redirects, history, or hidden thinking', async () => {
    const data = fixture()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: 'local:latest', size: 123, digest: 'abc', details: { format: 'gguf' } },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ model_info: {}, capabilities: ['completion'] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ done: true, message: { content: JSON.stringify(answer) } })),
      )
    vi.stubGlobal('fetch', fetch)
    await generate(
      data,
      data.projects[0].id,
      'http://localhost:11434',
      'local:latest',
      'Summary',
      '',
      new AbortController().signal,
    )
    const options = fetch.mock.calls[2][1]
    expect(options.credentials).toBe('omit')
    expect(options.redirect).toBe('error')
    const body = JSON.parse(options.body)
    expect(body.think).toBe(false)
    expect(body.tools).toBeUndefined()
    expect(body.messages).toHaveLength(2)
    expect(body.messages[1].content).not.toContain(data.projects[1].id)
  })
  it('handles HTTP failure and cancellation without mutation or automatic retries', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await expect(
      listModels('http://localhost:11434', new AbortController().signal),
    ).rejects.toThrow('HTTP 503')
    fetch.mockImplementation((_url, options) => {
      options.signal.throwIfAborted()
      return Promise.resolve(new Response('{}'))
    })
    const abort = new AbortController()
    abort.abort()
    await expect(listModels('http://localhost:11434', abort.signal)).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
