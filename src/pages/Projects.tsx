import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ProjectCard } from '../components/ProjectCard'
import { PageHeader } from '../components/ui'
import { useEditor } from '../components/Editors'
import { useWorkspace } from '../state/WorkspaceContext'

export default function Projects() {
  const { data } = useWorkspace()
  const edit = useEditor()
  const [query, setQuery] = useState('')
  return (
    <>
      <PageHeader
        title="Your projects"
        description="One space for each idea. A clear view of every next step."
      >
        <button className="btn primary" onClick={() => edit({ kind: 'project' })}>
          <Plus size={14} />
          New project
        </button>
      </PageHeader>
      <div className="toolbar">
        <input
          className="search"
          aria-label="Search projects"
          placeholder="Find a project…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="subtle">{data.projects.length} projects</span>
      </div>
      <div className="project-grid">
        {data.projects
          .filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()))
          .map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        <button className="card new-project" onClick={() => edit({ kind: 'project' })}>
          <Plus size={22} />
          <strong>Create a project</strong>
          <span>Make room for your next idea</span>
        </button>
      </div>
    </>
  )
}
