//! Lists the top level of the Downloads folder. Folders Neat created are skipped.

use crate::source::{self, Source};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Hidden file that marks a folder as created by Neat. Neat never reorganises folders without it.
pub const MARKER: &str = ".neat";

#[derive(Debug, Clone)]
pub struct Entry {
    pub path: PathBuf,
    pub name: String,
    pub stem: String,
    pub ext: String,
    pub is_dir: bool,
    /// For a folder, the total size of the files inside it.
    pub size: u64,
    pub modified: SystemTime,
    pub source: Option<Source>,
}

impl Entry {
    pub fn host(&self) -> Option<String> {
        self.source.as_ref().and_then(Source::host)
    }

    pub fn age_secs(&self, now: SystemTime) -> u64 {
        now.duration_since(self.modified).map_or(0, |d| d.as_secs())
    }
}

pub fn is_neat_folder(path: &Path) -> bool {
    path.join(MARKER).is_file()
}

fn is_system_file(name: &str) -> bool {
    name.starts_with('.') || name.eq_ignore_ascii_case("desktop.ini") || name.eq_ignore_ascii_case("thumbs.db")
}

pub fn scan(root: &Path) -> io::Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for item in fs::read_dir(root)? {
        let item = item?;
        let name = item.file_name().to_string_lossy().into_owned();
        if is_system_file(&name) {
            continue;
        }
        let path = item.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) if !m.file_type().is_symlink() => m,
            _ => continue,
        };
        let is_dir = meta.is_dir();
        if is_dir && is_neat_folder(&path) {
            continue;
        }
        let (stem, ext) = if is_dir {
            (name.clone(), String::new())
        } else {
            let (s, e) = crate::names::split_ext(&name);
            (s.to_string(), e)
        };
        entries.push(Entry {
            size: if is_dir { dir_size(&path) } else { meta.len() },
            modified: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
            source: if is_dir { None } else { source::read(&path) },
            path,
            name,
            stem,
            ext,
            is_dir,
        });
    }
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

pub fn dir_size(path: &Path) -> u64 {
    dir_files(path).iter().map(|(_, size)| size).sum()
}

/// Folders past this many files (an extracted repository with node_modules, say) are measured approximately.
/// Walking them in full on every scan would make Neat slow for no benefit.
const WALK_LIMIT: usize = 20_000;

/// Files under `path`, as ("relative/path/with/slashes", size), up to `WALK_LIMIT` of them.
pub fn dir_files(path: &Path) -> Vec<(String, u64)> {
    let mut out = Vec::new();
    let mut stack = vec![(path.to_path_buf(), String::new())];
    while let Some((dir, prefix)) = stack.pop() {
        let Ok(items) = fs::read_dir(&dir) else { continue };
        for item in items.flatten() {
            let Ok(meta) = fs::symlink_metadata(item.path()) else { continue };
            let name = item.file_name().to_string_lossy().into_owned();
            let rel = if prefix.is_empty() { name } else { format!("{prefix}/{name}") };
            if meta.is_dir() {
                stack.push((item.path(), rel));
            } else if meta.is_file() {
                out.push((rel, meta.len()));
                if out.len() >= WALK_LIMIT {
                    return out;
                }
            }
        }
    }
    out
}
