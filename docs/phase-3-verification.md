# Phase 3 verification

Verified on 26 October 2026 on Windows x64 build 26200.9711, WebView2 155.0.4283.62, Node 22.15.0, Rust 1.99.1 MSVC, and Visual Studio 2022 C++ tools. Base: `f947fb8`; branch: `feat/phase-3-companion`.

## Automated checks

| Check                                                            | Result           |
| ---------------------------------------------------------------- | ---------------- |
| Frontend unit/component/adapter tests                            | 35 passing       |
| Production-browser Playwright suite                              | 6 passing        |
| Rust database, timer, geometry, and shortcut tests               | 17 passing       |
| Existing native migration/backup/workspace smoke test            | 8 checks passing |
| Native two-window companion smoke test                           | 9 checks passing |
| Installed production application                                 | 4 checks passing |
| Browser/desktop builds and NSIS packaging                        | Passing          |
| TypeScript, ESLint, Rust formatting, Clippy with warnings denied | Passing          |

New frontend tests cover timer deadlines after time away and retained settings drafts/save feedback across updates from another window. Native tests cover timer start/pause/resume/reset, expiration after elapsed time, duration validation, persistence, independent companion/workspace revisions, stale-write rejection, work-area bounds including negative monitor origins, shortcut parsing, and migration from Phase 2 with existing workspace and recovery records.

The real WebView2 companion test uses isolated SQLite and WebView profiles. It verifies passive opening using the native window focus query, explicit Quick Add focus, task capture/completion and updates in both directions, project-scoped capture, pin/preferences synchronization, invalid shortcut rejection, and an actual Windows shortcut collision between two isolated processes. It also verifies timer pause/resume, restart with an identical workspace and timer deadline, hidden native windows with a live process, work-area bounds, and explicit Quit. A regression assertion toggles pin immediately after closing the main window, ensuring the saved position's new revision reaches the widget before its next preference write. No test fixtures are written to the personal workspace.

The pre-existing native suite continues to cover browser JSON migration, source-data preservation, Kanban movement, saved notes, completion, restart, invalid imports, recovery restore, analytics rendering, offline assets, and no desktop service worker. The browser suite covers offline reopening, backups, cross-tab updates, and responsive layouts.

One frontend workflow initially exceeded its five-second test timeout while native compilation and WebView processes were competing for resources. It passed on rerun after that load subsided; no timeout was increased. WebView2 occasionally emitted a `Chrome_WidgetWin_0` cleanup diagnostic when a test process was forcibly terminated; the smoke tests reported no JavaScript errors or persistence failures.

## Windows installation and upgrade

Built and installed the per-user `FlowPlan Personal_0.3.0_x64-setup.exe` over the existing 0.2.0 installation. The installed executable reports version 0.3.0. Before installation, SQLite's backup API saved a consistent copy of the Phase 2 database. After opening 0.3.0, schema version advanced from 2 to 3; every workspace metadata, project, task, activity, and recovery row matched the saved snapshot. SQLite integrity and foreign-key checks passed. The populated migration unit test independently covers existing project/task data and a recovery snapshot.

The installed production executable passed all four read-only workspace checks: it uses the production data path and ignores the test override, a second launch exits successfully while the original instance remains, local assets and SQLite work offline, and restart returns the identical workspace. Version 0.3.0 remains installed locally. Neither branch merging nor release publication was performed. The installer is unsigned.

## Native interaction and appearance

The collapsed island and expanded companion were inspected at 125% display scaling. The expanded form fits without horizontal overflow. Actual Windows keyboard input for the configured Control+Shift+F9 binding opened Quick Add and focused capture. Native dragging moved the widget; Alt+F4 on the main window retained the process via close-to-tray. Native visibility/focus queries are used in the regression script because WebView2 document visibility/focus values do not reliably describe a hidden native window.

The tray is constructed during real application startup and its actions share the tested native dispatcher. Direct notification-area menu clicking was not verified: the available native automation surface did not expose the taskbar/tray. Tray menu wiring is covered by code review, not claimed as an end-to-end pointer test.

## Performance observations

In the final five-second sample with both native windows hidden and the timer reset, the companion renderer recorded about 0.063 ms of additional JavaScript script time, 2.7 ms of total task time, and a 384-byte increase in its approximately 5.3 MB JavaScript heap. No companion database revision changed. This is one local CDP renderer sample, not total application memory, a battery measurement, or a general performance benchmark.

The widget is created lazily, and hiding it removes the running timer's rendering interval. A deadline is persisted on timer actions; there are no per-second database writes or native timer polling. Hidden WebViews remain allocated after first use. Large-workspace and long-running memory benchmarks are not claimed.

## Remaining limits

- Native testing targets this Windows x64 machine. Clean-machine WebView2 bootstrap, Windows 10, ARM64, signing, SmartScreen, and antivirus matrices were not exercised. No release is published.
- Physical sleep/resume, multi-monitor transitions, monitor removal, and mixed DPI were not exercised. Pure tests cover elapsed-time jumps and negative-origin/work-area bounds; Settings provides position reset.
- The focus timer uses wall-clock deadlines, has visual completion only, and does not automatically complete tasks or record analytical focus history.
- JSON backups remain portable workspace backups; device-specific companion preferences and running timers are not included. A complete closed database backup includes them.
- Transaction failure tests are not physical power-loss or disk-exhaustion tests. Full-workspace commits and unpruned local recovery copies retain the Phase 2 scaling limits.
- Remote CI results must be checked separately from these local results. Generated executables, screenshots, profiles, databases, and reports remain ignored artifacts.

Reproduce with the commands in the [desktop guide](desktop.md); behavior and architecture are described in the [companion guide](companion.md).
