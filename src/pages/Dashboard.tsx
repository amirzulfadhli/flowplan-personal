import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCheck, Clock3, Folder, ListTodo, Plus } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { chartData, progress, sortedTasks } from '../domain/selectors'
import { dayOffset } from '../domain/dates'
import { Card, Empty, PageHeader, Progress } from '../components/ui'
import { useEditor } from '../components/Editors'
import { AddTask, TaskRow } from '../components/Tasks'
import { ProjectCard } from '../components/ProjectCard'
import { isDesktop } from '../storage/desktop'

export default function Dashboard() {
  const { data, execute, busy } = useWorkspace()
  const edit = useEditor()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const open = data.tasks.filter((t) => t.status !== 'done')
  const due = open.filter((t) => t.due && t.due <= dayOffset(2))
  const stats = progress(data.tasks)
  const days = chartData(data, 7)
  const weekTotal = days.reduce((n, d) => n + Number(d.total), 0)
  const max = Math.max(1, ...days.map((d) => Number(d.total)))
  async function capture(e: FormEvent) {
    e.preventDefault()
    if (
      await execute({
        type: 'saveTask',
        input: {
          title,
          projectId: projectId || data.projects[0]?.id || '',
          status: 'todo',
          priority: 'Medium',
          due: '',
          description: '',
        },
      })
    )
      setTitle('')
  }
  return (
    <>
      <PageHeader title="Home" description="A clear snapshot of what matters now.">
        <button className="btn" onClick={() => edit({ kind: 'project' })}>
          <Plus size={14} />
          Project
        </button>
        <AddTask />
      </PageHeader>
      {isDesktop() && data.projects.length === 0 && (
        <Card title="Get started" className="mb-4">
          <p className="note">
            Create your first project above, or import a JSON backup in Settings. Your work stays on
            this device; browser and desktop workspaces are separate.
          </p>
          <p className="note">
            By default, closing the window keeps FlowPlan in the system tray. Use the tray menu or
            Settings → Quit FlowPlan to exit completely. You can change close-to-tray and widget
            preferences in Settings.
          </p>
          <Link className="linkbtn" to="/settings">
            Open settings and backups ↗
          </Link>
        </Card>
      )}
      <div className="micro-kpis">
        {[
          { label: 'Projects', value: data.projects.length, icon: Folder },
          { label: 'Open tasks', value: open.length, icon: ListTodo },
          { label: 'Due / overdue', value: due.length, icon: Clock3 },
          { label: 'Completion', value: `${stats.percent}%`, icon: CheckCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div className="micro-kpi" key={label}>
            <span className="mico">
              <Icon size={16} />
            </span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="homegrid">
        <Card
          title="Up next"
          description="Your priorities, ordered by due date"
          action={
            <Link className="linkbtn" to="/tasks">
              All tasks ↗
            </Link>
          }
        >
          {data.projects.length > 0 && (
            <form className="quickform" onSubmit={(e) => void capture(e)}>
              <input
                required
                maxLength={160}
                aria-label="Quick task title"
                placeholder="＋ Quick add a task…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select
                aria-label="Quick task project"
                value={projectId || data.projects[0]?.id}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn primary" disabled={busy || !title.trim()}>
                Add ↵
              </button>
            </form>
          )}
          {open.length ? (
            sortedTasks(open)
              .slice(0, 6)
              .map((t) => <TaskRow key={t.id} task={t} compact />)
          ) : (
            <Empty
              action={
                !data.projects.length && (
                  <button className="btn primary" onClick={() => edit({ kind: 'project' })}>
                    Create your first project
                  </button>
                )
              }
            >
              {data.projects.length
                ? 'Your queue is clear. Add a task when you’re ready.'
                : 'Start with a project. Build momentum one task at a time.'}
            </Empty>
          )}
        </Card>
        <div className="verticalgap">
          <Card title="Your progress" description="Every completed task counts">
            <div className="progress-total">
              {stats.done}
              <span> / {stats.total} tasks done</span>
            </div>
            <Progress value={stats.percent} />
            <p className="subtle mt-3">
              {stats.total
                ? `${open.length} tasks left across your projects.`
                : 'Progress will appear as you complete tasks.'}
            </p>
          </Card>
          <Card
            title="This week’s momentum"
            action={<span className="subtle">{weekTotal} done</span>}
          >
            <div className="weekbars">
              {days.map((d) => (
                <div className="weekbar" key={d.day} title={`${d.label}: ${d.total} completed`}>
                  <span style={{ height: `${(Number(d.total) / max) * 38}px` }} />
                  <small>
                    {new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                    })}
                  </small>
                </div>
              ))}
            </div>
            <p className="chart-note">Based on completed tasks recorded here.</p>
          </Card>
          {due.length > 0 && (
            <Link to="/tasks?due=soon" className="signal">
              <Clock3 size={14} />
              <strong>{due.length} due soon or overdue</strong>
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>
      <div className="sectionhead">
        <h2>Project pulse</h2>
        <Link className="linkbtn" to="/projects">
          View projects →
        </Link>
      </div>
      <div className="project-grid">
        {data.projects.slice(0, 6).map((p) => (
          <ProjectCard key={p.id} project={p} compact />
        ))}
      </div>
      <p className="workspace-footnote">Your workspace, on this device. No account required.</p>
    </>
  )
}
