# Phase 6 final gate review

Continuation from `b30fb69` on `feat/phase-6-release-prep`, 30 October 2026. Earlier passed tests are retained in [the acceptance record](phase-6-acceptance.md); this review covers the remaining gates only.

## Increasing-version installation

The retained synthetic workspace contains 40 projects, 2,000 tasks, and 4,000 activity entries. The dedicated identity remains `com.amirzulfadhli.flowplan-beta-acceptance`, product name **FlowPlan Beta Acceptance**, installed only under the workspace audit directory. The personal application and its data were not used.

The baseline executable reported 0.4.0. A Tauri configuration overlay set the acceptance candidate to 0.4.1; the installed executable then reported 0.4.1. The repository's product version remains 0.4.0: this test does not announce or publish a release. This exercises an actual increasing-version NSIS upgrade, with the existing database schema unchanged.

Every workspace field matched the retained external JSON backup after the upgrade. Project/task selection, always-on-top, close-to-tray, disabled shortcut, and timer duration also matched the recorded pre-upgrade values. Runtime readiness was 1,221 ms for the retained baseline and 1,123 ms after upgrade, including CDP connection/locator overhead; this is not a new startup benchmark.

The first silent candidate installation returned a nonzero exit without diagnostics and left the baseline executable at 0.4.0. A direct retry exited 0. The failed attempt was archived, and a complete isolated baseline-to-candidate rerun passed. The cause of the first failure is unconfirmed; it must not be described as fixed or attributed to antivirus/file locking without evidence. The audit now captures installer exit codes, stdout, and stderr on future failures.

## Physical checks and blocked environments

- Passed through native UI on the installed acceptance candidate: Settings navigation, Quick Add expansion with the task capture field visible, companion collapse, and explicit Settings > Quit (both windows disappeared and no acceptance process remained).
- Companion remained above the main window with its retained always-on-top preference. This is a single-monitor observation, not proof of cross-application focus preservation.
- Two injected drag attempts produced no observed position change. Dragging is **not passed**; the available evidence does not distinguish input-tool behavior from a product defect. A human pointer test is required before clearing this gate.
- The Windows taskbar/tray was not exposed as a targetable window by the available automation API. Physical tray Open/Quick Add/Show/Hide/Quit and shortcut conflicts remain **blocked**. Existing automated command tests do not replace these checks.
- Read-only inventory found one active monitor, no Windows Sandbox executable, no Hyper-V management module/VM service, no VirtualBox/VMware commands, and no VMs in the checked standard directories. The `vmcompute` service alone is not a usable disposable Windows VM. Clean Windows installation and missing-WebView2 execution are **blocked**.
- Sleep/resume requires a disposable machine or an attended host session with a reliable resume path. It was not induced on the user's active host. Multiple monitors, monitor removal, negative origins, mixed DPI, and alternate taskbar edges are **blocked** by unavailable hardware/configurations. No host security or display setting was changed.

## Missing WebView2: source inspection only

The generated NSIS script checks the machine/user WebView2 registration. With no runtime and a normal installation, it downloads Microsoft's bootstrapper, invokes it, and aborts if download or installation fails. `/UPDATE` skips this prerequisite branch. This is source inspection, **not execution evidence**. Do not use `/UPDATE` as a clean-install command or claim this package installs offline on a machine without WebView2. The host runtime was already present (156.0.4314.50).

## First use

An empty desktop Home page now uses the existing compact Card styling to explain project creation, Settings JSON import, device-local storage, separate browser data, default close-to-tray, and explicit Quit. Its Settings link is functional. The guide disappears when projects exist; existing populated workspaces and the browser layout remain unchanged. No persistent onboarding flag, new database migration, or new account flow was introduced.

## Extended resource measurements

The original extended run finished the visible and hidden idle stages, then was interrupted about 129 seconds into the timer stage. Its 239 samples are preserved in `before-soak-1793357893001.json`. Each idle stage spans approximately 20 minutes (1,200.56 and 1,199.46 seconds between endpoint samples). The incomplete timer samples are excluded from the final timer result.

| Stage                          | Private memory, first → last | Process CPU seconds |
| ------------------------------ | ---------------------------- | ------------------- |
| Visible                        | 291.36 → 237.36 MiB          | 127.203             |
| Hidden idle                    | 278.53 → 238.01 MiB          | 0.484               |
| Hidden running timer (resumed) | 281.48 → 218.31 MiB          | 2.031               |

The resumed timer stage completed on 30 October 2026 at 19:18 MYT, with 104 samples spanning 1,199.62 seconds between endpoints. The 25-minute timer duration covered the full stage. The complete synthetic workspace still matched the external backup, no renderer errors were recorded, and the audit's explicit application shutdown completed. Its report is `increasing-version-report.json`, with console output in `timer-soak-resumed.log`. These bounded measurements show no sustained private-memory growth; no resource optimization was justified.

