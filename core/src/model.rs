//! Shapes sent to the UI. Field names match `src/lib/types.ts`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionKind {
    Move,
    Keep,
    Recycle,
}

impl ActionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ActionKind::Move => "move",
            ActionKind::Keep => "keep",
            ActionKind::Recycle => "recycle",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StackKind {
    Installers,
    Duplicates,
    Versions,
    Archive,
    Partial,
    Stale,
    Category,
}

impl StackKind {
    pub fn as_str(self) -> &'static str {
        match self {
            StackKind::Installers => "installers",
            StackKind::Duplicates => "duplicates",
            StackKind::Versions => "versions",
            StackKind::Archive => "archive",
            StackKind::Partial => "partial",
            StackKind::Stale => "stale",
            StackKind::Category => "category",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Fate {
    Kept,
    Affected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    /// The full path. Also the id, since a path is unique inside Downloads.
    pub id: String,
    pub name: String,
    pub size: u64,
    /// RFC 3339 timestamp.
    pub modified: String,
    /// Host the file was downloaded from, when the browser recorded it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// What the suggested action does to this file. None means the whole stack gets the action.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fate: Option<Fate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl Evidence {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into(), detail: None }
    }

    pub fn with(text: impl Into<String>, detail: impl Into<String>) -> Self {
        Self { text: text.into(), detail: Some(detail.into()) }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stack {
    /// Stable across scans while the same files form the same group.
    pub id: String,
    pub kind: StackKind,
    pub title: String,
    pub summary: String,
    pub action: ActionKind,
    /// Folder inside Downloads, with `/` separators, e.g. "Finance/Receipts".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
    pub confidence: Confidence,
    pub evidence: Vec<Evidence>,
    pub files: Vec<FileItem>,
    /// Whether "Always move files like these" can become a rule for this group.
    pub can_learn: bool,
}

impl Stack {
    /// Files the suggested action touches. The kept copy of a duplicate set is excluded.
    pub fn affected(&self) -> impl Iterator<Item = &FileItem> {
        self.files.iter().filter(|f| f.fate != Some(Fate::Kept))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: String,
    pub at: String,
    /// "move", "keep", "recycle" or "rule".
    pub action: String,
    pub auto: bool,
    pub title: String,
    pub count: u64,
    pub bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
    pub undone: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStatus {
    pub path: String,
    pub files: u64,
    pub bytes: u64,
    pub watching: bool,
    pub last_scan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Inbox {
    pub stacks: Vec<Stack>,
    pub folder: FolderStatus,
    /// When the user last opened Neat on this machine, RFC 3339. None on first run.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_session: Option<String>,
}

/// Result of applying or undoing: what worked and what did not.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub entries: Vec<ActivityEntry>,
    /// Files that could not be handled, with a plain reason ("in use by another app").
    pub skipped: Vec<Skipped>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skipped {
    pub path: String,
    pub reason: String,
}
