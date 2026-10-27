# Phase 4 verification

Base: `feat/phase-3-companion` at `2fe38fc`. Implementation branch: `feat/phase-4-project-ai`. Local verification started 26 October and continued 27 October 2026 (Asia/Kuala_Lumpur), Windows x64, Node 22.15.0, Rust 1.99.1 MSVC, and WebView2 155.0.4283.62.

## Completed checks

- 54 frontend unit/component/adapter tests passed; the additional companion capture-focus regression test passed separately (55 total).
- 20 Rust tests passed, including loopback URL validation, local-model filtering, selected-project context, existing SQLite/recovery invariants, and companion timer behavior. Clippy passed with warnings denied.
- All six existing production-browser checks passed. The added browser AI test passed separately, covering opt-in, selected-project context, explicit review/approval, IndexedDB persistence, and project switching.
- The existing native desktop smoke test passed all eight storage, browser migration, backup/recovery, offline, and workflow checks.
- The new native AI smoke test passed all eight checks using a real WebView2 window, Rust IPC/HTTP, and isolated SQLite. It covered opt-in/no automatic network, context isolation, no inference-side writes, atomic approval, cancelled review, stale approval, malformed/foreign proposals, HTTP failure recovery, cancellation disconnect, blocked redirects/cloud aliases/remote URLs, denied companion AI capability, and restart persistence.
- All nine native companion checks passed, including explicit Quick Add focus, passive-show focus preservation, shortcut conflicts, task synchronization, pinning, timer behavior, and restart persistence.
- TypeScript, ESLint, Prettier, Rust formatting, and diff whitespace checks passed. Browser/PWA and desktop production assets built successfully. The Windows release build produced the 0.4.0 x64 NSIS installer (3.44 MiB).
- Installed 0.4.0 over 0.3.0 and passed all four installed-app checks: production database selection, single instance, offline assets/SQLite, and identical workspace after restart. A consistent SQLite backup was taken first; every workspace, recovery, and companion row remained identical afterward. SQLite integrity and foreign-key checks passed; database version remains 3.
- Visually inspected the project AI panel in WebView2 at Windows 125% scaling; shared form styling was restored and no horizontal overflow was present.

Screenshots and test databases are ignored artifacts under `desktop-test-results/`. All synthetic records belong to isolated fixtures. No model test imported synthetic progress into the personal workspace. No real Ollama model was installed or downloaded during this work; model quality and performance remain unverified.

## CI investigation

The Phase 2 Windows run [40308790887](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/40308790887) and Phase 3 Windows run [40352410078](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/40352410078) both failed waiting for `127.0.0.1:9227/json/version`; the browser job passed. Downloaded artifacts show that the app created its isolated SQLite database and WebView2 profile using runtime 155.0.4283.62. These are debugging-endpoint startup failures, not evidence of lost workspace data.

The shared native test helper now reports early process exits, bounds each readiness fetch, allows first-run initialization, and collects test-only WebView2 diagnostics. No functional assertion was skipped. The timeout itself has not reproduced locally; a passing local test does not prove the hosted-runner issue resolved. A trial GPU-disabling test flag was removed because it was not justified by the evidence.

During regression testing, Quick Add's input focus assertion failed reproducibly: a native capture event could arrive before React mounted the expanded input. The fix retains that explicit request until the input mounts. A component regression test and all nine native companion checks passed, including passive-show focus preservation.

## Remaining verification

Remote Phase 4 CI will be checked after pushing this branch. The previous hosted Windows startup failure remains unverified until that run completes.

See [project AI setup and architecture](project-ai.md) and [Windows commands](desktop.md). The package remains unsigned; clean-machine installation, physical power loss, multi-monitor/sleep behavior, real-model compatibility, and model quality are outside the checks completed so far.
