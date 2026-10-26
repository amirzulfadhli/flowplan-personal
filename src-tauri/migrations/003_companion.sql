-- Device preferences and timer are separate from portable workspace JSON backups.
CREATE TABLE desktop_companion (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
