CREATE TABLE recovery_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source_revision INTEGER NOT NULL,
  workspace_json TEXT NOT NULL CHECK(json_valid(workspace_json))
);
