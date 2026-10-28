# Limited Windows beta checklist

This is a preparation checklist, not a release announcement. Keep AI optional and experimental. Do not widen distribution until the unchecked gates have evidence.

## Candidate identity

- [ ] Record the exact source commit, installer SHA-256, Windows version, WebView2 version, and build configuration.
- [ ] Verify browser and Windows CI for that commit.
- [ ] Confirm the distributed installer excludes `desktop-test` and debugging flags.
- [ ] Retain the previous installer and an external JSON backup for upgrade testing.

## Installation and recovery

- [ ] Fresh Windows account/VM: install, launch, create synthetic work, quit, reopen, and verify persistence.
- [ ] Repeat with WebView2 absent; document the bootstrapper's network requirement.
- [ ] Upgrade a synthetic prior-version installation; compare project/task/activity IDs, notes, completion dates, and companion preferences.
- [ ] Export JSON, inspect it, restore into an isolated profile, and compare every field.
- [ ] Verify recovery after rejected imports and interrupted writes. Never test destructive failure against a personal database.
- [ ] Check uninstall/reinstall data retention explicitly; do not assume uninstallation removes or preserves every file.

## Desktop acceptance

- [ ] Record fresh launch, immediate reopen, delayed reopen, and existing-instance activation separately.
- [ ] Measure production process/window readiness, WebView initialization, database work, and rendered UI separately; report instrumentation overhead.
- [ ] Measure visible/hidden CPU and private memory with a populated synthetic workspace and no concurrent model inference.
- [ ] Physically test tray Open, Quick Add, Show/Hide, and Quit; check shortcut conflicts and focus preservation.
- [ ] Test sleep/resume, monitor removal, negative monitor origins, mixed DPI, and taskbars on different edges.
- [ ] Complete a long-duration idle/timer soak test.

## Beta communication

- [ ] Explain close-to-tray and explicit Quit at first use.
- [ ] Explain where local data lives and that browser and desktop workspaces are separate.
- [ ] Provide backup/restore instructions and distinguish replace from merge.
- [ ] Disclose unsigned packaging, tested configurations, known startup issues, and experimental AI accuracy.
- [ ] Collect bug reports without requesting personal project content or secrets.

Phase 5's automated evidence is in [its verification record](phase-5-verification.md). Passing a synthetic renderer-freeze test is not evidence of physical Windows sleep/resume. Passing packaging is not evidence of a clean-machine installation.
