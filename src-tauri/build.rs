fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "read_workspace",
            "commit_workspace",
            "export_backup",
            "storage_info",
            "list_recovery",
            "read_recovery",
        ]),
    ))
    .expect("Failed to prepare Tauri desktop resources");
}
