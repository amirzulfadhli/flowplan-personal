import { useRegisterSW } from 'virtual:pwa-register/react'

/** Mounted only in the browser. Installed desktop assets never use a service worker. */
export function BrowserOffline() {
  const {
    offlineReady: [ready],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW()
  return (
    <>
      {refresh && (
        <div className="notice flex items-center justify-between gap-3">
          <span>An update is ready. Save any open edits before reloading.</span>
          <button className="btn" onClick={() => void updateServiceWorker(true)}>
            Reload app
          </button>
        </div>
      )}
      {ready && <p className="offline-note">Ready to reopen offline on this device.</p>}
    </>
  )
}
