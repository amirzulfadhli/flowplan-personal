//! Explicit local diagnostic opt-in. Records only milestone names and times, never workspace data.
use std::{
    io::Write,
    path::Path,
    sync::{Mutex, OnceLock},
    time::Instant,
};

static START: OnceLock<Instant> = OnceLock::new();
static WRITER: Mutex<()> = Mutex::new(());

pub fn mark(name: &str) {
    let start = START.get_or_init(Instant::now);
    let Some(path) = std::env::var_os("FLOWPLAN_STARTUP_TRACE") else {
        return;
    };
    append_mark(Path::new(&path), name, start);
}

fn append_mark(path: &Path, name: &str, start: &Instant) {
    // IPC commands may run concurrently. Keep complete records together so
    // diagnostic output cannot splice timestamps and names across threads.
    let Ok(_guard) = WRITER.lock() else { return };
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(file, "{}\t{}", start.elapsed().as_micros(), name);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concurrent_marks_remain_complete_records() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("startup.tsv");
        let start = Instant::now();
        std::thread::scope(|scope| {
            for _ in 0..16 {
                let path = &path;
                let start = &start;
                scope.spawn(move || {
                    for _ in 0..20 {
                        append_mark(path, "database_open_begin", start);
                    }
                });
            }
        });
        let output = std::fs::read_to_string(path).unwrap();
        assert_eq!(output.lines().count(), 320);
        for line in output.lines() {
            let (elapsed, name) = line.split_once('\t').unwrap();
            assert!(elapsed.parse::<u128>().is_ok());
            assert_eq!(name, "database_open_begin");
        }
    }
}
