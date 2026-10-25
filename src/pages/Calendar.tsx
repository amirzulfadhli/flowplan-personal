import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { dateKey, displayDate, monthDays } from '../domain/dates'
import { useWorkspace } from '../state/WorkspaceContext'
import { useEditor } from '../components/Editors'
import { AddTask } from '../components/Tasks'
import { Card, Empty, PageHeader } from '../components/ui'

export default function Calendar() {
  const { data } = useWorkspace()
  const edit = useEditor()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(dateKey())
  const [projectId, setProjectId] = useState('')
  const [showDone, setShowDone] = useState(false)
  const events = [
    ...data.tasks
      .filter((t) => t.due && (showDone || t.status !== 'done'))
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.due,
        projectId: t.projectId,
        kind: 'task' as const,
        done: t.status === 'done',
      })),
    ...data.projects
      .filter((p) => p.due)
      .map((p) => ({
        id: p.id,
        title: `${p.name} deadline`,
        date: p.due,
        projectId: p.id,
        kind: 'project' as const,
        done: false,
      })),
  ]
    .filter((e) => !projectId || e.projectId === projectId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
  const upcoming = events.filter((e) => e.date >= dateKey()).slice(0, 8)
  const selectedEvents = events.filter((e) => e.date === selected)
  function openEvent(event: (typeof events)[number]) {
    if (event.kind === 'project') navigate(`/projects/${event.id}`)
    else edit({ kind: 'task', task: data.tasks.find((t) => t.id === event.id) })
  }
  const schedule = (items: typeof events) =>
    items.map((e) => (
      <button className="schedule-row" key={`${e.kind}-${e.id}`} onClick={() => openEvent(e)}>
        <span
          className="schedule-accent"
          style={{ background: data.projects.find((p) => p.id === e.projectId)?.color }}
        />
        <strong>{e.title}</strong>
        <small>
          {data.projects.find((p) => p.id === e.projectId)?.name} · {displayDate(e.date)} ·{' '}
          {e.kind === 'project' ? 'Project deadline' : e.done ? 'Completed task' : 'Task'}
        </small>
      </button>
    ))
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Make room for what’s next. Keep every project’s deadlines in view."
      >
        <AddTask />
      </PageHeader>
      <div className="toolbar">
        <select
          className="select"
          aria-label="Calendar project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All projects</option>
          {data.projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="check-label">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Include completed tasks
        </label>
        <span className="grow" />
        <span className="subtle">
          {events.filter((e) => e.date < dateKey() && !e.done).length} past deadlines
        </span>
      </div>
      <div className="calendar-shell">
        <section className="calendar-main" aria-label="Monthly calendar">
          <div className="calendar-header">
            <div>
              <div className="eyebrow">Your schedule</div>
              <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            </div>
            <div className="actions">
              <button
                className="btn small"
                onClick={() => {
                  setMonth(new Date())
                  setSelected(dateKey())
                }}
              >
                Today
              </button>
              <button
                className="iconbtn"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="iconbtn"
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <p className="calendar-intro">A little clarity for the days ahead.</p>
          <div className="calendargrid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div className="weekday" key={day}>
                {day}
              </div>
            ))}
            {monthDays(month).map((date) => {
              const key = dateKey(date)
              const dayEvents = events.filter((e) => e.date === key)
              return (
                <div
                  key={key}
                  className={`day ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === dateKey() ? 'today' : ''} ${selected === key ? 'selected' : ''}`}
                >
                  <button
                    className="day-number"
                    aria-label={`${date.toLocaleDateString(undefined, { dateStyle: 'full' })}, ${dayEvents.length} deadlines`}
                    aria-pressed={selected === key}
                    onClick={() => setSelected(key)}
                  >
                    {date.getDate()}
                    <span>{dayEvents.length || ''}</span>
                  </button>
                  <div className="calendar-events">
                    {dayEvents.slice(0, 2).map((e) => (
                      <button
                        key={`${e.kind}-${e.id}`}
                        className={`event ${e.done ? 'event-done' : ''}`}
                        style={{
                          borderLeftColor: data.projects.find((p) => p.id === e.projectId)?.color,
                        }}
                        title={e.title}
                        onClick={() => openEvent(e)}
                      >
                        <small>
                          {e.kind === 'project'
                            ? 'Project deadline'
                            : data.projects.find((p) => p.id === e.projectId)?.name}
                        </small>
                        {e.title}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <button className="calendar-more" onClick={() => setSelected(key)}>
                        +{dayEvents.length - 2} more
                      </button>
                    )}
                  </div>
                  {dayEvents.length > 0 && <span className="mobile-event-dot" aria-hidden="true" />}
                </div>
              )
            })}
          </div>
          <div className="calendar-legend">
            {data.projects
              .filter((p) => !projectId || p.id === projectId)
              .map((p) => (
                <span key={p.id}>
                  <i className="dot" style={{ background: p.color }} />
                  {p.name}
                </span>
              ))}
          </div>
        </section>
        <aside className="verticalgap">
          <Card title={displayDate(selected)} description="Selected day">
            {selectedEvents.length ? (
              schedule(selectedEvents)
            ) : (
              <Empty>No deadlines on this day.</Empty>
            )}
          </Card>
          <Card title="Upcoming schedule" description="Project deadlines and open tasks">
            {upcoming.length ? (
              schedule(upcoming)
            ) : (
              <Empty>No upcoming deadlines. Set a date on a task or project.</Empty>
            )}
          </Card>
        </aside>
      </div>
    </>
  )
}
