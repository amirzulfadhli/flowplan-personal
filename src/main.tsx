import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { WorkspaceProvider } from './state/WorkspaceContext'
import './styles.css'

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
        <HashRouter>
          <App />
        </HashRouter>
      </WorkspaceProvider>
    </ErrorBoundary>
  </StrictMode>,
)
