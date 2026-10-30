# Limited Windows beta checklist

This is a preparation checklist, not a release announcement. Keep AI optional and experimental. Do not widen distribution until the unchecked gates have evidence.

## Candidate identity

- [x] Record the exact source commit, installer SHA-256, Windows version, WebView2 version, and build configuration in the final gate review (runtime source `cab42bb`).
- [x] Verify browser and Windows CI for that source commit: [run 41046243959](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/41046243959).
- [x] Confirm the local candidate installer excludes `desktop-test` and debugging flags.
- [x] Retain the previous installer and an external JSON backup for upgrade testing.

## Installation and recovery

- [ ] **Blocked — no disposable Windows environment:** fresh Windows account/VM: install, launch, create synthetic work, quit, reopen, and verify persistence.
- [ ] **Blocked — no disposable Windows environment:** repeat with WebView2 absent; document the bootstrapper's network requirement.
- [x] Replace an isolated Phase 5 installation with Phase 6; compare all workspace fields and selected companion preferences (both report 0.4.0; same-version replacement).
- [x] Verify an actual increasing-version installer upgrade: isolated 0.4.0 → 0.4.1 retained all workspace fields and selected preferences. One initial unexplained installer failure remains recorded for follow-up.
- [x] Export JSON, inspect it, restore into an isolated profile, and compare every field (Rust round-trip test and native migration/recovery checks).
- [x] Verify recovery after rejected imports and injected transaction failures (automated; physical power loss remains untested). Never test destructive failure against a personal database.
- [x] Verify default silent uninstall/reinstall retains the isolated SQLite workspace and selected companion preferences. Explicit data-deletion behavior is outside this check.

## Desktop acceptance

- [ ] Record fresh launch, immediate reopen, delayed reopen, and existing-instance activation separately.
- [ ] Measure production process/window readiness, WebView initialization, database work, and rendered UI separately; report instrumentation overhead.
- [x] Measure visible/hidden CPU and private memory with 40 synthetic projects, 2,000 tasks, and 4,000 activities; three five-minute stages, no model inference.
- [x] Test fresh application-profile startup and immediate production reopen without CDP; no slow candidate reopen reproduced. This is not a fresh Windows account.
- [ ] **Blocked/partial — native Quick Add, collapse, and Settings Quit observed; tray target unavailable and dragging unverified:** physically test tray Open, Quick Add, Show/Hide, and Quit; check shortcut conflicts and focus preservation.
- [ ] **Blocked — unattended host and single monitor; no display changes authorized:** test sleep/resume, monitor removal, negative monitor origins, mixed DPI, and taskbars on different edges.
- [x] Complete extended idle/timer measurements: three approximately 20-minute stages across two sessions, with workspace equality and no renderer errors; overlap/interruption limits are documented. Continuous overnight stability remains untested.

## Beta communication

- [x] Explain close-to-tray and explicit Quit in the empty desktop Home guide, with a Settings/backups link.
- [x] Explain where local data lives and that browser and desktop workspaces are separate.
- [x] Provide backup/restore instructions and distinguish replace from merge.
- [x] Disclose unsigned packaging, tested configurations, known startup issues, and experimental AI accuracy.
- [x] Provide bug-report instructions without requesting personal project content or secrets.

Phase 5's automated evidence is in [its verification record](phase-5-verification.md). Passing a synthetic renderer-freeze test is not evidence of physical Windows sleep/resume. Passing packaging is not evidence of a clean-machine installation.

Current evidence and explicit partial results: [Phase 6 verification](phase-6-investigation.md). Unchecked items remain acceptance gates; they are not silently waived by packaging or automated tests.

Additional installation, startup, and populated-resource evidence: [Phase 6 acceptance follow-up](phase-6-acceptance.md). Physical and clean-machine gates above remain open.

Remaining-gate evidence and environment inventory: [Phase 6 final gate review](phase-6-final-gates.md).
