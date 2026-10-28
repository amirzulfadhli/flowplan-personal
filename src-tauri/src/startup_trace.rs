//! Explicit local diagnostic opt-in. Records only milestone names and times, never workspace data.
use std::{io::Write, sync::OnceLock, time::Instant};

static START: OnceLock<Instant> = OnceLock::new();

pub fn mark(name: &str) {
    let start = START.get_or_init(Instant::now);
    let Some(path) = std::env::var_os("FLOWPLAN_STARTUP_TRACE") else {
        return;
    };
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(file, "{}\t{}", start.elapsed().as_micros(), name);
    }
}
