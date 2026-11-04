# Phase 6 acceptance follow-up

Runtime source: `4f036a7` on `feat/phase-6-release-prep`. Tests performed 29 October 2026. This is a verification record, not a release announcement. The application UI, data schema, and production behavior were not changed for these checks.

## Isolation and installation

Two release/NSIS installers were built from Phase 5 (`ab28016`) and the current candidate. Both use the separate product name **FlowPlan Beta Acceptance** and identifier `com.amirzulfadhli.flowplan-beta-acceptance`. Installation was limited to the workspace's `desktop-test-results/acceptance/installed` directory. The personal installation and its database were not used. WebView2 was already present; this is not a clean Windows account/VM test.

Both source versions report 0.4.0, matching the actual branch history. The test therefore exercises NSIS same-version executable replacement, not a fabricated version-number upgrade. The installed executable hashes changed, proving the candidate replaced the baseline. An external JSON backup was retained before replacement and uninstallation.

- Initial audit installation created its own empty SQLite database.
- Seeded 40 projects, 2,000 tasks, and 4,000 activity records, including notes, deadlines, and completion timestamps. All data was explicitly synthetic.
- Upgraded Phase 5 to Phase 6 and compared every stored workspace field with the external backup, including IDs, order, revision, dates, and notes.
- Compared project/task selection, always-on-top, close-to-tray, shortcut, and timer-duration preferences. Mutable companion revision/position and a running timer were not part of this installer comparison; timer restart behavior is covered by the existing native suite.
- Ran the default silent uninstaller. The application executable was removed while the SQLite database remained.
- Reinstalled the candidate and verified the entire workspace and the selected preferences again.

The uninstaller offers a separate data-deletion checkbox. These results apply to its default retention behavior; they do not imply that explicitly selecting deletion preserves data. No personal data was deleted or reset.

Audit installer SHA-256 values (not distribution artifacts):

| Source  | SHA-256                                                            |
| ------- | ------------------------------------------------------------------ |
| Phase 5 | `B8F03FC006A01C7E0A1EB0EDEF114151956F4DF3B01CFD0C0BF8BFE81B98FCFD` |
| Phase 6 | `A8172BDE00C34251780D7036995030E79C7BD4FE2A19AD7B2B9D9D95BDDE30E6` |

## Production startup

The installed, populated candidate used release optimization and normal capabilities. It did not enable `desktop-test`. With CDP enabled only for observation, the upgrade launch took 1,590 ms, the reinstall launch 1,142 ms, and three subsequent reopens took **1,189 / 1,177 / 1,423 ms**. The active WebView2 version was **156.0.4314.50**. These include CDP connection and locator polling, not just renderer work. No 2–7-second candidate reopen was reproduced in these samples; no speculative startup optimization was made.

The first-ever launch of the previous Phase 5 audit profile took 6,716 ms. It is retained as a cold baseline observation, not presented as a Phase 6 reopen regression. The test harness initially supplied an incorrect fixture revision; SQLite rejected that write, and the audit resumed from the unchanged empty baseline. A second harness correction used the actual task-page heading before the soak. Passed installation checks were not repeated.

## Normal production launch without CDP

The same installed release executable was also launched without CDP, WebView2 argument overrides, a custom WebView profile, or `desktop-test`. Only the opt-in native timing file was enabled. The populated synthetic profile was retained intact while a fresh audit profile was tested, then restored with an identical SQLite SHA-256. The acceptance installation was subsequently uninstalled successfully; its synthetic database and external backup remain retained. Personal application data was never involved.

| Launch                                | Native entry to initial workspace return | Initial SQLite initialization | Spawn to snapshot observation |
| ------------------------------------- | ---------------------------------------- | ----------------------------- | ----------------------------- |
| Fresh audit profile                   | 1.768 s                                  | 90 ms                         | 1.916 s                       |
| Immediate reopen after normal UI Quit | 1.463 s                                  | about 6 ms                    | See retained trace/log        |
| Launch after an interrupted audit     | 1.790 s                                  | about 15 ms                   | See retained trace/log        |

These are workspace-return milestones, not exact first-paint measurements. The main UI was independently inspected and rendered correctly. Only the first launch completed an observed Settings > Quit cycle; the subsequent runs reached their workspace milestones but timed out during user interruption/automation foreground binding failures. The harness stopped only its owned audit process. Do not count them as three completed graceful lifecycle checks. The resumed third launch is not an immediate reopen.

