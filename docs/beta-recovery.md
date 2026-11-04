# Beta backup, rollback, uninstall, and recovery

Applies to **0.5.0-beta.1**. Phase 7 changes no SQLite or portable JSON schema. This does not make every downgrade supported: NSIS blocks in-place downgrades and SQLite rejects future schemas. Use synthetic data in a separate account/VM first. See [desktop storage details](desktop.md) for actual Settings paths and implementation.

## Before installing or upgrading

1. Export JSON in Settings. Confirm saving succeeded and the file/date are correct. Keep it outside the application-data and installation directories, ideally with a separate device copy. Backups are unencrypted and private; never attach them to a report.
2. In an isolated test account, review/import a copy to verify usability. Import replaces that destination; never test restore over your only live workspace.
3. Use **Quit FlowPlan**. Confirm both windows close and no FlowPlan process remains in Task Manager. Do not force termination just to make a database copy.
4. For a full snapshot, copy the entire closed data directory, including any SQLite `-wal`/`-shm` files, to a new private folder. Preserve the original. The normal location is `%APPDATA%\com.amirzulfadhli.flowplan-personal`; Settings shows the actual path. JSON contains workspace content; the full directory also contains companion preferences and recovery history.
5. Record the current version; retain its known installer/hash and pre-upgrade backup. Never mix backups from different accounts or application identities.

## Accidental replacement import

If storage is readable, open Settings, choose the appropriate recovery copy, select **Review recovery copy**, inspect it, and confirm replacement. Export current state first if needed. Restoration also preserves the workspace it replaces. Recovery copies live in the same database and do not protect against disk loss or database damage.

If an import is rejected, preserve the original file, record a redacted error, and stop. Do not edit schema versions, remove validation, or repeatedly retry over personal data.

## Startup failure or suspected data loss

Stop editing. Do not delete the data directory, repeatedly reinstall, or open it with an older executable. If the app can quit normally, quit and preserve the full directory plus the last external backup. If it cannot exit safely, ask the coordinator before copying or terminating it. A copy taken while SQLite is running is not a verified backup. Report only safe metadata and synthetic reproduction steps.

For unreadable/corrupt storage, keep the original untouched. The coordinator should first reproduce and restore an external JSON backup in a separate account/VM with a known compatible build. This beta has no supported destructive reset or down-migration procedure.

## Rollback to the previous candidate

Rollback is coordinator-assisted recovery, not an in-place downgrade button. Post-upgrade edits will be absent from a pre-upgrade backup.

1. Preserve current external JSON and a closed full-directory snapshot, if readable. Keep the pre-upgrade backup separately; never overwrite it.
2. On a separate account/VM, install the retained prior build and restore the **pre-upgrade JSON** through Settings. Verify projects, notes, tasks, dates, and activity. JSON does not restore companion preferences or recovery history.
3. Do not point the older build at the beta database. For same-account recovery, obtain a coordinator-reviewed plan after validating the prior backup in isolation. Same-account downgrade/uninstall/reinstall rollback has not passed acceptance.

Using a compatible current candidate with a reviewed backup may be preferable to an unverified binary rollback. Manual schema edits, deletion commands, and replacing database files while running are outside this procedure.

## Uninstall

1. Preserve backups and explicitly Quit.
2. Open Windows Settings → Apps → Installed apps → FlowPlan Personal → Uninstall (Apps & features on Windows 10).
3. Leave the optional data-removal checkbox **unchecked**. Phase 6 default silent uninstall/reinstall retained synthetic data; explicit data deletion was not tested. Cancel if options differ or are unclear.
4. Verify the application stopped. Uninstalling is not a backup and does not prove the retained database is healthy. Reinstall only the agreed same or newer compatible candidate, then verify content.

Do not select data removal to troubleshoot. Secure deletion, cleanup of external backups, and removal of browser data are separate user decisions outside this supervised test.
