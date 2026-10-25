import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Folder,
  House,
  LayoutDashboard,
  ListTodo,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useWorkspace } from './state/WorkspaceContext'
import { EditorsProvider, useEditor } from './components/Editors'
import { Empty, Modal } from './components/ui'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import TasksPage from './pages/TasksPage'
import Board from './pages/Board'
import Calendar from './pages/Calendar'
import SettingsPage from './pages/Settings'

const Analytics = lazy(() => import('./pages/Analytics'))
const nav = [
  { to: '/', name: 'Home', icon: House },
  { to: '/projects', name: 'Projects', icon: Folder },
  { to: '/tasks', name: 'Tasks', icon: ListTodo },
  { to: '/board', name: 'Board', icon: LayoutDashboard },
  { to: '/calendar', name: 'Calendar', icon: CalendarDays },
  { to: '/insights', name: 'Insights', icon: BarChart3 },
]
export default function App() {
  return (
    <EditorsProvider>
      <Shell />
    </EditorsProvider>
  )
}

function Shell() {
  const { data, busy, error, clearError } = useWorkspace()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const location = useLocation()
  const current =
    nav.find((n) => n.to !== '/' && location.pathname.startsWith(n.to))?.name ??
    (location.pathname === '/settings' ? 'Settings' : 'Home')
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearch((v) => !v)
      }
      if (event.key === 'Escape') setMenu(false)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      {menu && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'mobile-open' : ''}`} aria-label="Workspace sidebar">
        <NavLink to="/" className="brand" onClick={() => setMenu(false)}>
          <span className="brandmark">F</span>
          <span>
            FlowPlan<span className="brand-personal">Personal</span>
          </span>
        </NavLink>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <UserRound size={15} />
          </span>
          <div>
            <strong>Personal workspace</strong>
            <small>Space for your best work</small>
          </div>
        </div>
        <div className="section-label">Workspace</div>
        <nav className="nav" aria-label="Main navigation">
          {nav.map(({ to, name, icon: Icon }) => (
            <NavLink key={to} end={to === '/'} to={to} onClick={() => setMenu(false)}>
              <Icon size={16} />
              {name}
            </NavLink>
          ))}
        </nav>
        <div className="section-label">Your projects</div>
        <nav className="nav pnav" aria-label="Your projects">
          {data.projects.slice(0, 8).map((p) => (
            <NavLink to={`/projects/${p.id}`} key={p.id} onClick={() => setMenu(false)}>
              <span className="dot" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
            </NavLink>
          ))}
          {!data.projects.length && (
            <span className="sidebar-empty">Your projects will live here.</span>
          )}
        </nav>
        <div className="sidefoot">
          <NavLink to="/settings" className="profile-link" onClick={() => setMenu(false)}>
            <span className="avatar">{data.profile.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0">
              <strong>{data.profile.name}</strong>
              <small>Personal · This device</small>
            </span>
          </NavLink>
          <nav className="nav" aria-label="Preferences">
            <NavLink to="/settings" onClick={() => setMenu(false)}>
              <Settings size={15} />
              Settings
            </NavLink>
          </nav>
          <div className="local-label">
            <ShieldCheck size={12} />
            Local-first workspace
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="iconbtn mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={17} />
          </button>
          <span className="crumb">Workspace</span>
          <ChevronRight size={12} className="subtle" />
          <strong className="crumb-current">{current}</strong>
          <span className="grow" />
          <span className="save-status" role="status">
            {error ? 'Save failed' : busy ? 'Saving…' : 'Saved locally'}
          </span>
          <button className="top-search" onClick={() => setSearch(true)}>
            <Search size={14} />
            <span>Search your workspace</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>
        <main id="main" className="layout" tabIndex={-1}>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button className="iconbtn" aria-label="Dismiss error" onClick={clearError}>
                <X size={14} />
              </button>
            </div>
          )}
          {needRefresh && (
            <div className="notice flex items-center justify-between gap-3">
              <span>An update is ready. Save any open edits before reloading.</span>
              <button className="btn" onClick={() => void updateServiceWorker(true)}>
                Reload app
              </button>
            </div>
          )}
          <Suspense fallback={<p role="status">Loading insights…</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/board" element={<Board />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/insights" element={<Analytics />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <Empty
                    action={
                      <NavLink to="/" className="btn">
                        Go home
                      </NavLink>
                    }
                  >
                    This page could not be found.
                  </Empty>
                }
              />
            </Routes>
          </Suspense>
          {offlineReady && <p className="offline-note">Ready to reopen offline on this device.</p>}
        </main>
      </div>
      {search && <WorkspaceSearch onClose={() => setSearch(false)} />}
    </div>
  )
}
function WorkspaceSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { data } = useWorkspace()
  const navigate = useNavigate()
  const edit = useEditor()
  const term = query.toLowerCase().trim()
  const matches = [
    ...data.projects.map((p) => ({
      id: `p-${p.id}`,
      label: p.name,
      context: 'Project',
      open: () => navigate(`/projects/${p.id}`),
    })),
    ...data.tasks.map((t) => ({
      id: `t-${t.id}`,
      label: t.title,
      context: data.projects.find((p) => p.id === t.projectId)?.name ?? 'Task',
      open: () => edit({ kind: 'task', task: t }),
    })),
    ...nav.map((n) => ({ id: n.to, label: n.name, context: 'Page', open: () => navigate(n.to) })),
  ]
    .filter((item) => `${item.label} ${item.context}`.toLowerCase().includes(term))
    .slice(0, 15)
  return (
    <Modal title="Search workspace" onClose={onClose}>
      <input
        autoFocus
        className="search w-full"
        aria-label="Search workspace"
        placeholder="Find projects, tasks, or pages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="search-results">
        {matches.map((item) => (
          <button
            className="search-result"
            key={item.id}
            onClick={() => {
              onClose()
              item.open()
            }}
          >
            <strong>{item.label}</strong>
            <small>{item.context}</small>
          </button>
        ))}
        {!matches.length && <Empty>No matching projects, tasks, or pages.</Empty>}
      </div>
    </Modal>
  )
}
