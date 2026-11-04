use crate::{
    database::{export_json, Database, DATABASE_VERSION},
    model::{Activity, Project, Task, Workspace},
};
use rusqlite::Connection;
use std::fs;

fn fixture() -> Workspace {
    let now = "2026-01-02T12:00:00.000Z".to_string();
    Workspace {
        revision: 1,
        projects: vec![Project {
            id: "p1".into(),
            name: "A project".into(),
            description: "Preserve details".into(),
            color: "#7d87ec".into(),
            due: "2026-02-28".into(),
            notes: "Keep these notes".into(),
            created_at: now.clone(),
            updated_at: now.clone(),
        }],
        tasks: vec![Task {
            id: "t1".into(),
            project_id: "p1".into(),
            title: "A task".into(),
            description: "Done".into(),
            status: "done".into(),
            priority: "High".into(),
            due: "2026-01-02".into(),
            created_at: now.clone(),
            updated_at: now.clone(),
            completed_at: Some(now.clone()),
        }],
        activity: vec![Activity {
            id: "a1".into(),
            project_id: "p1".into(),
            message: "Completed task".into(),
            time: now,
        }],
        ..Workspace::default()
    }
}
#[test]
fn creates_migrates_and_reopens_without_losing_data() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.sqlite3");
    {
        let mut db = Database::open(&path).unwrap();
        assert_eq!(db.read().unwrap(), Workspace::default());
        db.commit(0, &fixture(), false).unwrap();
    }
    let mut reopened = Database::open(&path).unwrap();
    assert_eq!(reopened.read().unwrap(), fixture());
    assert_eq!(
        reopened
            .connection
            .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        DATABASE_VERSION
    );
    assert_eq!(
        reopened
            .connection
            .query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "ok"
    );
}
#[test]
fn migrates_v1_to_latest_preserving_existing_rows() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("old.sqlite3");
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(include_str!("../migrations/001_workspace.sql"))
            .unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES(1, 'workspace')", [])
            .unwrap();
        conn.pragma_update(None, "application_id", 0x46504C4E_i64)
            .unwrap();
        conn.pragma_update(None, "user_version", 1).unwrap();
        conn.execute(
            "UPDATE workspace_meta SET revision = 7, profile_json = '{\"name\":\"Existing user\"}'",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects VALUES (?1, 0, ?2)",
            rusqlite::params!["p1", serde_json::to_string(&fixture().projects[0]).unwrap()],
        )
        .unwrap();
    }
    let mut db = Database::open(&path).unwrap();
    assert_eq!(db.read().unwrap().profile.name, "Existing user");
    assert_eq!(db.read().unwrap().revision, 7);
    assert_eq!(db.read().unwrap().projects, fixture().projects);
    assert!(db.recovery_list().unwrap().is_empty());
}

