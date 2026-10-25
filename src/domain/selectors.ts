import { dateKey, dayOffset } from './dates'
import type { Task, Workspace } from './model'

export function progress(tasks: Task[]) {
  const done = tasks.filter((t) => t.status === 'done').length
  return {
    total: tasks.length,
    done,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  }
}
export function sortedTasks(tasks: Task[]) {
  const rank = { High: 0, Medium: 1, Low: 2 }
  return [...tasks].sort(
    (a, b) =>
      Number(a.status === 'done') - Number(b.status === 'done') ||
      (a.due || '9999').localeCompare(b.due || '9999') ||
      rank[a.priority] - rank[b.priority] ||
      a.title.localeCompare(b.title),
  )
}
/** Current completed tasks, grouped by their latest completion date; never synthetic history. */
export function chartData(data: Workspace, span: number, now = new Date()) {
  const days = Array.from({ length: span }, (_, index) => dayOffset(index - span + 1, now))
  const daily = new Map<string, Map<string, number>>()
  const cumulative = new Map<string, number>()
  for (const task of data.tasks) {
    if (task.status !== 'done' || !task.completedAt) continue
    const day = dateKey(new Date(task.completedAt))
    if (day < days[0]) {
      cumulative.set(task.projectId, (cumulative.get(task.projectId) ?? 0) + 1)
    } else {
      const counts = daily.get(day) ?? new Map<string, number>()
      counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1)
      daily.set(day, counts)
    }
  }
  return days.map((day) => {
    const row: Record<string, string | number> = {
      day,
      label: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }
    for (const project of data.projects) {
      const count = daily.get(day)?.get(project.id) ?? 0
      const total = (cumulative.get(project.id) ?? 0) + count
      cumulative.set(project.id, total)
      row[`daily_${project.id}`] = count
      row[`cumulative_${project.id}`] = total
    }
    row.total = data.projects.reduce((sum, p) => sum + Number(row[`daily_${p.id}`]), 0)
    return row
  })
}
