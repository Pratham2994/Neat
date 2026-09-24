//! Rules the user confirmed with "Always move files like these". Rules only ever move files inside Downloads.

use crate::model::{FileItem, Stack, StackKind};
use crate::names;
use crate::scan::Entry;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Condition {
    /// Downloaded from this site (or a subdomain of it).
    Host { host: String },
    /// Any of these extensions.
    Extensions { exts: Vec<String> },
    /// Name contains one of these words, with one of these extensions.
    NameWords { words: Vec<String>, exts: Vec<String> },
}

impl Condition {
    pub fn matches(&self, e: &Entry) -> bool {
        if e.is_dir {
            return false;
        }
        match self {
            Condition::Host { host } => e.host().is_some_and(|h| h == *host || h.ends_with(&format!(".{host}"))),
            Condition::Extensions { exts } => exts.contains(&e.ext),
            Condition::NameWords { words, exts } => {
                // Whole words, allowing a plural: "order_invoice_18842" has "order" and "invoice".
                let lower = e.stem.to_lowercase();
                let tokens: Vec<&str> = lower.split(|c: char| !c.is_ascii_alphabetic()).collect();
                exts.contains(&e.ext) && tokens.iter().any(|t| words.iter().any(|w| *t == w || t.strip_suffix('s') == Some(w)))
            }
        }
    }

    /// Plain words and the typed part, for the Rules table: ("Downloaded from", "hdfcbank.com").
    pub fn describe(&self) -> (String, String) {
        match self {
            Condition::Host { host } => ("Downloaded from".into(), host.clone()),
            Condition::Extensions { exts } => ("File type".into(), exts.iter().map(|e| format!(".{e}")).collect::<Vec<_>>().join(" ")),
            Condition::NameWords { words, exts } => (
                "Name contains".into(),
                format!("{} ({})", words.join(", "), exts.iter().map(|e| format!(".{e}")).collect::<Vec<_>>().join(" ")),
            ),
        }
    }
}

fn host_of(f: &FileItem) -> Option<&str> {
    f.source.as_deref()
}

/// The narrowest condition that covers every file in the group, or None when nothing safe fits.
pub fn condition_for(stack: &Stack) -> Option<Condition> {
    let first = stack.files.first()?;
    if let Some(host) = host_of(first) {
        if stack.files.iter().all(|f| host_of(f) == Some(host)) {
            return Some(Condition::Host { host: host.to_string() });
        }
    }
    let mut exts: Vec<String> = stack.files.iter().map(|f| names::split_ext(&f.name).1).filter(|e| !e.is_empty()).collect();
    exts.sort();
    exts.dedup();
    if exts.is_empty() {
        return None;
    }
    match stack.kind {
        StackKind::Category if stack.destination.as_deref() == Some("Finance/Receipts") => Some(Condition::NameWords {
            words: vec!["invoice".into(), "receipt".into(), "order".into(), "bill".into()],
            exts,
        }),
        StackKind::Category => Some(Condition::Extensions { exts }),
        _ => None,
    }
}
