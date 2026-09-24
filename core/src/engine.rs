//! The engine: scans, applies decisions, records every file operation, and undoes them.
//!
//! Every move and recycle is written to the `operations` table right after it happens, so undo
//! works even if the app closes mid-batch. Moves stay inside Downloads. Recycling goes through the
//! Recycle Bin, never a permanent delete.

use crate::detect::{self, Context};
use crate::installers::{self, InstalledApp};
use crate::model::{ActionKind, ActivityEntry, FolderStatus, Inbox, Outcome, Skipped, Stack};
use crate::rules::{self, Condition};
use crate::scan::{self, Entry, MARKER};
use crate::util::{now_rfc3339, plural};
use crate::{Error, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::SystemTime;

const SCHEMA: &str = "
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    action TEXT NOT NULL,
    auto INTEGER NOT NULL,
    title TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,
    destination TEXT,
    stack_id TEXT,
    rule_id INTEGER,
    undone INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY,
    activity_id INTEGER NOT NULL REFERENCES activity(id),
    kind TEXT NOT NULL,
    from_path TEXT NOT NULL,
    to_path TEXT,
    size INTEGER NOT NULL
);
-- Files the user chose to keep, by path. Keeping is per file, so a new download joining a group
-- does not bring back files already kept.
CREATE TABLE IF NOT EXISTS kept (path TEXT PRIMARY KEY, activity_id INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY,
    condition TEXT NOT NULL,
    destination TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    matched INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
);
";

/// A rule as the Rules table shows it. Field names match `Rule` in `src/lib/types.ts`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleView {
    pub id: String,
    pub when: String,
    pub value: String,
    pub then: String,
    pub auto: bool,
    pub matched: u64,
    pub enabled: bool,
}

pub struct Neat {
    root: PathBuf,
    db: Connection,
    pub installed: Vec<InstalledApp>,
    /// Set by the shell when its folder watcher is running.
    pub watching: bool,
    /// Groups from the last scan, by id. Decisions refer to these.
    stacks: HashMap<String, Stack>,
}

