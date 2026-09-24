//! Turns a scan into review groups. Deterministic only: names, sizes, hashes, archive listings,
//! installer metadata and the installed-apps list. Each file lands in at most one group.

use crate::hash;
use crate::installers::{self, InstalledApp};
use crate::model::{ActionKind, Confidence, Evidence, Fate, FileItem, Stack, StackKind};
use crate::names::{self, Category};
use crate::scan::{self, Entry};
use crate::util::{fmt_bytes, month_year, plural, rfc3339};
use regex::Regex;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::SystemTime;

const MINUTE: u64 = 60;
const DAY: u64 = 24 * 60 * MINUTE;
/// Files changed more recently than this may still be written by a browser or an app.
const SETTLE_SECS: u64 = 2 * MINUTE;
/// An unfinished download untouched for this long was abandoned.
const ABANDONED_SECS: u64 = 60 * MINUTE;
const STALE_SECS: u64 = 180 * DAY;
const STALE_MIN_BYTES: u64 = 500 * 1024 * 1024;

pub struct Context<'a> {
    pub now: SystemTime,
    pub installed: &'a [InstalledApp],
    /// Files the user chose to keep. They are never suggested again.
    pub kept: &'a HashSet<PathBuf>,
    pub hashes: &'a hash::Cache,
}

pub fn detect(entries: &[Entry], ctx: &Context) -> Vec<Stack> {
    let mut used = HashSet::new();
    // Anything still changing is left alone this round.
    for (i, e) in entries.iter().enumerate() {
        let settling = e.age_secs(ctx.now) < SETTLE_SECS || (names::is_partial(&e.ext) && e.age_secs(ctx.now) < ABANDONED_SECS);
        if settling || ctx.kept.contains(&e.path) {
            used.insert(i);
        }
    }
    let mut stacks = Vec::new();
    stacks.extend(partial(entries, ctx, &mut used));
    stacks.extend(duplicates(entries, ctx.hashes, &mut used));
    stacks.extend(archives(entries, &mut used));
    stacks.extend(installed_installers(entries, ctx, &mut used));
    stacks.extend(versions(entries, &mut used));
    stacks.extend(stale(entries, ctx, &mut used));
    stacks.extend(categories(entries, &mut used));
    for s in &mut stacks {
        s.can_learn = s.action == ActionKind::Move && crate::rules::condition_for(s).is_some();
    }
    stacks
}

fn file_item(e: &Entry, note: Option<String>, fate: Option<Fate>) -> FileItem {
    FileItem {
        id: e.path.to_string_lossy().into_owned(),
        name: e.name.clone(),
        size: e.size,
        modified: rfc3339(e.modified),
        source: e.host(),
        note,
        fate,
    }
}

fn stack_id(kind: StackKind, files: &[FileItem]) -> String {
    let mut parts: Vec<&str> = files.iter().map(|f| f.id.as_str()).collect();
    parts.sort_unstable();
    parts.insert(0, kind.as_str());
    hash::short_id(&parts)
}

#[allow(clippy::too_many_arguments)]
fn stack(
    kind: StackKind,
    title: String,
    summary: String,
    action: ActionKind,
    destination: Option<String>,
    confidence: Confidence,
    evidence: Vec<Evidence>,
    files: Vec<FileItem>,
) -> Stack {
    Stack { id: stack_id(kind, &files), kind, title, summary, action, destination, confidence, evidence, files, can_learn: false }
}

fn free(entries: &[Entry], used: &HashSet<usize>) -> Vec<usize> {
    (0..entries.len()).filter(|i| !used.contains(i)).collect()
}

/// "amazon.in, flipkart.com and 2 more"
fn host_list(hosts: &[String], max: usize) -> String {
    let shown = hosts.iter().take(max).cloned().collect::<Vec<_>>().join(", ");
    if hosts.len() > max {
        format!("{shown} and {} more", hosts.len() - max)
    } else {
        shown
    }
}

