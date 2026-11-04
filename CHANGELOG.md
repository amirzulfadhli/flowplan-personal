# Changelog

## 0.5.0-beta.1 — supervised candidate preparation (not released)

- Versioned the Windows candidate consistently across npm, Cargo, and Tauri; retained the application identity and existing database/JSON schemas.
- Added tester onboarding, private bug/feedback forms, a manual Windows acceptance sheet, and backup/recovery/rollback/uninstall guidance.
- Added an opt-in, read-only diagnostic collector restricted to environment and installer metadata; no project content or automatic upload.
- Recorded one successful isolated 0.4.1 → 0.5.0-beta.1 upgrade; the earlier unexplained installer failure remains unresolved, with no speculative installer fix.
- Kept CI packaging verification while disabling installer artifact uploads. No tag, distribution, or public release accompanies this candidate.

Known limits: clean Windows/missing-WebView2 execution, physical tray/shortcut/focus/dragging, sleep/resume, multi-monitor/DPI/taskbar configurations, detailed startup instrumentation, and overnight stability remain unverified. AI remains optional and experimental. See the [candidate record](docs/phase-7-beta-preparation.md).

## Phase 6 — beta preparation (not released)

- Added a compact empty-desktop getting-started guide for local backups, browser migration, close-to-tray, and explicit Quit.
- Verified isolated increasing-version installer retention and extended the acceptance harness to resume longer resource measurements without repeating passed installation checks.

- Serialized optional startup trace records to prevent concurrent IPC writes from corrupting diagnostic timestamps.
- Added isolated installer replacement/retention and populated resource audit scripts; recorded normal production startup and a 15-minute soak without resetting personal data.

- Removed a duplicate initial desktop workspace read while preserving subscribe-before-read ordering and cross-window updates.
- Added opt-in native/SQLite milestones and a React readiness mark; corrected stale debugging-endpoint attachment in the audit harness.
- Compared debug and isolated production startup. Slow debug reopens remain unresolved; no end-to-end speedup is claimed.

- Added separate startup benchmark milestones for process spawning, the WebView2 debugging endpoint, automation connection, navigation readiness, and a SQLite read round trip. These measurements must not be conflated with production UI readiness.
- Added a beta acceptance checklist and installation/recovery instructions.

## Phase 5 — `ab28016`

- Prevented stale project-note drafts from overwriting another window's changes.
- Bounded task-list rendering with pagination while retaining full-workspace filtering.
- Enforced the portable backup size limit on new browser writes.
- Refined local-AI instructions after testing an actual local model; approval remains mandatory and advice remains experimental.
- Verified browser/native workflows and Windows packaging; documented physical-device and clean-install gaps.

See [Phase 5 verification](docs/phase-5-verification.md) for evidence and measured performance. Neither entry represents a published release.
