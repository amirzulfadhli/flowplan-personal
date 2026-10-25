import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { PageHeader } from '../components/ui'
import { useEditor } from '../components/Editors'
import { AddTask, TaskFilters, defaultFilters, filterTasks } from '../components/Tasks'
import { statusLabels, statuses, type Status } from '../domain/model'
import { displayDate } from '../domain/dates'

export default function Board() {
  const { data, execute, busy } = useWorkspace()
  const edit = useEditor()
  const [filters, setFilters] = useState(defaultFilters)
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const tasks = filterTasks(data.tasks, filters)
  async function move(id: string, status: Status) {
    const task = data.tasks.find((t) => t.id === id)
    if (
      task &&
      task.status !== status &&
      (await execute({ type: 'saveTask', id, input: { ...task, status } }))
    )
      setAnnouncement(`${task.title} moved to ${statusLabels[status]}`)
  }
  return (
    <>
      <PageHeader
        title="Board"
        description="Move tasks through your workflow. Drag a card or use its status menu."
      >
        <AddTask />
      </PageHeader>
      <TaskFilters value={filters} onChange={setFilters} hideStatus />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="board">
        {statuses.map((status) => (
          <section
            className={`column ${dragOver === status ? 'dropactive' : ''}`}
            key={status}
            aria-label={statusLabels[status]}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(status)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              void move(e.dataTransfer.getData('text/plain'), status)
            }}
          >
            <div className="colhead">
              <span className={`status-dot ${status}`} />
              <h2>{statusLabels[status]}</h2>
              <span className="subtle">{tasks.filter((t) => t.status === status).length}</span>
            </div>
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <article
                  key={task.id}
                  className="kanban-task"
                  draggable={!busy}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                  onDragEnd={() => setDragOver(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="kanban-project">
                      {data.projects.find((p) => p.id === task.projectId)?.name}
                    </span>
                    <span className={`chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
                  </div>
                  <button className="rowlink" onClick={() => edit({ kind: 'task', task })}>
                    <strong>{task.title}</strong>
                  </button>
                  {task.description && <p className="desc">{task.description}</p>}
                  <div className="kanban-foot">
                    <span>{displayDate(task.due)}</span>
                    <select
                      aria-label={`Status of ${task.title}`}
                      value={task.status}
                      disabled={busy}
                      onChange={(e) => void move(task.id, e.target.value as Status)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            <button
              className="add-in-column"
              onClick={() =>
                data.projects.length
                  ? edit({ kind: 'task', status, projectId: filters.projectId || undefined })
                  : edit({ kind: 'project' })
              }
            >
              <Plus size={12} /> Add task
            </button>
          </section>
        ))}
      </div>
    </>
  )
}