fn distinct_hosts<'a>(items: impl Iterator<Item = &'a Entry>) -> Vec<String> {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for e in items {
        if let Some(h) = e.host() {
            *counts.entry(h).or_default() += 1;
        }
    }
    let mut hosts: Vec<(String, usize)> = counts.into_iter().collect();
    hosts.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    hosts.into_iter().map(|(h, _)| h).collect()
}

fn partial(entries: &[Entry], ctx: &Context, used: &mut HashSet<usize>) -> Option<Stack> {
    let found: Vec<usize> = free(entries, used).into_iter().filter(|&i| names::is_partial(&entries[i].ext)).collect();
    if found.is_empty() {
        return None;
    }
    let newest = found.iter().map(|&i| entries[i].age_secs(ctx.now)).min().unwrap_or(0);
    used.extend(&found);
    Some(stack(
        StackKind::Partial,
        "Unfinished downloads".into(),
        format!("{} the browser never completed", plural(found.len() as u64, "download")),
        ActionKind::Recycle,
        None,
        Confidence::High,
        vec![
            Evidence::new("The browser stopped these downloads"),
            Evidence::new(format!("No change in {}", crate::util::duration_words(newest))),
        ],
        found.iter().map(|&i| file_item(&entries[i], None, None)).collect(),
    ))
}

fn duplicates(entries: &[Entry], hashes: &hash::Cache, used: &mut HashSet<usize>) -> Option<Stack> {
    let mut by_size: HashMap<u64, Vec<usize>> = HashMap::new();
    for i in free(entries, used) {
        let e = &entries[i];
        if !e.is_dir && e.size > 0 {
            by_size.entry(e.size).or_default().push(i);
        }
    }
    let mut sets: Vec<Vec<usize>> = Vec::new();
    for group in by_size.into_values().filter(|g| g.len() > 1) {
        let (partial, full) = (
            |i: usize| hashes.partial(&entries[i].path, entries[i].size, entries[i].modified),
            |i: usize| hashes.full(&entries[i].path, entries[i].size, entries[i].modified),
        );
        for candidates in split_by(&group, partial) {
            sets.extend(split_by(&candidates, full));
        }
    }
    if sets.is_empty() {
        return None;
    }

    let mut files = Vec::new();
    let mut kept_names = Vec::new();
    let mut extra = 0u64;
    for mut set in sets {
        // Keep the copy with the original name ("x.pdf" over "x (1).pdf"), then the oldest.
        set.sort_by_key(|&i| {
            let e = &entries[i];
            (names::strip_copy_suffix(&e.stem) != e.stem, e.modified)
        });
        kept_names.push(entries[set[0]].name.clone());
        for (n, &i) in set.iter().enumerate() {
            let fate = if n == 0 { Fate::Kept } else { Fate::Affected };
            files.push(file_item(&entries[i], None, Some(fate)));
        }
        extra += set.len() as u64 - 1;
        used.extend(set);
    }

    let (title, summary) = if kept_names.len() == 1 {
        (format!("Same file, downloaded {} times", extra + 1), kept_names[0].clone())
    } else {
        (
            "Duplicate downloads".to_string(),
            format!("{} of {}", plural(extra, "extra copy"), plural(kept_names.len() as u64, "file")).replace("copys", "copies"),
        )
    };
    Some(stack(
        StackKind::Duplicates,
        title,
        summary,
        ActionKind::Recycle,
        None,
        Confidence::High,
        vec![
            Evidence::with("Identical content", "The copies are byte-for-byte the same"),
            Evidence::with("Keeps one copy of each", "The one with the original name, or the oldest"),
        ],
        files,
    ))
}

