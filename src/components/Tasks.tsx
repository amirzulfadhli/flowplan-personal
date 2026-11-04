import { Check, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dateKey, displayDate } from '../domain/dates'
import { statusLabels, statuses, type Status, type Task } from '../domain/model'
import { useWorkspace } from '../state/WorkspaceContext'
import { useEditor } from './Editors'
import { Empty } from './ui'

export function AddTask({ projectId, status }: { projectId?: string; status?: Status }) {
  const edit = useEditor()
  const { data } = useWorkspace()
  return (
    <button
      className="btn primary"
      onClick={() =>
        data.projects.length ? edit({ kind: 'task', projectId, status }) : edit({ kind: 'project' })
      }
    >
      <Plus size={14} />
      {data.projects.length ? 'Add task' : 'Create a project'}
    </button>
  )
}
export function TaskRow({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { data, execute, busy } = useWorkspace()
  const edit = useEditor()
  const project = data.projects.find((p) => p.id === task.projectId)
  const overdue = task.status !== 'done' && task.due && task.due < dateKey()
  return (
    <div className={compact ? 'nextrow' : 'trow'}>
      <div className="task-title-cell">
        <button
          className={`tick ${task.status === 'done' ? 'done' : ''}`}
          aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}
          disabled={busy}
          onClick={() =>
            void execute({
              type: 'saveTask',
              id: task.id,
              input: { ...task, status: task.status === 'done' ? 'todo' : 'done' },
            })
          }
        >
          <Check size={12} />
        </button>
        <div className="min-w-0">
          <button className="rowlink task-title" onClick={() => edit({ kind: 'task', task })}>
            {task.title}
          </button>
          <div className="nextmeta">
            {compact
              ? `${project?.name} · ${displayDate(task.due)}`
              : task.description || 'No description'}
          </div>
        </div>
      </div>
      {!compact && (
        <Link className="project-cell" to={`/projects/${task.projectId}`}>
          <span className="dot" style={{ background: project?.color }} />
          {project?.name}
        </Link>
      )}
      <span className={`chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
      {!compact && (
        <>
          <span className={`due-cell ${overdue ? 'error-text' : 'subtle'}`}>
            {overdue ? 'Overdue · ' : ''}
            {displayDate(task.due)}
          </span>
          <select
            className={`status ${task.status}`}
            aria-label={`Status of ${task.title}`}
            disabled={busy}
            value={task.status}
            onChange={(e) =>
              void execute({
                type: 'saveTask',
                id: task.id,
                input: { ...task, status: e.target.value as Status },
              })
            }
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}
export function TaskList({ tasks }: { tasks: Task[] }) {
  const [page, setPage] = useState(0)
  const pageSize = 100
  const lastPage = Math.max(0, Math.ceil(tasks.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * pageSize
  return (
    <div className="card tasktable">
      {tasks.length ? (
        <>
          <div className="trow thead" aria-hidden="true">
            <span>Task</span>
            <span>Project</span>
            <span>Priority</span>
            <span>Due date</span>
            <span>Status</span>
          </div>
          {tasks.slice(start, start + pageSize).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {tasks.length > pageSize && (
            <nav className="toolbar p-4" aria-label="Task list pages">
              <span className="subtle" role="status">
                {start + 1}–{Math.min(start + pageSize, tasks.length)} of {tasks.length} tasks
              </span>
              <button
                className="btn"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous tasks
              </button>
              <button
                className="btn"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                Next tasks
              </button>
            </nav>
          )}
        </>
      ) : (
        <Empty>No tasks here yet. Add a task or adjust your filters.</Empty>
      )}
    </div>
  )
}
export type Filters = { query: string; projectId: string; status: string; priority: string }
export const defaultFilters: Filters = { query: '', projectId: '', status: '', priority: '' }
export function filterTasks(tasks: Task[], filters: Filters) {
  return tasks.filter(
    (t) =>
      (!filters.projectId || t.projectId === filters.projectId) &&
      (!filters.status || t.status === filters.status) &&
      (!filters.priority || t.priority === filters.priority) &&
      `${t.title} ${t.description}`.toLowerCase().includes(filters.query.toLowerCase()),
  )
}
export function TaskFilters({
  value,
  onChange,
  hideStatus = false,
}: {
  value: Filters
  onChange: (filters: Filters) => void
  hideStatus?: boolean
}) {
  const { data } = useWorkspace()
  return (
    <div className="toolbar">
      <label className="search-wrap">
        <Search size={14} />
        <input
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </label>
      <select
        aria-label="Filter by project"
        className="select"
        value={value.projectId}
        onChange={(e) => onChange({ ...value, projectId: e.target.value })}
      >
        <option value="">All projects</option>
        {data.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {!hideStatus && (
        <select
          className="select"
          aria-label="Filter by status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      )}
      <select
        className="select"
        aria-label="Filter by priority"
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: e.target.value })}
      >
        <option value="">All priorities</option>
        {['High', 'Medium', 'Low'].map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      {Object.values(value).some(Boolean) && (
        <button className="linkbtn" onClick={() => onChange(defaultFilters)}>
          Clear filters
        </button>
      )}
    </div>
  )
}
