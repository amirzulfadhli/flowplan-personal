# Windows desktop

FlowPlan Personal uses the same React UI in the browser and in Tauri 2. Desktop data is stored in SQLite; browser data remains in IndexedDB. Desktop startup never falls back to an empty browser workspace when SQLite fails.

## Windows development

Requirements:

- Windows 10/11 x64, Node 22.12+ and npm.
- Visual Studio 2022 or Build Tools with **Desktop development with C++**, MSVC x64 tools, and a Windows SDK.
- Rust MSVC via [rustup](https://rustup.rs/). `rust-toolchain.toml` pins the verified toolchain; Cargo downloads it if needed.
- Microsoft Edge WebView2 Evergreen Runtime. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

From the repository in PowerShell:

```powershell
npm ci
. .\scripts\windows-env.ps1
npm run desktop:dev
```

The environment helper locates Visual Studio and adds Cargo to the current process PATH. It does not change global PATH or install system tools. Desktop development uses port 1420; ordinary `npm run dev` remains on port 5173.

Build a Windows installer:

```powershell
. .\scripts\windows-env.ps1
npm run desktop:build
```

Output: `src-tauri/target/release/bundle/nsis/FlowPlan Personal_0.4.0_x64-setup.exe`. The NSIS installer is per-user and does not require administrator installation. It can bootstrap WebView2 if absent; that first-time dependency download requires connectivity. Once installed, application assets and SQLite work offline immediately. Ollama is an optional, separately installed local service; core functionality does not require it.

The package is unsigned: Windows may display an unknown-publisher/SmartScreen warning. Signing certificates, automatic updates, and release publication are outside this phase. CI builds artifacts but does not create a GitHub release.

## Data location and lifetime

The stable application identifier is `com.amirzulfadhli.flowplan-personal`. The database lives in Tauri's per-user application-data directory, normally:

```text
%APPDATA%\com.amirzulfadhli.flowplan-personal\flowplan.sqlite3
```

Settings displays the actual path. This location is independent of the executable and installation folder. Do not change the application identifier in upgrades: doing so selects a different data directory. The uninstaller offers an optional data-removal checkbox, unchecked by default; leave it unchecked to retain data. Installer downgrades are disabled, and SQLite independently rejects newer schema versions. Keep JSON backups outside the application directory.

SQLite uses foreign keys, a busy timeout, WAL journaling, and `synchronous=FULL`. Do not copy only the `.sqlite3` file while the app is running; committed records can be in its `-wal` companion. Use JSON export for live portable backups, or close the application before copying the complete database directory.

## Browser-to-desktop migration

1. Open the **original browser address and profile** containing your Phase 1 workspace. Development, preview, and different ports are separate origins.
2. In Settings, select **Export JSON** and retain that file.
3. Open FlowPlan Personal desktop and select **Import JSON** in Settings.
4. Review project/task/activity counts. Export the current desktop workspace if it contains data you want to keep.
5. Confirm replacement. Verify your projects, notes, task completion, and dates in the desktop app.

The source browser workspace is never removed or modified. Migration is an explicit copy, not synchronization or a merge. The desktop app does not access Chrome/Edge profile files. The same v1 JSON format can move data back to the browser. IDs and timestamps are preserved; only the destination's monotonic revision changes.

If any destination changes while an import is being reviewed, the confirmation is rejected. Cancel and review the import again. Import is never automatically retried over unreviewed changes.

## Backup and recovery

- Desktop **Export JSON** opens a native Save dialog. Rust reads a consistent database snapshot, writes a temporary JSON file beside the destination, flushes it, and atomically replaces the selected file. Canceling the dialog is not reported as a successful export. Only `.json` destinations are accepted.
- Imports are validated in TypeScript and again at the Rust boundary. Unsupported schema versions, invalid dates/statuses, duplicate IDs, orphan records, oversized data, and incompatible completion fields are rejected.
- Every desktop replacement import stores the **previous workspace** in `recovery_snapshots` in the same transaction as the replacement. If any write fails, neither the replacement nor the recovery insertion is committed.
- Settings lists these recovery copies. Choose one, select **Review recovery copy**, and confirm through the same import review. Restoring a recovery copy also preserves the workspace it replaces.
- Recovery copies are retained without automatic pruning. They protect against accidental replacement, not disk loss: export separate backups regularly. All files are local and unencrypted.

## Storage design

The `WorkspaceRepository` interface is unchanged. Browser uses `IndexedDBRepository`; desktop uses `SQLiteRepository`. The desktop adapter reads the current state and executes the existing TypeScript domain command. Rust then validates the resulting workspace and atomically compares the expected revision before committing. Ordinary commands retry bounded revision conflicts against fresh state; imports do not retry.

Database version is independent of JSON schema version:

| SQLite version | Migration                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| 1              | Workspace metadata and ordered projects, tasks, and activity tables; foreign keys and project indexes |
| 2              | Transactional recovery snapshots for replacement imports                                              |
| 3              | Independent companion preferences, window state, selection, and focus deadline                        |

`PRAGMA application_id`, `user_version`, and `schema_migrations` identify the database and migration history. Migrations run in a transaction. Unknown/future versions, unrelated databases, and unreadable data produce an error rather than initialization over existing data. No down-migrations or destructive reset path is implemented.

Treat shipped migrations as immutable. Add the next numbered SQL file and migration entry for future changes; test that upgrade against an existing database before shipping it.

The existing interface returns the complete workspace. Phase 2 stores entities in related tables but still rewrites their current snapshot inside each commit; this keeps command behavior identical and transactional. Large-scale query pagination, partial-row persistence, and immutable analytical history remain future optimizations, not performance claims.

## Desktop security and app lifecycle

The local main window has workspace, backup, and companion commands. The companion has workspace read/write and desktop controls, but no backup/file commands. Both windows can listen for native changes; narrowly scoped window visibility/focus queries support native UI verification. No remote web origins, generic SQL command, frontend filesystem API, shell execution, or updater is enabled. Native export chooses its own path through a user-visible dialog. A production CSP restricts scripts and connections; inline styles remain allowed for the existing charts and design tokens.

Phase 4 grants only the main window three cancellable local-AI commands. Rust accepts loopback endpoints and fixed Ollama API operations, builds context from the selected project in SQLite, and disables HTTP proxies and redirects. The companion cannot invoke AI. No database migration or portable JSON change is needed. See [project AI boundaries](project-ai.md).

The production app is single-instance: launching it again shows and focuses the existing main window. Closing the main window hides it to the tray by default; Settings can change this to quit. Closing the companion hides only the companion. **Quit FlowPlan** exits all windows and releases its shortcut. See the [companion guide](companion.md) for lifecycle and timer behavior. Production builds bundle local assets in `dist-desktop` and do not register a service worker. Browser builds keep their existing PWA/offline behavior in `dist`.

Tauri's native file drag handler is disabled because it intercepts WebView2 HTML drag events on Windows. This preserves the existing Kanban card drag-and-drop; backup imports continue to use the file chooser.

## Verification commands

```powershell
. .\scripts\windows-env.ps1
npm run typecheck
npm run lint
npm test
npm run build
npm run build:desktop
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
npx playwright install chromium
npm run test:e2e
npm run desktop:build:test
npm run test:desktop
npm run test:companion
npm run test:ai
npm run desktop:build
```

The `desktop-test` feature permits an isolated database directory and enables WebView debugging. It is used only for the native smoke executable, never for the installer. The smoke test creates real browser data, exports it, imports it through the real desktop UI, restarts the native process, and verifies SQLite persistence and recovery. Artifacts are written to ignored `desktop-test-results/`. It does not read or replace the user's actual workspace.

After installing, close any running FlowPlan window and optionally verify the production executable:

```powershell
npm run test:installed -- "$env:LOCALAPPDATA\FlowPlan Personal\flowplan-personal.exe"
```

This test reads the real desktop database without editing records. It checks the production data path, single-instance behavior, offline reload, and restart. Normal initialization or schema migrations may occur when the app opens. Both native scripts temporarily enable a localhost WebView2 debugging port for automation; ordinary application launches do not enable it.

See [Phase 2 verification](phase-2-verification.md) for the original storage checks and [Phase 3 verification](phase-3-verification.md) for companion and upgrade results.

[Phase 4 verification](phase-4-verification.md) records the local AI tests and investigation of prior Windows CI startup failures. Native AI testing uses a deterministic loopback Ollama protocol fixture and isolated data, not a downloaded model or the personal workspace.
