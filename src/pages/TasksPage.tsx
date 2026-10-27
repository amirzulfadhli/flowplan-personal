import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../state/WorkspaceContext'
import { PageHeader } from '../components/ui'
import { AddTask, TaskFilters, TaskList, defaultFilters, filterTasks } from '../components/Tasks'
import { dayOffset } from '../domain/dates'
import { sortedTasks } from '../domain/selectors'

export default function TasksPage() {
  const { data } = useWorkspace()
  const [filters, setFilters] = useState(defaultFilters)
  const [params, setParams] = useSearchParams()
  const soon = params.get('due') === 'soon'
  const tasks = filterTasks(data.tasks, filters).filter(
    (t) => !soon || (t.status !== 'done' && t.due && t.due <= dayOffset(2)),
  )
  return (
    <>
      <PageHeader
        title="All your tasks"
        description="Plan, prioritize, and move your work forward."
      >
        <AddTask />
      </PageHeader>
      <TaskFilters value={filters} onChange={setFilters} />
      <div className="toolbar">
        <div className="segments">
          <button aria-pressed={!soon} className={!soon ? 'on' : ''} onClick={() => setParams({})}>
            All tasks
          </button>
          <button
            aria-pressed={soon}
            className={soon ? 'on' : ''}
            onClick={() => setParams({ due: 'soon' })}
          >
            Due / overdue
          </button>
        </div>
        <span className="subtle">{tasks.length} tasks</span>
      </div>
      <TaskList key={JSON.stringify([filters, soon])} tasks={sortedTasks(tasks)} />
    </>
  )
}
