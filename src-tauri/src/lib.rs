mod ai;
mod companion;
pub mod companion_state;
pub mod database;
#[cfg(test)]
mod database_tests;
pub mod model;

use database::{Database, Recovery, StoreError};
use model::Workspace;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

pub struct DatabasePath(PathBuf);
impl DatabasePath {
    fn open(&self) -> Result<Database, StoreError> {
        Database::open(&self.0)
    }
}

#[tauri::command]
async fn read_workspace(state: State<'_, DatabasePath>) -> Result<Workspace, StoreError> {
    state.open()?.read()
}
#[tauri::command]
async fn commit_workspace(
    app: tauri::AppHandle,
    state: State<'_, DatabasePath>,
    expected_revision: u64,
    workspace: Workspace,
    replacement: bool,
) -> Result<Workspace, StoreError> {
    let saved = state
        .open()?
        .commit(expected_revision, &workspace, replacement)?;
    let _ = app.emit("workspace-changed", saved.revision);
    Ok(saved)
}
#[tauri::command]
async fn list_recovery(state: State<'_, DatabasePath>) -> Result<Vec<Recovery>, StoreError> {
    state.open()?.recovery_list()
}
#[tauri::command]
async fn read_recovery(state: State<'_, DatabasePath>, id: i64) -> Result<Workspace, StoreError> {
    state.open()?.recovery_read(id)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageInfo {
    path: String,
    database_version: i64,
}
#[tauri::command]
async fn storage_info(state: State<'_, DatabasePath>) -> Result<StorageInfo, StoreError> {
    let db = state.open()?;
    Ok(StorageInfo {
        path: db.path.display().to_string(),
        database_version: database::DATABASE_VERSION,
    })
}
#[tauri::command]
async fn export_backup(
    app: tauri::AppHandle,
    window: tauri::Window,
    state: State<'_, DatabasePath>,
) -> Result<Option<String>, StoreError> {
    let workspace = state.open()?.read()?;
    let filename = format!(
        "flowplan-backup-{}.json",
        chrono::Local::now().format("%Y-%m-%d")
    );
    let Some(selected) = app
        .dialog()
        .file()
        .set_parent(&window)
        .add_filter("FlowPlan JSON backup", &["json"])
        .set_file_name(filename)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|e| StoreError::new("FILESYSTEM", e.to_string()))?;
    database::export_json(&path, &workspace)?;
    Ok(Some(path.display().to_string()))
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    #[cfg(not(feature = "desktop-test"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
        let _ = companion::show_main(app);
    }));
    builder
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            #[cfg(feature = "desktop-test")]
            let directory = std::env::var_os("FLOWPLAN_TEST_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or(directory);
            app.manage(DatabasePath(directory.join("flowplan.sqlite3")));
            app.manage(ai::AiRuntime::default());
            companion::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                companion::dispatch(
                    window.app_handle(),
                    if window.label() == "companion" {
                        "hide"
                    } else {
                        "closeMain"
                    },
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_workspace,
            commit_workspace,
            export_backup,
            storage_info,
            list_recovery,
            read_recovery,
            companion::companion_read,
            companion::companion_update,
            companion::desktop_action,
            ai::ai_begin,
            ai::ai_cancel,
            ai::ai_request
        ])
        .run(tauri::generate_context!())
        .expect("FlowPlan could not start its desktop window");
}
