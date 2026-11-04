# Phase 7 — supervised beta preparation

Prepared 31 October 2026 from `9a10efd` on `feat/phase-7-beta-prep`. **Candidate preparation only: no merge, tag, installer distribution, or release.** Phase 6 evidence remains in the [final gate review](phase-6-final-gates.md), [acceptance report](phase-6-acceptance.md), and [open checklist](beta-checklist.md). A version bump does not clear those limitations.

## Candidate identity

| Field                 | Value                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate             | FlowPlan Personal **0.5.0-beta.1**, Windows x64, unsigned                                                                                             |
| Exact packaged source | `edc341c1c9449f0a521d612c33d34c3381b721b2`                                                                                                            |
| Normal identifier     | `com.amirzulfadhli.flowplan-personal` (unchanged)                                                                                                     |
| Installer             | `FlowPlan Personal_0.5.0-beta.1_x64-setup.exe`                                                                                                        |
| Size                  | **3,629,157 bytes**                                                                                                                                   |
| SHA-256               | `A559941CCAD5FD5860F6B9A1EF4E99037CDED9F44B8F0FB957D53C94A6ED6334`                                                                                    |
| Authenticode          | `NotSigned`                                                                                                                                           |
| Packaging             | Release optimization; locked Cargo dependencies; current-user NSIS; no `desktop-test` feature or diagnostic launch flags                              |
| Version consistency   | npm manifest/lock, Cargo manifest/lock, and Tauri config all `0.5.0-beta.1`; NSIS numeric resource `0.5.0.0`, product version retains prerelease text |
| Data formats          | SQLite schema 3 and portable JSON schema 1, unchanged                                                                                                 |
| Observed environment  | Windows build 26200.9711, x64, WebView2 156.0.4314.50, one monitor at 125% scaling                                                                    |

The local installer is retained under the ignored build directory, not attached to documentation or uploaded. Its hash identifies this exact local artifact; a CI rebuild may have a different hash and is not interchangeable without a new record. Later documentation-only commits do not alter the packaged source. Normal-identity installation of this candidate has not been exercised on a clean machine.

No application features, UI redesign, database migrations, cloud services, telemetry, or model downloads were added. Local-first behavior and optional experimental AI remain unchanged. See the [changelog](../CHANGELOG.md).

## Installer failure investigation

The Phase 6 interrupted report was reviewed. It recorded a nonzero silent installation failure but did not retain its numeric exit code or useful stdout/stderr. The baseline remained 0.4.0. A direct retry and complete rerun subsequently passed. That evidence cannot establish a root cause.

One bounded new upgrade was performed on 30 October 2026 using the retained **synthetic acceptance identity**, from 0.4.1 to 0.5.0-beta.1. No personal installation/database was used. The existing binary hash was checked before launch, all 40 projects/2,000 tasks/4,000 activities were compared with the external backup before and after, and selected preferences were compared across installation. The candidate launched and explicitly quit without renderer errors.

Installer exit code **0**, stdout empty, stderr empty; installed product version **0.5.0-beta.1**. All workspace fields and selected preferences matched. The earlier failure **did not reproduce in this attempt**. It remains an unresolved reliability observation, not a fixed bug. No antivirus, file-locking, or other cause is asserted; no speculative installer change was made. Startup observations in this audit include automation overhead and are not a new performance benchmark.

The isolated audit installer was 3,628,952 bytes, SHA-256 `4FD90B60D0764EC7FE4EB0DBA5C1F0EECA5D377A36C4F9AB2200392FFF8ACBB1`, product **FlowPlan Beta Acceptance**. Never substitute it for the normal candidate. Machine-local synthetic evidence remains under ignored `desktop-test-results/acceptance`: `phase-7-upgrade-report.json`, `phase-7-upgrade.log`, the acceptance installer/configuration, retained backups, and earlier failed/successful reports.

The audit now records installer hashes, successful/nonzero exit codes, stdout, and stderr. Raw audit files can contain local paths and are not tester-shareable diagnostics. To reproduce on the same **retained 0.4.1 acceptance baseline**, build the same separate identifier/product overlay with version 0.5.0-beta.1, retain its installer as `candidate-setup-0.5.0-beta.1.exe`, then run `node scripts/beta-acceptance.mjs --phase7-upgrade --skip-soak`. It refuses to overwrite an existing Phase 7 report and checks the Phase 6 binary hash. The local baseline is now upgraded; do not rerun by deleting reports or downgrading its database. Restore a separate disposable baseline if a future failure warrants another attempt. No prior soak or completed installation suite was repeated.

