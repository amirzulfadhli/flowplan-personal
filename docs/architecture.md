# Architecture decisions

This document records the Phase 1 foundation. [Desktop architecture](desktop.md) adds a Tauri 2 shell and SQLite adapter behind the same repository contract, with independent database migrations and transactional recovery copies. [Phase 3 companion architecture](companion.md) adds native lifecycle controls, a second window, and separately versioned companion state. Browser behavior remains supported.

## 1. React, TypeScript, and Vite

React components own presentation and temporary form state. TypeScript checks domain and UI boundaries. Dependencies are pinned and the npm lockfile is committed. The selected Vite toolchain supports the installed Node 22.15 runtime; Vite’s documented baseline is Node 20.19+ or 22.12+ ([official guide](https://vite.dev/guide/)). This project requires Node 22.12+.

Hash routing works without server rewrite configuration and supports desktop asset serving. Analytics is lazy-loaded because Recharts is the main optional screen dependency; the desktop companion also has a separate lazy-loaded entry. The browser service worker precaches shipped bundles for offline routing.

## 2. Design tokens and reusable components

Tailwind 4 is integrated through its official Vite plugin ([installation](https://tailwindcss.com/docs/installation/using-vite)). `src/styles.css` exposes the same tokens to Tailwind utilities and semantic component classes. Shared primitives include page headers, cards, empty states, progress indicators, native dialogs, project cards, task filters, and task editors. This preserves the reference’s layout values without duplicating long utility strings across every screen.

The original reference is retained without modification. Component source and styles are formatted with Prettier; reference HTML is intentionally excluded from formatting.

## 3. Domain and data integrity

`Workspace` contains a schema version, revision, local profile, projects, tasks, and project-scoped activity. Zod validates the entire boundary on disk reads, imports, and writes. Validation rejects unknown schema versions, unknown fields, malformed dates/colors, duplicate IDs, dangling project references, and completion/status mismatches.

`applyCommand` is a pure operation over a cloned workspace. It handles creation, updates, cascading deletes, notes, profile changes, and import replacement. Database-specific concerns do not leak into domain commands. UI updates become visible only after persistence succeeds. Errors retain the prior workspace and leave editor input available for retry.

Each task has `createdAt`, `updatedAt`, and nullable `completedAt` timestamps. Completing a task sets its completion timestamp; ordinary edits preserve it; reopening clears it; completing again records the new instant. Calendar due dates are local `YYYY-MM-DD` values, while timestamps are UTC ISO strings. Rendering completion days uses the device’s time zone. Changing the device time zone may shift the day of a completion near midnight.

## 4. Interchangeable storage

`WorkspaceRepository` exposes:

```ts
read(): Promise<Workspace>
execute(command: Command): Promise<Workspace>
```

The Phase 1 adapter uses `idb` and one IndexedDB object store. Every mutation reads the latest snapshot, applies the command, and writes the validated result in one read-write transaction. Independent concurrent changes do not overwrite the whole workspace from a stale React closure. The adapter’s contract allows a future desktop implementation without component rewrites.

An increasing local revision prevents older asynchronous read results from replacing newer UI state. `BroadcastChannel` notifies other tabs after committed writes; focus refresh is a fallback. Entity-level simultaneous editing is last-save-wins. A future database adapter should keep transactional command execution and add concurrency checks if conflict resolution becomes necessary.

The snapshot approach intentionally prioritizes simplicity and atomic backups for individual datasets. The import guardrails (2,000 projects, 50,000 tasks, 100,000 activity entries, and 20 MB file size) are validation ceilings, not performance guarantees. Larger workloads should move to indexed tables and paginated queries in Phase 2.

## 5. Backups and recovery

Exports contain the exact v1 workspace, including IDs and timestamps. Imports validate before presenting counts and requiring an explicit replace decision. The review offers a backup export; failed validation or persistence leaves the current workspace intact. Import revision is assigned from the current local revision rather than trusting the incoming revision.

An unreadable or unsupported saved schema triggers recovery UI rather than silently resetting user data. Phase 1 has no automatic migration from the prototype and no destructive “reset all” shortcut.

## 6. Honest analytics

All charts derive from persisted tasks; no synthetic data is shipped in the production runtime. Empty days are zero. Daily stacked bars count tasks currently marked done with a completion date on that day. Project cumulative lines count these tasks completed on or before the plotted date, including completions outside the visible window.

These are current-state completion statistics, not event-sourced audit history. Reopening, deletion, and moving tasks can change earlier aggregates. Activity text is for project timelines and is never parsed as numerical analytics. Workflow balance replaces the reference’s focus-duration sample because Phase 1 does not record focus sessions.

## 7. Offline app shell and scope

`vite-plugin-pwa` generates a production precache manifest for all shipped assets. First-visit caching needs a network connection (or a reachable localhost server); subsequent loads work offline at the same origin. Updates use an explicit reload prompt to protect unsaved forms. There are no runtime data API calls, authentication tokens, or backend services.

Phase 2 implements Tauri and SQLite while preserving the v1 JSON contract. Phase 3 adds the native tray/island and cross-window notifications. Phase 4 adds [project-scoped local AI](project-ai.md) with explicit task approval and no persistence/schema changes. Synchronization remains future work. See the desktop, companion, and AI guides for storage boundaries, revision checks, migration procedures, and native lifecycle.
