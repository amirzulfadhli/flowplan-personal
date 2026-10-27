import { workspaceSchema, type ProjectInput, type TaskInput, type Workspace } from './model'
import { proposalSchema, type Proposal } from '../ai/protocol'

export type Command =
  | { type: 'approveAiActions'; projectId: string; expectedRevision: number; actions: Proposal[] }
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
  if (command.type === 'approveAiActions') {
    if (current.revision !== command.expectedRevision)
      throw new Error(
        'The workspace changed. Generate and review fresh AI suggestions before approving.',
      )
    if (
      !current.projects.some((p) => p.id === command.projectId) ||
      !command.actions.length ||
      command.actions.length > 8
    )
      throw new Error('Choose 1 to 8 actions for an existing project.')
    const seen = new Set<string>()
    let next = current
    for (const raw of command.actions) {
      const action = proposalSchema.parse(raw)
      if (action.kind === 'update') {
        if (
          !current.tasks.some((t) => t.id === action.taskId && t.projectId === command.projectId) ||
          seen.has(action.taskId!)
        )
          throw new Error('AI actions must reference distinct tasks within this project.')
        seen.add(action.taskId!)
      }
      const { title, description, status, priority, due } = action
      next = applyCommand(
        next,
        {
          type: 'saveTask',
          id: action.taskId ?? undefined,
          input: { projectId: command.projectId, title, description, status, priority, due },
        },
        now,
      )
    }
    return workspaceSchema.parse({ ...next, revision: current.revision + 1 })
  }
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
