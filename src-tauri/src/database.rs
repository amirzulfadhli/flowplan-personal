use crate::model::Workspace;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};

const APPLICATION_ID: i64 = 0x46504C4E;
pub const DATABASE_VERSION: i64 = 2;
const MIGRATIONS: &[(i64, &str, &str)] = &[
    (
        1,
        "workspace",
        include_str!("../migrations/001_workspace.sql"),
    ),
    (
        2,
        "recovery",
        include_str!("../migrations/002_recovery.sql"),
    ),
];

#[derive(Debug, Clone, Serialize)]
pub struct StoreError {
    pub code: String,
    pub message: String,
}
impl StoreError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}
impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
impl std::error::Error for StoreError {}
impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        Self::new(
            "DATABASE",
            format!("SQLite could not complete the operation: {e}. Your workspace was not reset."),
        )
    }
}
impl From<serde_json::Error> for StoreError {
    fn from(e: serde_json::Error) -> Self {
        Self::new("VALIDATION", format!("Invalid workspace data: {e}"))
    }
}
impl From<std::io::Error> for StoreError {
    fn from(e: std::io::Error) -> Self {
        Self::new("FILESYSTEM", format!("Could not access local data: {e}"))
    }
}
type Result<T> = std::result::Result<T, StoreError>;