/// Splits a group into subgroups of two or more that share the same key. Unreadable files drop out.
fn split_by<K: std::hash::Hash + Eq>(group: &[usize], key: impl Fn(usize) -> Option<K>) -> Vec<Vec<usize>> {
    let mut buckets: HashMap<K, Vec<usize>> = HashMap::new();
    for &i in group {
        if let Some(k) = key(i) {
            buckets.entry(k).or_default().push(i);
        }
    }
    buckets.into_values().filter(|b| b.len() > 1).collect()
}

fn zip_listing(path: &Path) -> Option<Vec<(String, u64)>> {
    let file = std::fs::File::open(path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    let mut out = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index_raw(i).ok()?;
        let name = entry.name().replace('\\', "/");
        if entry.is_dir() || name.starts_with("__MACOSX/") || name.ends_with(".DS_Store") {
            continue;
        }
        out.push((name, entry.size()));
    }
    Some(out)
}

/// Share of the archive's files present in the folder with the same size (0.0 to 1.0).
fn extracted_ratio(listing: &[(String, u64)], folder: &[(String, u64)]) -> f64 {
    if listing.is_empty() {
        return 0.0;
    }
    let present: HashSet<(String, u64)> = folder.iter().map(|(p, s)| (p.to_lowercase(), *s)).collect();
    let score = |strip_top: bool| {
        let hits = listing
            .iter()
            .filter(|(p, s)| {
                let p = if strip_top { p.split_once('/').map_or(p.as_str(), |(_, rest)| rest) } else { p };
                present.contains(&(p.to_lowercase(), *s))
            })
            .count();
        hits as f64 / listing.len() as f64
    };
    // "Extract all" may or may not keep the archive's own top folder.
    score(false).max(score(true))
}

fn archives(entries: &[Entry], used: &mut HashSet<usize>) -> Option<Stack> {
    let free_now = free(entries, used);
    let mut files = Vec::new();
    let mut pairs = Vec::new();
    let mut worst = 1.0f64;
    let mut total = 0usize;
    for &z in &free_now {
        let zip = &entries[z];
        if zip.is_dir || zip.ext != "zip" || used.contains(&z) {
            continue;
        }
        let base = names::strip_copy_suffix(&zip.stem).to_lowercase();
        let Some(&d) = free_now.iter().find(|&&d| {
            let dir = &entries[d];
            dir.is_dir && !used.contains(&d) && (dir.name.to_lowercase() == zip.stem.to_lowercase() || names::strip_copy_suffix(&dir.name).to_lowercase() == base)
        }) else {
            continue;
        };
        let Some(listing) = zip_listing(&zip.path) else { continue };
        let folder = scan::dir_files(&entries[d].path);
        let ratio = extracted_ratio(&listing, &folder);
        if ratio < 0.9 {
            continue;
        }
        worst = worst.min(ratio);
        total += listing.len();
        files.push(file_item(zip, None, Some(Fate::Affected)));
        files.push(file_item(&entries[d], Some(format!("Folder, {}", plural(folder.len() as u64, "file"))), Some(Fate::Kept)));
        pairs.push(zip.name.clone());
        used.insert(z);
        used.insert(d);
    }
    if pairs.is_empty() {
        return None;
    }
    let complete = worst >= 1.0;
    let (title, summary) = if pairs.len() == 1 {
        ("Archive already extracted".to_string(), format!("{} and its folder", pairs[0]))
    } else {
        ("Archives already extracted".to_string(), format!("{} and their folders", plural(pairs.len() as u64, "archive")))
    };
    Some(stack(
        StackKind::Archive,
        title,
        summary,
        ActionKind::Recycle,
        None,
        if complete { Confidence::High } else { Confidence::Medium },
        vec![
            if complete {
                Evidence::new(format!("All {} files in the archive are in the folder", total))
            } else {
                Evidence::new("Nearly every file in the archive is in the folder")
            },
            Evidence::new("Names and sizes match"),
            Evidence::with("Keeps the extracted folder", "The folder may hold changes the archive does not"),
        ],
        files,
    ))
}

