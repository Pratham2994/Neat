//! Watches Downloads while Neat runs, including when the window is closed to the tray.
//!
//! After a change it waits for things to go quiet, then scans: rules move what they cover and the
//! UI gets the new inbox. A second scan after the settle time picks up downloads that were still
//! being written the first time.

use neat_core::Neat;
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Wait for a burst of changes (a browser renaming .crdownload, an unzip) to finish.
const QUIET: Duration = Duration::from_secs(3);
/// The core leaves files alone for two minutes after they change; look again once that has passed.
const SETTLE: Duration = Duration::from_secs(150);
/// A safety net for changes the file system did not report.
const PERIODIC: Duration = Duration::from_secs(15 * 60);

pub const INBOX_CHANGED: &str = "inbox-changed";

pub fn start(app: AppHandle, root: &Path, neat: Arc<Mutex<Neat>>) -> notify::Result<RecommendedWatcher> {
    let (tx, rx) = channel();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if let Ok(event) = event {
            if !matches!(event.kind, EventKind::Access(_)) {
                let _ = tx.send(());
            }
        }
    })?;
    watcher.watch(root, RecursiveMode::NonRecursive)?;

    std::thread::spawn(move || {
        let mut quiet_until: Option<Instant> = None;
        let mut settle_at: Option<Instant> = None;
        loop {
            let next = [quiet_until, settle_at].into_iter().flatten().min();
            let wait = next.map_or(PERIODIC, |t| t.saturating_duration_since(Instant::now()));
            match rx.recv_timeout(wait) {
                Ok(()) => {
                    let now = Instant::now();
                    quiet_until = Some(now + QUIET);
                    settle_at = Some(now + SETTLE);
                }
                Err(RecvTimeoutError::Timeout) => {
                    let now = Instant::now();
                    if quiet_until.is_some_and(|t| t <= now) {
                        quiet_until = None;
                    } else if settle_at.is_some_and(|t| t <= now) {
                        settle_at = None;
                    } else if next.is_some() {
                        continue;
                    }
                    rescan(&app, &neat);
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    Ok(watcher)
}

pub fn rescan(app: &AppHandle, neat: &Mutex<Neat>) {
    let inbox = match neat.lock() {
        Ok(mut neat) => neat.scan(),
        Err(_) => return,
    };
    if let Ok(inbox) = inbox {
        let _ = app.emit(INBOX_CHANGED, &inbox);
    }
}