## Tester packet and diagnostics

- [Onboarding and test instructions](beta-tester-guide.md): identity/hash check, synthetic first-use workflow, local storage/AI expectations, stop conditions, and private reporting.
- [Manual acceptance sheet](beta-manual-acceptance.md): clean Windows, missing WebView2/network failure, upgrade, launch variants, physical tray/shortcut/focus/dragging, sleep/resume, monitors/DPI/taskbars, recovery, and offline use.
- [Backup, rollback, uninstall, and recovery](beta-recovery.md): preserve external backups, keep data on uninstall, validate prior-build restoration in isolation; no unsupported in-place downgrade.
- [Bug report](templates/beta-bug-report.md) and [feedback form](templates/beta-feedback.md): structured, synthetic-only submissions through a separately agreed private channel.

The opt-in PowerShell collector emits only an explicit metadata allowlist, sends nothing, and saves nothing by default. Its contract check passed both environment-only and actual-installer paths, including exact output keys and absence of private paths. An inherited PowerShell 7 module path initially prevented the Windows PowerShell test child from finding `Get-FileHash`; the test launcher now lets that child resolve its own modules. No system policy was changed. Testers need not run scripts if local policy blocks them.

## Verification and distribution controls

Local checks: changed JavaScript passed ESLint and syntax checks; the isolated upgrade passed; candidate metadata/hash/signature and the diagnostic allowlist passed. The normal local build produced the expected NSIS artifact from the committed source. Formatting and document links are checked before delivery. Full browser and Windows suites are verified through branch CI rather than repeating previously passed local runtime suites.

CI still builds the production installer and checks its diagnostic metadata contract, but its installer-upload step is removed. Executables and MSI files are explicitly excluded from uploaded synthetic verification artifacts. There is no new release workflow, tag, or automatic updater. CI status is associated with the final delivery commit in GitHub Actions; a failed required job blocks readiness.

## Readiness and remaining gates

**The candidate and tester packet are prepared for a separately authorized, supervised synthetic-data evaluation. Full product acceptance and public-release readiness are not established.** Before a session, the coordinator must choose a trusted tester, agree the private channel, verify the candidate identity and backups, and assign checklist rows appropriate to the tester's disposable environment. This work does not authorize installer delivery.

| Gate                                                               | Current evidence / required next step                                                                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Increasing-version data retention                                  | Passed on isolated acceptance identity; normal clean-install/real-device cases remain separate.                                                                   |
| Earlier installer failure                                          | Not reproduced by this one attempt; cause unresolved. Stop and retain first-failure evidence if it recurs.                                                        |
| Clean Windows and absent WebView2                                  | Blocked locally by no disposable environment; human W01–W03, including network failure/retry. No host runtime removal.                                            |
| Tray, shortcut conflicts, cross-app focus, physical dragging       | Partial Phase 6 UI observations only; human W06–W08. Two injected drag attempts did not demonstrate movement.                                                     |
| Sleep/resume                                                       | Unverified; attended W09 with a reliable wake path. Renderer-freeze tests are not a substitute.                                                                   |
| Multi-monitor, negative origins, removal, mixed DPI, taskbar edges | Blocked by available hardware/configuration; human W10–W11.                                                                                                       |
| Startup                                                            | All four launch scenarios and component-level timing remain open; W05 records distinct observations, not a claimed speedup.                                       |
| Resources                                                          | Retain three approximately 20-minute observations across two sessions, with interruption/concurrent-work limits. Continuous overnight stability remains untested. |
| Rollback and deletion                                              | No supported in-place downgrade; prior-build restore must be validated in isolation. Same-account rollback and explicit uninstall data deletion are untested.     |
| Signing and broader distribution                                   | Candidate unsigned; no security bypass. Wider distribution remains gated by unchecked Phase 6 acceptance scenarios and explicit authorization.                    |

Unexpected data loss/corruption, security blocking, setup failure, crashes, or an unreachable UI stop the session and require triage. Hardware/environment blockers stay explicitly Blocked; they are never silently waived by CI or packaging.