pub struct Database {
    pub connection: Connection,
    pub path: PathBuf,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recovery {
    pub id: i64,
    pub created_at: String,
    pub source_revision: i64,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut connection = Connection::open(path)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        migrate(&mut connection)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "FULL")?;
        Ok(Self {
            connection,
            path: path.into(),
        })
    }
    pub fn read(&mut self) -> Result<Workspace> {
        let tx = self.connection.transaction()?;
        let workspace = read_workspace(&tx)?;
        tx.commit()?;
        Ok(workspace)
    }
    pub fn commit(
        &mut self,
        expected_revision: u64,
        next: &Workspace,
        replacement: bool,
    ) -> Result<Workspace> {
        next.validate()
            .map_err(|e| StoreError::new("VALIDATION", e))?;
        if expected_revision.checked_add(1) != Some(next.revision) {
            return Err(StoreError::new(
                "VALIDATION",
                "The new revision must follow the saved revision.",
            ));
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current = read_workspace(&tx)?;
        if current.revision != expected_revision {
            return Err(StoreError::new(
                "CONFLICT",
                "The workspace changed. Review the latest data before retrying.",
            ));
        }
        // The recovery snapshot and replacement succeed or roll back together.
        if replacement {
            tx.execute(
                "INSERT INTO recovery_snapshots(source_revision, workspace_json) VALUES (?1, ?2)",
                params![current.revision as i64, serde_json::to_string(&current)?],
            )?;
        }
        tx.execute("DELETE FROM tasks", [])?;
        tx.execute("DELETE FROM activity", [])?;
        tx.execute("DELETE FROM projects", [])?;
        for (position, project) in next.projects.iter().enumerate() {
            tx.execute(
                "INSERT INTO projects(id, position, payload) VALUES (?1, ?2, ?3)",
                params![project.id, position as i64, serde_json::to_string(project)?],
            )?;
        }
        for (position, task) in next.tasks.iter().enumerate() {
            tx.execute(
                "INSERT INTO tasks(id, project_id, position, payload) VALUES (?1, ?2, ?3, ?4)",
                params![
                    task.id,
                    task.project_id,
                    position as i64,
                    serde_json::to_string(task)?
                ],
            )?;
        }
        for (position, activity) in next.activity.iter().enumerate() {
            tx.execute(
                "INSERT INTO activity(id, project_id, position, payload) VALUES (?1, ?2, ?3, ?4)",
                params![
                    activity.id,
                    activity.project_id,
                    position as i64,
                    serde_json::to_string(activity)?
                ],
            )?;
        }
        tx.execute(
            "UPDATE workspace_meta SET revision = ?1, profile_json = ?2 WHERE singleton = 1",
            params![next.revision as i64, serde_json::to_string(&next.profile)?],
        )?;
        tx.commit()?;
        Ok(next.clone())
    }
    pub fn recovery_list(&self) -> Result<Vec<Recovery>> {
        let mut query = self.connection.prepare(
            "SELECT id, created_at, source_revision FROM recovery_snapshots ORDER BY id DESC",
        )?;
        let rows = query.query_map([], |r| {
            Ok(Recovery {
                id: r.get(0)?,
                created_at: r.get(1)?,
                source_revision: r.get(2)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }
    pub fn recovery_read(&self, id: i64) -> Result<Workspace> {
        let json: String = self.connection.query_row(
            "SELECT workspace_json FROM recovery_snapshots WHERE id = ?1",
            [id],
            |row| row.get(0),
        )?;
        let data: Workspace = serde_json::from_str(&json)?;
        data.validate()
            .map_err(|e| StoreError::new("VALIDATION", e))?;
        Ok(data)
    }
}

fn read_workspace(connection: &Connection) -> Result<Workspace> {
    let (version, revision, profile): (u32, i64, String) = connection.query_row(
        "SELECT schema_version, revision, profile_json FROM workspace_meta WHERE singleton = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;
    fn rows<T: serde::de::DeserializeOwned>(connection: &Connection, sql: &str) -> Result<Vec<T>> {
        let mut statement = connection.prepare(sql)?;
        let jsons = statement.query_map([], |r| r.get::<_, String>(0))?;
        jsons.map(|r| Ok(serde_json::from_str(&r?)?)).collect()
    }
    let data = Workspace {
        schema_version: version,
        revision: revision
            .try_into()
            .map_err(|_| StoreError::new("VALIDATION", "Negative stored revision"))?,
        profile: serde_json::from_str(&profile)?,
        projects: rows(connection, "SELECT payload FROM projects ORDER BY position")?,
        tasks: rows(connection, "SELECT payload FROM tasks ORDER BY position")?,
        activity: rows(connection, "SELECT payload FROM activity ORDER BY position")?,
    };
    data.validate()
        .map_err(|e| StoreError::new("VALIDATION", e))?;
    Ok(data)
}

pub fn migrate(connection: &mut Connection) -> Result<()> {
    let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let version: i64 = tx.pragma_query_value(None, "user_version", |r| r.get(0))?;
    let app_id: i64 = tx.pragma_query_value(None, "application_id", |r| r.get(0))?;
    if version > DATABASE_VERSION || (app_id != 0 && app_id != APPLICATION_ID) {
        return Err(StoreError::new("SCHEMA", "This database belongs to another application or a newer FlowPlan version. It has not been changed."));
    }
    if version == 0 {
        let count: i64 = tx.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            [],
            |r| r.get(0),
        )?;
        if count != 0 {
            return Err(StoreError::new(
                "SCHEMA",
                "An unrecognized database already exists. It has not been changed.",
            ));
        }
        tx.pragma_update(None, "application_id", APPLICATION_ID)?;
    } else if app_id != APPLICATION_ID {
        return Err(StoreError::new(
            "SCHEMA",
            "Missing FlowPlan database identity. It has not been changed.",
        ));
    }
    for &(number, name, sql) in MIGRATIONS {
        if number <= version {
            let recorded: Option<String> = tx
                .query_row(
                    "SELECT name FROM schema_migrations WHERE version = ?1",
                    [number],
                    |r| r.get(0),
                )
                .optional()?;
            if recorded.as_deref() != Some(name) {
                return Err(StoreError::new(
                    "SCHEMA",
                    "Migration history does not match this application.",
                ));
            }
        } else {
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO schema_migrations VALUES (?1, ?2)",
                params![number, name],
            )?;
            tx.pragma_update(None, "user_version", number)?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Write beside the destination, flush, then atomically replace it. A failed write leaves the old file intact.
pub fn export_json(path: &Path, workspace: &Workspace) -> Result<()> {
    workspace
        .validate()
        .map_err(|e| StoreError::new("VALIDATION", e))?;
    if !path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("json"))
    {
        return Err(StoreError::new(
            "VALIDATION",
            "Choose a .json backup filename.",
        ));
    }
    let parent = path
        .parent()
        .ok_or_else(|| StoreError::new("FILESYSTEM", "Choose a backup folder."))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    // Compact JSON remains inside the same 20 MB limit accepted by browser and desktop imports.
    temporary.write_all(&serde_json::to_vec(workspace)?)?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(path)
        .map_err(|e| StoreError::from(e.error))?;
    Ok(())
}
