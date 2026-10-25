# FlowPlan Personal

A compact, local-first workspace for an individual developer’s projects, tasks, deadlines, and progress. Phase 1 implements the approved V4.3 direction in React and TypeScript. No backend, login, or external API is required.

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

## Phase 1 features

- Dashboard with quick capture, upcoming tasks, project cards, completion, and seven-day momentum.
- Project creation, editing, deadlines, colors, and confirmed cascading deletion.
- Task creation, editing, deletion, due dates, priorities, status changes, search, and filters.
- Responsive Kanban with desktop drag-and-drop and keyboard/touch-accessible status selects.
- Calendar with project and task deadlines, project filtering, month navigation, selected-day details, and upcoming schedule.
- Interactive Recharts analytics: project completion, layered daily completions, workflow balance, project momentum, and cumulative completion lines. Project legends toggle series; periods cover 7, 14, or 30 days. Daily data is also available in a table.
- Project workspaces with overview, tasks, explicitly saved notes, and isolated activity timelines.
- Local display name above Settings in the sidebar; global workspace search with Ctrl/Cmd+K.
- IndexedDB persistence, cross-tab refresh, JSON export, validated and confirmed JSON replacement imports, visible storage error states, and production offline caching.

The profile is a local display name, not an account. No telemetry, external font requests, AI, native tray, floating companion, collaboration, or authentication is included.

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

The browser tests serve the built application on port 4173. Rebuild after source changes before rerunning them. In Linux CI, use `npx playwright install --with-deps chromium`. CI repeats the checks on pushes and pull requests.

Tests cover commands, validation, completion dates, scoped activity, date boundaries, transactional persistence, failure recovery, real UI editing, export/import, offline reopening, cross-tab updates, and responsive routes from 360 to 1440 pixels. Test-only fixtures explicitly label their projects “Demo”; they are never loaded automatically in production. Screenshots and failure traces are written to ignored `test-results/` and `playwright-report/` folders.

## Structure

```text
src/
  domain/       Typed schema, pure commands, local dates, progress selectors
  storage/      Interchangeable repository contract and IndexedDB adapter
  state/        Persistence lifecycle and cross-tab notifications
  components/   Shared cards, dialogs, project cards, task controls and editors
  pages/        Home, projects, project detail, tasks, board, calendar, insights, settings
  test/         Test setup and fixtures
  App.tsx       Navigation shell, route composition and search
  main.tsx      Application bootstrap and error boundary
  styles.css    V4.3 tokens, Tailwind theme and responsive component styling
e2e/            Production-browser workflow and layout tests
docs/           Architecture, design mapping and verification record
design/reference/ Original approved HTML reference
```

## Data and limitations

- Data is stored only in the current browser profile. Browser eviction or clearing site data can remove it. JSON export is the backup mechanism; make regular copies outside the browser.
- Imports **replace**, rather than merge, the workspace after validation and review. Export first. Only this app’s schema v1 is accepted, up to 20 MB. The prototype’s unversioned localStorage format is not an application backup.
- Completion analytics reflect **currently completed tasks grouped by their latest completion timestamp**. Reopening/deleting a task removes it from the charts; moving it attributes it to its current project. Cumulative totals include earlier completions. Charts are not an immutable record of past daily snapshots.
- Notes and editor forms require Save. Unsaved drafts do not survive navigation or reload. Updates never force a reload; apply them after saving edits.
- Multiple tabs serialize database transactions and refresh after writes. Simultaneous edits to the same entity use the last saved values; no conflict-resolution UI is provided.
- This is optimized for personal workspaces, not very large datasets. Lists are not virtualized, and the v1 adapter rewrites one validated workspace snapshot per transaction.
- Automated browser verification targets Chromium. Firefox, Safari, native Windows packaging, OS integration, and real device touch testing are not part of Phase 1 verification.

See [architecture decisions](docs/architecture.md), [design mapping](docs/design.md), and [verification](docs/verification.md).

## Phase 2 starting point

Introduce a Tauri 2 shell and a Rust/SQLite implementation of `WorkspaceRepository`. Preserve the domain commands and schema contract; add database migrations, transactional backup/restore, and a tested IndexedDB-to-desktop migration. Validate WebView2 behavior and Windows packaging before adding any floating-island or system-tray functionality.
