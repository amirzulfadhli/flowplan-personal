use crate::{
    companion_state::{clamp_position, Companion},
    database::StoreError,
    DatabasePath,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Default)]
pub struct DesktopRuntime {
    gate: Mutex<()>,
    shortcut_error: Mutex<Option<String>>,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanionView {
    #[serde(flatten)]
    pub state: Companion,
    pub shortcut_error: Option<String>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Update {
    Project {
        id: Option<String>,
    },
    Task {
        id: Option<String>,
    },
    Timer {
        action: String,
        minutes: Option<u32>,
    },
    #[serde(rename_all = "camelCase")]
    Preferences {
        always_on_top: bool,
        close_to_tray: bool,
        shortcut: String,
        expected_revision: u64,
    },
}
fn native(e: impl std::fmt::Display) -> StoreError {
    StoreError::new("DESKTOP", e.to_string())
}
fn view(app: &tauri::AppHandle, state: Companion) -> CompanionView {
    CompanionView {
        state,
        shortcut_error: app
            .state::<DesktopRuntime>()
            .shortcut_error
            .lock()
            .ok()
            .and_then(|v| v.clone()),
    }
}
pub fn announce(app: &tauri::AppHandle, state: Companion) {
    let _ = app.emit("companion-changed", view(app, state));
}
fn dimensions(expanded: bool) -> (f64, f64) {
    if expanded {
        (360.0, 480.0)
    } else {
        (288.0, 58.0)
    }
}

pub fn clamp_window(window: &WebviewWindow) -> Result<(), StoreError> {
    if let Some(monitor) = window
        .current_monitor()
        .map_err(native)?
        .or(window.primary_monitor().map_err(native)?)
    {
        let area = monitor.work_area();
        let mut size = window.outer_size().map_err(native)?;
        if size.width > area.size.width || size.height > area.size.height {
            size = tauri::PhysicalSize::new(
                size.width.min(area.size.width),
                size.height.min(area.size.height),
            );
            window.set_size(size).map_err(native)?;
        }
        let pos = window.outer_position().map_err(native)?;
        let next = clamp_position(
            (pos.x, pos.y),
            (size.width, size.height),
            (
                area.position.x,
                area.position.y,
                area.size.width,
                area.size.height,
            ),
        );
        if next != (pos.x, pos.y) {
            window
                .set_position(PhysicalPosition::new(next.0, next.1))
                .map_err(native)?;
        }
    }
    Ok(())
}
fn widget(app: &tauri::AppHandle, state: &Companion) -> Result<WebviewWindow, StoreError> {
    if let Some(w) = app.get_webview_window("companion") {
        return Ok(w);
    }
    let (width, height) = dimensions(state.expanded);
    let builder = WebviewWindowBuilder::new(
        app,
        "companion",
        WebviewUrl::App("index.html?companion=1".into()),
    )
    .title("FlowPlan Companion")
    .inner_size(width, height)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .always_on_top(state.always_on_top)
    .visible(false)
    .focused(false)
    .disable_drag_drop_handler();
    // Match the main test window's environment even on elevated CI runners.
    #[cfg(feature = "desktop-test")]
    let builder = {
        let mut builder = builder;
        if let Ok(args) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
            builder = builder.additional_browser_args(&args);
        }
        if let Some(path) = std::env::var_os("WEBVIEW2_USER_DATA_FOLDER") {
            builder = builder.data_directory(path.into());
        }
        builder
    };
    let w = builder.build().map_err(native)?;
    if let Some((x, y)) = state.position {
        w.set_position(PhysicalPosition::new(x, y))
            .map_err(native)?;
    } else if let Some(monitor) = w.primary_monitor().map_err(native)? {
        let area = monitor.work_area();
        let size = w.outer_size().map_err(native)?;
        w.set_position(PhysicalPosition::new(
            area.position.x + area.size.width.saturating_sub(size.width + 24) as i32,
            area.position.y + 24,
        ))
        .map_err(native)?;
    }
    clamp_window(&w)?;
    let cloned = w.clone();
    w.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
        ) {
            let _ = clamp_window(&cloned);
        }
    });
    Ok(w)
}
pub fn show_main(app: &tauri::AppHandle) -> Result<(), StoreError> {
    if let Some(w) = app.get_webview_window("main") {
        w.show().map_err(native)?;
        w.unminimize().map_err(native)?;
        w.set_focus().map_err(native)?;
    }
    Ok(())
}