fn installed_installers(entries: &[Entry], ctx: &Context, used: &mut HashSet<usize>) -> Option<Stack> {
    if ctx.installed.is_empty() {
        return None;
    }
    let mut files = Vec::new();
    let mut products = Vec::new();
    let mut all_newer = true;
    for i in free(entries, used) {
        let e = &entries[i];
        if e.is_dir || !matches!(e.ext.as_str(), "exe" | "msi") {
            continue;
        }
        let info = installers::describe(&e.path, &e.stem);
        let Some(m) = installers::find_installed(&info, ctx.installed) else { continue };
        if m.installed_is_older {
            // The installer is newer than what is installed; it may still be needed.
            continue;
        }
        all_newer &= m.installed_is_same_or_newer;
        let note = match &m.app.version {
            Some(v) => format!("Installed: {v}"),
            None => "Installed".to_string(),
        };
        products.push(info.product.clone());
        files.push(file_item(e, Some(note), None));
        used.insert(i);
    }
    if files.is_empty() {
        return None;
    }
    let mut evidence = vec![Evidence::with(
        if files.len() == 1 { "The app is installed".to_string() } else { format!("All {} apps are installed", files.len()) },
        "Matched against the Windows installed-apps list",
    )];
    if all_newer {
        evidence.push(Evidence::new("Installed versions are the same or newer"));
    }
    products.dedup();
    Some(stack(
        StackKind::Installers,
        "Installers for apps you already have".into(),
        list_words(&products, 5),
        ActionKind::Recycle,
        None,
        if all_newer { Confidence::High } else { Confidence::Medium },
        evidence,
        files,
    ))
}

fn list_words(items: &[String], max: usize) -> String {
    let shown = items.iter().take(max).cloned().collect::<Vec<_>>().join(", ");
    if items.len() > max {
        format!("{shown} and {} more", items.len() - max)
    } else {
        shown
    }
}

fn versions(entries: &[Entry], used: &mut HashSet<usize>) -> Vec<Stack> {
    let mut families: BTreeMap<(String, String), Vec<usize>> = BTreeMap::new();
    for i in free(entries, used) {
        let e = &entries[i];
        if e.is_dir {
            continue;
        }
        let key = names::version_key(&e.stem);
        if key.len() < 3 || names::is_generic(&key) {
            continue;
        }
        families.entry((key, e.ext.clone())).or_default().push(i);
    }
    let mut out = Vec::new();
    for ((_, ext), mut members) in families.into_iter().filter(|(_, m)| m.len() > 1) {
        members.sort_by_key(|&i| std::cmp::Reverse(entries[i].modified));
        let newest = &entries[members[0]];
        // The plainest name in the family reads best as a title: "DBMS_Project_Report" -> "DBMS Project Report".
        let base = members.iter().map(|&i| names::strip_copy_suffix(&entries[i].stem)).min_by_key(|s| s.len()).unwrap_or(&newest.stem);
        let title = names::pretty(base);
        let folder = names::category(&ext).unwrap_or(Category::Documents).folder();
        let files: Vec<FileItem> = members
            .iter()
            .enumerate()
            .map(|(n, &i)| file_item(&entries[i], (n == 0).then(|| "Newest".to_string()), None))
            .collect();
        out.push(stack(
            StackKind::Versions,
            format!("{title}, {} versions", members.len()),
            members.iter().map(|&i| entries[i].stem.clone()).collect::<Vec<_>>().join(", "),
            ActionKind::Move,
            Some(format!("{folder}/{title}")),
            Confidence::Medium,
            vec![
                Evidence::new(format!("Same name, {} versions", members.len())),
                Evidence::with(format!("Newest is {}", newest.name), "Older versions move with it, so nothing is lost"),
            ],
            files,
        ));
        used.extend(members);
    }
    out
}

