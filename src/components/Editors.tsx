import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import {
  colors,
  priorities,
  statuses,
  statusLabels,
  type Project,
  type ProjectInput,
  type Status,
  type Task,
  type TaskInput,
} from '../domain/model'
import { useWorkspace } from '../state/WorkspaceContext'
import { Modal } from './ui'

type Editor =
  | { kind: 'project'; project?: Project }
  | { kind: 'task'; task?: Task; projectId?: string; status?: Status }
  | null
const EditorContext = createContext<(editor: Editor) => void>(() => undefined)
export const useEditor = () => useContext(EditorContext)
export function EditorsProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor>(null)
  return (
    <EditorContext.Provider value={setEditor}>
      {children}
      {editor?.kind === 'project' && (
        <ProjectEditor project={editor.project} onClose={() => setEditor(null)} />
      )}
      {editor?.kind === 'task' && (
        <TaskEditor
          task={editor.task}
          projectId={editor.projectId}
          status={editor.status}
          onClose={() => setEditor(null)}
        />
      )}
    </EditorContext.Provider>
  )
}
function ProjectEditor({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { execute, busy, error } = useWorkspace()
  const [input, setInput] = useState<ProjectInput>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    color: project?.color ?? colors[0],
    due: project?.due ?? '',
  })
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (await execute({ type: 'saveProject', id: project?.id, input })) onClose()
  }
  async function remove() {
    if (
      project &&
      window.confirm(
        `Delete “${project.name}” and all its tasks, notes, and activity? This cannot be undone.`,
      )
    ) {
      if (await execute({ type: 'deleteProject', id: project.id })) onClose()
    }
  }
  return (
    <Modal title={project ? 'Edit project' : 'Create project'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="editor-form">
        <label>
          Project name
          <input
            autoFocus
            required
            maxLength={80}
            value={input.name}
            onChange={(e) => setInput({ ...input, name: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            maxLength={500}
            value={input.description}
            onChange={(e) => setInput({ ...input, description: e.target.value })}
            placeholder="What are you building?"
          />
        </label>
        <div className="form-grid">
          <label>
            Project deadline
            <input
              type="date"
              value={input.due}
              onChange={(e) => setInput({ ...input, due: e.target.value })}
            />
          </label>
          <label>
            Project color
            <input
              type="color"
              value={input.color}
              onChange={(e) => setInput({ ...input, color: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {project && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete project
            </button>
          )}
          <span className="grow" />
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !input.name.trim()}>
            {busy ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
function TaskEditor({
  task,
  projectId,
  status,
  onClose,
}: {
  task?: Task
  projectId?: string
  status?: Status
  onClose: () => void
}) {
  const { data, execute, busy, error } = useWorkspace()
  const [input, setInput] = useState<TaskInput>({
    title: task?.title ?? '',
    projectId: task?.projectId ?? projectId ?? data.projects[0]?.id ?? '',
    description: task?.description ?? '',
    status: task?.status ?? status ?? 'todo',
    priority: task?.priority ?? 'Medium',
    due: task?.due ?? '',
  })
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (await execute({ type: 'saveTask', id: task?.id, input })) onClose()
  }
  async function remove() {
    if (task && window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
      if (await execute({ type: 'deleteTask', id: task.id })) onClose()
    }
  }
  return (
    <Modal title={task ? 'Edit task' : 'Add task'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="editor-form">
        {!data.projects.length && <p className="notice">Create a project before adding tasks.</p>}
        <label>
          Task title
          <input
            autoFocus
            required
            maxLength={160}
            value={input.title}
            onChange={(e) => setInput({ ...input, title: e.target.value })}
          />
        </label>
        <label>
          Project
          <select
            required
            value={input.projectId}
            onChange={(e) => setInput({ ...input, projectId: e.target.value })}
          >
            <option value="" disabled>
              Choose a project
            </option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea
            rows={3}
            maxLength={5000}
            value={input.description}
            onChange={(e) => setInput({ ...input, description: e.target.value })}
            placeholder="Details, acceptance criteria, or a next step…"
          />
        </label>
        <div className="form-grid">
          <label>
            Status
            <select
              value={input.status}
              onChange={(e) => setInput({ ...input, status: e.target.value as Status })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={input.priority}
              onChange={(e) => setInput({ ...input, priority: e.target.value as Task['priority'] })}
            >
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Due date
          <input
            type="date"
            value={input.due}
            onChange={(e) => setInput({ ...input, due: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {task && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete task
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !data.projects.length || !input.title.trim()}
          >
            {busy ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
