import { useState, type FormEvent } from 'react'
import { Card } from '../components/ui'
import { useCompanion, type CompanionState } from './bridge'

export default function DesktopPreferences() {
  const companion = useCompanion()
  const { state, error, action, refresh } = companion
  const [formVersion, setFormVersion] = useState(0)
  return (
    <Card title="Desktop companion" description="Quick capture and focus, one shortcut away.">
      <p className="note">
        Closing the main window{' '}
        {state?.closeToTray === false ? 'quits FlowPlan' : 'keeps FlowPlan in the system tray'}. Use
        Quit to stop the app. Hiding the widget keeps your focus timer running; pause it to stop
        counting.
      </p>
      <div className="actions">
        <button className="btn" onClick={() => void action('toggle')}>
          {state?.visible ? 'Hide widget' : 'Show widget'}
        </button>
        <button className="btn" onClick={() => void action('quickAdd')}>
          Quick Add
        </button>
        <button className="btn" onClick={() => void action('resetPosition')}>
          Reset widget position
        </button>
        <button className="btn" onClick={() => void action('quit')}>
          Quit FlowPlan
        </button>
      </div>
      {state && <PreferenceForm key={formVersion} state={state} companion={companion} />}
      {(error || state?.shortcutError) && (
        <p className="error-text" role="alert">
          {error || state?.shortcutError}
        </p>
      )}
      <button
        className="btn mt-3"
        onClick={() => void refresh().then(() => setFormVersion((v) => v + 1))}
      >
        Reload companion settings
      </button>
    </Card>
  )
}
function PreferenceForm({
  state,
  companion,
}: {
  state: CompanionState
  companion: ReturnType<typeof useCompanion>
}) {
  const [top, setTop] = useState(state.alwaysOnTop)
  const [tray, setTray] = useState(state.closeToTray)
  const [shortcut, setShortcut] = useState(state.shortcut)
  const [saved, setSaved] = useState(false)
  const [baseline, setBaseline] = useState({
    top: state.alwaysOnTop,
    tray: state.closeToTray,
    shortcut: state.shortcut,
  })
  const changedElsewhere =
    baseline.top !== state.alwaysOnTop ||
    baseline.tray !== state.closeToTray ||
    baseline.shortcut !== state.shortcut
  async function save(e: FormEvent) {
    e.preventDefault()
    if (changedElsewhere) return
    const success = await companion.update({
      type: 'preferences',
      alwaysOnTop: top,
      closeToTray: tray,
      shortcut,
      expectedRevision: state.revision,
    })
    if (success) setBaseline({ top, tray, shortcut: shortcut.trim() })
    setSaved(success)
  }
  return (
    <form className="editor-form mt-4" onSubmit={(e) => void save(e)}>
      <label className="check-label">
        <input
          type="checkbox"
          checked={top}
          onChange={(e) => {
            setTop(e.target.checked)
            setSaved(false)
          }}
        />
        Keep widget above other windows
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={tray}
          onChange={(e) => {
            setTray(e.target.checked)
            setSaved(false)
          }}
        />
        Close main window to tray
      </label>
      <label>
        Global Quick Add shortcut
        <input
          value={shortcut}
          maxLength={100}
          placeholder="Control+Shift+Space"
          onChange={(e) => {
            setShortcut(e.target.value)
            setSaved(false)
          }}
        />
      </label>
      <p className="subtle">
        Use Control or Alt with a key, such as Control+Shift+Space. Leave blank to disable.
        Conflicts keep your previous shortcut.
      </p>
      {changedElsewhere && (
        <p role="alert" className="error-text">
          Settings changed in another window. Reload companion settings before saving. Your draft
          has been kept here.
        </p>
      )}
      <button className="btn primary self-start" disabled={companion.busy || changedElsewhere}>
        Save companion settings
      </button>
      {saved && (
        <p role="status" className="success-text">
          Companion settings saved.
        </p>
      )}
    </form>
  )
}
