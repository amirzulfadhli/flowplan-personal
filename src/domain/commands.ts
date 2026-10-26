import { workspaceSchema, type ProjectInput, type TaskInput, type Workspace } from './model'

export type Command =
  | { type: 'saveProject'; id?: string; input: ProjectInput }
  | { type: 'deleteProject'; id: string }
  | { type: 'saveTask'; id?: string; input: TaskInput }
  | { type: 'deleteTask'; id: string }
  | { type: 'notes'; id: string; notes: string }
  | { type: 'profile'; name: string }
  | { type: 'import'; data: Workspace; expectedRevision?: number }

/** Pure domain mutation. The repository runs this inside its atomic transaction. */
export function applyCommand(
  current: Workspace,
  command: Command,
  now = new Date().toISOString(),
): Workspace {
  const data = structuredClone(current)
  const log = (projectId: string, message: string) =>
    data.activity.unshift({ id: crypto.randomUUID(), projectId, message, time: now })
  if (command.type === 'import') {
    if (command.expectedRevision !== undefined && command.expectedRevision !== current.revision)
      throw new Error(
        'The workspace changed while you reviewed this backup. Cancel and review the import again.',
      )
    return workspaceSchema.parse({ ...command.data, revision: current.revision + 1 })
  }
  if (command.type === 'profile') data.profile.name = command.name
  if (command.type === 'saveProject') {
    const existing = data.projects.find((p) => p.id === command.id)
    if (command.id && !existing) throw new Error('This project was deleted in another window.')
    if (existing) {
      Object.assign(existing, command.input, { updatedAt: now })
      log(existing.id, `Updated project “${existing.name}”`)
    } else {
      const project = {
        ...command.input,
        id: crypto.randomUUID(),
        notes: '',
        createdAt: now,
        updatedAt: now,
      }
      data.projects.push(project)
      log(project.id, `Created project “${project.name}”`)
    }
  }
  if (command.type === 'deleteProject') {
    data.projects = data.projects.filter((p) => p.id !== command.id)
    data.tasks = data.tasks.filter((t) => t.projectId !== command.id)
    data.activity = data.activity.filter((a) => a.projectId !== command.id)
  }
  if (command.type === 'notes') {
    const project = data.projects.find((p) => p.id === command.id)
    if (!project) throw new Error('This project no longer exists.')
    if (project.notes !== command.notes) {
      project.notes = command.notes
      project.updatedAt = now
      log(project.id, 'Updated project notes')
    }
  }
  if (command.type === 'saveTask') {
    if (!data.projects.some((p) => p.id === command.input.projectId))
      throw new Error('Choose an existing project.')
    const existing = data.tasks.find((t) => t.id === command.id)
    if (command.id && !existing) throw new Error('This task was deleted in another window.')
    const completedAt = command.input.status === 'done' ? (existing?.completedAt ?? now) : null
    if (existing) {
      const oldProject = existing.projectId
      const oldStatus = existing.status
      Object.assign(existing, command.input, { completedAt, updatedAt: now })
      if (oldProject !== existing.projectId)
        log(oldProject, `Moved task “${existing.title}” to another project`)
      log(
        existing.projectId,
        oldStatus !== existing.status
          ? `“${existing.title}” → ${existing.status === 'done' ? 'Done' : existing.status === 'todo' ? 'To do' : existing.status === 'doing' ? 'In progress' : 'Review'}`
          : `Updated task “${existing.title}”`,
      )
    } else {
      const task = {
        ...command.input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        completedAt,
      }
      data.tasks.push(task)
      log(task.projectId, `Created task “${task.title}”`)
    }
  }
  if (command.type === 'deleteTask') {
    const task = data.tasks.find((t) => t.id === command.id)
    if (task) {
      log(task.projectId, `Deleted task “${task.title}”`)
      data.tasks = data.tasks.filter((t) => t.id !== command.id)
    }
  }
  data.revision += 1
  return workspaceSchema.parse(data)
}
