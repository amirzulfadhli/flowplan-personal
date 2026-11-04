use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_BACKUP_BYTES: usize = 20 * 1024 * 1024;
const MAX_JS_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    pub schema_version: u32,
    pub revision: u64,
    pub profile: Profile,
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub activity: Vec<Activity>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Profile {
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub due: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub due: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Activity {
    pub id: String,
    pub project_id: String,
    pub message: String,
    pub time: String,
}

impl Default for Workspace {
    fn default() -> Self {
        Self {
            schema_version: 1,
            revision: 0,
            profile: Profile {
                name: "My workspace".into(),
            },
            projects: vec![],
            tasks: vec![],
            activity: vec![],
        }
    }
}
fn bounded(value: &str, max: usize) -> bool {
    value.encode_utf16().count() <= max
}
fn name(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && bounded(value, max)
}
fn id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn date(value: &str) -> bool {
    value.is_empty()
        || (value.len() == 10
            && NaiveDate::parse_from_str(value, "%Y-%m-%d")
                .is_ok_and(|d| d.format("%Y-%m-%d").to_string() == value))
}
fn instant(value: &str) -> bool {
    // Match the browser's UTC ISO schema, including casing and rejecting leap seconds.
    let Some((day, time)) = value.strip_suffix('Z').and_then(|v| v.split_once('T')) else {
        return false;
    };
    let (clock, fraction) = time
        .split_once('.')
        .map_or((time, None), |(c, f)| (c, Some(f)));
    let parts: Vec<_> = clock.split(':').collect();
    day.len() == 10
        && date(day)
        && parts.len() == 3
        && parts
            .iter()
            .all(|p| p.len() == 2 && p.bytes().all(|b| b.is_ascii_digit()))
        && parts[0].parse::<u8>().is_ok_and(|n| n < 24)
        && parts[1].parse::<u8>().is_ok_and(|n| n < 60)
        && parts[2].parse::<u8>().is_ok_and(|n| n < 60)
        && fraction.is_none_or(|f| !f.is_empty() && f.bytes().all(|b| b.is_ascii_digit()))
}
impl Workspace {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1
            || self.revision > MAX_JS_INTEGER
            || !name(&self.profile.name, 60)
        {
            return Err("Unsupported or invalid workspace metadata".into());
        }
        if self.projects.len() > 2000 || self.tasks.len() > 50000 || self.activity.len() > 100000 {
            return Err("Workspace exceeds supported record limits".into());
        }
        let mut project_ids = HashSet::new();
        for p in &self.projects {
            if !id(&p.id)
                || !project_ids.insert(p.id.as_str())
                || !name(&p.name, 80)
                || !bounded(&p.description, 500)
                || !bounded(&p.notes, 20000)
                || !date(&p.due)
                || !instant(&p.created_at)
                || !instant(&p.updated_at)
                || p.color.len() != 7
                || !p.color.starts_with('#')
                || !p.color[1..].bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err("Invalid or duplicate project".into());
            }
        }
        let mut task_ids = HashSet::new();
        for t in &self.tasks {
            if !id(&t.id)
                || !task_ids.insert(t.id.as_str())
                || !project_ids.contains(t.project_id.as_str())
                || !name(&t.title, 160)
                || !bounded(&t.description, 5000)
                || !date(&t.due)
                || !instant(&t.created_at)
                || !instant(&t.updated_at)
                || !["todo", "doing", "review", "done"].contains(&t.status.as_str())
                || !["Low", "Medium", "High"].contains(&t.priority.as_str())
                || (t.status == "done") != t.completed_at.is_some()
                || t.completed_at.as_ref().is_some_and(|d| !instant(d))
            {
                return Err("Invalid, duplicate, or orphaned task".into());
            }
        }
        let mut activity_ids = HashSet::new();
        for a in &self.activity {
            if !id(&a.id)
                || !activity_ids.insert(a.id.as_str())
                || !project_ids.contains(a.project_id.as_str())
                || !bounded(&a.message, 500)
                || !instant(&a.time)
            {
                return Err("Invalid, duplicate, or orphaned activity".into());
            }
        }
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > MAX_BACKUP_BYTES {
            return Err("Workspace exceeds the 20 MB backup limit".into());
        }
        Ok(())
    }
}