fn stale(entries: &[Entry], ctx: &Context, used: &mut HashSet<usize>) -> Option<Stack> {
    let found: Vec<usize> = free(entries, used)
        .into_iter()
        .filter(|&i| !entries[i].is_dir && entries[i].size >= STALE_MIN_BYTES && entries[i].age_secs(ctx.now) >= STALE_SECS)
        .collect();
    if found.is_empty() {
        return None;
    }
    let bytes: u64 = found.iter().map(|&i| entries[i].size).sum();
    let newest = found.iter().map(|&i| entries[i].modified).max().unwrap_or(ctx.now);
    let mut sorted = found.clone();
    sorted.sort_by_key(|&i| std::cmp::Reverse(entries[i].size));
    let first = &entries[sorted[0]].name;
    let summary = if sorted.len() == 1 { first.clone() } else { format!("{first} and {}", plural(sorted.len() as u64 - 1, "more")) };
    used.extend(&found);
    Some(stack(
        StackKind::Stale,
        "Large files not changed in 6 months".into(),
        summary,
        ActionKind::Recycle,
        None,
        Confidence::Low,
        vec![
            Evidence::new(format!("Together they take {}", fmt_bytes(bytes))),
            Evidence::new(format!("None changed since {}", month_year(newest))),
            Evidence::with("Size and age alone are weak evidence", "Check before recycling"),
        ],
        sorted.iter().map(|&i| file_item(&entries[i], None, None)).collect(),
    ))
}

// Whole words only, so "border.pdf" or "billboard.pdf" do not count.
static RECEIPT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(^|[^a-z])(invoice|receipt|order|bill)s?([^a-z]|$)").unwrap());

fn categories(entries: &[Entry], used: &mut HashSet<usize>) -> Vec<Stack> {
    let mut receipts = Vec::new();
    let mut by_category: BTreeMap<Category, Vec<usize>> = BTreeMap::new();
    for i in free(entries, used) {
        let e = &entries[i];
        if e.is_dir {
            continue;
        }
        let Some(category) = names::category(&e.ext) else { continue };
        if category == Category::Documents && RECEIPT.is_match(&e.stem) {
            receipts.push(i);
        } else {
            by_category.entry(category).or_default().push(i);
        }
    }

    let mut out = Vec::new();
    if !receipts.is_empty() {
        let hosts = distinct_hosts(receipts.iter().map(|&i| &entries[i]));
        let mut evidence = Vec::new();
        if !hosts.is_empty() {
            evidence.push(Evidence::with(
                format!("Downloaded from {}", plural(hosts.len() as u64, "site")),
                host_list(&hosts, 4),
            ));
        }
        evidence.push(Evidence::new("Names mention an invoice, receipt, order or bill"));
        out.push(stack(
            StackKind::Category,
            "Receipts and invoices".into(),
            if hosts.is_empty() { plural(receipts.len() as u64, "document") } else { format!("From {}", host_list(&hosts, 3)) },
            ActionKind::Move,
            Some("Finance/Receipts".into()),
            Confidence::Medium,
            evidence,
            receipts.iter().map(|&i| file_item(&entries[i], None, None)).collect(),
        ));
        used.extend(&receipts);
    }

    for (category, members) in by_category {
        let hosts = distinct_hosts(members.iter().map(|&i| &entries[i]));
        let summary = match hosts.first() {
            Some(h) => format!("{}, mostly from {h}", plural(members.len() as u64, category.noun().trim_end_matches('s'))),
            None => plural(members.len() as u64, category.noun().trim_end_matches('s')),
        };
        out.push(stack(
            StackKind::Category,
            capitalise(category.noun()),
            summary,
            ActionKind::Move,
            Some(category.folder().to_string()),
            Confidence::Medium,
            vec![Evidence::with(
                format!("All {} are {}", plural(members.len() as u64, "file"), category.noun()),
                "Sorted by file type, with nothing more specific to go on",
            )],
            members.iter().map(|&i| file_item(&entries[i], None, None)).collect(),
        ));
        used.extend(members);
    }
    out
}

fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}
