# FlowPlan Personal

A compact, local-first workspace for an individual developer’s projects, tasks, deadlines, and progress. The approved V4.3 React UI runs in the browser and as a Tauri 2 Windows desktop app. No backend, login, or external API is required.

## Windows desktop

Phase 7 prepares **0.5.0-beta.1** for future supervised Windows testing; it is not a public release and no installer is distributed. Start with the [tester guide](docs/beta-tester-guide.md), [candidate evidence](docs/phase-7-beta-preparation.md), and [manual acceptance sheet](docs/beta-manual-acceptance.md). Phase 6 limitations remain open.

Phase 3 adds a system tray and an expandable floating companion for project capture, current tasks, progress, and focus sessions. SQLite persistence, native backups, browser-to-desktop migration, and the browser version remain supported.

Phase 4 adds an optional **AI** tab inside each project using a local Ollama model. It supports summaries, priorities, blockers, and task breakdowns; proposed task changes require explicit review and approval. No AI request runs automatically. See the [project AI guide](docs/project-ai.md) for local-only setup, privacy boundaries, and supported models.

Phase 5 hardens concurrent notes editing, bounds task-list rendering, and keeps browser writes within the portable backup limit. The [beta verification record](docs/phase-5-verification.md) includes actual local-model results, performance observations, and remaining Windows release gates.

Press **Control+Shift+Space** for Quick Add. Closing the main window keeps FlowPlan in the tray by default; use **Quit FlowPlan** to exit. Settings lets you disable close-to-tray, choose a shortcut, and keep the widget above other windows. See the [companion guide](docs/companion.md).

```powershell
npm ci
. .\scripts\windows-env.ps1
npm run desktop:dev
# Build the installer:
npm run desktop:build
```

Install Rust MSVC, Visual Studio C++ Build Tools, and WebView2 first. See the [desktop guide](docs/desktop.md) for prerequisites, installer location, data paths, migration steps, and native test commands. The package is unsigned and no release is published.

## Run locally

Use Node.js **22.12 or newer** (Node 22 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. A fresh browser profile starts with an **empty workspace**. Create a project, then add tasks. There is no production seed data.

For the production build and offline caching:

```sh
npm run build
npm run preview -- --port 4173
```

Visit `http://127.0.0.1:4173` once online and wait for the offline-ready message. The production service worker precaches the application, including the lazy-loaded analytics bundle. Subsequent visits at that same origin work offline. Development mode does not install a service worker. Service workers require localhost or HTTPS.

**Use a consistent address and port:** each origin, browser, and browser profile has its own IndexedDB workspace. The development and preview ports have separate data. Export/import to move between them.

## Application features

- Dashboard with quick capture, upcoming tasks, project cards, completion, and seven-day momentum.
- Project creation, editing, deadlines, colors, and confirmed cascading deletion.
- Task creation, editing, deletion, due dates, priorities, status changes, search, and filters.
- Responsive Kanban with desktop drag-and-drop and keyboard/touch-accessible status selects.
- Calendar with project and task deadlines, project filtering, month navigation, selected-day details, and upcoming schedule.
- Interactive Recharts analytics: project completion, layered daily completions, workflow balance, project momentum, and cumulative completion lines. Project legends toggle series; periods cover 7, 14, or 30 days. Daily data is also available in a table.
- Project workspaces with overview, tasks, explicitly saved notes, and isolated activity timelines.
- Local display name above Settings in the sidebar; global workspace search with Ctrl/Cmd+K.
- IndexedDB persistence, cross-tab refresh, JSON export, validated and confirmed JSON replacement imports, visible storage error states, and production offline caching.
- Windows SQLite storage with three versioned migrations, revision-checked writes, native JSON Save dialog, and recovery-copy review/restore. Existing browser backups can be imported without altering their source.
- Windows tray, draggable floating island, expandable project/task companion, configurable global Quick Add shortcut, and a focus timer that survives hiding and restarts.

The profile is a local display name, not an account. No telemetry, external font requests, cloud AI provider, collaboration, or authentication is included.

## Verify

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests serve the built application on port 4173. Rebuild after source changes before rerunning them. In Linux CI, use `npx playwright install --with-deps chromium`. CI repeats browser checks and Windows desktop/database builds on pushes and pull requests. Native test commands and their isolated-data setup are in the [desktop guide](docs/desktop.md).

Tests cover commands, validation, completion dates, scoped activity, date boundaries, transactional persistence, failure recovery, real UI editing, export/import, offline reopening, cross-tab updates, and responsive routes from 360 to 1440 pixels. Test-only fixtures explicitly label their projects “Demo”; they are never loaded automatically in production. Screenshots and failure traces are written to ignored `test-results/` and `playwright-report/` folders.

## Structure

```text
src/
  domain/       Typed schema, pure commands, local dates, progress selectors
  storage/      Repository contract, IndexedDB/SQLite adapters and runtime selection
  desktop/      Companion UI, native bridge, desktop preferences and timer display
  ai/           Project assistant, local transport, scoped context and reviewed proposals
  state/        Persistence lifecycle and cross-tab notifications
  components/   Shared cards, dialogs, project cards, task controls and editors
  pages/        Home, projects, project detail, tasks, board, calendar, insights, settings
  test/         Test setup and fixtures
  App.tsx       Navigation shell, route composition and search
  main.tsx      Application bootstrap and error boundary
  styles.css    V4.3 tokens, Tailwind theme and responsive component styling
e2e/            Production-browser workflow and layout tests
src-tauri/      Rust application, SQLite, migrations, capabilities and Windows packaging
scripts/        Windows environment helper and native WebView2 smoke test
docs/           Architecture, design mapping and verification record
design/reference/ Original approved HTML reference
```

## Data and limitations

- Browser data lives in the current browser profile; desktop data lives in a separate SQLite database under the Windows user application-data directory. Browser eviction can remove browser data. Export backups outside either data directory regularly.
- Imports **replace**, rather than merge, the workspace after validation and review. Export first. Only this app’s schema v1 is accepted, up to 20 MB. The prototype’s unversioned localStorage format is not an application backup.
- Completion analytics reflect **currently completed tasks grouped by their latest completion timestamp**. Reopening/deleting a task removes it from the charts; moving it attributes it to its current project. Cumulative totals include earlier completions. Charts are not an immutable record of past daily snapshots.
- Notes and editor forms require Save. Unsaved drafts do not survive navigation or reload. Updates never force a reload; apply them after saving edits.
- Multiple tabs serialize database transactions and refresh after writes. Simultaneous edits to the same entity use the last saved values; no conflict-resolution UI is provided.
- This is optimized for personal workspaces, not very large datasets. Lists are not virtualized, and the v1 adapter rewrites one validated workspace snapshot per transaction.
- Automated browser verification targets Chromium. Native verification targets Windows x64 WebView2. Firefox, Safari, macOS/Linux desktop packaging, and real device touch testing are not claimed.

See [architecture decisions](docs/architecture.md), [design mapping](docs/design.md), [desktop guide](docs/desktop.md), and [Phase 4 verification](docs/phase-4-verification.md).

## Future phases

Collaboration and cloud sync remain deferred. Signing and a controlled installer upgrade rollout should precede public desktop distribution.
