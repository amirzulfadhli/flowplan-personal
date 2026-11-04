# Desktop companion

Phase 3 builds on `feat/phase-2-desktop` at `f947fb8`. It keeps the existing main application and browser UI. Desktop version 0.3.0 adds a native tray, a small floating island, and an expandable companion.

## Everyday controls

- Right-click the FlowPlan tray icon for **Open FlowPlan**, **Quick Add**, **Show / Hide Widget**, and **Quit FlowPlan**. Left-click opens the main window.
- **Control+Shift+Space** opens Quick Add and focuses its input. Change or disable this shortcut under Settings → Desktop companion. An occupied shortcut reports an error and preserves the previous binding.
- Show Widget opens it without activating it. Expand the island to select a project, capture a task, choose or complete the current task, view project completion, and operate the focus timer. Capture uses the selected project and the same task commands as the main app.
- Drag the F handle to move it. The pin button toggles always-on-top; it is off by default. The widget is kept within the monitor's work area, excluding the taskbar. **Reset widget position** in Settings returns it to the primary monitor.
- Closing the main window keeps FlowPlan running in the tray by default. Closing/hiding the widget does not quit. **Quit FlowPlan** exits the process. Disable **Close main window to tray** if closing the main window should exit instead.
- A second app launch opens the existing main window. There is no login startup entry, scheduled background service, or automatic launch after reboot.

## Focus timer

Choose 5, 15, 25, or 50 minutes. Start, pause/resume, and reset are explicit actions. A running timer stores its absolute deadline in SQLite, so hiding the widget, sleeping the computer, or restarting the app does not reset it. Pause freezes the remaining duration. A completed timer displays zero until reset or started again.

Completion does not change task status, generate progress, play a sound, send a notification, or activate a window. Task completion remains an explicit action. The timer uses the system clock; changing that clock can change the displayed remaining time.

## Persistence and window synchronization

`src/desktop/` owns the companion React UI, timer formatting, native bridge, and desktop settings. `src-tauri/src/companion.rs` owns tray actions, shortcut registration, window geometry, and lifecycle. `companion_state.rs` owns timer rules and persistence.

Both windows use the existing `WorkspaceRepository` and `SQLiteRepository`. A durable workspace commit emits `workspace-changed`; subscribers reload through the repository and discard older revisions. SQLite transactions and compare-and-swap revisions prevent two windows from overwriting stale snapshots. Existing bounded command retries and non-retrying replacement imports are unchanged. Browser tabs continue using IndexedDB and BroadcastChannel.

Migration 003 adds a singleton companion record with its own revision. Timer, shortcut, selection, pin, and window state do not alter workspace revisions or analytics. Native companion mutations are serialized and persisted transactionally. Shortcut replacement registers the new OS binding before saving, then unregisters the old binding; registration or database failures preserve the previous settings. Settings drafts remain visible when another window changes preferences and require an explicit reload before saving.

Portable JSON backups continue to contain the schema-v1 workspace. They intentionally exclude device-specific shortcut, position, and timer preferences. Import/recovery preserves those preferences; selection falls back to an available project/task if the previous selection was removed. Existing recovery snapshots and browser migration are unchanged. Back up the complete closed database directory if device preferences also need to be retained.

## Background cost and boundaries

The companion WebView is created only on first use (or when restoring a previously visible widget). No native timer thread, polling loop, or per-second database writes are used. A visible running timer updates its text once per second; hiding it removes that interval. SQLite writes happen on actions. Once created, hidden WebViews remain loaded to retain drafts, so background memory use is not zero.

Position is saved on companion actions and graceful close/quit, not on every drag event. A forced process termination immediately after dragging can lose the last position. Work-area clamping and a position-reset action handle disconnected monitors, but physical multi-monitor and mixed-DPI testing remain outstanding.

Desktop APIs are enabled only for local windows with named capabilities. There is no generic SQL, shell, remote-content permission, AI, sync, or collaboration. Builds remain unsigned and are not automatically released.

See [verification results](phase-3-verification.md) and [Windows setup and backups](desktop.md).