#[test]
fn phase_two_upgrade_keeps_workspace_and_recovery() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("phase2.sqlite3");
    let mut db = Database::open(&path).unwrap();
    db.commit(0, &fixture(), true).unwrap();
    db.connection.execute_batch("DROP TABLE desktop_companion; DELETE FROM schema_migrations WHERE version = 3; PRAGMA user_version = 2;").unwrap();
    drop(db);
    let mut reopened = Database::open(&path).unwrap();
    assert_eq!(reopened.read().unwrap(), fixture());
    assert_eq!(reopened.recovery_list().unwrap().len(), 1);
    assert_eq!(
        reopened.companion_read().unwrap(),
        crate::companion_state::Companion::default()
    );
}
#[test]
fn refuses_unknown_future_database_without_resetting_it() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("future.sqlite3");
    let db = Database::open(&path).unwrap();
    db.connection
        .pragma_update(None, "user_version", 999)
        .unwrap();
    drop(db);
    assert!(Database::open(&path).is_err());
    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        999
    );
}
#[test]
fn rejects_unrecognized_and_corrupt_databases() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("foreign.sqlite3");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TABLE other(data TEXT); INSERT INTO other VALUES('keep')")
        .unwrap();
    drop(conn);
    assert!(Database::open(&path).is_err());
    let corrupt = dir.path().join("corrupt.sqlite3");
    fs::write(&corrupt, "not a database").unwrap();
    assert!(Database::open(&corrupt).is_err());
    assert_eq!(fs::read_to_string(corrupt).unwrap(), "not a database");
}
#[test]
fn rejects_stale_writes_from_a_second_connection() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.sqlite3");
    let mut first = Database::open(&path).unwrap();
    let mut second = Database::open(&path).unwrap();
    first.commit(0, &fixture(), false).unwrap();
    let error = second.commit(0, &fixture(), false).unwrap_err();
    assert_eq!(error.code, "CONFLICT");
    assert_eq!(second.read().unwrap(), fixture());
}
#[test]
fn replacement_has_a_transactional_recovery_copy() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("data.sqlite3")).unwrap();
    db.commit(0, &fixture(), false).unwrap();
    let replacement = Workspace {
        revision: 2,
        ..Workspace::default()
    };
    db.commit(1, &replacement, true).unwrap();
    assert_eq!(db.read().unwrap(), replacement);
    let copies = db.recovery_list().unwrap();
    assert_eq!(copies.len(), 1);
    let mut recovered = db.recovery_read(copies[0].id).unwrap();
    assert_eq!(recovered, fixture());
    recovered.revision = 3;
    db.commit(2, &recovered, true).unwrap();
    assert_eq!(db.read().unwrap(), recovered);
    assert_eq!(db.recovery_list().unwrap().len(), 2);
}
#[test]
fn mid_transaction_failure_rolls_back_rows_revision_and_recovery_copy() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("data.sqlite3")).unwrap();
    db.commit(0, &fixture(), false).unwrap();
    db.connection.execute_batch("CREATE TRIGGER fail_insert BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT, 'simulated disk/write failure'); END;").unwrap();
    let mut next = fixture();
    next.revision = 2;
    next.projects[0].notes = "Must not survive failure".into();
    assert!(db.commit(1, &next, true).is_err());
    assert_eq!(db.read().unwrap(), fixture());
    assert!(db.recovery_list().unwrap().is_empty());
}
#[test]
fn invalid_import_cannot_modify_existing_data() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("data.sqlite3")).unwrap();
    db.commit(0, &fixture(), false).unwrap();
    let mut invalid = fixture();
    invalid.revision = 2;
    invalid.tasks[0].project_id = "missing".into();
    assert!(db.commit(1, &invalid, true).is_err());
    assert_eq!(db.read().unwrap(), fixture());
    invalid = fixture();
    invalid.revision = 2;
    invalid.tasks[0].completed_at = None;
    assert!(db.commit(1, &invalid, true).is_err());
    invalid = fixture();
    invalid.revision = 2;
    invalid.projects[0].due = "2026-02-30".into();
    assert!(db.commit(1, &invalid, true).is_err());
    invalid = fixture();
    invalid.revision = 2;
    invalid.projects.push(invalid.projects[0].clone());
    assert!(db.commit(1, &invalid, true).is_err());
}
#[test]
fn backup_round_trip_preserves_every_field_and_rejects_non_json_target() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("backup.json");
    fs::write(&path, "previous backup").unwrap();
    export_json(&path, &fixture()).unwrap();
    let restored: Workspace = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
    assert_eq!(restored, fixture());
    let database = dir.path().join("data.sqlite3");
    fs::write(&database, "keep database").unwrap();
    assert!(export_json(&database, &fixture()).is_err());
    assert_eq!(fs::read_to_string(database).unwrap(), "keep database");
}
#[test]
fn failed_export_keeps_previous_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("backup.json");
    fs::write(&path, "keep backup").unwrap();
    let mut invalid = fixture();
    invalid.schema_version = 999;
    assert!(export_json(&path, &invalid).is_err());
    assert_eq!(fs::read_to_string(path).unwrap(), "keep backup");
}

#[test]
fn native_timestamps_remain_readable_by_the_browser_schema() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("data.sqlite3")).unwrap();
    db.commit(0, &fixture(), false).unwrap();
    for invalid in [
        "2026-01-02t12:00:00Z",
        "2026-01-02T12:00:60Z",
        "2026-01-02T12:00Z",
        "2026-01-02T12:00:00+00:00",
        "2026-02-30T12:00:00Z",
    ] {
        let mut next = fixture();
        next.revision = 2;
        next.projects[0].created_at = invalid.into();
        assert!(db.commit(1, &next, true).is_err(), "{invalid}");
    }
    assert_eq!(db.read().unwrap(), fixture());
    assert!(db.recovery_list().unwrap().is_empty());
}
