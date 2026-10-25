import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Pencil } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { Card, Empty, PageHeader, Progress } from '../components/ui'
import { useEditor } from '../components/Editors'
import { AddTask, TaskList, TaskRow } from '../components/Tasks'
import { progress, sortedTasks } from '../domain/selectors'
import { displayDate } from '../domain/dates'
import type { Project } from '../domain/model'

export default function ProjectDetail() {
  const { id } = useParams()
  const { data } = useWorkspace()
  const project = data.projects.find((p) => p.id === id)
  if (!project)
    return (
      <Empty
        action={
          <Link className="btn" to="/projects">
            Back to projects
          </Link>
        }
      >
        This project no longer exists.
      </Empty>
    )
  return <ProjectWorkspace key={project.id} project={project} />
}
function ProjectWorkspace({ project }: { project: Project }) {
  const { data } = useWorkspace()
  const edit = useEditor()
  const [tab, setTab] = useState('Overview')
  const tasks = sortedTasks(data.tasks.filter((t) => t.projectId === project.id))
  const stats = progress(tasks)
  const activity = data.activity.filter((a) => a.projectId === project.id)
  const timeline = (limit?: number) =>
    activity.length ? (
      <ol className="timeline">
        {activity.slice(0, limit).map((a) => (
          <li key={a.id}>
            <span className="actbubble">
              <ArrowUpRight size={13} />
            </span>
            <div>
              <strong>{a.message}</strong>
              <time dateTime={a.time}>{new Date(a.time).toLocaleString()}</time>
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <Empty>Your project activity will appear here.</Empty>
    )
  return (
    <>
      <Link className="linkbtn back-link" to="/projects">
        ← All projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.description || 'Your dedicated project workspace.'}
      >
        <button className="btn" onClick={() => edit({ kind: 'project', project })}>
          <Pencil size={13} />
          Edit project
        </button>
        <AddTask projectId={project.id} />
      </PageHeader>
      <div className="project-summary">
        <span className="dot" style={{ background: project.color }} />
        <span>
          {stats.done} of {stats.total} tasks completed
        </span>
        <strong>{stats.percent}%</strong>
        <div className="summary-progress">
          <Progress value={stats.percent} color={project.color} />
        </div>
        <span className="subtle">Deadline: {displayDate(project.due)}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Project sections">
        {['Overview', 'Tasks', 'Notes', 'Activity'].map((name) => (
          <button
            role="tab"
            aria-selected={tab === name}
            aria-controls="project-panel"
            id={`tab-${name}`}
            className={tab === name ? 'active' : ''}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
            {name === 'Tasks' && <span>{tasks.length}</span>}
          </button>
        ))}
      </div>
      <div id="project-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'Overview' && (
          <div className="homegrid">
            <div className="verticalgap">
              <Card
                title="Next actions"
                action={
                  <button className="linkbtn" onClick={() => setTab('Tasks')}>
                    See all tasks ↗
                  </button>
                }
              >
                {tasks
                  .filter((t) => t.status !== 'done')
                  .slice(0, 5)
                  .map((t) => (
                    <TaskRow task={t} key={t.id} compact />
                  ))}
                {!tasks.some((t) => t.status !== 'done') && (
                  <Empty>No pending tasks for this project.</Empty>
                )}
              </Card>
              <Card
                title="Recent activity"
                action={
                  <button className="linkbtn" onClick={() => setTab('Activity')}>
                    View timeline ↗
                  </button>
                }
              >
                {timeline(4)}
              </Card>
            </div>
            <Card
              title="Project notes"
              action={
                <button className="linkbtn" onClick={() => setTab('Notes')}>
                  Edit
                </button>
              }
            >
              <p className="note">
                {project.notes || 'Record decisions, milestones, and what you want to do next.'}
              </p>
            </Card>
          </div>
        )}
        {tab === 'Tasks' && <TaskList tasks={tasks} />}
        {tab === 'Notes' && <Notes key={project.id} project={project} />}
        {tab === 'Activity' && (
          <Card title={`${project.name} activity`} description="Only events from this project">
            {timeline()}
          </Card>
        )}
      </div>
    </>
  )
}
function Notes({ project }: { project: Project }) {
  const { execute, busy } = useWorkspace()
  const [notes, setNotes] = useState(project.notes)
  const [saved, setSaved] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault()
    setSaved(await execute({ type: 'notes', id: project.id, notes }))
  }
  return (
    <Card title="Project notes" description="A place for decisions, milestones, and blockers.">
      <form className="editor-form" onSubmit={(e) => void save(e)}>
        <label className="sr-only" htmlFor="project-notes">
          Project notes
        </label>
        <textarea
          id="project-notes"
          rows={14}
          maxLength={20000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setSaved(false)
          }}
        />
        <div className="flex items-center gap-3">
          <button className="btn primary" disabled={busy}>
            Save notes
          </button>
          <span className="subtle" role="status">
            {saved
              ? 'Notes saved on this device.'
              : notes !== project.notes
                ? 'Unsaved changes'
                : ''}
          </span>
        </div>
      </form>
    </Card>
  )
}
