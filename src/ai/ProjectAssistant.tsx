import { useEffect, useRef, useState } from 'react'
import { Card, Modal } from '../components/ui'
import { useWorkspace } from '../state/WorkspaceContext'
import type { Task } from '../domain/model'
import {
  intents,
  parseAnswer,
  projectContext,
  type Answer,
  type Intent,
  type Proposal,
} from './protocol'
import { aiError, DEFAULT_ENDPOINT, generate, listModels, localEndpoint } from './client'
import './assistant.css'

function connection() {
  try {
    const saved = JSON.parse(localStorage.getItem('flowplan-ollama') ?? '{}')
    return {
      endpoint: localEndpoint(saved.endpoint ?? DEFAULT_ENDPOINT),
      model: typeof saved.model === 'string' ? saved.model : '',
    }
  } catch {
    return { endpoint: DEFAULT_ENDPOINT, model: '' }
  }
}
export default function ProjectAssistant({ projectId }: { projectId: string }) {
  const { data, execute, busy: saving } = useWorkspace()
  const [enabled, setEnabled] = useState(false)
  const [settings, setSettings] = useState(connection)
  const [models, setModels] = useState<string[]>([])
  const [intent, setIntent] = useState<Intent>('Summary')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<{
    answer: Answer
    revision: number
    tasks: Task[]
    model: string
  } | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [review, setReview] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  let context: ReturnType<typeof projectContext> | undefined
  let contextError = ''
  try {
    context = projectContext(data, projectId)
  } catch (error) {
    contextError = aiError(error)
  }
  const stale = result !== null && result.revision !== data.revision
  function cancel() {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setStatus('Request cancelled. No tasks changed.')
  }
  async function run(kind: 'models' | 'generate') {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError('')
    setStatus(
      kind === 'models'
        ? 'Checking local models…'
        : 'Generating locally. This may take a few minutes…',
    )
    if (kind === 'generate') {
      setResult(null)
      setSelected([])
    }
    let timedOut = false
    const timeout = setTimeout(
      () => {
        timedOut = true
        request.abort()
      },
      kind === 'models' ? 15_000 : 180_000,
    )
    try {
      const endpoint = localEndpoint(settings.endpoint)
      if (kind === 'models') {
        const available = await listModels(endpoint, request.signal)
        if (controller.current !== request || request.signal.aborted) return
        setModels(available)
        const model = available.includes(settings.model) ? settings.model : (available[0] ?? '')
        setSettings({ endpoint, model })
        setStatus(
          available.length
            ? `${available.length} local model(s) found. No project data sent.`
            : 'No supported local text models found. Install a local GGUF text model in Ollama, then refresh.',
        )
      } else {
        const raw = await generate(
          data,
          projectId,
          endpoint,
          settings.model,
          intent,
          question.trim(),
          request.signal,
        )
        if (controller.current !== request || request.signal.aborted) return
        const answer = parseAnswer(raw, data, projectId)
        setResult({
          answer,
          revision: data.revision,
          tasks: data.tasks.filter((t) => t.projectId === projectId),
          model: settings.model,
        })
        setStatus('Suggestions ready. No tasks have been changed.')
      }
      try {
        localStorage.setItem('flowplan-ollama', JSON.stringify({ ...settings, endpoint }))
      } catch {
        setStatus('Request completed. Connection preferences could not be saved on this device.')
      }
    } catch (error) {
      if (controller.current === request) setStatus('')
      if (controller.current === request)
        setError(
          timedOut
            ? 'Local Ollama timed out. Try a smaller model or request. No tasks changed.'
            : request.signal.aborted
              ? 'Request cancelled.'
              : aiError(error),
        )
    } finally {
      clearTimeout(timeout)
      if (controller.current === request) {
        if (timedOut) setStatus('')
        if (timedOut)
          setError('Local Ollama timed out. Try a smaller model or request. No tasks changed.')
        setBusy(false)
        controller.current = null
      }
    }
  }
  async function approve() {
    if (!result || stale || !selected.length) return
    const ok = await execute({
      type: 'approveAiActions',
      projectId,
      expectedRevision: result.revision,
      actions: selected.map((i) => result.answer.actions[i]),
    })
    if (ok) {
      setResult(null)
      setSelected([])
      setReview(false)
      setStatus('Approved actions saved to this project.')
    } else
      setError(
        'Actions were not saved. The workspace may have changed. Generate and review fresh suggestions.',
      )
  }
  return (
    <div className="verticalgap ai-panel">
      <Card title="Project AI" description="Optional advice from a model running on this computer.">
        <p className="note">
          Only this project's tasks, saved notes, progress, and recent activity are included.
          Responses stay in this panel until you leave it. AI can be mistaken; task changes always
          need your approval.
        </p>
        <label className="check-label mt-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked)
              if (!e.target.checked) {
                cancel()
                setResult(null)
                setSelected([])
                setReview(false)
              }
            }}
          />
          Enable local AI for this project
        </label>
        {enabled && (
          <>
            <div className="ai-connection mt-4">
              <label>
                Ollama address
                <input
                  value={settings.endpoint}
                  maxLength={100}
                  disabled={busy}
                  onChange={(e) => {
                    setSettings({ endpoint: e.target.value, model: '' })
                    setModels([])
                  }}
                />
              </label>
              <button className="btn" disabled={busy} onClick={() => void run('models')}>
                Find local models
              </button>
            </div>
            <p className="subtle mt-2">
              Local loopback only. Cloud/remote models and redirects are blocked. Configure Ollama
              with OLLAMA_NO_CLOUD=1 for local-only operation. FlowPlan never downloads models.
            </p>
            <div className="ai-connection mt-3">
              <label>
                Local model
                <select
                  value={settings.model}
                  disabled={busy || !models.length}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                >
                  {!models.includes(settings.model) && (
                    <option value={settings.model}>
                      {settings.model || 'Find local models first'}
                    </option>
                  )}
                  {models.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Assistance
                <select
                  value={intent}
                  disabled={busy}
                  onChange={(e) => setIntent(e.target.value as Intent)}
                >
                  {intents.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="ai-question mt-3">
              Question or task to break down (optional)
              <textarea
                rows={3}
                maxLength={2000}
                value={question}
                disabled={busy}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What should I work on next, and why?"
              />
            </label>
            <details className="mt-3">
              <summary>Review project context before sending</summary>
              <p className="subtle">
                All saved tasks and notes; up to 30 recent activity entries. No profile, other
                projects, chat history, or desktop timer data. Your question is also sent when you
                generate.
              </p>
              {context && <pre className="ai-context">{JSON.stringify(context, null, 2)}</pre>}
            </details>
            {contextError && (
              <p className="error-text" role="alert">
                {contextError}
              </p>
            )}
            <div className="actions mt-4">
              <button
                className="btn primary"
                disabled={busy || !models.includes(settings.model) || !!contextError}
                onClick={() => void run('generate')}
              >
                Generate suggestions
              </button>
              {busy && (
                <button className="btn" onClick={cancel}>
                  Cancel request
                </button>
              )}
            </div>
          </>
        )}
        {status && (
          <p className="subtle mt-3" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="error-text mt-3" role="alert">
            {error}
          </p>
        )}
      </Card>
      {enabled && result && (
        <Card
          title="Project advice"
          description={`Generated locally with ${result.model}. Review the evidence and assumptions.`}
        >
          <p className="ai-answer">{result.answer.summary}</p>
          <h3 className="mt-4">Reasoning summary</h3>
          <p className="note ai-answer">{result.answer.reasoningSummary}</p>
          {stale && (
            <p role="alert" className="error-text mt-3">
              The workspace changed since this response. Generate fresh suggestions before approving
              actions.
            </p>
          )}
          <h3 className="mt-4">Proposed actions</h3>
          {!result.answer.actions.length && (
            <p className="subtle">Advice only. No task changes proposed.</p>
          )}
          {result.answer.actions.map((action, index) => (
            <div className="ai-proposal" key={index}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selected.includes(index)}
                  disabled={stale || saving}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, index] : selected.filter((i) => i !== index),
                    )
                  }
                />
                {action.kind === 'create' ? 'Create' : 'Update'}: {action.title}
              </label>
              <p className="note">{action.reason}</p>
              <ProposalPreview
                action={action}
                before={result.tasks.find((t) => t.id === action.taskId)}
              />
            </div>
          ))}
          {!!result.answer.actions.length && (
            <button
              className="btn primary mt-3"
              disabled={stale || saving || !selected.length}
              onClick={() => setReview(true)}
            >
              Review {selected.length} selected action(s)
            </button>
          )}
        </Card>
      )}
      {review && result && (
        <Modal title="Approve project task changes" onClose={() => setReview(false)}>
          <p className="note">
            Only these selected changes will be saved, together in one transaction. Nothing has been
            applied yet.
          </p>
          {selected.map((index) => (
            <div className="ai-proposal" key={index}>
              <h3>{result.answer.actions[index].title}</h3>
              <ProposalPreview
                action={result.answer.actions[index]}
                before={result.tasks.find((t) => t.id === result.answer.actions[index].taskId)}
              />
            </div>
          ))}
          {stale && (
            <p role="alert" className="error-text">
              The workspace changed. Close this review and generate fresh suggestions.
            </p>
          )}
          <div className="actions mt-4">
            <button className="btn" onClick={() => setReview(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={saving || stale || !selected.length}
              onClick={() => void approve()}
            >
              Approve and save selected actions
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
function ProposalPreview({ action, before }: { action: Proposal; before?: Task }) {
  const fields = ['title', 'description', 'status', 'priority', 'due'] as const
  return (
    <div className="ai-table-wrap">
      <table className="ai-diff">
        <thead>
          <tr>
            <th>Field</th>
            <th>Current</th>
            <th>Proposed</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field}>
              <th>{field}</th>
              <td>{before?.[field] || '—'}</td>
              <td>{action[field] || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
