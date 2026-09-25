//! Neat's core: scanning Downloads, grouping files for review, and reversible file operations.
//!
//! Everything here is deterministic. Windows-only inputs (the browser's Zone.Identifier stream and
//! the installed-apps list) return nothing on other platforms, so the rest can be built and tested anywhere.

pub mod detect;
pub mod engine;
pub mod folder;
pub mod hash;
pub mod installers;
pub mod model;
pub mod names;
pub mod rules;
pub mod scan;
pub mod source;
pub mod util;

pub use engine::{Neat, RuleView};
pub use model::*;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Db(#[from] rusqlite::Error),
    #[error("{0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;
