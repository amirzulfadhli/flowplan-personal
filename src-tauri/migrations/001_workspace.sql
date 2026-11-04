CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE workspace_meta (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  schema_version INTEGER NOT NULL CHECK(schema_version = 1),
  revision INTEGER NOT NULL CHECK(revision >= 0),
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json))
);
INSERT INTO workspace_meta VALUES(1, 1, 0, '{"name":"My workspace"}');
CREATE TABLE projects (
  id TEXT PRIMARY KEY, position INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE INDEX tasks_project ON tasks(project_id);
CREATE TABLE activity (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE INDEX activity_project ON activity(project_id);
