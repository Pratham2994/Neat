//! Content hashing for duplicate detection. Cheap partial hashes first, full BLAKE3 only on collisions.

use std::collections::HashMap;
use std::fs::File;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

const PARTIAL_BYTES: u64 = 64 * 1024;

pub type Digest = [u8; 32];

/// Hash of the first 64 KiB. Equal files always match; most different files of equal size do not.
pub fn partial(path: &Path) -> io::Result<Digest> {
    let mut hasher = blake3::Hasher::new();
    let file = File::open(path)?;
    hasher.update_reader(file.take(PARTIAL_BYTES))?;
    Ok(*hasher.finalize().as_bytes())
}

pub fn full(path: &Path) -> io::Result<Digest> {
    let mut hasher = blake3::Hasher::new();
    hasher.update_reader(File::open(path)?)?;
    Ok(*hasher.finalize().as_bytes())
}

/// Short hex id for stacks: stable, not secret.
pub fn short_id(parts: &[&str]) -> String {
    let mut hasher = blake3::Hasher::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update(&[0]);
    }
    hasher.finalize().to_hex()[..12].to_string()
}

/// Remembers hashes between scans. The watcher rescans after every change, and without this two
/// large downloads of the same size would be read in full every time. A file is re-read only when
/// its size or modified time changes.
#[derive(Default)]
pub struct Cache {
    partial: Mutex<HashMap<(PathBuf, u64, SystemTime), Digest>>,
    full: Mutex<HashMap<(PathBuf, u64, SystemTime), Digest>>,
}

impl Cache {
    pub fn partial(&self, path: &Path, size: u64, modified: SystemTime) -> Option<Digest> {
        Self::get(&self.partial, path, size, modified, partial)
    }

    pub fn full(&self, path: &Path, size: u64, modified: SystemTime) -> Option<Digest> {
        Self::get(&self.full, path, size, modified, full)
    }

    fn get(
        map: &Mutex<HashMap<(PathBuf, u64, SystemTime), Digest>>,
        path: &Path,
        size: u64,
        modified: SystemTime,
        compute: fn(&Path) -> io::Result<Digest>,
    ) -> Option<Digest> {
        let key = (path.to_path_buf(), size, modified);
        if let Some(d) = map.lock().ok()?.get(&key) {
            return Some(*d);
        }
        let digest = compute(path).ok()?;
        let mut map = map.lock().ok()?;
        // A changed file replaces its old entry. Entries for deleted files stay until Neat restarts; there are few.
        map.retain(|(p, _, _), _| p != path);
        map.insert(key, digest);
        Some(digest)
    }
}
