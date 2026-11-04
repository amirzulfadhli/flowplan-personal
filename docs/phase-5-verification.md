# Phase 5 — beta hardening

Base: `bb23af4` on `feat/phase-4-project-ai`. Work: `feat/phase-5-beta-hardening`.
Verification dates: 27–28 October 2026. No release or merge. The package version remains 0.4.0; use the branch commit to identify this beta candidate.

## Changes

- Task lists render 100 rows per page. Search and filters still operate over the entire workspace, reset pagination, and preserve editing. No storage/query pagination or chart redesign.
- Project notes retain the user's draft when another window saves. Saving requires the original notes to match inside the repository transaction; SQLite conflict retries cannot overwrite a newer note. The UI explains the conflict and offers an explicit reload.
- IndexedDB writes enforce the same 20 MiB compact UTF-8 backup limit as SQLite. Rejected writes retain the previous workspace, including revision and activity. Existing data is never reset or truncated. Legacy oversized browser workspaces remain readable/exportable; reducing their size is necessary before saving again or importing into desktop.
- The shared Ollama prompt now distinguishes advice from proposed changes, provides an explicit new-task example, and prohibits claims that proposals have already been saved. Approval, project isolation, endpoint restrictions, and validation remain mandatory.
- Added opt-in UI, real-model, and native performance audit scripts. Native companion regression coverage now includes a suspended/resumed WebView renderer.

## Actual local model

With explicit user approval, downloaded the official portable Ollama 0.40.11 Windows runtime, verified its SHA-256 against the official release metadata, and downloaded only `qwen3:1.7b` (1.4 GB). Ran on CPU on this 8 GB machine. The audit server bound to `127.0.0.1:11435` with `OLLAMA_NO_CLOUD=1`, one loaded model, one parallel request, a one-minute keep-alive, and workspace-local model storage. No global startup service or environment setting was installed. The audit-owned server was stopped afterward; runtime/model files remain in ignored `desktop-test-results/ollama/`.

All prompts used synthetic projects in an isolated SQLite database. No personal project data was read or sent to Ollama. A second project and profile contained canaries for isolation checks.

The original prompt returned accepted JSON for summary/priorities/blockers but ignored an advice-only request and proposed unnecessary field rewrites. Its breakdown invented a task reference; FlowPlan rejected that response without saving anything. The revised prompt passed the structural/approval audit:

| Request        | Final measured time | Observation                                                                                        |
| -------------- | ------------------: | -------------------------------------------------------------------------------------------------- |
| Summary        |             14.94 s | Correct guide/build/deployment summary; no task actions                                            |
| Priorities     |             12.52 s | Recognized dependency, but one explanation incorrectly called the pending deployment “in progress” |
| Blockers       |             15.18 s | Identified failing image paths/preview build as the deployment blocker; no actions                 |
| Task breakdown |             24.06 s | Two new todo proposals, no invented due date; one persisted only after review and approval         |

An earlier cold-load summary took 42.35 s. These are individual measurements, not percentiles or guarantees. The final run reused a recently loaded model. The small model can repeat itself, misstate status, or propose a task similar to an existing task. **Structured validation is not factual validation.** AI should remain optional and treated as experimental for beta; users must review evidence and every field before approval. No larger model was downloaded or assessed.

Cancelled review and request cancellation preserved SQLite data and returned usable controls. An unavailable local endpoint produced a visible error; reconnect discovered the installed model again. The existing deterministic protocol suite separately verifies malformed output, foreign task references, HTTP failures, redirects, cloud aliases, request cancellation, and companion access denial.