Production did not reproduce the 2–7-second reopen delay. SQLite initialization is too short in these samples to explain that delay. Most observed startup precedes the setup callback (approximately 1.24–1.47 seconds), but that interval does not isolate a particular Windows/WebView subsystem. The old debug-only wait has no confirmed root cause; no production speedup or speculative optimization is claimed.

## Populated resource soak

The populated release application completed three five-minute stages with eight owned processes (application plus WebView2), without concurrent model inference or compilation. The visible Tasks view used its existing pagination. Samples cover approximately 300 seconds per stage after warmup.

| Mode                 | Private memory, first → last | CPU seconds over stage |
| -------------------- | ---------------------------- | ---------------------- |
| Visible idle         | 311.61 → 344.27 MiB          | 19.406                 |
| Hidden idle          | 357.47 → 291.47 MiB          | 0.328                  |
| Hidden running timer | 299.55 → 296.33 MiB          | 0.422                  |

All workspace fields remained identical to the external backup after each stage; no renderer errors were recorded. Hidden background consumption was low and memory did not show sustained growth across this bounded run. This is not an overnight leak test. CPU is summed process CPU time, not a percentage; summed working sets would double-count shared pages, so private memory is reported instead. Sampling itself ran outside the measured process tree.

## Confirmed fix and verification scope

Concurrent IPC diagnostic writes could interleave timestamp and milestone text in the optional startup trace. A process-local mutex now serializes complete records. A regression test writes 320 records from 16 threads and verifies every record. Normal runs without the diagnostic environment variable do not acquire the writer lock or open a log file. This fix changes diagnostics, not workspace storage or UI behavior.

The new no-CDP audit driver checkpoints readiness before waiting for UI Quit and records interrupted attempts, cleaning up only its owned process. These harness changes were syntax/lint checked; completed runtime measurements were not repeated merely to exercise reporting changes.

Remaining acceptance gates: fresh Windows account/VM, missing-WebView2 installation, a genuine increasing-version upgrade, physical tray/dragging/focus and shortcut conflicts, sleep/resume, monitor removal/negative origins/mixed DPI/taskbar edges, and a long-duration soak. The current host already had WebView2 and ran at 125% scaling. Existing automated tray/timer/window/storage suites remain complementary evidence, not substitutes for these physical tests.

**Verdict:** the evidence supports limited, supervised beta evaluation on the tested Windows configuration. Phase 6's full acceptance checklist is not complete, and broader distribution remains gated by the unchecked physical/clean-machine scenarios. AI remains optional and experimental. No release was published.

## Reproduction and retained evidence

Local final verification on 30 October 2026: the concurrent-record regression test passed (20 existing Rust tests intentionally filtered), Clippy passed with warnings denied, TypeScript/desktop frontend build and normal NSIS packaging passed, and changed audit scripts passed ESLint, Prettier, JavaScript syntax checks, and PowerShell parsing. Full browser/Windows suites are delegated to the branch CI for the delivery commit rather than repeating previously passed local suites.

The rebuilt normal **FlowPlan Personal** 0.4.0 x64 installer is 3,629,858 bytes, SHA-256 `064FD87CF512BDEACB674AA98C3F1C876B899A5D915CE7E951C93712083ED95A`. It uses `com.amirzulfadhli.flowplan-personal`, release optimization, and no `desktop-test` feature or diagnostic launch flags. This build adds only the trace serialization fix to the runtime source tested above; the installer lifecycle measurements refer to the separately identified acceptance artifacts, not to a fresh installation of this final personal-identity artifact. Host: Windows build 26200.9711, 8 GB RAM, 125% scaling.

`./scripts/prepare-beta-acceptance.ps1` builds separate installers from archived previous sources without switching the active branch. It refuses to replace an existing acceptance source directory. `node scripts/beta-acceptance.mjs` requires an unused acceptance profile and installation. Its default soak is three five-minute stages; `FLOWPLAN_SOAK_PHASE_SECONDS` can increase each stage up to one hour. `--soak-only` resumes only the unfinished soak after validating the installed candidate hash and completed installer checks. `--resume-empty` is restricted to an interrupted baseline with its recorded binary hash and an empty workspace; neither mode resets a database.

Machine-local evidence is retained under ignored `desktop-test-results/acceptance`: both installers, external JSON backup, archived source, cleanup record, native traces, the report, and interrupted-run records. These artifacts contain synthetic data only. Rebuild using `npm run desktop:build` to restore the normal distribution binary after building audit identities. Never distribute the acceptance installer.
