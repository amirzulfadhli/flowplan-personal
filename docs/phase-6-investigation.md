# Phase 6 investigation — in progress

Base: ab28016. No startup optimization has yet been justified or implemented.

The isolated debug audit now records separate process-spawn, debugging-endpoint, CDP connection, UI readiness, navigation timing, and database-read round-trip milestones. Endpoint availability includes native startup and WebView2 initialization; it does not isolate those two phases internally. The database round trip is measured after UI readiness, not the initial database open.

Observed on 28 October 2026:

| Profile          | UI ready | Endpoint ready | CDP connected | Database round trip |
| ---------------- | -------: | -------------: | ------------: | ------------------: |
| Fresh            |  2248 ms |        1447 ms |       1598 ms |               23 ms |
| Immediate reopen |  2046 ms |        1429 ms |       1554 ms |               28 ms |
| Immediate reopen |  7190 ms |        6713 ms |       6839 ms |               33 ms |

The delay is intermittent and mostly precedes endpoint readiness. This does not prove a SQLite or React bottleneck. Hidden private memory was 199.89 MiB; process-tree CPU was 0.48 CPU-seconds over 15.84 seconds. Evidence: desktop-test-results/performance-1793180003014/report.json. These are debug measurements, not production performance claims.

Pending: internal native/initial SQLite timing, isolated production measurements, confirmed optimization with before/after comparison, physical tray/lifecycle audit, isolated installer upgrade and clean-install verification, final packaging and CI. Phase 6 is not complete. Existing Phase 5 evidence remains valid but is not relabeled as new Phase 6 testing.

Preparation documents: [beta checklist](beta-checklist.md), [installation instructions](beta-installation.md), and [changelog](../CHANGELOG.md).
