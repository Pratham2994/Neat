//! Content hashing for duplicate detection. Cheap partial hashes first, full BLAKE3 only on collisions.

use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

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
