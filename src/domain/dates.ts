/** Calendar dates stay local; timestamps are UTC instants. Never parse YYYY-MM-DD as UTC. */
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dayOffset(amount: number, from = new Date()) {
  const date = new Date(from)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}
export function displayDate(value: string) {
  if (!value) return 'No deadline'
  if (value === dateKey()) return 'Today'
  if (value === dayOffset(1)) return 'Tomorrow'
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: value.slice(0, 4) !== String(new Date().getFullYear()) ? 'numeric' : undefined,
  })
}
export function monthDays(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  )
}
