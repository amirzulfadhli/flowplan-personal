# Phase 6 startup investigation and beta verification

Continued from `5d5691b` on `feat/phase-6-release-prep`, 28 October 2026. No merge, tag, or release. **Phase 6 is not fully complete:** the intermittent native initialization delay and physical/installation acceptance gates below remain open.

## Confirmed findings and changes

- Desktop mounted the workspace by reading it immediately and again after registering its change listener. It now subscribes first and performs one initial read. A regression test verifies ordering, one read, subsequent commit refresh, and listener cleanup. Browser initialization is unchanged.
- Opt-in `FLOWPLAN_STARTUP_TRACE` records native entry, context creation, plugin initialization, application setup, database open/read, and navigation milestones. It writes only timing and milestone names to the caller-selected local file. Normal runs create no diagnostic file. A React performance mark records the first committed workspace view.
- In a slow pre-change debug sample, context creation finished at 22 ms, application setup started at 7,639 ms, and the first SQLite open took 32 ms. The delay preceded SQLite and React.
- The final debug marker narrows the slow interval further: plugins were ready at 29/24 ms, but application setup began at 6,689/6,617 ms. Tauri 2.12.5 creates configured windows before calling application setup. This interval includes event-loop dispatch, native window/WebView2 construction, and asset setup; it is **not a pure WebView2 initialization measurement**. Pinpointing the internal wait still requires runtime/ETW profiling. No cache deletion, SQLite durability reduction, or speculative runtime flag was introduced.
- The benchmark could reconnect to a previous process's still-closing CDP endpoint. It now waits for endpoint teardown between launches and records that wait separately. This corrects a measurement failure; it did not eliminate the slow debug reopen.

- A targeted debug follow-up waited 10 seconds after each Quit. Reopens fell to 1,524/1,479 ms, versus 7,364/7,250 ms immediately. This supports teardown/profile-lifetime contention as a hypothesis, not a proven specific WebView2 lock or a product fix. The audit now exposes this interval through `FLOWPLAN_AUDIT_RESTART_DELAY_MS` (0–60,000 ms); no delay was added to the application.

## Measurements

Same Windows host, 8 GB RAM, 125% display scale, no concurrent build or model inference during the final samples. Host build: 26200.9711 (25H2). Installed WebView2 directories: 155.0.4283.62 and 156.0.4314.50; the exact runtime selected for each sample was not captured, so these are not runtime-version-controlled benchmarks.

| Sample                                         | First launch | Reopen 1 | Reopen 2 |
| ---------------------------------------------- | -----------: | -------: | -------: |
| Checkpoint debug, before optimization          |     2,248 ms | 2,046 ms | 7,190 ms |
| Final debug desktop-test                       |     2,019 ms | 7,364 ms | 7,250 ms |
| Optimized production profile, audit identifier |     1,992 ms | 1,493 ms | 1,208 ms |

Delayed-debug follow-up: fresh launch 2,500 ms; reopens after 10 seconds 1,524 and 1,479 ms. Evidence: `desktop-test-results/performance-1793181845498/report.json`. The controlled waiting interval is outside the reported launch times. This follow-up used an ignored copy of the same harness with only the explicit wait inserted; the committed environment option reproduces it.

Times are process launch through Playwright navigation visibility, including automation polling/attachment. Production used an existing, empty audit database; the historical report incorrectly labels its first launch fresh. The harness now checks database existence. Debug used a new empty database and WebView profile. Production had single-instance support enabled, an isolated application identifier, and environment-enabled CDP; debug additionally enables desktop-test/devtools and explicit WebView environment overrides. These differences prevent attributing the entire gap to compiler optimization. The production sample does not prove the intermittent delay is absent from normal distribution builds.

| Stage, final samples                                                |      Debug | Production audit |
| ------------------------------------------------------------------- | ---------: | ---------------: |
| Context ready after native entry                                    |    9–14 ms |          7–15 ms |
| Initial database open                                               |   11–25 ms |          6–11 ms |
| Navigation-start to navigation-finish callback                      | 124–203 ms |       104–138 ms |
| First React workspace commit, relative to browser navigation origin | 571–606 ms |       362–466 ms |
| Post-ready SQLite IPC round trip                                    |   36–95 ms |         30–43 ms |

The native and browser clocks have different origins; do not add these rows together. Native reads now show one startup snapshot plus the benchmark's explicit post-ready read, versus two startup snapshots before. This is the demonstrated optimization. There is **no demonstrated end-to-end startup speedup** from this small change.

| Short idle observation, entire owned process tree |          Debug | Production audit |
| ------------------------------------------------- | -------------: | ---------------: |
| Main + island private bytes                       |      202.8 MiB |        251.0 MiB |
| Both windows hidden private bytes                 |      199.5 MiB |        246.1 MiB |
| Visible CPU-seconds / sample seconds              | 0.359 / 15.807 |   3.625 / 16.036 |
| Hidden CPU-seconds / sample seconds               | 0.141 / 15.917 |   0.375 / 16.170 |

