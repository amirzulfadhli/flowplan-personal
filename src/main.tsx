import { Component, StrictMode, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { WorkspaceProvider } from './state/WorkspaceContext'
import './styles.css'
import { isDesktop } from './storage/desktop'

const floating = isDesktop() && new URLSearchParams(window.location.search).get('companion') === '1'
const Companion = lazy(() => import('./desktop/Companion'))
if (floating) document.getElementById('root')!.classList.add('companion-root')

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FlowPlan rendering error', error, info)
  }
  render() {
    if (this.state.failed)
      return (
        <main className="startup">
          <h1>Something went wrong</h1>
          <p>Your saved workspace has not been reset. Reload the app to try again.</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload FlowPlan
          </button>
        </main>
      )
    return this.props.children
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WorkspaceProvider>
        {floating ? (
          <Suspense fallback={<p>Opening companion…</p>}>
            <Companion />
          </Suspense>
        ) : (
          <HashRouter>
            <App />
          </HashRouter>
        )}
      </WorkspaceProvider>
    </ErrorBoundary>
  </StrictMode>,
)
