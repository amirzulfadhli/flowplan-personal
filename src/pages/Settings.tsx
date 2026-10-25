import { useState, type FormEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceContext'
import { parseImport, type Workspace } from '../domain/model'
import { dateKey } from '../domain/dates'
import { Card, Modal, PageHeader } from '../components/ui'

export function downloadBackup(data: Workspace) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `flowplan-backup-${dateKey()}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function Settings() {
  const { data, execute, busy, error } = useWorkspace()
  const [name, setName] = useState(data.profile.name)
  const [message, setMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [candidate, setCandidate] = useState<Workspace | null>(null)
  const [backedUp, setBackedUp] = useState(false)
  async function profile(e: FormEvent) {
    e.preventDefault()
    if (await execute({ type: 'profile', name })) setMessage('Profile saved on this device.')
  }
  async function inspect(file?: File) {
    if (!file) return
    setImportError('')
    setBackedUp(false)
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error('The backup exceeds the 20 MB import limit.')
      setCandidate(parseImport(await file.text()))
    } catch (error) {
      setImportError(
        error instanceof SyntaxError
          ? 'This file is not valid JSON. No data has been changed.'
          : error instanceof Error
            ? error.message
            : 'Could not read this backup.',
      )
    }
  }
  async function restore() {
    if (candidate && (await execute({ type: 'import', data: candidate }))) {
      setName(candidate.profile.name)
      setCandidate(null)
      setMessage('Backup restored successfully.')
    }
  }
  return (
    <>
      <PageHeader title="Settings" description="Your workspace, your data, your control." />
      <div className="settings-grid">
        <Card
          title="Personal profile"
          description="A local display name. No sign-in or online account."
        >
          <form className="editor-form" onSubmit={(e) => void profile(e)}>
            <label>
              Display name
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="btn primary self-start" disabled={busy || !name.trim()}>
              Save profile
            </button>
          </form>
        </Card>
        <Card
          title="Backup & restore"
          description="Keep a portable copy of your projects, tasks, notes, and activity."
        >
          <div className="backup-stats">
            <strong>{data.projects.length}</strong> projects <span>·</span>
            <strong>{data.tasks.length}</strong> tasks <span>·</span>
            <strong>{data.activity.length}</strong> activity entries
          </div>
          <div className="actions">
            <button className="btn" onClick={() => downloadBackup(data)}>
              <Download size={14} />
              Export JSON
            </button>
            <label className="btn file-button">
              <Upload size={14} />
              Import JSON
              <input
                aria-label="Import JSON backup"
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  void inspect(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="subtle mt-3">
            Imports replace this workspace after review. Only FlowPlan v1 backups are supported; the
            HTML prototype’s demo format is different.
          </p>
          {importError && (
            <p role="alert" className="error-text">
              {importError}
            </p>
          )}
        </Card>
        <Card title="Local storage" description="Stored in IndexedDB in this browser profile.">
          <p className="note">
            Your data stays on this device. Clearing site data or using a different browser profile
            will create a separate workspace. Export backups regularly.
          </p>
          <p className="note">
            After the production app finishes caching on its first visit, it can reopen offline at
            the same address. Development mode requires the local dev server.
          </p>
        </Card>
        <Card
          title="About FlowPlan Personal"
          description="Phase 1 · A calm place to make progress."
        >
          <p className="note">
            Built for individual projects, with no backend, authentication, or synchronization.
            Native Windows packaging and a durable desktop database are planned for Phase 2.
          </p>
          <span className="data-badge">Schema version {data.schemaVersion}</span>
        </Card>
      </div>
      <p role="status" className="success-text mt-4">
        {message}
      </p>
      {candidate && (
        <Modal title="Review backup import" onClose={() => setCandidate(null)}>
          <p className="note">
            Replace your current workspace with{' '}
            <strong>{candidate.projects.length} projects</strong>,{' '}
            <strong>{candidate.tasks.length} tasks</strong>, and{' '}
            <strong>{candidate.activity.length} activity entries</strong> from this backup?
          </p>
          <p className="notice">
            This replaces all current data. Export a copy first so you can undo the replacement by
            restoring it.
          </p>
          <div className="actions">
            <button
              className="btn"
              onClick={() => {
                downloadBackup(data)
                setBackedUp(true)
              }}
            >
              <Download size={14} />
              Export current workspace
            </button>
          </div>
          <label className="check-label mt-4">
            <input
              type="checkbox"
              checked={backedUp}
              onChange={(e) => setBackedUp(e.target.checked)}
            />
            I have a backup, or accept replacing the current data.
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setCandidate(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy || !backedUp}
              onClick={() => void restore()}
            >
              Replace workspace
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
