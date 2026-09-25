//! Updates from GitHub Releases.
//!
//! Only builds made by the release workflow carry the public key that verifies updates (it adds
//! `plugins.updater.pubkey` to the config), so a local or test build never replaces itself. A new
//! version downloads in the background; it installs when the user presses "Restart to update".

use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Neat runs in the tray for days, so it looks again now and then, not only at start.
const FIRST_CHECK: Duration = Duration::from_secs(30);
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

pub const UPDATE_READY: &str = "update-ready";

pub fn enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    let updater = app.config().plugins.0.get("updater");
    updater.and_then(|u| u.get("pubkey")).and_then(|k| k.as_str()).is_some_and(|k| !k.trim().is_empty())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
}

/// A downloaded update waiting for the user.
#[derive(Default)]
pub struct Pending(Mutex<Option<(Update, Vec<u8>)>>);

impl Pending {
    pub fn info(&self) -> Option<UpdateInfo> {
        let pending = self.0.lock().ok()?;
        pending.as_ref().map(|(update, _)| UpdateInfo { version: update.version.clone() })
    }
}

/// Registers the updater and starts checking, in builds that can verify updates.
pub fn start(app: &AppHandle) -> tauri::Result<()> {
    if !enabled(app) {
        return Ok(());
    }
    app.plugin(tauri_plugin_updater::Builder::new().build())?;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK);
        loop {
            // Offline or GitHub unreachable: try again at the next check.
            let _ = tauri::async_runtime::block_on(fetch(&app));
            std::thread::sleep(CHECK_EVERY);
        }
    });
    Ok(())
}

/// Looks for a newer version and downloads it. Returns the version waiting to install, if any.
pub async fn fetch(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let pending = app.state::<Pending>();
    if let Some(info) = pending.info() {
        return Ok(Some(info));
    }
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    let info = UpdateInfo { version: update.version.clone() };
    if let Ok(mut slot) = pending.0.lock() {
        *slot = Some((update, bytes));
    }
    let _ = app.emit(UPDATE_READY, &info);
    Ok(Some(info))
}

/// Runs the installer. On Windows the installer closes Neat and opens the new version.
pub fn install(app: &AppHandle) -> Result<(), String> {
    let pending = app.state::<Pending>();
    let slot = pending.0.lock().map_err(|_| "Neat hit an internal error. Restart it.".to_string())?;
    let Some((update, bytes)) = slot.as_ref() else {
        return Err("There is no update waiting".into());
    };
    // If the installer cannot start, the update stays waiting so the user can try again.
    update.install(bytes).map_err(|e| format!("The update did not install: {e}"))?;
    drop(slot);
    app.restart();
}
