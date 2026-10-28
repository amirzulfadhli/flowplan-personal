# Changelog

## Unreleased — beta preparation

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
