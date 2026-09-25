//! Which folders Neat may look after: Downloads by default, or one the user picks.

use crate::scan;
use std::path::{Path, PathBuf};

// Where Windows and apps keep their own files.
const SYSTEM_VARS: &[&str] = &["SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramData", "APPDATA", "LOCALAPPDATA"];
const ONEDRIVE_VARS: &[&str] = &["OneDrive", "OneDriveConsumer", "OneDriveCommercial"];

/// Why `folder` cannot be Neat's folder, in plain words, or None when it can.
pub fn unsuitable(folder: &Path) -> Option<&'static str> {
    if !folder.is_absolute() || !folder.is_dir() {
        return Some("That folder does not exist");
    }
    if folder.parent().is_none() {
        return Some("Pick a folder, not a whole drive");
    }
    if scan::is_neat_folder(folder) {
        return Some("Neat made that folder. Pick the folder it sits in");
    }
    let inside = |var: &&str| std::env::var_os(var).is_some_and(|p| same_or_inside(folder, Path::new(&p)));
    if ONEDRIVE_VARS.iter().any(inside) {
        return Some("Neat does not work in OneDrive: reading online-only files would download them");
    }
    if SYSTEM_VARS.iter().any(inside) {
        return Some("Windows and apps keep their own files there");
    }
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"));
    if home.is_some_and(|h| same_or_inside(Path::new(&h), folder)) {
        return Some("That folder holds your whole user profile. Pick one inside it, such as Downloads");
    }
    None
}

/// Whether `path` is `folder` or inside it, ignoring case as Windows does.
pub fn same_or_inside(path: &Path, folder: &Path) -> bool {
    let lower = |p: &Path| PathBuf::from(p.to_string_lossy().to_lowercase());
    lower(path).starts_with(lower(folder))
}

pub fn same(a: &Path, b: &Path) -> bool {
    same_or_inside(a, b) && same_or_inside(b, a)
}
