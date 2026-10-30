# Supervised beta bug report

Copy into the coordinator's agreed private channel. Do not attach installers, databases, backups, raw logs/dumps, personal screenshots, project text, prompts, credentials, usernames, or paths. Use a tester alias and synthetic reproduction. Without an agreed private channel, keep the report local.

- Report ID / tester alias:
- Candidate version / exact source commit:
- Installer SHA-256 / signature status:
- Windows build / architecture / WebView2 (or unknown):
- Monitor count, resolutions, scaling, relative arrangement, taskbar edge:
- Acceptance-sheet scenario ID:
- Impact: data loss / installation blocked / crash / unusable UI / incorrect behavior / cosmetic
- Frequency: attempts __ / failures __; first seen date/time/timezone:
- Clean install, upgrade (from version __), reopen, or existing-instance activation:
- Main window closed or explicit Quit? Companion visible? Timer running?
- AI disabled or explicitly enabled? Model name/version only if relevant; no prompts:

## Synthetic reproduction

1.
2.
3.

Expected:

Observed (redacted errors; retain error code if available):

For installer failures: normal UI or silent mode, exit code if known (do not guess), installed version afterward, windows/processes remaining, WebView2/network availability. Preserve the first failure before any coordinator-approved retry. Do not attribute it to antivirus or file locking without evidence.

Recovery attempted and outcome (or none):

External backup available? Yes / No / Unknown. Do not attach it.

Optional reviewed allowlisted diagnostic JSON:

Optional cropped synthetic-only screenshot description:

## Coordinator triage

- Status: new / needs reproduction / reproduced / blocked / fixed pending verification / verified
- Severity and release-blocking decision:
- Evidence / related report IDs:
- Assigned owner / next action:
- Retest candidate and result:
