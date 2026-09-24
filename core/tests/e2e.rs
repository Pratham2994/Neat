//! End to end: a fake Downloads folder goes through scan, decisions, rules and undo.

use neat_core::installers::InstalledApp;
use neat_core::{ActionKind, Confidence, Neat, Stack, StackKind};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::time::{Duration, SystemTime};

const DAY: u64 = 24 * 60 * 60;

fn write(dir: &Path, name: &str, content: &[u8], age_secs: u64) {
    let path = dir.join(name);
    File::create(&path).unwrap().write_all(content).unwrap();
    age(&path, age_secs);
}

fn age(path: &Path, secs: u64) {
    let when = SystemTime::now() - Duration::from_secs(secs);
    open_for_times(path).unwrap().set_modified(when).unwrap();
}

// Setting a folder's times needs a handle to the folder itself.
#[cfg(windows)]
fn open_for_times(path: &Path) -> std::io::Result<File> {
    use std::os::windows::fs::OpenOptionsExt;
    const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
    File::options().write(true).custom_flags(FILE_FLAG_BACKUP_SEMANTICS).open(path)
}

#[cfg(not(windows))]
fn open_for_times(path: &Path) -> std::io::Result<File> {
    if path.is_dir() {
        File::open(path)
    } else {
        File::options().write(true).open(path)
    }
}

fn zip_with(path: &Path, files: &[(&str, &[u8])]) {
    let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    for (name, content) in files {
        zip.start_file(*name, options).unwrap();
        zip.write_all(content).unwrap();
    }
    zip.finish().unwrap();
}

fn find<'a>(stacks: &'a [Stack], kind: StackKind, title: &str) -> &'a Stack {
    stacks
        .iter()
        .find(|s| s.kind == kind && s.title.contains(title))
        .unwrap_or_else(|| panic!("no {kind:?} stack titled {title:?}; got {:#?}", stacks.iter().map(|s| &s.title).collect::<Vec<_>>()))
}

fn names_in(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    names.sort();
    names
}

#[test]
fn downloads_round_trip() {
    let tmp = tempfile::tempdir().unwrap();
    // Keep the Recycle Bin (freedesktop trash on Linux) inside the test folder.
    std::env::set_var("XDG_DATA_HOME", tmp.path().join("xdg"));
    let downloads = tmp.path().join("Downloads");
    fs::create_dir_all(&downloads).unwrap();
    let d = downloads.as_path();

    // Receipts, older than a day.
    write(d, "Invoice_402-8831127-4432.pdf", b"invoice one", DAY);
    write(d, "order_invoice_18842.pdf", b"invoice two", 2 * DAY);
    // The same timetable downloaded three times.
    for (name, age) in [("Semester 5 Timetable.pdf", 30), ("Semester 5 Timetable (1).pdf", 20), ("Semester 5 Timetable (2).pdf", 10)] {
        write(d, name, b"same timetable bytes", age * DAY);
    }
    // One report in three versions.
    write(d, "DBMS_Project_Report.docx", b"v1", 9 * DAY);
    write(d, "DBMS_Project_Report_final.docx", b"v2 longer", 8 * DAY);
    write(d, "DBMS_Project_Report_final_v2.docx", b"v3 longest", 6 * DAY);
    // An archive and the folder it was extracted into.
    let assets: [(&str, &[u8]); 2] = [("logo.svg", b"<svg/>"), ("fonts/brand.woff2", b"font bytes")];
    zip_with(&d.join("brand-assets.zip"), &assets);
    age(&d.join("brand-assets.zip"), 5 * DAY);
    for (name, content) in assets {
        let path = d.join("brand-assets").join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }
    age(&d.join("brand-assets"), 5 * DAY);
    // An installer for an app that is already installed at a newer version.
    write(d, "Figma-124.1.2.exe", b"not really a PE file", 40 * DAY);
    // A download the browser gave up on, and one still in progress.
    write(d, "dataset-full.tar.gz.crdownload", b"half", 3 * DAY);
    write(d, "ubuntu.iso.crdownload", b"in progress", 0);
    // A large file untouched for months (sparse, so the test stays fast).
    let big = d.join("old-backup.iso");
    File::create(&big).unwrap().set_len(600 * 1024 * 1024).unwrap();
    age(&big, 200 * DAY);
    // Images, a file that just arrived, and a folder the user made.
    write(d, "wallpaper-1.jpg", b"jpg one", 3 * DAY);
    write(d, "wallpaper-2.png", b"png two", 4 * DAY);
    write(d, "just-arrived.pdf", b"fresh", 0);
    fs::create_dir(d.join("My Stuff")).unwrap();
    fs::write(d.join("My Stuff/notes.txt"), b"mine").unwrap();

    let mut neat = Neat::open(d, tmp.path().join("neat.db")).unwrap();
    neat.installed = vec![InstalledApp { name: "Figma".into(), version: Some("124.3.2".into()), publisher: None }];
    neat.begin_session().unwrap();

    // --- Scan: every detector finds its group, nothing in progress is touched.
    let inbox = neat.scan().unwrap();
    let stacks = &inbox.stacks;
    let partial = find(stacks, StackKind::Partial, "Unfinished");
    assert_eq!(partial.files.len(), 1, "the in-progress download must be left alone");
    let dupes = find(stacks, StackKind::Duplicates, "Same file");
    assert_eq!(dupes.affected().count(), 2);
    assert_eq!(dupes.files.iter().find(|f| f.fate == Some(neat_core::Fate::Kept)).unwrap().name, "Semester 5 Timetable.pdf");
    let archive = find(stacks, StackKind::Archive, "Archive already extracted");
    assert_eq!(archive.confidence, Confidence::High);
    assert_eq!(archive.affected().next().unwrap().name, "brand-assets.zip");
    let installers = find(stacks, StackKind::Installers, "Installers");
    assert_eq!(installers.confidence, Confidence::High);
    let versions = find(stacks, StackKind::Versions, "DBMS Project Report");
    assert_eq!(versions.destination.as_deref(), Some("Documents/DBMS Project Report"));
    let stale = find(stacks, StackKind::Stale, "Large files");
    assert_eq!(stale.confidence, Confidence::Low);
    let receipts = find(stacks, StackKind::Category, "Receipts");
    assert_eq!(receipts.files.len(), 2);
    find(stacks, StackKind::Category, "Images");
    let everything: Vec<&str> = stacks.iter().flat_map(|s| s.files.iter().map(|f| f.name.as_str())).collect();
    assert!(!everything.contains(&"just-arrived.pdf"), "files still settling must wait");
    assert!(!everything.contains(&"My Stuff"), "user folders are never grouped");

    // --- Move receipts and remember it as a rule.
    let receipts_id = receipts.id.clone();
    let out = neat.apply(&receipts_id, ActionKind::Move, true).unwrap();
    assert!(out.skipped.is_empty(), "{:?}", out.skipped);
    let receipt_dir = d.join("Finance/Receipts");
    assert_eq!(names_in(&receipt_dir), vec![".neat", "Invoice_402-8831127-4432.pdf", "order_invoice_18842.pdf"]);
    assert!(d.join("Finance/.neat").is_file(), "every folder Neat creates is marked");
    assert_eq!(neat.rules().unwrap().len(), 1);
    let move_id = out.entries.iter().find(|e| e.action == "move").unwrap().id.clone();
    let rule_id = out.entries.iter().find(|e| e.action == "rule").unwrap().id.clone();

    // --- Recycle the duplicate copies, then undo it.
    let dupes_id = dupes.id.clone();
    let out = neat.apply(&dupes_id, ActionKind::Recycle, false).unwrap();
    assert!(out.skipped.is_empty(), "{:?}", out.skipped);
    assert!(!d.join("Semester 5 Timetable (1).pdf").exists());
    assert!(d.join("Semester 5 Timetable.pdf").exists(), "the kept copy stays");
    let recycle_id = out.entries[0].id.clone();
    let undo = neat.undo(&[recycle_id]).unwrap();
    assert!(undo.skipped.is_empty(), "{:?}", undo.skipped);
    assert!(d.join("Semester 5 Timetable (1).pdf").exists() && d.join("Semester 5 Timetable (2).pdf").exists());

    // --- Keep the images: they are not suggested again.
    let inbox = neat.scan().unwrap();
    let images_id = find(&inbox.stacks, StackKind::Category, "Images").id.clone();
    neat.apply(&images_id, ActionKind::Keep, false).unwrap();
    let inbox = neat.scan().unwrap();
    assert!(inbox.stacks.iter().all(|s| s.id != images_id), "kept groups stay dismissed");

    // --- The rule files a new invoice by itself on the next scan.
    write(d, "Invoice_555-0000000-1111.pdf", b"invoice three", 10 * 60);
    neat.scan().unwrap();
    assert!(receipt_dir.join("Invoice_555-0000000-1111.pdf").exists());
    let auto = neat.activity(10).unwrap().into_iter().find(|e| e.auto).expect("an automatic move is logged");
    assert_eq!(auto.count, 1);

    // --- Undo everything receipt-related: files return, the rule goes, empty Neat folders are removed.
    let undo = neat.undo(&[auto.id, move_id, rule_id]).unwrap();
    assert!(undo.skipped.is_empty(), "{:?}", undo.skipped);
    assert!(d.join("Invoice_402-8831127-4432.pdf").exists() && d.join("Invoice_555-0000000-1111.pdf").exists());
    assert!(!d.join("Finance").exists(), "empty Neat folders are cleaned up");
    assert!(neat.rules().unwrap().is_empty());
    assert!(d.join("My Stuff/notes.txt").exists(), "user folders are untouched");
}
