import { z } from 'zod'

export const statuses = ['todo', 'doing', 'review', 'done'] as const
export const statusLabels = { todo: 'To do', doing: 'In progress', review: 'Review', done: 'Done' }
export const priorities = ['Low', 'Medium', 'High'] as const
export const colors = ['#7d87ec', '#6dc3a4', '#eea77f', '#bd8ce4', '#e0b762']
export type Status = (typeof statuses)[number]
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
const timestamp = z.iso.datetime()
const date = z.union([z.literal(''), z.iso.date()])
const projectSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    due: date,
    notes: z.string().max(20000),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()
const taskSchema = z
  .object({
    id,
    projectId: id,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(5000),
    status: z.enum(statuses),
    priority: z.enum(priorities),
    due: date,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp.nullable(),
  })
  .strict()
  .refine(
    (t) => (t.status === 'done') === (t.completedAt !== null),
    'Completion date must match task status',
  )
const activitySchema = z
  .object({ id, projectId: id, message: z.string().max(500), time: timestamp })
  .strict()
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    profile: z.object({ name: z.string().trim().min(1).max(60) }).strict(),
    projects: z.array(projectSchema).max(2000),
    tasks: z.array(taskSchema).max(50000),
    activity: z.array(activitySchema).max(100000),
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const collection of [data.projects, data.tasks, data.activity]) {
      if (new Set(collection.map((row) => row.id)).size !== collection.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate IDs are not allowed' })
    }
    const projectIds = new Set(data.projects.map((p) => p.id))
    if ([...data.tasks, ...data.activity].some((row) => !projectIds.has(row.projectId)))
      ctx.addIssue({
        code: 'custom',
        message: 'Every task and activity must belong to an existing project',
      })
  })
export type Project = z.infer<typeof projectSchema>
export type Task = z.infer<typeof taskSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type ProjectInput = Pick<Project, 'name' | 'description' | 'color' | 'due'>
export type TaskInput = Pick<
  Task,
  'projectId' | 'title' | 'description' | 'status' | 'priority' | 'due'
>
export const emptyWorkspace = (): Workspace => ({
  schemaVersion: 1,
  revision: 0,
  profile: { name: 'My workspace' },
  projects: [],
  tasks: [],
  activity: [],
})

export function parseImport(text: string): Workspace {
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024)
    throw new Error('The backup exceeds the 20 MB import limit.')
  const parsed = workspaceSchema.safeParse(JSON.parse(text))
  if (!parsed.success)
    throw new Error('This is not a valid FlowPlan v1 backup. No data has been changed.')
  return parsed.data
}

/** Compact UTF-8 matches the native backup limit and keeps every new write restorable. */
export function serializeBackup(data: Workspace): string {
  const text = JSON.stringify(data)
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024)
    throw new Error('The workspace exceeds the 20 MB backup limit. No changes were saved.')
  return text
}
