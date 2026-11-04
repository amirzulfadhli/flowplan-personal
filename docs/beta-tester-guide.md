# Supervised beta tester guide — 0.5.0-beta.1

**Preparation only. No installer is being distributed or released.** This protocol is for a later, separately authorized session with trusted Windows testers. Before starting, the coordinator must supply the exact version, source commit, installer SHA-256, and agreed private reporting channel. Do not forward installers or report personal content in public issues.

## Scope

Use Windows x64, preferably a disposable VM or separate test account, and synthetic projects only. The package is unsigned. Keep Windows protections enabled; report a block rather than bypassing it. Windows 11 build 26200.9711 at 125% scaling is the observed host configuration, not proof that all Windows 10/11 systems work. Read the [candidate record](phase-7-beta-preparation.md) and [remaining Phase 6 gates](beta-checklist.md).

Data stays on the device: SQLite on desktop and separate IndexedDB data in each browser origin/profile. No account, cloud backup, or automatic synchronization exists. AI is optional, experimental, enabled explicitly per project, and requires a separately installed local Ollama model. Leave AI off for initial acceptance. Do not use this beta as the only copy of important work.

## Before the session

1. Agree which [manual checklist](beta-manual-acceptance.md) rows your hardware can exercise. Mark unavailable environments **Blocked**, never Pass.
2. Compare the entire installer SHA-256 with the coordinator's candidate record using `Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\path\to\FlowPlan Personal_0.5.0-beta.1_x64-setup.exe'`. Stop on a mismatch. A matching hash establishes file identity, not publisher signing or safety certification.
3. Follow [backup and recovery](beta-recovery.md). A separate installation folder does **not** isolate data: the normal identifier remains `com.amirzulfadhli.flowplan-personal`. Use a separate Windows account or VM.
4. Quit existing FlowPlan through Settings or its tray menu. Closing the main window normally leaves it running. Retain the previous installer and pre-upgrade backup privately.

## First 15 minutes

1. Install normally for the current user; do not use `/UPDATE` for a clean installation. Without WebView2, the bootstrapper needs internet. Missing-runtime and network-failure execution remain human acceptance gates; never remove the runtime from your working machine to simulate them.
2. Launch and confirm the empty getting-started guide. Create `Beta sample`, add `Check persistence`, edit its due date/status, and add a synthetic note. Check project-specific activity and navigation.
3. Export JSON in Settings to a private folder outside application data. Quit explicitly, reopen, and verify the project/task/note. Disconnect the network and repeat a small core edit with AI off; reconnect afterward.
4. Exercise close-to-tray, tray Open/Quick Add/Show/Hide, and explicit Quit using the manual checklist. Stop if the UI is unreachable or the wrong workspace appears.
5. In the synthetic account only, review/import the saved JSON. Import **replaces**, not merges, the destination. Verify content and inspect the recovery copy in Settings.

Record expected versus observed behavior. Stop on data loss/corruption, repeated setup failure, crashes, or unrecoverable UI. Preserve backups and contact the coordinator before retrying. Do not reset the database or disable security tools to continue.

## Safe diagnostics

The optional [collector](../scripts/collect-beta-diagnostics.ps1) is read-only and sends nothing. From a reviewed repository checkout, run:

```powershell
.\scripts\collect-beta-diagnostics.ps1 -Installer 'C:\path\to\FlowPlan Personal_0.5.0-beta.1_x64-setup.exe'
```

Omit `-Installer` for environment metadata only. Output is JSON containing Windows build, OS architecture, registered WebView2 versions, and optional installer product/version/size/SHA-256/signature status. An empty runtime array means no readable matching registration, not definitive proof of absence. Inspect output before sharing in the agreed private channel. No report is saved unless you redirect output. If policy blocks scripts, leave policy unchanged and manually enter fields from Windows Settings and the candidate record.

The collector does **not** read projects, counts, notes, activity, databases, recovery copies, backups, prompts, usernames, computer names, paths, environment variables, network addresses, screenshots, process lists, or crash dumps. Do not add these to a report. Screenshots are optional, synthetic-only, cropped, and checked for names, paths, notifications, and other apps. Raw logs, startup traces, and exception stacks can contain personal paths; keep them local unless the coordinator requests a reviewed, redacted excerpt. No telemetry or automatic upload was added.

Use the [bug report](templates/beta-bug-report.md) for defects and [feedback form](templates/beta-feedback.md) for usability observations. End each session with completed/blocked checklist rows and brief feedback. Never attach an installer, database, or backup.
