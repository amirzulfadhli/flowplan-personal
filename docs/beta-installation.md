# Installing a limited beta candidate

Only use an installer supplied with an exact commit and SHA-256. No release has been published by this preparation work. The current package is unsigned; do not disable Windows security protections to install it. If your environment blocks it, report the block or use an appropriately managed test machine.

## Before upgrading

1. Export JSON from Settings and keep a copy outside the application-data directory.
2. Quit FlowPlan from its tray menu. Closing the main window normally leaves it running.
3. For a full device backup, copy the complete closed database directory, including any SQLite sidecar files. Paths and recovery details are in [the desktop guide](desktop.md).
4. Retain your previous installer. Database downgrades are not supported; do not assume an older executable can open a future schema.

## First use

Run the Windows installer for your current user. WebView2 must be available; the current installer downloads its bootstrapper when the runtime is absent, so a clean machine without WebView2 needs internet. A failed prerequisite download/installation aborts setup. This path still requires execution in a disposable clean Windows environment; do not remove the host runtime to test it. Once installed, normal project management works offline.

A fresh desktop workspace includes a compact getting-started guide with a Settings/backups link and close-to-tray instructions. The guide goes away once projects exist. A fresh workspace is empty. Create a project, then capture a task. The sidebar profile is a local display name, not an account. Browser data does not automatically appear in desktop: export it from the original browser, then review and import the JSON in desktop Settings. Imports replace the destination workspace, so export that destination first if it contains anything you need.

Control+Shift+Space opens Quick Add unless another application owns the shortcut. Settings lets you change it. Closing the main window hides it to the tray by default; **Quit FlowPlan** exits. Hiding the companion does not pause a running focus timer.

AI is opt-in per project. It requires an independently installed local Ollama model and can give inaccurate advice. Review every proposed field before approval. FlowPlan does not download models automatically.

## If something goes wrong

Do not delete the database or repeatedly reinstall to recover missing data. Preserve your backup and note the exact error. Settings can review automatic recovery copies when storage is readable. See [backup and recovery instructions](desktop.md).

Report the candidate commit/hash, Windows/WebView2 versions, display arrangement/scaling, whether the app was closed or explicitly quit, and minimal reproduction steps using synthetic data. Redact project names and content from screenshots and logs. Never include credentials or your full personal database in a public issue.

## Acceptance scope

The increasing-version upgrade was exercised with the separate **FlowPlan Beta Acceptance** identity (0.4.0 → 0.4.1) and synthetic data. Those installers are test artifacts, not beta downloads. The repository product version remains 0.4.0. Consult [the final gate review](phase-6-final-gates.md) before deciding whether a candidate is suitable for your test environment. Do not treat blocked physical/clean-machine checks as passed.