impl Neat {
    pub fn open(root: impl Into<PathBuf>, db_path: impl AsRef<Path>) -> Result<Self> {
        let db = Connection::open(db_path)?;
        db.execute_batch(SCHEMA)?;
        Ok(Self { root: root.into(), db, installed: installers::installed_apps(), watching: false, stacks: HashMap::new() })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn meta(&self, key: &str) -> Result<Option<String>> {
        Ok(self.db.query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0)).optional()?)
    }

    fn set_meta(&self, key: &str, value: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }

    /// Call when the user stops looking: the window goes to the tray, or Neat quits. The inbox then
    /// reports what Neat did since this moment ("While you were away"), however long Neat kept running.
    pub fn mark_seen(&self) -> Result<()> {
        self.set_meta("last_seen", &now_rfc3339())
    }

    /// Whether rules move matching files without asking. On by default.
    pub fn auto_rules(&self) -> Result<bool> {
        Ok(self.meta("auto_rules")?.as_deref() != Some("off"))
    }

    pub fn set_auto_rules(&self, on: bool) -> Result<()> {
        self.set_meta("auto_rules", if on { "on" } else { "off" })
    }

    /// Runs the rules (when automatic rules are on), then groups whatever is left for review.
    pub fn scan(&mut self) -> Result<Inbox> {
        if self.auto_rules()? {
            self.run_rules()?;
        }
        let entries = scan::scan(&self.root)?;
        let kept = self.kept()?;
        let ctx = Context { now: SystemTime::now(), installed: &self.installed, kept: &kept };
        let stacks: Vec<Stack> = detect::detect(&entries, &ctx);
        self.stacks = stacks.iter().map(|s| (s.id.clone(), s.clone())).collect();
        Ok(Inbox {
            stacks,
            folder: FolderStatus {
                path: self.root.to_string_lossy().into_owned(),
                files: entries.iter().filter(|e| !e.is_dir).count() as u64,
                bytes: entries.iter().map(|e| e.size).sum(),
                watching: self.watching,
                last_scan: now_rfc3339(),
            },
            last_session: self.meta("last_seen")?,
        })
    }

    fn kept(&self) -> Result<HashSet<PathBuf>> {
        let mut stmt = self.db.prepare("SELECT path FROM kept")?;
        let paths = stmt.query_map([], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(paths.into_iter().map(PathBuf::from).collect())
    }

    /// Applies one decision to one group from the last scan.
    pub fn apply(&mut self, stack_id: &str, action: ActionKind, always: bool) -> Result<Outcome> {
        let stack = self
            .stacks
            .get(stack_id)
            .cloned()
            .ok_or_else(|| Error::Invalid("That group changed since the last scan. Scan again.".into()))?;
        let mut outcome = Outcome::default();
        let entry = self.apply_one(&stack, action, &mut outcome.skipped)?;

        if always && action == ActionKind::Move {
            if let (Some(condition), Some(dest)) = (rules::condition_for(&stack), stack.destination.as_deref()) {
                outcome.entries.push(self.add_rule(&condition, dest)?);
            }
        }
        outcome.entries.push(entry);
        self.stacks.remove(stack_id);
        Ok(outcome)
    }

    /// Applies each group's suggested action: the "Apply all sure suggestions" button.
    pub fn apply_suggested(&mut self, stack_ids: &[String]) -> Result<Outcome> {
        let mut outcome = Outcome::default();
        for id in stack_ids {
            let Some(stack) = self.stacks.get(id).cloned() else { continue };
            let entry = self.apply_one(&stack, stack.action, &mut outcome.skipped)?;
            outcome.entries.push(entry);
            self.stacks.remove(id);
        }
        Ok(outcome)
    }

    fn apply_one(&self, stack: &Stack, action: ActionKind, skipped: &mut Vec<Skipped>) -> Result<ActivityEntry> {
        let destination = if action == ActionKind::Move {
            Some(stack.destination.clone().ok_or_else(|| Error::Invalid("This group has no destination.".into()))?)
        } else {
            None
        };
        self.db.execute(
            "INSERT INTO activity (at, action, auto, title, destination, stack_id) VALUES (?1, ?2, 0, ?3, ?4, ?5)",
            params![now_rfc3339(), action.as_str(), stack.title, destination, stack.id],
        )?;
        let activity_id = self.db.last_insert_rowid();
        let (mut count, mut bytes) = (0u64, 0u64);

        match action {
            ActionKind::Keep => {
                count = stack.files.len() as u64;
                bytes = stack.files.iter().map(|f| f.size).sum();
                for file in &stack.files {
                    self.db.execute(
                        "INSERT OR REPLACE INTO kept (path, activity_id) VALUES (?1, ?2)",
                        params![file.id, activity_id],
                    )?;
                }
            }
            ActionKind::Move | ActionKind::Recycle => {
                for file in stack.affected() {
                    let from = PathBuf::from(&file.id);
                    let result = match &destination {
                        Some(dest) => move_into(&self.root, &from, dest).map(Some),
                        None => recycle(&from).map(|_| None),
                    };
                    match result {
                        Ok(to) => {
                            // Recorded straight away, so undo survives a crash mid-batch.
                            self.db.execute(
                                "INSERT INTO operations (activity_id, kind, from_path, to_path, size) VALUES (?1, ?2, ?3, ?4, ?5)",
                                params![activity_id, action.as_str(), file.id, to.map(|p| p.to_string_lossy().into_owned()), file.size as i64],
                            )?;
                            count += 1;
                            bytes += file.size;
                        }
                        Err(reason) => skipped.push(Skipped { path: file.id.clone(), reason }),
                    }
                }
            }
        }
        self.db.execute("UPDATE activity SET count = ?1, bytes = ?2 WHERE id = ?3", params![count as i64, bytes as i64, activity_id])?;
        self.entry(activity_id)
    }

    fn add_rule(&self, condition: &Condition, destination: &str) -> Result<ActivityEntry> {
        let now = now_rfc3339();
        self.db.execute(
            "INSERT INTO rules (condition, destination, created) VALUES (?1, ?2, ?3)",
            params![serde_json::to_string(condition).unwrap_or_default(), destination, now],
        )?;
        let rule_id = self.db.last_insert_rowid();
        self.db.execute(
            "INSERT INTO activity (at, action, auto, title, destination, rule_id) VALUES (?1, 'rule', 0, ?2, ?3, ?4)",
            params![now, noun_phrase(condition, None), destination, rule_id],
        )?;
        self.entry(self.db.last_insert_rowid())
    }

    /// Moves every settled file that an enabled rule covers. These are the only automatic actions.
    pub fn run_rules(&mut self) -> Result<Outcome> {
        let rules = self.load_rules()?;
        let mut outcome = Outcome::default();
        if rules.iter().all(|r| !r.enabled) {
            return Ok(outcome);
        }
        let now = SystemTime::now();
        let entries: Vec<Entry> = scan::scan(&self.root)?
            .into_iter()
            .filter(|e| !e.is_dir && !crate::names::is_partial(&e.ext) && e.age_secs(now) >= 120)
            .collect();
        let mut taken = HashSet::new();
        for rule in rules.iter().filter(|r| r.enabled) {
            let matched: Vec<&Entry> =
                entries.iter().filter(|e| !taken.contains(&e.path) && rule.condition.matches(e)).collect();
            if matched.is_empty() {
                continue;
            }
            let title = if matched.len() == 1 { matched[0].name.clone() } else { noun_phrase(&rule.condition, Some(matched.len())) };
            self.db.execute(
                "INSERT INTO activity (at, action, auto, title, destination, rule_id) VALUES (?1, 'move', 1, ?2, ?3, ?4)",
                params![now_rfc3339(), title, rule.destination, rule.id],
            )?;
            let activity_id = self.db.last_insert_rowid();
            let (mut count, mut bytes) = (0u64, 0u64);
            for e in matched {
                taken.insert(e.path.clone());
                match move_into(&self.root, &e.path, &rule.destination) {
                    Ok(to) => {
                        self.db.execute(
                            "INSERT INTO operations (activity_id, kind, from_path, to_path, size) VALUES (?1, 'move', ?2, ?3, ?4)",
                            params![activity_id, e.path.to_string_lossy(), to.to_string_lossy(), e.size as i64],
                        )?;
                        count += 1;
                        bytes += e.size;
                    }
                    Err(reason) => outcome.skipped.push(Skipped { path: e.path.to_string_lossy().into_owned(), reason }),
                }
            }
            self.db.execute("UPDATE activity SET count = ?1, bytes = ?2 WHERE id = ?3", params![count as i64, bytes as i64, activity_id])?;
            self.db.execute("UPDATE rules SET matched = matched + ?1 WHERE id = ?2", params![count as i64, rule.id])?;
            outcome.entries.push(self.entry(activity_id)?);
        }
        Ok(outcome)
    }

    /// Reverses the given activity entries, newest first. Files that changed since are skipped, never overwritten.
    pub fn undo(&mut self, activity_ids: &[String]) -> Result<Outcome> {
        let mut outcome = Outcome::default();
        let mut ids: Vec<i64> = activity_ids.iter().filter_map(|id| id.parse().ok()).collect();
        ids.sort_unstable_by(|a, b| b.cmp(a));
        for id in ids {
            let row: Option<(String, bool, Option<i64>)> = self
                .db
                .query_row("SELECT action, undone, rule_id FROM activity WHERE id = ?1", [id], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?))
                })
                .optional()?;
            let Some((action, undone, rule_id)) = row else { continue };
            if undone {
                continue;
            }
            match action.as_str() {
                "keep" => {
                    self.db.execute("DELETE FROM kept WHERE activity_id = ?1", [id])?;
                }
                "rule" => {
                    if let Some(rule_id) = rule_id {
                        self.db.execute("DELETE FROM rules WHERE id = ?1", [rule_id])?;
                    }
                }
                _ => self.undo_operations(id, &mut outcome.skipped)?,
            }
            self.db.execute("UPDATE activity SET undone = 1 WHERE id = ?1", [id])?;
            outcome.entries.push(self.entry(id)?);
        }
        Ok(outcome)
    }

    fn undo_operations(&self, activity_id: i64, skipped: &mut Vec<Skipped>) -> Result<()> {
        let mut stmt = self.db.prepare("SELECT kind, from_path, to_path FROM operations WHERE activity_id = ?1 ORDER BY id DESC")?;
        let ops = stmt
            .query_map([activity_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<String>>(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for (kind, from, to) in ops {
            let from = PathBuf::from(from);
            let result = match (kind.as_str(), to) {
                ("move", Some(to)) => move_back(&self.root, Path::new(&to), &from),
                ("recycle", _) => restore(&from),
                _ => Ok(()),
            };
            if let Err(reason) = result {
                skipped.push(Skipped { path: from.to_string_lossy().into_owned(), reason });
            }
        }
        Ok(())
    }

    pub fn activity(&self, limit: usize) -> Result<Vec<ActivityEntry>> {
        let mut stmt = self.db.prepare(&format!("{ENTRY_SELECT} ORDER BY id DESC LIMIT ?1"))?;
        let rows = stmt.query_map([limit as i64], entry_from_row)?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    fn entry(&self, id: i64) -> Result<ActivityEntry> {
        Ok(self.db.query_row(&format!("{ENTRY_SELECT} WHERE id = ?1"), [id], entry_from_row)?)
    }

    fn load_rules(&self) -> Result<Vec<StoredRule>> {
        let mut stmt = self.db.prepare("SELECT id, condition, destination, enabled, matched FROM rules ORDER BY id")?;
        let rules = stmt
            .query_map([], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, bool>(3)?, r.get::<_, i64>(4)? as u64))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rules
            .into_iter()
            .filter_map(|(id, condition, destination, enabled, matched)| {
                let condition = serde_json::from_str(&condition).ok()?;
                Some(StoredRule { id, condition, destination, enabled, matched })
            })
            .collect())
    }

    pub fn rules(&self) -> Result<Vec<RuleView>> {
        Ok(self
            .load_rules()?
            .into_iter()
            .map(|r| {
                let (when, value) = r.condition.describe();
                RuleView {
                    id: r.id.to_string(),
                    when,
                    value,
                    then: format!("Move to {}", r.destination),
                    auto: true,
                    matched: r.matched,
                    enabled: r.enabled,
                }
            })
            .collect())
    }

    pub fn set_rule_enabled(&self, id: &str, enabled: bool) -> Result<()> {
        let id: i64 = id.parse().map_err(|_| Error::Invalid("Unknown rule.".into()))?;
        self.db.execute("UPDATE rules SET enabled = ?1 WHERE id = ?2", params![enabled, id])?;
        Ok(())
    }
}

struct StoredRule {
    id: i64,
    condition: Condition,
    destination: String,
    enabled: bool,
    matched: u64,
}

const ENTRY_SELECT: &str = "SELECT id, at, action, auto, title, count, bytes, destination, undone FROM activity";

fn entry_from_row(r: &rusqlite::Row) -> rusqlite::Result<ActivityEntry> {
    Ok(ActivityEntry {
        id: r.get::<_, i64>(0)?.to_string(),
        at: r.get(1)?,
        action: r.get(2)?,
        auto: r.get(3)?,
        title: r.get(4)?,
        count: r.get::<_, i64>(5)? as u64,
        bytes: r.get::<_, i64>(6)? as u64,
        destination: r.get(7)?,
        undone: r.get(8)?,
    })
}

/// "8 files from hdfcbank.com", "Files from hdfcbank.com".
fn noun_phrase(condition: &Condition, count: Option<usize>) -> String {
    let files = count.map_or("Files".to_string(), |n| plural(n as u64, "file"));
    match condition {
        Condition::Host { host } => format!("{files} from {host}"),
        Condition::Extensions { exts } => format!("{files} of type {}", exts.iter().map(|e| format!(".{e}")).collect::<Vec<_>>().join(", ")),
        Condition::NameWords { words, .. } => format!("{files} named like {}", words.join(", ")),
    }
}

fn plain_reason(err: &io::Error) -> String {
    match (err.kind(), err.raw_os_error()) {
        // ERROR_SHARING_VIOLATION and ERROR_LOCK_VIOLATION on Windows.
        (_, Some(32 | 33)) => "In use by another app".into(),
        (io::ErrorKind::NotFound, _) => "No longer in Downloads".into(),
        (io::ErrorKind::PermissionDenied, _) => "Windows did not allow the change".into(),
        _ => err.to_string(),
    }
}

/// Rejects destinations that could leave Downloads or that Windows cannot name.
fn safe_destination(root: &Path, dest: &str) -> std::result::Result<PathBuf, String> {
    let mut path = root.to_path_buf();
    for part in dest.split('/') {
        let bad = part.is_empty()
            || part.ends_with(['.', ' '])
            || part.chars().any(|c| matches!(c, '<' | '>' | ':' | '"' | '\\' | '|' | '?' | '*') || c.is_control())
            || !matches!(Path::new(part).components().next(), Some(Component::Normal(_)));
        if bad {
            return Err(format!("\"{dest}\" is not a valid folder name"));
        }
        path.push(part);
    }
    Ok(path)
}

/// Creates each missing folder on the way and marks it as Neat's.
fn ensure_folder(root: &Path, dir: &Path) -> io::Result<()> {
    let mut current = root.to_path_buf();
    for part in dir.strip_prefix(root).map_err(|_| io::Error::other("outside Downloads"))?.components() {
        current.push(part);
        if !current.exists() {
            fs::create_dir(&current)?;
            write_marker(&current)?;
        }
    }
    Ok(())
}

fn write_marker(dir: &Path) -> io::Result<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        options.attributes(FILE_ATTRIBUTE_HIDDEN);
    }
    use std::io::Write;
    options.open(dir.join(MARKER))?.write_all(b"This folder was created by Neat. Neat only files things into folders marked like this.\n")
}