Evidence: `desktop-test-results/local-model-1793106284766/report.json`; the earlier rejected-output audit is `local-model-1793105858826/report.json`. The audit validates accepted UI output, counts/actions, privacy canaries, and writes; quality observations above are a manual review of the actual text. The prompt retains JSON-schema output and post-validation, consistent with [Ollama's structured-output guidance](https://docs.ollama.com/capabilities/structured-outputs).

## UI and performance

Audited calendar, layered analytics, and project activity at 1440, 720, and 390 CSS pixels, including long and unbroken content. No document-wide horizontal overflow or runtime errors. Analytics tables use their intended internal scroll container. Screenshots retain the approved compact hierarchy and sidebar profile placement. A 720-pixel viewport is a responsive-layout check, not proof of Windows DPI behavior.

Synthetic scale fixture: 40 projects, 2,000 tasks, 4,000 activity entries. Whole navigation-to-render timings from the same audit harness:

| Task page    |   Before |  After |
| ------------ | -------: | -----: |
| Render time  | 1,769 ms | 247 ms |
| DOM elements |   34,212 |  1,916 |

Other large-fixture routes remained usable: calendar 76 ms, analytics 256 ms, project activity 142 ms in the post-change sample. These include navigation and rendering on this machine; they are not a sustained benchmark. Evidence: `beta-ui-1793105081913` (baseline) and `beta-ui-1793105755899` (after).

Native startup/resource observations are recorded below. The first sample (`performance-1793106397006`) overlapped Rust compilation and is excluded from the final baseline.

Final no-build/no-inference sample: `performance-1793124721227/report.json`. This uses an empty isolated profile, a debug desktop-test binary, and CDP readiness; it is not a production installer benchmark. Existing user applications remained running.

| Native measurement                                     |           Result |
| ------------------------------------------------------ | ---------------: |
| Fresh profile, process launch through navigation ready |           1.23 s |
| Immediate reopens after graceful Quit                  |    7.71 / 7.72 s |
| Main + idle island, summed private bytes               |        196.7 MiB |
| Both windows hidden, summed private bytes              |        194.2 MiB |
| Hidden process tree CPU over 16.31 s                   | 0.25 CPU-seconds |
| Hidden WebViews' JavaScript execution delta            |              0 s |

The process tree includes FlowPlan and its WebView2 children. Summed working sets were 464.8/472.6 MiB visible/hidden and can count shared pages more than once; they are not exclusive physical RAM. No AI model process is included. Hiding retains WebViews/drafts, so memory does not fall to zero. Short samples do not establish leak-free behavior.

Immediate repeated launches were slower than a fresh profile, both after forced termination (7.78/7.83 s) and graceful Quit. No unsupported runtime flag or destructive cache reset was added to hide this result. Separate production UI-ready timing from WebView2/CDP/profile startup before claiming a startup improvement. This remains a performance investigation item for beta.

## Automated verification and package

| Check                                         | Result                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Vitest                                        | 60 passed; five new data-safety/pagination cases                                                            |
| Rust unit/database tests                      | 20 passed                                                                                                   |
| Browser Playwright workflows                  | 7 passed, including offline, backups, cross-tab refresh, and responsive routes                              |
| Native desktop                                | 8 checks passed                                                                                             |
| Native companion                              | 11 checks passed                                                                                            |
| Native AI protocol fixture                    | 8 checks passed                                                                                             |
| Real local-model audit                        | Four accepted structured responses; approval/cancel/reconnect passed, with the factual-quality caveat above |
| TypeScript, ESLint, Prettier, diff whitespace | Passed                                                                                                      |
| Rust formatting and strict Clippy             | Passed                                                                                                      |
| Browser/desktop frontend builds               | Passed                                                                                                      |
| Production Windows NSIS build                 | Passed, 3,620,496 bytes (3.45 MiB)                                                                          |

Installer: `src-tauri/target/release/bundle/nsis/FlowPlan Personal_0.4.0_x64-setup.exe`.
SHA-256: `4DF8041DC73E957C1106F55CD0854643717B6240AC231F7FF199FE86B5F39F5E`.
This is an unsigned local artifact, not an installed upgrade or published release.

Native reports: `smoke-1793106824979`, `companion-1793124499500`, and `ai-1793124556964` under `desktop-test-results/`. The artificial CDP freeze leaves document visibility hidden after reactivation even though timers run; the simulation is isolated at the end of the suite so it cannot block Playwright's animation-frame-based pointer checks. Existing pointer tests still run normally. A WebView2 class-unregistration diagnostic appeared during forced test teardown; the functional checks and explicit Quit passed with no page errors.

The base branch's prior CI failures were resolved: [Phase 4 run 40467823031](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/40467823031) passed both browser and Windows jobs. Phase 5 uses those fixes unchanged; its pushed-commit CI status is reported with delivery.

## Windows coverage and remaining release gates

- Real Windows `Control+Shift+Space` opened the expanded companion. The fresh main window and companion were inspected at the machine's 125% scale; controls fit. The empty-workspace capture guard correctly required a project.
- Automated native tests exercise menu action handlers, close-to-tray/Quit, real OS shortcut registration/conflicts, passive foreground preservation, pinning, two-window task persistence, timer pause/resume/restart, and work-area clamping. The added renderer-freeze check verifies elapsed-time catch-up without changing the deadline. It does **not** suspend Windows.
- Physical tray-pointer interaction, sustained drag behavior, real sleep/resume, docking/undocking, multiple monitors/mixed DPI, and taskbars on other edges remain unverified. No system display settings, sleep state, security settings, or personal records were changed to simulate them.
- Fresh isolated SQLite profiles and populated v1/v2 upgrades are covered; the database schema stays at version 3 and portable JSON stays at version 1. Transaction rollback, recovery copies, corrupt/future schema refusal, and offline behavior remain covered.
- NSIS packaging is verified separately below. A fresh test profile is not a clean Windows installation. Clean-VM installation with missing WebView2, antivirus/SmartScreen behavior, signing, installer upgrade on a second machine, physical power loss, and long-duration resource soak testing remain beta distribution gates. The installed personal app/database was not upgraded or modified during Phase 5.

**Readiness:** suitable for a limited, supervised beta evaluation with backups and optional experimental AI. It is not yet signed or fully validated for broad Windows distribution. The outstanding physical-device, clean-install, startup, and model-quality checks above should be completed before widening the beta.

## Reproduce the optional audits

```powershell
npm run build
npm run audit:ui
. ./scripts/windows-env.ps1
npm run desktop:build:test
npm run audit:desktop-performance
# Start an already installed, cloud-disabled local Ollama first. This command never downloads models.
$env:FLOWPLAN_AUDIT_OLLAMA = 'http://127.0.0.1:11435'
$env:FLOWPLAN_AUDIT_MODEL = 'qwen3:1.7b'
npm run audit:local-model
```

Run resource measurements without concurrent builds or inference. The scripts write reports to ignored `desktop-test-results/` and use separate profiles. Real-model quality checks are intentionally opt-in and not CI requirements; CI never downloads models. Standard automated verification commands remain in [the desktop guide](desktop.md).