These are process-tree CPU totals, not CPU percentages. Physical UI verification overlapped the earlier run, and local tests/builds overlapped the beginning of the resumed timer run. Treat these as bounded operational observations, not controlled idle benchmarks or a continuous one-hour session. They do not establish overnight stability or explain a performance regression.

## Reproduction

Retain the original acceptance report, external backup, and 0.4.0 candidate installer. With the isolated application uninstalled but its synthetic database retained, build with a Tauri overlay containing the same acceptance identifier/productName and `"version": "0.4.1"`. Copy the resulting acceptance installer to `desktop-test-results/acceptance/candidate-setup-0.4.1.exe`.

Run `node scripts/beta-acceptance.mjs --upgrade-retained --skip-soak`. It refuses to overwrite an existing upgrade report and checks installed executable versions and data before/after replacement. The completed original installer/reinstall suite is not repeated. Then set `FLOWPLAN_SOAK_PHASE_SECONDS=1200` and run `node scripts/beta-acceptance.mjs --upgrade-soak` for three 20-minute stages. This resumes the verified upgraded installation, checks its binary hash, and retains the earlier report before collecting samples. The timer duration exceeds its measurement stage so that the entire hidden-timer interval remains active.

If interrupted during the final stage, `--upgrade-soak --timer-soak-only` runs a fresh full timer stage and archives the preceding report. It explicitly hides both windows before starting the timer. Earlier idle measurements remain separate evidence; the gap between runs must not be counted as measured time or described as a continuous one-hour soak.

Machine-local synthetic evidence remains under ignored `desktop-test-results/acceptance`: `increasing-version-interrupted.json`, `increasing-version-report.json`, `extended-soak.log`, `environment-gates.json`, installers, and the external backup. Never distribute an acceptance-identity installer. Restore the normal build with `npm run desktop:build` after audit builds.

## Audit installer integrity

The increasing-version acceptance installer is 3,630,516 bytes, SHA-256 `29AE89BBF87B1E1607999523E8CF25B461A9F27587F7E8B8BFE953D34E2B2D4D`, Authenticode status `NotSigned`. Runtime sources are the `b30fb69` baseline plus the desktop empty-state guide in this delivery; the only version override is in the separate acceptance build configuration. Windows build 26200.9711, WebView2 156.0.4314.50, 8 GB RAM, existing single-monitor 125% scaling. Final personal-identity packaging is recorded separately after the soak.

## Normal installer and source identity

The normal **FlowPlan Personal** 0.4.0 x64 installer was rebuilt from source commit `cab42bb5a3a701e6bcd8a8ebaf846c6c37eca657`, using `com.amirzulfadhli.flowplan-personal`, release optimization, the locked Cargo dependencies, and no `desktop-test` feature. Documentation changes after this commit do not change the packaged runtime. No diagnostic launch flags are bundled.

Installer size: **3,631,450 bytes**. SHA-256: `A89A4455FBB7D17170B375BFF9442772A3165FCBE9A281A4A3A06AF5D2E919EA`. Authenticode: **NotSigned**. Build environment is the Windows/WebView2 configuration recorded above. The first packaging attempt could not resolve the NSIS download host inside the sandbox; the network-enabled retry completed successfully. This is a local packaging result, not another clean-install acceptance test or a published release.

Local ESLint, all 61 frontend tests, TypeScript/desktop frontend build, script syntax, and normal NSIS packaging passed. Browser end-to-end and native suites are checked through the delivery branch CI.

Source commit `cab42bb` passed both jobs in [CI run 41046243959](https://github.com/amirzulfadhli/flowplan-personal/actions/runs/41046243959): browser formatting/lint/types/tests/build/end-to-end checks, and Windows Rust formatting/tests/Clippy, browser/desktop builds, native storage/companion/AI suites, and production packaging.

## Readiness decision

**Limited supervised evaluation only; full Phase 6 acceptance remains incomplete.** Increasing-version retention, first-use guidance, three approximately 20-minute resource stages across two sessions, normal packaging, and source CI now have evidence. No personal database was used or reset, and no host security/display configuration was changed.

Broader distribution remains gated by clean Windows/missing-WebView2 execution, physical tray/shortcut/focus/dragging checks, sleep/resume, and multi-monitor/DPI/taskbar configurations. The earlier unexplained installer failure remains an unresolved reliability observation despite the successful complete retry. Startup component-level instrumentation and all four launch scenarios remain unchecked in the beta checklist. No confirmed new runtime regression was found, but unavailable tests are not proof of correctness. Nothing was merged, tagged, or released.