/// "name.pdf" -> "name (2).pdf" until the name is free.
fn free_name(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, ext) = crate::names::split_ext(name);
    let ext = if ext.is_empty() { String::new() } else { format!(".{}", &name[name.len() - ext.len()..]) };
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .expect("an unused name exists")
}

fn move_into(root: &Path, from: &Path, dest: &str) -> std::result::Result<PathBuf, String> {
    let dir = safe_destination(root, dest)?;
    if !from.starts_with(root) {
        return Err("Not in Downloads".into());
    }
    ensure_folder(root, &dir).map_err(|e| plain_reason(&e))?;
    let name = from.file_name().ok_or("No file name")?.to_string_lossy().into_owned();
    let to = free_name(&dir, &name);
    // A rename inside one folder tree is instant and fails cleanly when another app holds the file open.
    fs::rename(from, &to).map_err(|e| plain_reason(&e))?;
    Ok(to)
}

fn move_back(root: &Path, to: &Path, from: &Path) -> std::result::Result<(), String> {
    if !to.exists() {
        return Err("Moved or deleted since, so it cannot be put back".into());
    }
    if from.exists() {
        return Err("A file with the same name is already back in Downloads".into());
    }
    fs::rename(to, from).map_err(|e| plain_reason(&e))?;
    remove_empty_neat_folders(root, to.parent());
    Ok(())
}

