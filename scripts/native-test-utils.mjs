import { resolve } from 'node:path'

// Test-only diagnostics. Production launches do not enable debugging or logging.
export function desktopEnvironment(root, port) {
  return {
    ...process.env,
    FLOWPLAN_TEST_DATA_DIR: resolve(root, 'data'),
    WEBVIEW2_USER_DATA_FOLDER: resolve(root, 'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --enable-logging --log-file="${resolve(root, 'webview2.log')}"`,
  }
}
export async function waitForDesktop(app, endpoint) {
  let launchError
  const onError = (error) => {
    launchError = error
  }
  app.on('error', onError)
  try {
    for (let i = 0; i < 240; i++) {
      if (launchError) throw launchError
      if (app.exitCode !== null || app.signalCode !== null)
        throw new Error(
          `Native app exited before WebView2 was ready: code=${app.exitCode}, signal=${app.signalCode}. Inspect native/WebView2 logs.`,
        )
      try {
        if ((await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) })).ok)
          return
      } catch {
        /* first-run WebView2 initialization */
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(
      `Native process ${app.pid} is running but WebView2 debugging is unavailable at ${endpoint}. Inspect webview2.log, runtime installation, and runner graphics/policies.`,
    )
  } finally {
    app.off('error', onError)
  }
}
