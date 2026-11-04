# Phase 8 — supervised beta validation record

Evidence review: **4 November 2026 (Asia/Kuala_Lumpur)**. Base `feat/phase-7-beta-prep` at `5ef7c1ce78b551776ad1a51ec7461313b4250ae9`; working branch `feat/phase-8-beta-validation`.

**Blocked: genuine Windows tester reports and completed acceptance sheets are not available in the checked sources.** Phase 8 defect resolution and human validation are incomplete. This record does not clear any Phase 6/7 gate or establish readiness for wider beta evaluation.

## Sources reviewed

- [Tester guide](beta-tester-guide.md), [manual acceptance sheet](beta-manual-acceptance.md), [recovery instructions](beta-recovery.md), [bug/feedback templates](templates/beta-bug-report.md), [Phase 7 candidate evidence](phase-7-beta-preparation.md), and [Phase 6 final gates](phase-6-final-gates.md).
- Tracked repository documentation contains preparation templates and prior engineering evidence, but no submitted Windows tester reports or completed human acceptance sheets. The manual sheet is blank.
- Read-only [repository issue inventory](https://api.github.com/repos/amirzulfadhli/flowplan-personal/issues?state=all&per_page=100&sort=updated&direction=desc), including closed issues, returned an empty list on the review date. This is a dated observation; it does not establish that no reports exist in private channels.
- No private reporting channel or report source was supplied. Requested redacted reports or an accessible source from the coordinator. No personal mailbox, database, backup, or project content was searched.

Received reports: **0 in checked sources**. Confirmed new tester defects: **0 established**. Fixes: **none justified by available evidence**. These counts describe evidence availability, not product quality or successful acceptance.

## Triage priorities and disposition

| Priority | Area                                                  | Disposition and evidence needed                                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Data loss/corruption, wrong workspace, unsafe restore | Blocked: no actual report. On receipt, stop the session, preserve private backups, request synthetic steps and candidate identity, then reproduce in an isolated account/VM before changing storage code.                                                                                 |
| P1       | Installation and upgrade failures                     | Historical Phase 6 silent installer failure remains observed and unresolved. Phase 7's one isolated upgrade passed; no new tester reproduction is available. Obtain installed version, exit code if known, runtime/network availability, and redacted first-failure details before retry. |
| P1       | Tray, widget dragging, focus, lifecycle               | Blocked: no physical tester observations. Obtain checklist IDs W05–W09, window state, timer/shortcut state, monitor setup, and synthetic steps. Prior injected dragging is inconclusive.                                                                                                  |
| P1       | Monitor/DPI placement and inaccessible controls       | Blocked: no tester reports for W10–W11. Need actual display configuration and physical observations.                                                                                                                                                                                      |

Do not label an unverified hypothesis as reproduced, fixed, or passed. Once a report arrives, retain its source/alias/date, candidate hash, scenario ID, impact, synthetic reproduction, and expected/observed behavior using the existing bug form. Link duplicates to the original report. Confirmed fixes require a failing regression test before the fix, a passing test afterward, affected-function validation, and an updated candidate integrity record if runtime code changes. A physical failure also needs a documented human retest; an automated regression test alone cannot clear it.

## Human acceptance status

Every status below applies to the **human 0.5.0-beta.1 session**, not the older automated suites. Blocked means the required tester/environment evidence is missing. The reusable blank sheet is preserved for real observations.

| ID  | Scenario                                      | Status  | Reason / next evidence                                                                         |
| --- | --------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| W01 | Clean Windows install and persistence         | Blocked | No disposable-environment tester result.                                                       |
| W02 | Missing WebView2, online bootstrap            | Blocked | No missing-runtime execution evidence; source inspection is insufficient.                      |
| W03 | Missing WebView2, offline failure and retry   | Blocked | No disposable VM snapshot/network scenario result.                                             |
| W04 | Prior-build upgrade and retention             | Blocked | No human candidate upgrade report. Prior isolated automated Pass is retained separately below. |
| W05 | First/immediate/delayed launch and activation | Blocked | No complete human four-scenario record; component-level timing also remains open.              |
| W06 | Physical tray menu and Quit                   | Blocked | No physical full-menu result; earlier partial UI observations remain partial.                  |
| W07 | Shortcut conflict and cross-app focus         | Blocked | No attended cross-application input/focus result.                                              |
| W08 | Physical dragging, placement, always-on-top   | Blocked | No physical pointer result. Two earlier injected attempts did not demonstrate movement.        |
| W09 | Actual sleep/resume timer lifecycle           | Blocked | No attended sleep/wake evidence or reliable test-machine wake path supplied.                   |
| W10 | Multiple monitors, negative origins, removal  | Blocked | No tester configuration and observations supplied.                                             |
| W11 | Mixed DPI, primary change, taskbar edges      | Blocked | No supported hardware/configuration result.                                                    |
| W12 | Manual backup/import/recovery and uninstall   | Blocked | No human session report. Prior automated recovery/retention results do not clear this row.     |
| W13 | Offline core workflow with AI off             | Blocked | No human disconnected-network session report.                                                  |

No new human Pass or Fail is asserted. The historical installer failure is retained as a failure observation, with cause unresolved and later non-reproduction explicitly preserved. Overnight stability, same-account rollback, explicit uninstall data deletion, and signing limitations remain as recorded in Phase 7.

## Engineering evidence retained and checked

| Check                                      | Result                                  | Evidence and limit                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retained local candidate integrity         | Pass                                    | Read-only inspection on 4 November: FlowPlan Personal 0.5.0-beta.1, 3,629,157 bytes, SHA-256 `A559941CCAD5FD5860F6B9A1EF4E99037CDED9F44B8F0FB957D53C94A6ED6334`, Authenticode `NotSigned`. Matches Phase 7 exactly; no rebuild needed.                                                       |
| Original candidate packaging and source CI | Pass (historical, rechecked)            | [Run 41088969265](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/41088969265) completed successfully for base `5ef7c1c`, including browser, Windows/native, packaging, and diagnostics-contract checks. Packaged source remains `edc341c1c9449f0a521d612c33d34c3381b721b2`. |
| Isolated synthetic upgrade retention       | Pass (historical)                       | Phase 7 recorded exit code 0 and equality of the complete workspace and selected preferences for 0.4.1 → 0.5.0-beta.1 under the acceptance identity. Not repeated.                                                                                                                           |
| Extended resource observations             | Pass within recorded scope (historical) | Preserve Phase 6's three approximately 20-minute stages across two sessions and its overlap/interruption limits. No overnight claim or new soak.                                                                                                                                             |

This branch changes acceptance documentation only. Candidate version, application identity, SQLite/JSON formats, backup behavior, local-first operation, optional experimental AI, and approved UI remain unchanged. No new regression test is warranted without a reproduced defect or runtime change. Formatting/local links are checked for this delivery; branch CI provides its own status on the pushed commit, distinct from the historical results above. Installer uploads remain disabled.

## Readiness decision and unblock requirements

**Hold wider beta evaluation.** The prepared candidate remains suitable only for the previously scoped, separately authorized supervised synthetic-data sessions. Phase 8 cannot be completed from the available evidence.

The coordinator must provide actual redacted reports or an accessible reporting source, plus completed checklist rows with tester alias, date/time, candidate identity/hash, Windows/WebView2/display configuration, and expected/observed behavior. Prioritize data-loss, installation, tray, dragging, focus, and lifecycle reports. Do not submit databases, JSON backups, personal project content, credentials, or raw path-bearing logs. Use the [safe diagnostic instructions](beta-tester-guide.md#safe-diagnostics).

Then triage actual reports, reproduce confirmed failures in isolation, implement targeted fixes with regression tests, validate affected behavior/packaging/CI, and obtain human retests where required. This review neither contacts testers nor distributes installers, modifies personal data, merges, tags, or releases anything.
