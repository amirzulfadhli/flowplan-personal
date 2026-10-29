# Limited Windows beta checklist

This is a preparation checklist, not a release announcement. Keep AI optional and experimental. Do not widen distribution until the unchecked gates have evidence.

## Candidate identity

- [ ] Record the exact source commit, installer SHA-256, Windows version, WebView2 version, and build configuration.
- [ ] Verify browser and Windows CI for that commit.
- [x] Confirm the local candidate installer excludes `desktop-test` and debugging flags.
- [x] Retain the previous installer and an external JSON backup for upgrade testing.

## Installation and recovery

- [ ] Fresh Windows account/VM: install, launch, create synthetic work, quit, reopen, and verify persistence.
- [ ] Repeat with WebView2 absent; document the bootstrapper's network requirement.
- [x] Replace an isolated Phase 5 installation with Phase 6; compare all workspace fields and selected companion preferences (both report 0.4.0; same-version replacement).
- [ ] Verify an actual increasing-version installer upgrade before shipping a new version.
- [x] Export JSON, inspect it, restore into an isolated profile, and compare every field (Rust round-trip test and native migration/recovery checks).
- [x] Verify recovery after rejected imports and injected transaction failures (automated; physical power loss remains untested). Never test destructive failure against a personal database.
- [x] Verify default silent uninstall/reinstall retains the isolated SQLite workspace and selected companion preferences. Explicit data-deletion behavior is outside this check.

## Desktop acceptance

- [ ] Record fresh launch, immediate reopen, delayed reopen, and existing-instance activation separately.
- [ ] Measure production process/window readiness, WebView initialization, database work, and rendered UI separately; report instrumentation overhead.
- [x] Measure visible/hidden CPU and private memory with 40 synthetic projects, 2,000 tasks, and 4,000 activities; three five-minute stages, no model inference.
- [x] Test fresh application-profile startup and immediate production reopen without CDP; no slow candidate reopen reproduced. This is not a fresh Windows account.
- [ ] Physically test tray Open, Quick Add, Show/Hide, and Quit; check shortcut conflicts and focus preservation.
- [ ] Test sleep/resume, monitor removal, negative monitor origins, mixed DPI, and taskbars on different edges.
- [ ] Complete a long-duration idle/timer soak test.

## Beta communication

- [ ] Explain close-to-tray and explicit Quit at first use.
- [x] Explain where local data lives and that browser and desktop workspaces are separate.
- [x] Provide backup/restore instructions and distinguish replace from merge.
- [x] Disclose unsigned packaging, tested configurations, known startup issues, and experimental AI accuracy.
- [x] Provide bug-report instructions without requesting personal project content or secrets.

Phase 5's automated evidence is in [its verification record](phase-5-verification.md). Passing a synthetic renderer-freeze test is not evidence of physical Windows sleep/resume. Passing packaging is not evidence of a clean-machine installation.

Current evidence and explicit partial results: [Phase 6 verification](phase-6-investigation.md). Unchecked items remain acceptance gates; they are not silently waived by packaging or automated tests.

Additional installation, startup, and populated-resource evidence: [Phase 6 acceptance follow-up](phase-6-acceptance.md). Physical and clean-machine gates above remain open.
