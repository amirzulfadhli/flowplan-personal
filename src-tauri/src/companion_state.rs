use crate::database::{Database, StoreError};
use rusqlite::{OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

pub const MINUTE: i64 = 60_000;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Companion {
    pub revision: u64,
    pub project_id: Option<String>,
    pub task_id: Option<String>,
    pub always_on_top: bool,
    pub close_to_tray: bool,
    pub shortcut: String,
    pub visible: bool,
    pub expanded: bool,
    pub position: Option<(i32, i32)>,
    pub duration_minutes: u32,
    pub remaining_ms: i64,
    pub ends_at: Option<i64>,
}
impl Default for Companion {
    fn default() -> Self {
        Self {
            revision: 0,
            project_id: None,
            task_id: None,
            always_on_top: false,
            close_to_tray: true,
            shortcut: "Control+Shift+Space".into(),
            visible: false,
            expanded: false,
            position: None,
            duration_minutes: 25,
            remaining_ms: 25 * MINUTE,
            ends_at: None,
        }
    }
}
impl Companion {
    pub fn remaining(&self, now: i64) -> i64 {
        self.ends_at
            .map_or(self.remaining_ms, |end| (end - now).max(0))
    }
    pub fn validate(&self) -> Result<(), StoreError> {
        if !(1..=180).contains(&self.duration_minutes)
            || self.remaining_ms < 0
            || self.remaining_ms > 180 * MINUTE
            || self.shortcut.len() > 100
            || self.revision >= 9_007_199_254_740_991
            || self
                .ends_at
                .is_some_and(|n| !(0..9_007_199_254_740_991).contains(&n))
        {
            return Err(StoreError::new(
                "VALIDATION",
                "Invalid companion settings or timer.",
            ));
        }
        Ok(())
    }
    pub fn timer(
        &mut self,
        action: &str,
        minutes: Option<u32>,
        now: i64,
    ) -> Result<(), StoreError> {
        match action {
            "start" => {
                if self.ends_at.is_none() || self.remaining(now) == 0 {
                    let remaining = self.remaining(now);
                    self.ends_at = Some(
                        now + if remaining == 0 {
                            self.duration_minutes as i64 * MINUTE
                        } else {
                            remaining
                        },
                    );
                }
            }
            "pause" => {
                self.remaining_ms = self.remaining(now);
                self.ends_at = None;
            }
            "reset" => {
                self.remaining_ms = self.duration_minutes as i64 * MINUTE;
                self.ends_at = None;
            }
            "duration" => {
                let minutes = minutes
                    .filter(|m| (1..=180).contains(m))
                    .ok_or_else(|| StoreError::new("VALIDATION", "Choose 1 to 180 minutes."))?;
                if self.ends_at.is_some() && self.remaining(now) > 0 {
                    return Err(StoreError::new(
                        "VALIDATION",
                        "Pause the timer before changing its duration.",
                    ));
                }
                self.duration_minutes = minutes;
                self.remaining_ms = minutes as i64 * MINUTE;
                self.ends_at = None;
            }
            _ => return Err(StoreError::new("VALIDATION", "Unknown timer action.")),
        }
        self.validate()
    }
}
impl Database {
    pub fn companion_read(&self) -> Result<Companion, StoreError> {
        let json: Option<String> = self
            .connection
            .query_row(
                "SELECT payload FROM desktop_companion WHERE singleton = 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        let state = json
            .map(|s| serde_json::from_str::<Companion>(&s))
            .transpose()?
            .unwrap_or_default();
        state.validate()?;
        Ok(state)
    }
    pub fn companion_save(
        &mut self,
        current: &Companion,
        next: &mut Companion,
    ) -> Result<(), StoreError> {
        next.revision = current.revision + 1;
        next.validate()?;
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let json: Option<String> = tx
            .query_row(
                "SELECT payload FROM desktop_companion WHERE singleton = 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        let saved = json
            .map(|s| serde_json::from_str::<Companion>(&s))
            .transpose()?
            .unwrap_or_default();
        if saved.revision != current.revision {
            return Err(StoreError::new(
                "CONFLICT",
                "Companion settings changed. Retry your action.",
            ));
        }
        tx.execute("INSERT INTO desktop_companion VALUES (1, ?1) ON CONFLICT(singleton) DO UPDATE SET payload = excluded.payload", [serde_json::to_string(next)?])?;
        tx.commit()?;
        Ok(())
    }
}

/// Physical work-area coordinates exclude the taskbar, including negative-origin monitors.
pub fn clamp_position(
    position: (i32, i32),
    size: (u32, u32),
    area: (i32, i32, u32, u32),
) -> (i32, i32) {
    let (x, y, w, h) = area;
    let max_x = x.saturating_add(w.saturating_sub(size.0) as i32);
    let max_y = y.saturating_add(h.saturating_sub(size.1) as i32);
    (position.0.clamp(x, max_x), position.1.clamp(y, max_y))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn timer_pause_resume_sleep_and_restart() {
        let mut s = Companion::default();
        s.timer("start", None, 1000).unwrap();
        assert_eq!(s.remaining(61_000), 24 * MINUTE);
        s.timer("pause", None, 61_000).unwrap();
        assert_eq!(s.remaining(999_000), 24 * MINUTE);
        s.timer("start", None, 1_000_000).unwrap();
        let restarted: Companion =
            serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        assert_eq!(restarted.remaining(1_060_000), 23 * MINUTE);
        assert_eq!(restarted.remaining(9_000_000), 0);
        s.timer("reset", None, 9_000_000).unwrap();
        assert_eq!(s.remaining(9_000_000), 25 * MINUTE);
    }
    #[test]
    fn timer_validates_duration_and_repeated_start_is_idempotent() {
        let mut s = Companion::default();
        assert!(s.timer("duration", Some(0), 0).is_err());
        s.timer("duration", Some(5), 0).unwrap();
        s.timer("start", None, 0).unwrap();
        s.timer("start", None, 1000).unwrap();
        assert_eq!(s.ends_at, Some(5 * MINUTE));
        assert!(s.timer("duration", Some(10), 1000).is_err());
        s.timer("pause", None, 10 * MINUTE).unwrap();
        assert_eq!(s.remaining_ms, 0);
    }
    #[test]
    fn companion_persists_separately_and_rejects_stale_write() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite3");
        let mut db = Database::open(&path).unwrap();
        let original = db.companion_read().unwrap();
        let mut next = original.clone();
        next.timer("start", None, 1000).unwrap();
        db.companion_save(&original, &mut next).unwrap();
        assert!(db.companion_save(&original, &mut original.clone()).is_err());
        drop(db);
        let mut reopened = Database::open(&path).unwrap();
        assert_eq!(reopened.companion_read().unwrap(), next);
        assert_eq!(reopened.read().unwrap().revision, 0);
    }
    #[test]
    fn clamps_to_work_area_including_negative_monitor_and_large_window() {
        assert_eq!(
            clamp_position((1900, 1050), (360, 480), (0, 0, 1920, 1040)),
            (1560, 560)
        );
        assert_eq!(
            clamp_position((-2000, -50), (288, 58), (-1920, 0, 1920, 1040)),
            (-1920, 0)
        );
        assert_eq!(
            clamp_position((500, 500), (360, 480), (0, 0, 300, 400)),
            (0, 0)
        );
    }
}