/// Removes folders Neat created once undo leaves them empty.
fn remove_empty_neat_folders(root: &Path, mut dir: Option<&Path>) {
    while let Some(d) = dir {
        if d == root || !d.starts_with(root) || !scan::is_neat_folder(d) {
            break;
        }
        let only_marker = fs::read_dir(d).map(|items| items.flatten().all(|i| i.file_name() == MARKER)).unwrap_or(false);
        if !only_marker || fs::remove_dir_all(d).is_err() {
            break;
        }
        dir = d.parent();
    }
}

fn recycle(path: &Path) -> std::result::Result<(), String> {
    trash::delete(path).map_err(|e| format!("Could not move it to the Recycle Bin: {e}"))
}

/// A folder in a form that compares equal however it is spelled (short 8.3 names, case).
fn resolved(dir: &Path) -> PathBuf {
    fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf())
}

/// Whether a Recycle Bin item is the file that was at `original`.
fn is_recycled_copy(item: &trash::TrashItem, original: &Path, folder: &Path) -> bool {
    let Some(name) = original.file_name().map(|n| n.to_string_lossy().into_owned()) else { return false };
    if resolved(&item.original_parent) != folder {
        return false;
    }
    let shown = item.name.to_string_lossy();
    if shown.eq_ignore_ascii_case(&name) {
        return true;
    }
    // Windows reports the name as Explorer shows it, which hides known extensions by default
    // ("report.pdf" shows as "report"). The item's own id still ends with the real extension.
    let (stem, ext) = crate::names::split_ext(&name);
    !ext.is_empty()
        && shown.eq_ignore_ascii_case(stem)
        && item.id.to_string_lossy().to_ascii_lowercase().ends_with(&format!(".{ext}"))
}

fn restore(original: &Path) -> std::result::Result<(), String> {
    if original.exists() {
        return Err("A file with the same name is already back in Downloads".into());
    }
    let items = trash::os_limited::list().map_err(|e| format!("Could not read the Recycle Bin: {e}"))?;
    let folder = resolved(original.parent().unwrap_or(original));
    let mut item = items
        .into_iter()
        .filter(|i| is_recycled_copy(i, original, &folder))
        .max_by_key(|i| i.time_deleted)
        .ok_or("No longer in the Recycle Bin")?;
    // Restore under the real name. On Windows the item's name is the displayed one, which may lack
    // the extension, and restoring under it would bring "report.pdf" back as "report".
    if let Some(name) = original.file_name() {
        item.name = name.to_owned();
    }
    trash::os_limited::restore_all([item]).map_err(|e| format!("Could not restore it: {e}"))
}