fn parse_shortcut(value: &str) -> Result<Option<Shortcut>, StoreError> {
    if value.is_empty() {
        return Ok(None);
    }
    // Require a deliberate modifier combination; avoid stealing ordinary typing.
    if value.len() > 100 || !(value.contains("Control+") || value.contains("Alt+")) {
        return Err(native("Use Control or Alt plus a key, for example Control+Shift+Space, or leave blank to disable."));
    }
    value
        .parse::<Shortcut>()
        .map(Some)
        .map_err(|_| native("Invalid shortcut. Try Control+Shift+Space."))
}
fn register(app: &tauri::AppHandle, shortcut: Shortcut) -> Result<(), StoreError> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                dispatch(app, "quickAdd");
            }
        })
        .map_err(|e| native(format!("Shortcut is unavailable or already in use: {e}")))
}
#[tauri::command]
pub async fn companion_read(app: tauri::AppHandle) -> Result<CompanionView, StoreError> {
    Ok(view(
        &app,
        app.state::<DatabasePath>().open()?.companion_read()?,
    ))
}
#[tauri::command]
pub async fn companion_update(
    app: tauri::AppHandle,
    update: Update,
) -> Result<CompanionView, StoreError> {
    let runtime = app.state::<DesktopRuntime>();
    let _guard = runtime.gate.lock().map_err(native)?;
    let mut db = app.state::<DatabasePath>().open()?;
    let current = db.companion_read()?;
    let mut next = current.clone();
    let mut registered = None;
    let mut old_shortcut = None;
    match update {
        Update::Project { id } => {
            if id.as_ref().is_some_and(|id| {
                !db.read()
                    .is_ok_and(|d| d.projects.iter().any(|p| &p.id == id))
            }) {
                return Err(native("This project no longer exists."));
            }
            next.project_id = id;
            next.task_id = None;
        }
        Update::Task { id } => {
            if let Some(ref id) = id {
                let data = db.read()?;
                let task = data
                    .tasks
                    .iter()
                    .find(|t| &t.id == id)
                    .ok_or_else(|| native("This task no longer exists."))?;
                next.project_id = Some(task.project_id.clone());
            }
            next.task_id = id;
        }
        Update::Timer { action, minutes } => {
            next.timer(&action, minutes, chrono::Utc::now().timestamp_millis())?
        }
        Update::Preferences {
            always_on_top,
            close_to_tray,
            shortcut,
            expected_revision,
        } => {
            if expected_revision != current.revision {
                return Err(native(
                    "Companion settings changed. Reload settings before saving.",
                ));
            }
            let parsed = parse_shortcut(shortcut.trim())?;
            let previous = parse_shortcut(&current.shortcut)?;
            if parsed != previous {
                old_shortcut = previous;
            }
            if parsed != previous || runtime.shortcut_error.lock().map_err(native)?.is_some() {
                if let Some(key) = parsed {
                    register(&app, key)?;
                    registered = Some(key);
                }
            }
            next.always_on_top = always_on_top;
            next.close_to_tray = close_to_tray;
            next.shortcut = shortcut.trim().into();
        }
    }
    if let Err(error) = db.companion_save(&current, &mut next) {
        if let Some(key) = registered {
            let _ = app.global_shortcut().unregister(key);
        }
        return Err(error);
    }
    if let Some(key) = old_shortcut {
        let _ = app.global_shortcut().unregister(key);
    }
    if registered.is_some() || next.shortcut.is_empty() {
        *runtime.shortcut_error.lock().map_err(native)? = None;
    }
    if let Some(w) = app.get_webview_window("companion") {
        crate::passive_window::pin(&w, next.always_on_top)?;
    }
    announce(&app, next.clone());
    Ok(view(&app, next))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shortcuts_allow_disable_and_reject_plain_typing() {
        assert!(parse_shortcut("").unwrap().is_none());
        assert!(parse_shortcut("Space").is_err());
        assert!(parse_shortcut("Control+DefinitelyNotAKey").is_err());
        assert!(parse_shortcut("Control+Shift+Space").unwrap().is_some());
        assert_eq!(
            parse_shortcut("Control+Shift+Space").unwrap(),
            parse_shortcut("Shift+Control+Space").unwrap()
        );
    }
}

