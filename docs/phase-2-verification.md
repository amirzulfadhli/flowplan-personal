# Phase 2 verification

Verified locally on 26 October 2026 on Windows x64 (build 26200.9711), WebView2 155.0.4283.62, Node 22.15.0, Rust 1.99.1 MSVC, and Visual Studio 2022 C++ tools.

Work is based on `90c82d6` on `feat/phase-2-desktop`. Phase 1's browser repository and JSON schema remain supported. No backend, cloud service, tray widget, AI integration, or release publication was added.

## Automated checks

| Check                                           | Result     |
| ----------------------------------------------- | ---------- |
| Frontend unit/component/adapter tests           | 31 passing |
| Existing production-browser Playwright suite    | 6 passing  |
| TypeScript, ESLint, Prettier                    | Passing    |
| Browser and desktop Vite production builds      | Passing    |
| Rust database tests                             | 11 passing |
| Rust formatting and Clippy with warnings denied | Passing    |
| Tauri production build and NSIS packaging       | Passing    |

Database tests exercise fresh initialization, v1-to-v2 migration with existing records, restart persistence, foreign/corrupt/future schema rejection, stale revisions across connections, transactional recovery, rollback after a simulated mid-write failure, validation, and atomic JSON exports. The additional timestamp test ensures Rust cannot save timestamps that the browser schema rejects.

The native smoke test uses the real WebView2 UI and Rust IPC with an isolated database. It verifies browser JSON migration with project/task/activity IDs intact, preservation of source browser data, Kanban drag-and-drop and status-menu persistence, saved notes and task completion after process termination/restart, rejection of invalid imports, recovery-copy restoration, analytics rendering, absence of service-worker registrations, and offline reload with SQLite still accessible.

## Windows installation

The per-user NSIS installer completed successfully and registered FlowPlan Personal 0.2.0. The application was installed under `%LOCALAPPDATA%\FlowPlan Personal`, and its database resolved to `%APPDATA%\com.amirzulfadhli.flowplan-personal\flowplan.sqlite3`.

Installing the final 0.2.0 build over the earlier local 0.2.0 test installation preserved the SQLite file byte-for-byte. This is a same-version replacement check, not verification of upgrades from a previously released version.

The installed production executable passed the read-only installed smoke test: it ignored the test-only database override, a second launch exited while the original instance remained running, local assets and SQLite worked offline, and restart returned the identical workspace. Record-writing and replacement tests run against the isolated test database so the actual personal workspace is not populated with invented progress.

Native Save dialog export was checked against the stored workspace and contained identical data. The dialog is attached to the calling window. Canceling it restored the export controls without reporting success. Rust tests cover preservation of an existing backup on validation failure and rejection of non-JSON destinations.

The installer is unsigned. Tauri patches its bundle-type marker from `UNK` to `NSS` when packaging; this accounts for the three-byte difference between the installed executable and the standalone release executable. No release was published.

## Limits of verification

- Tested on this Windows machine, not a clean Windows 10/11 matrix. First-time WebView2 bootstrap installation, antivirus/SmartScreen behavior, and ARM64 were not exercised.
- No earlier FlowPlan desktop installer exists. SQL schema upgrade tests passed, but upgrades from a previously shipped installer and uninstall/reinstall data retention are not claimed.
- Failure injection checks transaction rollback; it is not a physical power-loss or disk-exhaustion test.
- Offline verification uses WebView2's offline network emulation, not a physical network disconnection.
- Recovery copies are local, unencrypted, and retained without pruning. They do not protect against disk loss. Keep separate JSON backups.
- Writes still commit the full workspace snapshot; large-scale performance and immutable historical analytics remain outside this phase.
- CI includes browser and Windows verification jobs; local success does not by itself assert a completed remote CI run.

Reproduce these checks using [the desktop guide](desktop.md). Test reports, screenshots, databases, generated executables, and installers are ignored build artifacts and are not committed.
