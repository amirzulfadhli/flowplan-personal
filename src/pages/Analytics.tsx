import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useWorkspace } from '../state/WorkspaceContext'
import { chartData, progress } from '../domain/selectors'
import { statusLabels, statuses } from '../domain/model'
import { Card, Empty, PageHeader, Progress } from '../components/ui'

const axis = { tick: { fontSize: 9, fill: '#9296a2' }, axisLine: false, tickLine: false }
const tooltip = {
  contentStyle: { border: '1px solid #e6e9f0', borderRadius: 8, fontSize: 11 },
  cursor: { fill: '#f1f3fa' },
}
export default function Analytics() {
  const { data } = useWorkspace()
  const [span, setSpan] = useState(14)
  const [hidden, setHidden] = useState<string[]>([])
  const [focus, setFocus] = useState('')
  const series = chartData(data, span)
  const visible = data.projects.filter((p) => !hidden.includes(p.id))
  const focused = data.projects.find((p) => p.id === focus) ?? data.projects[0]
  const stats = progress(data.tasks)
  const recent = series.reduce(
    (sum, row) => sum + visible.reduce((n, p) => n + Number(row[`daily_${p.id}`]), 0),
    0,
  )
  const workflow = statuses.map((status) => ({
    label: statusLabels[status],
    tasks: data.tasks.filter((t) => t.status === status).length,
  }))
  const legend = (
    <div className="chart-legend">
      {data.projects.map((p) => (
        <button
          className={`legend-btn ${hidden.includes(p.id) ? 'dimmed' : ''}`}
          aria-pressed={!hidden.includes(p.id)}
          key={p.id}
          onClick={() =>
            setHidden(
              hidden.includes(p.id) ? hidden.filter((id) => id !== p.id) : [...hidden, p.id],
            )
          }
        >
          <span className="dot" style={{ background: p.color }} />
          {p.name}
        </button>
      ))}
    </div>
  )
  return (
    <>
      <PageHeader
        title="Insights"
        description="A closer look at your progress. Every number comes from your workspace."
      />
      <div className="insights-ui">
        <div className="toolbar">
          <span className="data-badge">
            <span className="dot" />
            My data · Recorded activity
          </span>
          <span className="grow" />
          <div className="segments">
            {[7, 14, 30].map((n) => (
              <button
                aria-pressed={span === n}
                className={span === n ? 'on' : ''}
                onClick={() => setSpan(n)}
                key={n}
              >
                {n} days
              </button>
            ))}
          </div>
        </div>
        <div className="insights-headstats">
          {[
            { label: 'Projects', value: data.projects.length, meta: 'Your tracked projects' },
            { label: 'Tasks completed', value: stats.done, meta: `Of ${stats.total} total tasks` },
            { label: 'Completion rate', value: `${stats.percent}%`, meta: 'Across saved projects' },
            {
              label: 'Recent task activity',
              value: recent,
              meta: `${span}-day selected project count`,
            },
          ].map((s) => (
            <div className="insights-stat" key={s.label}>
              <div className="key">{s.label}</div>
              <div className="value">{s.value}</div>
              <div className="meta">{s.meta}</div>
            </div>
          ))}
        </div>
        {!data.tasks.length && (
          <div className="notice">
            Your charts start at zero. Add projects and complete tasks to build your own progress
            history.
          </div>
        )}
        <div className="insights-cards">
          <Card
            className="ins-card"
            title="Project performance"
            description="Completed tasks within each project"
            action={
              <Link to="/projects" className="linkbtn">
                View projects ↗
              </Link>
            }
          >
            <div className="ins-highlight">
              {stats.done}
              <span> of {stats.total} completed</span>
            </div>
            <div className="ins-hbars">
              {data.projects.map((p) => {
                const s = progress(data.tasks.filter((t) => t.projectId === p.id))
                return (
                  <button
                    className={`ins-hrow ${focused?.id === p.id ? 'focused' : ''}`}
                    key={p.id}
                    onClick={() => setFocus(p.id)}
                    aria-pressed={focused?.id === p.id}
                  >
                    <div className="hrow-line">
                      <strong>{p.name}</strong>
                      <small>
                        {s.done} of {s.total} tasks · {s.percent}%
                      </small>
                    </div>
                    <Progress value={s.percent} color={p.color} />
                  </button>
                )
              })}
            </div>
            {!data.projects.length && <Empty>Create a project to see its progress here.</Empty>}
            <p className="chart-note">Select a project to inspect its daily pace below.</p>
          </Card>
          <Card
            className="ins-card"
            title="Task activity"
            description="Daily completions layered by project"
          >
            <div className="ins-highlight">
              {recent}
              <span> tasks in the selected period</span>
            </div>
            {legend}
            <div className="chart-container" aria-label="Daily tasks completed by project">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} barSize={span === 30 ? 8 : 14}>
                  <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="3 4" />
                  <XAxis dataKey="label" {...axis} minTickGap={35} />
                  <YAxis {...axis} allowDecimals={false} width={24} />
                  <Tooltip {...tooltip} />
                  {visible.map((p) => (
                    <Bar
                      key={p.id}
                      dataKey={`daily_${p.id}`}
                      name={p.name}
                      stackId="projects"
                      fill={p.color}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card
            className="ins-card"
            title="Workflow balance"
            description="Where your saved tasks stand today"
          >
            <div className="ins-highlight">
              {stats.total - stats.done}
              <span> tasks still in progress or waiting</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workflow} barSize={26}>
                  <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="3 4" />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} allowDecimals={false} width={24} />
                  <Tooltip {...tooltip} />
                  <Bar
                    dataKey="tasks"
                    name="Tasks"
                    fill="#eea77f"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card
            className="ins-card"
            title="Task momentum"
            description="Daily completion pace for one project"
            action={
              <select
                className="select small"
                aria-label="Momentum project"
                value={focused?.id ?? ''}
                onChange={(e) => setFocus(e.target.value)}
              >
                {!data.projects.length && <option value="">No project</option>}
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            }
          >
            <div className="ins-highlight">
              {focused ? series.reduce((n, row) => n + Number(row[`daily_${focused.id}`]), 0) : 0}
              <span> tasks in {span} days</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#eea77f" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#eea77f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="3 4" />
                  <XAxis dataKey="label" {...axis} minTickGap={35} />
                  <YAxis {...axis} allowDecimals={false} width={24} />
                  <Tooltip {...tooltip} />
                  <Area
                    type="linear"
                    dataKey={(row: Record<string, string | number>) =>
                      Number(row[focused ? `daily_${focused.id}` : 'total'])
                    }
                    name={focused?.name ?? 'Tasks'}
                    stroke="#ed976c"
                    fill="url(#pace-fill)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card
            className="ins-card ins-wide"
            title="Project completion over time"
            description="Cumulative completed tasks · a separate line for each project"
          >
            {legend}
            <div
              className="chart-container chart-wide"
              aria-label="Layered project completion statistics"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid vertical={false} stroke="#eceef2" strokeDasharray="3 5" />
                  <XAxis dataKey="label" {...axis} minTickGap={40} />
                  <YAxis {...axis} allowDecimals={false} width={24} />
                  <Tooltip {...tooltip} />
                  {visible.map((p) => (
                    <Line
                      key={p.id}
                      type="linear"
                      dataKey={`cumulative_${p.id}`}
                      name={p.name}
                      stroke={p.color}
                      dot={false}
                      strokeWidth={2.2}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="chart-note">
              Cumulative totals include tasks completed before this window. These charts reflect
              currently completed tasks, grouped by their latest completion date in your device’s
              time zone. Reopening or deleting a task removes it from these totals; they are not an
              immutable historical audit.
            </p>
            <details className="chart-data">
              <summary>View chart data as a table</summary>
              <div className="data-table-wrap">
                <table>
                  <caption>Daily completions for visible projects</caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      {visible.map((p) => (
                        <th key={p.id}>{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        {visible.map((p) => (
                          <td key={p.id}>{row[`daily_${p.id}`]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </div>
      </div>
    </>
  )
}
