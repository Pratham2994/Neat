//! Matches installer files against the apps installed on this computer.

use regex::Regex;
use std::cmp::Ordering;
use std::path::Path;
use std::sync::LazyLock;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledApp {
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
}

#[derive(Debug, Clone)]
pub struct InstallerInfo {
    pub product: String,
    pub version: Option<String>,
}

pub struct Match<'a> {
    pub app: &'a InstalledApp,
    pub installed_is_same_or_newer: bool,
    pub installed_is_older: bool,
}

/// Product name and version, from the file's version resource when it has one, else from its name.
pub fn describe(path: &Path, stem: &str) -> InstallerInfo {
    pe_info(path).unwrap_or_else(|| from_file_name(stem))
}

fn pe_info(path: &Path) -> Option<InstallerInfo> {
    use pelite::FileMap;
    let map = FileMap::open(path).ok()?;
    let file = pelite::PeFile::from_bytes(&map).ok()?;
    let info = file.resources().ok()?.version_info().ok()?;
    let lang = *info.translation().first()?;
    let product = info
        .value(lang, "ProductName")
        .or_else(|| info.value(lang, "FileDescription"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())?;
    let version = info.value(lang, "ProductVersion").map(|s| s.trim().to_string()).or_else(|| {
        info.fixed().map(|f| {
            let v = f.dwProductVersion;
            format!("{}.{}.{}.{}", v.Major, v.Minor, v.Patch, v.Build)
        })
    });
    Some(InstallerInfo { product, version })
}

static VERSION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\d+(\.\d+)+").unwrap());
// A version in a file name, with the "v" some projects put in front: "node-v24.21.0-x64".
static NAME_VERSION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)(?:\bv)?(\d+(?:\.\d+)+)").unwrap());
static CAMEL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"([a-z])([A-Z])").unwrap());

// Words that describe the installer, not the product.
const NOISE: &[&str] = &[
    "setup", "installer", "install", "x64", "x86", "amd64", "arm64", "win64", "win32", "win", "windows", "user", "system",
    "full", "offline", "online", "latest", "stable", "release", "64bit", "32bit", "64", "32",
];

fn from_file_name(stem: &str) -> InstallerInfo {
    // "Discord Setup (1)" is Discord, not a product called "discord 1".
    let stem = crate::names::strip_copy_suffix(stem);
    let version = NAME_VERSION.captures(stem).map(|c| c[1].to_string());
    let without_version = NAME_VERSION.replace_all(stem, " ");
    let spaced = CAMEL.replace_all(&without_version, "$1 $2");
    let product = tokens(&spaced).into_iter().filter(|t| !NOISE.contains(&t.as_str())).collect::<Vec<_>>().join(" ");
    InstallerInfo { product, version }
}

fn tokens(s: &str) -> Vec<String> {
    s.split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty()).map(str::to_lowercase).collect()
}

// Short names that installers use for products whose installed name is spelled out.
const ALIASES: &[(&str, &str)] = &[("vscode", "visual studio code"), ("vs code", "visual studio code")];

fn expand(product: &str) -> String {
    let lower = product.to_lowercase();
    ALIASES.iter().find(|(short, _)| lower == *short).map_or(lower, |(_, long)| long.to_string())
}

fn names_match(product: &str, installed: &str) -> bool {
    let wanted = tokens(&expand(product));
    let wanted: Vec<&String> = wanted.iter().filter(|t| !NOISE.contains(&t.as_str())).collect();
    if wanted.is_empty() {
        return false;
    }
    let have = tokens(installed);
    wanted.iter().all(|w| have.contains(w)) || have.concat() == wanted.iter().map(|s| s.as_str()).collect::<String>()
}

fn parse_version(v: &str) -> Vec<u64> {
    VERSION
        .find(v)
        .map(|m| m.as_str().split('.').filter_map(|p| p.parse().ok()).collect())
        .unwrap_or_default()
}

fn compare(a: &[u64], b: &[u64]) -> Ordering {
    for i in 0..a.len().max(b.len()) {
        match a.get(i).unwrap_or(&0).cmp(b.get(i).unwrap_or(&0)) {
            Ordering::Equal => continue,
            other => return other,
        }
    }
    Ordering::Equal
}

pub fn find_installed<'a>(info: &InstallerInfo, apps: &'a [InstalledApp]) -> Option<Match<'a>> {
    let app = apps.iter().find(|a| names_match(&info.product, &a.name))?;
    let (installed, wanted) = (app.version.as_deref().map(parse_version), info.version.as_deref().map(parse_version));
    let order = match (installed, wanted) {
        (Some(i), Some(w)) if !i.is_empty() && !w.is_empty() => Some(compare(&i, &w)),
        _ => None,
    };
    Some(Match {
        app,
        installed_is_same_or_newer: matches!(order, Some(Ordering::Equal | Ordering::Greater)),
        installed_is_older: order == Some(Ordering::Less),
    })
}

/// Apps listed under Settings > Apps, read from the registry's Uninstall keys.
#[cfg(windows)]
pub fn installed_apps() -> Vec<InstalledApp> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    const PATHS: &[(winreg::HKEY, &str)] = &[
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    let mut apps = Vec::new();
    for (hive, path) in PATHS {
        let Ok(root) = RegKey::predef(*hive).open_subkey(path) else { continue };
        for key in root.enum_keys().flatten() {
            let Ok(entry) = root.open_subkey(&key) else { continue };
            let Ok(name) = entry.get_value::<String, _>("DisplayName") else { continue };
            apps.push(InstalledApp {
                name,
                version: entry.get_value("DisplayVersion").ok(),
                publisher: entry.get_value("Publisher").ok(),
            });
        }
    }
    apps
}

#[cfg(not(windows))]
pub fn installed_apps() -> Vec<InstalledApp> {
    Vec::new()
}
