import { ArrowUpRight, Folder } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Project } from '../domain/model'
import { progress } from '../domain/selectors'
import { displayDate } from '../domain/dates'
import { useWorkspace } from '../state/WorkspaceContext'
import { Progress } from './ui'

export function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  const { data } = useWorkspace()
  const stats = progress(data.tasks.filter((t) => t.projectId === project.id))
  return (
    <Link
      to={`/projects/${project.id}`}
      className={`card project-card ${compact ? 'compact' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="project-icon"
          style={{ color: project.color, background: `${project.color}20` }}
        >
          <Folder size={16} />
        </span>
        <span className="subtle">
          {stats.done}/{stats.total} tasks
        </span>
      </div>
      <h3>{project.name}</h3>
      {!compact && (
        <p className="project-description">
          {project.description || 'A space for your next idea.'}
        </p>
      )}
      <div className="progresslab">
        <span>Completion</span>
        <strong>{stats.percent}%</strong>
      </div>
      <Progress value={stats.percent} color={project.color} />
      <div className="pfoot">
        <span>{displayDate(project.due)}</span>
        <span>
          Open <ArrowUpRight size={12} />
        </span>
      </div>
    </Link>
  )
}