Empty workspaces only. Visible production sampling includes recent companion initialization; this is not steady-state CPU or a memory improvement claim. Hidden WebViews retain drafts. These short observations cannot establish leak-free or long-duration behavior.

Local raw evidence under ignored `desktop-test-results/`: checkpoint `performance-1793180003014`, pre-change instrumentation `performance-1793180467140` (partial run, third CDP attachment failed), production `performance-1793181123158`, final debug `performance-1793181268232`. Each contains native traces and/or `report.json`. Raw artifacts are machine-local; this document preserves their relevant measurements.

## Windows and data safety

The audit identifier was `com.amirzulfadhli.flowplan-startup-audit`; personal databases and the installed personal app were not upgraded or reset. The production audit harness checks executable ProductName before launch to reject an ordinary production binary.

On the real Windows desktop, the audit main window and expanded companion rendered at 125% scaling. Settings Quick Add opened the companion, Hide returned Settings to Show widget, and Quit stopped the audit process. A second audit launch returned exit code 0 and reused the existing window. Native Close was exercised, but focus/visibility observations were inconclusive; automated lifecycle evidence is separate. A synthetic pointer drag did not produce a confirmed position change; sustained physical dragging remains unverified. The taskbar tray was not exposed as a targetable window by the automation surface, so tray-pointer menus are not claimed as tested.

Database schema stays at 3; backup schema stays at 1. Existing transactional writes, migration/recovery tests, and offline/backup workflows remain the acceptance checks. An isolated database is not a clean Windows installation. No disposable Windows account/VM or additional physical monitor was available; no personal installation, Windows security setting, or display/sleep configuration was changed to substitute for these tests.

## Verification and candidate

Local verification: 61 frontend tests, 20 Rust tests, TypeScript, ESLint, Rust formatting, strict Clippy, browser/desktop builds, and normal production NSIS packaging passed. Also passed: 7 browser workflows, 8 native storage/backup/recovery checks, 11 companion checks, and 8 AI protocol checks. Native reports: `smoke-1793181634555`, `companion-1793181654837`, and `ai-1793181685960`. The companion teardown again emitted WebView2 class-unregistration error 1412; functional checks and explicit Quit passed. This diagnostic is retained as a runtime observation, not silently treated as proof of a product failure. Pushed-commit CI status is reported with delivery.

Normal package: `src-tauri/target/release/bundle/nsis/FlowPlan Personal_0.4.0_x64-setup.exe`, 3,628,008 bytes.
SHA-256: `8B87E5968F446532CD5924D63EAE37B1FC12D889C9CB99536CED88A3CAE5C897`.
Built with `npm run desktop:build`, normal identifier `com.amirzulfadhli.flowplan-personal`, without desktop-test or configured debugging flags. The executable ProductName was verified as FlowPlan Personal after restoring the normal build. This unsigned local artifact is not a published release or an installed upgrade.

Remaining gates: exact native/WebView wait root cause; uninstrumented production and repeated delayed-reopen baselines; populated/long-duration resource measurements; physical tray/drag/focus/sleep-resume and multi-monitor/mixed-DPI tests; clean-account install with/without WebView2; actual installer upgrade and uninstall/reinstall retention; independent package/security acceptance. Suitable for supervised evaluation with backups, **not a fully qualified beta release**. AI remains optional and experimental; Phase 5 model findings are unchanged.

## Reproduce safely

Run the debug build and `npm run audit:desktop-performance` without concurrent builds/inference. To compare delayed reopens, set `$env:FLOWPLAN_AUDIT_RESTART_DELAY_MS = '10000'`; remove that environment variable afterward. The default is immediate reopen after endpoint teardown. For an isolated production audit:

```powershell
. ./scripts/windows-env.ps1
node scripts/prepare-production-audit.mjs
node node_modules/@tauri-apps/cli/tauri.js build --config desktop-test-results/production-audit/tauri.conf.json --no-bundle -- --locked
$env:FLOWPLAN_AUDIT_PRODUCTION = '1'
node scripts/desktop-performance.mjs
Remove-Item Env:FLOWPLAN_AUDIT_PRODUCTION
npm run desktop:build
```

The audit database is separate and retained between runs. The final command restores the normal distribution binary; never distribute the audit executable/configuration. See [beta checklist](beta-checklist.md) and [installation instructions](beta-installation.md).

## CI follow-up — 29 October 2026

Browser CI passed at `e57ec3e`, but Windows run 40669527432 timed out selecting the main page after companion restart. The retained main-window screenshot shows the workspace and navigation fully loaded. The harness used a negative URL check that could select an `about:blank` companion before its navigation completed. It now waits for a positive main application URL before retaining the page. This is a test-selection fix, not an application startup optimization; no assertions or persistence checks were removed. All 11 companion checks passed locally afterward (`companion-1793205070196`). Final pushed-commit CI is reported with delivery.

## Subsequent acceptance evidence

See [the acceptance follow-up](phase-6-acceptance.md) for isolated installer replacement, uninstall/reinstall retention, normal production startup without CDP, and the populated 15-minute resource soak. It supersedes the outstanding status of those specific checks above; physical-device and clean-machine gates remain open.
