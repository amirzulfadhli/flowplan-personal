import { useEffect, useRef, useState, type FormEvent } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  GripVertical,
  Minus,
  Pause,
  Pin,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { Progress } from '../components/ui'
import { formatTimer, remainingSeconds, useCompanion } from './bridge'
import './companion.css'

export default function Companion() {
  const { data, execute, busy: saving, error: storageError } = useWorkspace()
  const { state, update, action, busy, error, refresh } = useCompanion()
  const [title, setTitle] = useState('')
  const [now, setNow] = useState(Date.now)
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const active = !!state?.visible && state.endsAt !== null
  useEffect(() => {
    if (!active) return
    const tick = () => {
      setNow(Date.now())
      if (state?.endsAt && Date.now() >= state.endsAt) clearInterval(timer)
    }
    const timer = window.setInterval(tick, 1000)
    const immediate = window.setTimeout(tick, 0)
    window.addEventListener('focus', tick)
    return () => {
      clearTimeout(immediate)
      clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [active, state?.endsAt])
  useEffect(() => {
    const listener = listen('companion-capture', () => {
      input.current?.focus()
    })
    return () => {
      void listener.then((stop) => stop()).catch(() => undefined)
    }
  }, [])
  useEffect(() => {
    let active = true
    if (state?.expanded)
      void getCurrentWindow()
        .isFocused()
        .then((focused) => {
          if (focused && active) input.current?.focus()
        })
        .catch(() => undefined)
    return () => {
      active = false
    }
  }, [state?.expanded])
  const project = data.projects.find((p) => p.id === state?.projectId) ?? data.projects[0]
  const tasks = data.tasks.filter((t) => t.projectId === project?.id)
  const openTasks = tasks.filter((t) => t.status !== 'done')
  const task =
    openTasks.find((t) => t.id === state?.taskId) ??
    openTasks.find((t) => t.status === 'doing') ??
    openTasks[0]
  const done = tasks.filter((t) => t.status === 'done').length
  if (!state)
    return (
      <main className="island island-loading">
        <span>{error || 'Opening companion…'}</span>
        <button onClick={() => void refresh()}>Retry</button>
        <button onClick={() => void action('hide')} aria-label="Hide companion">
          ×
        </button>
      </main>
    )
  const seconds = remainingSeconds(state, now)
  const running = state.endsAt !== null && seconds > 0
  const complete = seconds === 0
  const time = formatTimer(seconds)
  async function capture(e: FormEvent) {
    e.preventDefault()
    if (!project || !title.trim()) return
    if (
      await execute({
        type: 'saveTask',
        input: {
          projectId: project.id,
          title: title.trim(),
          description: '',
          due: '',
          status: 'todo',
          priority: 'Medium',
        },
      })
    ) {
      setTitle('')
      setMessage('Task saved')
      input.current?.focus()
    }
  }
  const drag = (
    <button
      className="island-icon drag-handle"
      aria-label="Drag companion"
      title="Drag to move"
      onPointerDown={(e) => {
        if (e.button === 0) {
          e.preventDefault()
          void action('drag')
        }
      }}
    >
      <GripVertical size={16} />
    </button>
  )
  if (!state.expanded)
    return (
      <main className="island collapsed" aria-label="FlowPlan floating island">
        {drag}
        <span className="island-mark">F</span>
        <button
          className="island-summary"
          aria-label="Expand companion"
          onClick={() => void action('expand')}
        >
          <span>{project?.name ?? 'Your workspace'}</span>
          <strong>
            {complete ? 'Focus complete' : running ? time : `${openTasks.length} open tasks`}
          </strong>
        </button>
        <button
          className="island-icon"
          aria-label="Quick Add"
          onClick={() => void action('quickAdd')}
        >
          <Plus size={17} />
        </button>
      </main>
    )
  return (
    <main className="island expanded" aria-label="FlowPlan companion">
      <header className="island-header">
        {drag}
        <span className="island-mark">F</span>
        <strong>
          FlowPlan <span>companion</span>
        </strong>
        <div className="island-tools">
          <button
            className={`island-icon ${state.alwaysOnTop ? 'selected' : ''}`}
            aria-label="Always on top"
            aria-pressed={state.alwaysOnTop}
            disabled={busy}
            onClick={() =>
              void update({
                type: 'preferences',
                alwaysOnTop: !state.alwaysOnTop,
                closeToTray: state.closeToTray,
                shortcut: state.shortcut,
                expectedRevision: state.revision,
              })
            }
          >
            <Pin size={14} />
          </button>
          <button
            className="island-icon"
            aria-label="Collapse companion"
            onClick={() => void action('collapse')}
          >
            <ChevronDown size={16} />
          </button>
          <button
            className="island-icon"
            aria-label="Hide companion"
            onClick={() => void action('hide')}
          >
            <Minus size={16} />
          </button>
        </div>
      </header>
      <div className="island-body">
        <label className="island-label">
          PROJECT
          <select
            aria-label="Companion project"
            value={project?.id ?? ''}
            onChange={(e) => void update({ type: 'project', id: e.target.value })}
            disabled={!data.projects.length || busy}
          >
            {!data.projects.length && <option value="">Create a project in FlowPlan</option>}
            {data.projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <form className="island-capture" onSubmit={(e) => void capture(e)}>
          <input
            ref={input}
            aria-label="Quick task"
            value={title}
            maxLength={160}
            placeholder={project ? 'Capture a task…' : 'Create a project first'}
            disabled={!project}
            onChange={(e) => {
              setTitle(e.target.value)
              setMessage('')
            }}
          />
          <button aria-label="Capture task" disabled={!project || !title.trim() || saving}>
            <Plus size={18} />
          </button>
        </form>
        <section className="island-current">
          <div className="island-section-label">
            <span>CURRENT TASK</span>
            <span>{openTasks.length} open</span>
          </div>
          {task ? (
            <div className="island-task">
              <select
                aria-label="Current task"
                value={task.id}
                disabled={busy}
                onChange={(e) => void update({ type: 'task', id: e.target.value })}
              >
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                className="island-icon complete-task"
                aria-label="Complete current task"
                disabled={saving}
                onClick={() =>
                  void execute({
                    type: 'saveTask',
                    id: task.id,
                    input: { ...task, status: 'done' },
                  })
                }
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <p className="island-empty">
              {project
                ? 'All clear. Capture your next task.'
                : 'Open FlowPlan to create your first project.'}
            </p>
          )}
          <div className="island-progress">
            <Progress
              value={tasks.length ? Math.round((done / tasks.length) * 100) : 0}
              color={project?.color}
            />
            <span>
              {done}/{tasks.length} done
            </span>
          </div>
        </section>
        <section className={`island-focus ${complete ? 'finished' : ''}`} aria-label="Focus timer">
          <div className="island-section-label">
            <span>
              {complete ? 'FOCUS COMPLETE' : running ? 'FOCUS IN PROGRESS' : 'FOCUS TIMER'}
            </span>
            <label className="duration-control">
              <select
                aria-label="Focus duration"
                value={state.durationMinutes}
                disabled={running || busy}
                onChange={(e) =>
                  void update({
                    type: 'timer',
                    action: 'duration',
                    minutes: Number(e.target.value),
                  })
                }
              >
                {[5, 15, 25, 50].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="timer-row">
            <output aria-label="Time remaining" className="timer-digits">
              {time}
            </output>
            <div className="timer-actions">
              <button
                className="timer-toggle"
                aria-label={running ? 'Pause focus' : 'Start focus'}
                disabled={busy}
                onClick={() => void update({ type: 'timer', action: running ? 'pause' : 'start' })}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}
                {running ? 'Pause' : complete ? 'Again' : 'Focus'}
              </button>
              <button
                className="island-icon"
                aria-label="Reset focus"
                disabled={busy}
                onClick={() => void update({ type: 'timer', action: 'reset' })}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
          <p className="timer-note">
            {complete
              ? 'Take a breather. Your tasks stay in your control.'
              : 'Keeps time while hidden. Pause when you step away.'}
          </p>
        </section>
        {(error || storageError) && (
          <p role="alert" className="island-error">
            {error || storageError}
          </p>
        )}
        <footer className="island-footer">
          <span role="status">{message || (saving ? 'Saving…' : 'Saved on this device')}</span>
          <button onClick={() => void action('open')}>
            Open FlowPlan <ArrowUpRight size={13} />
          </button>
        </footer>
      </div>
    </main>
  )
}
