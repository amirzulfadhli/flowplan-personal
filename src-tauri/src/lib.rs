pub mod database;
#[cfg(test)]
mod database_tests;
pub mod model;

use database::{Database, Recovery, StoreError};
use model::Workspace;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{Manager, State};
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
    state: State<'_, DatabasePath>,
    expected_revision: u64,
    workspace: Workspace,
    replacement: bool,
) -> Result<Workspace, StoreError> {
    state
        .open()?
        .commit(expected_revision, &workspace, replacement)
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
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    #[cfg(not(feature = "desktop-test"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));
    builder
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            #[cfg(feature = "desktop-test")]
            let directory = std::env::var_os("FLOWPLAN_TEST_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or(directory);
            app.manage(DatabasePath(directory.join("flowplan.sqlite3")));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_workspace,
            commit_workspace,
            export_backup,
            storage_info,
            list_recovery,
            read_recovery
        ])
        .run(tauri::generate_context!())
        .expect("FlowPlan could not start its desktop window");
}