pub fn action(app: &tauri::AppHandle, action: &str) -> Result<(), StoreError> {
    if action == "open" {
        return show_main(app);
    }
    if action == "drag" {
        if let Some(w) = app.get_webview_window("companion") {
            w.start_dragging().map_err(native)?;
        }
        return Ok(());
    }
    let runtime = app.state::<DesktopRuntime>();
    let _guard = runtime.gate.lock().map_err(native)?;
    let mut db = app.state::<DatabasePath>().open()?;
    let current = db.companion_read()?;
    let mut next = current.clone();
    if let Some(w) = app.get_webview_window("companion") {
        if let Ok(p) = w.outer_position() {
            next.position = Some((p.x, p.y));
        }
    }
    match action {
        "quit" => {
            db.companion_save(&current, &mut next)?;
            app.exit(0);
            return Ok(());
        }
        "closeMain" => {
            db.companion_save(&current, &mut next)?;
            announce(app, next.clone());
            if next.close_to_tray {
                if let Some(w) = app.get_webview_window("main") {
                    w.hide().map_err(native)?;
                }
            } else {
                app.exit(0);
            }
            return Ok(());
        }
        "show" => next.visible = true,
        "hide" => next.visible = false,
        "toggle" => next.visible = !current.visible,
        "quickAdd" | "expand" => {
            next.visible = true;
            next.expanded = true;
        }
        "collapse" => next.expanded = false,
        "resetPosition" => {
            next.position = None;
            next.visible = true;
        }
        _ => return Err(native("Unknown desktop action.")),
    }
    if next.visible {
        let w = widget(app, &next)?;
        let (width, height) = dimensions(next.expanded);
        w.set_size(LogicalSize::new(width, height))
            .map_err(native)?;
        crate::passive_window::pin(&w, next.always_on_top)?;
        if action == "resetPosition" {
            if let Some(monitor) = w.primary_monitor().map_err(native)? {
                let area = monitor.work_area();
                w.set_position(PhysicalPosition::new(
                    area.position.x + 24,
                    area.position.y + 24,
                ))
                .map_err(native)?;
            }
        }
        clamp_window(&w)?;
        crate::passive_window::visibility(&w, true, action == "quickAdd" || action == "expand")?;
        let p = w.outer_position().map_err(native)?;
        next.position = Some((p.x, p.y));
    } else if let Some(w) = app.get_webview_window("companion") {
        crate::passive_window::visibility(&w, false, false)?;
    }
    db.companion_save(&current, &mut next)?;
    announce(app, next);
    if action == "quickAdd" {
        let _ = app.emit_to("companion", "companion-capture", ());
    }
    Ok(())
}
#[tauri::command]
pub async fn desktop_action(app: tauri::AppHandle, action: String) -> Result<(), StoreError> {
    self::action(&app, &action)
}
pub fn dispatch(app: &tauri::AppHandle, name: &str) {
    let app = app.clone();
    let name = name.to_string();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = action(&app, &name) {
            let _ = app.emit("desktop-error", error.message);
            // A failed storage write must not make the app impossible to quit.
            if name == "quit" {
                app.exit(0);
            }
        }
    });
}
pub fn setup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(DesktopRuntime::default());
    let open = MenuItem::with_id(app, "open", "Open FlowPlan", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quickAdd", "Quick Add", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Show / Hide Widget", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit FlowPlan", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &quick, &toggle, &separator, &quit])?;
    TrayIconBuilder::with_id("flowplan-tray")
        .icon(tauri::image::Image::from_bytes(include_bytes!(
            "../icons/32x32.png"
        ))?)
        .tooltip("FlowPlan · Close to tray, Quit to exit")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| dispatch(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                dispatch(tray.app_handle(), "open");
            }
        })
        .build(app)?;
    // Storage errors remain visible in the main UI; never silently reset the database.
    if let Ok(state) = app
        .state::<DatabasePath>()
        .open()
        .and_then(|db| db.companion_read())
    {
        if let Some(shortcut) = parse_shortcut(&state.shortcut)? {
            if let Err(error) = register(app, shortcut) {
                *app.state::<DesktopRuntime>()
                    .shortcut_error
                    .lock()
                    .map_err(native)? = Some(error.message);
            }
        }
        if state.visible {
            dispatch(app, "show");
        }
    }
    Ok(())
}
