import { z } from 'zod'
import { priorities, statuses, type Workspace } from '../domain/model'

export const intents = ['Summary', 'Priorities', 'Blockers', 'Task breakdown'] as const
export type Intent = (typeof intents)[number]
export const proposalSchema = z
  .object({
    kind: z.enum(['create', 'update']),
    taskId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(100)
      .nullable(),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(5000),
    status: z.enum(statuses),
    priority: z.enum(priorities),
    due: z.union([z.literal(''), z.iso.date()]),
    reason: z.string().min(1).max(600),
  })
  .strict()
  .refine(
    (p) => (p.kind === 'create' ? p.taskId === null : p.taskId !== null),
    'Invalid task reference',
  )
export const answerSchema = z
  .object({
    summary: z.string().min(1).max(8000),
    reasoningSummary: z.string().min(1).max(3000),
    actions: z.array(proposalSchema).max(8),
  })
  .strict()
export type Proposal = z.infer<typeof proposalSchema>
export type Answer = z.infer<typeof answerSchema>

// The same selection and limits are enforced in Rust before desktop network access.
export function projectContext(data: Workspace, projectId: string) {
  const project = data.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('This project no longer exists.')
  const tasks = data.tasks.filter((t) => t.projectId === projectId)
  const activity = data.activity.filter((a) => a.projectId === projectId)
  const context = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      due: project.due,
      notes: project.notes,
    },
    progress: { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length },
    tasks: tasks.map(({ id, title, description, status, priority, due, completedAt }) => ({
      id,
      title,
      description,
      status,
      priority,
      due,
      completedAt,
    })),
    activity: activity.slice(0, 30).map(({ message, time }) => ({ message, time })),
    omittedActivity: Math.max(0, activity.length - 30),
  }
  // Fail visibly rather than silently omit task details a recommendation could depend on.
  if (new TextEncoder().encode(JSON.stringify(context)).length > 60_000)
    throw new Error(
      'This project exceeds the 60 KB AI context limit. Shorten notes or task descriptions before requesting advice.',
    )
  return context
}
export function parseAnswer(raw: string, data: Workspace, projectId: string): Answer {
  if (raw.length > 64_000)
    throw new Error('The model response is too large. Try a smaller request.')
  let answer: Answer
  try {
    answer = answerSchema.parse(JSON.parse(raw))
  } catch {
    throw new Error(
      'The model returned an invalid structured response. No tasks changed. Try again or choose another local model.',
    )
  }
  const ids = new Set<string>()
  for (const action of answer.actions) {
    if (action.kind === 'update') {
      if (
        !data.tasks.some((t) => t.id === action.taskId && t.projectId === projectId) ||
        ids.has(action.taskId!)
      )
        throw new Error(
          'The model proposed an unknown, duplicate, or out-of-project task. No tasks changed.',
        )
      ids.add(action.taskId!)
    }
  }
  return answer
}
