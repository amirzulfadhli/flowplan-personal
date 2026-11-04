import { invoke } from '@tauri-apps/api/core'
import { isDesktop, nativeError } from '../storage/desktop'
import type { Workspace } from '../domain/model'
import { projectContext, type Intent } from './protocol'
import prompt from './prompt.json'

export const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434'
export function localEndpoint(value: string) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?\/?$/.test(value.trim()))
    throw new Error(
      'Use a local Ollama address, such as http://127.0.0.1:11434. Remote hosts, credentials, and paths are not allowed.',
    )
  const url = new URL(value.trim().replace('localhost', '127.0.0.1'))
  if (url.port === '0') throw new Error('Choose a port from 1 to 65535.')
  return url.origin
}
type Model = {
  name?: unknown
  size?: unknown
  digest?: unknown
  remote_host?: unknown
  remote_model?: unknown
  details?: { format?: unknown }
}
export function localModels(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || !('models' in raw) || !Array.isArray(raw.models))
    throw new Error('Ollama returned an invalid model list.')
  return raw.models
    .filter(
      (m: Model) =>
        m &&
        typeof m.name === 'string' &&
        m.name.length > 0 &&
        m.name.length <= 200 &&
        !/cloud/i.test(m.name) &&
        (m.remote_host == null || m.remote_host === '') &&
        (m.remote_model == null || m.remote_model === '') &&
        typeof m.size === 'number' &&
        m.size > 0 &&
        typeof m.digest === 'string' &&
        m.digest.length > 0 &&
        m.details?.format === 'gguf',
    )
    .map((m: Model) => m.name as string)
}
async function json(endpoint: string, path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`${localEndpoint(endpoint)}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new Error(
      `Ollama returned HTTP ${response.status}. Check the model and local server, then retry.`,
    )
  if (!response.body) throw new Error('Ollama returned an empty response.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 1_000_000) throw new Error('Ollama response exceeds the 1 MB safety limit.')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}
async function nativeRequest(args: Record<string, unknown>, signal: AbortSignal) {
  const id = await invoke<string>('ai_begin')
  const cancel = () => {
    void invoke('ai_cancel', { id }).catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    return await invoke<unknown>('ai_request', { id, request: args })
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
  }
}
export async function listModels(endpoint: string, signal: AbortSignal): Promise<string[]> {
  endpoint = localEndpoint(endpoint)
  if (isDesktop())
    return (await nativeRequest({ endpoint, operation: 'models' }, signal)) as string[]
  return localModels(await json(endpoint, 'tags', signal))
}
export async function generate(
  data: Workspace,
  projectId: string,
  endpoint: string,
  model: string,
  intent: Intent,
  question: string,
  signal: AbortSignal,
): Promise<string> {
  endpoint = localEndpoint(endpoint)
  if (!model || model.length > 200 || question.length > 2000)
    throw new Error('Choose a local model and keep the question below 2,000 characters.')
  if (isDesktop())
    return (await nativeRequest(
      {
        endpoint,
        operation: 'generate',
        projectId,
        expectedRevision: data.revision,
        model,
        intent,
        question,
      },
      signal,
    )) as string
  const context = projectContext(data, projectId)
  if (!(await listModels(endpoint, signal)).includes(model))
    throw new Error(
      'This local model is no longer available. Refresh models; cloud models are not allowed.',
    )
  const details = await json(endpoint, 'show', signal, { model })
  if (
    (details.remote_host != null && details.remote_host !== '') ||
    (details.remote_model != null && details.remote_model !== '') ||
    !details.model_info ||
    typeof details.model_info !== 'object' ||
    Array.isArray(details.model_info) ||
    !Array.isArray(details.capabilities) ||
    !details.capabilities.includes('completion')
  )
    throw new Error('This model cannot be verified as a local text model. Choose another model.')
  const result = await json(endpoint, 'chat', signal, {
    model,
    stream: false,
    think: false,
    keep_alive: '1m',
    format: prompt.format,
    options: { temperature: 0.2, num_predict: 3000, num_ctx: 16384 },
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: JSON.stringify({ intent, question, context }) },
    ],
  })
  const message = result.message as { content?: unknown; tool_calls?: unknown[] } | undefined
  if (
    result.done !== true ||
    result.done_reason === 'length' ||
    message?.tool_calls?.length ||
    typeof message?.content !== 'string'
  )
    throw new Error(
      'Ollama returned an incomplete or unsupported response. No tasks changed. Try a smaller request.',
    )
  return message.content
}
export function aiError(error: unknown) {
  if (error instanceof TypeError)
    return 'Could not reach local Ollama. Start Ollama and check the address. In a browser, allow this exact origin in OLLAMA_ORIGINS.'
  return nativeError(error).message
}
