//! File name helpers: extensions, copy suffixes, version families, and categories.

use regex::Regex;
use std::sync::LazyLock;

/// Splits "Report (1).PDF" into ("Report (1)", "pdf"). Dotfiles keep their name as the stem.
pub fn split_ext(name: &str) -> (&str, String) {
    match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], name[i + 1..].to_ascii_lowercase()),
        _ => (name, String::new()),
    }
}

// " (1)", " - Copy", " - Copy (2)", " copy" as added by browsers and Explorer.
static COPY_SUFFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(\s*\(\d+\)|\s+-\s+copy|\s+copy)$").unwrap());

// "final", "v2", "v1.3", "draft", "rev4" and similar at the end of a name.
static VERSION_SUFFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[\s_.-]*(final|draft|updated|edited|latest|new|v\d+(\.\d+)*|rev\d+)$").unwrap()
});

static SEPARATORS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[\s_.-]+").unwrap());

/// "Semester 5 Timetable (2)" -> "Semester 5 Timetable".
pub fn strip_copy_suffix(stem: &str) -> &str {
    let mut s = stem;
    while let Some(m) = COPY_SUFFIX.find(s) {
        if m.start() == 0 {
            break;
        }
        s = &s[..m.start()];
    }
    s
}

/// The name shared by every version of a document: "DBMS_Project_Report_final_v2" -> "dbms project report".
pub fn version_key(stem: &str) -> String {
    let mut s = strip_copy_suffix(stem).to_string();
    loop {
        let before = s.len();
        s = strip_copy_suffix(&s).to_string();
        if let Some(m) = VERSION_SUFFIX.find(&s) {
            if m.start() > 0 {
                s.truncate(m.start());
            }
        }
        if s.len() == before {
            break;
        }
    }
    SEPARATORS.replace_all(&s, " ").trim().to_lowercase()
}

/// Names browsers give files with no useful name. Two of these are not versions of each other.
pub fn is_generic(key: &str) -> bool {
    matches!(
        key,
        "download" | "downloads" | "file" | "document" | "image" | "untitled" | "unknown" | "attachment" | "scan" | "invoice"
    )
}

/// "DBMS_Project_Report" -> "DBMS Project Report".
pub fn pretty(stem: &str) -> String {
    SEPARATORS.replace_all(strip_copy_suffix(stem), " ").trim().to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Category {
    Documents,
    Images,
    Videos,
    Audio,
    Archives,
    Installers,
    Code,
}

impl Category {
    pub fn folder(self) -> &'static str {
        match self {
            Category::Documents => "Documents",
            Category::Images => "Images",
            Category::Videos => "Videos",
            Category::Audio => "Audio",
            Category::Archives => "Archives",
            Category::Installers => "Installers",
            Category::Code => "Code",
        }
    }

    /// Plural noun for summaries: "12 documents".
    pub fn noun(self) -> &'static str {
        match self {
            Category::Documents => "documents",
            Category::Images => "images",
            Category::Videos => "videos",
            Category::Audio => "audio files",
            Category::Archives => "archives",
            Category::Installers => "installers",
            Category::Code => "code files",
        }
    }
}

pub fn category(ext: &str) -> Option<Category> {
    use Category::*;
    Some(match ext {
        "pdf" | "doc" | "docx" | "odt" | "rtf" | "txt" | "md" | "xls" | "xlsx" | "ods" | "csv" | "ppt" | "pptx" | "odp"
        | "epub" | "pages" | "numbers" | "key" => Documents,
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "heif" | "bmp" | "tif" | "tiff" | "svg" | "avif" | "raw"
        | "psd" => Images,
        "mp4" | "mkv" | "mov" | "avi" | "webm" | "wmv" | "m4v" => Videos,
        "mp3" | "wav" | "flac" | "m4a" | "aac" | "ogg" | "opus" | "wma" => Audio,
        "zip" | "7z" | "rar" | "tar" | "gz" | "tgz" | "bz2" | "xz" | "zst" | "iso" => Archives,
        "exe" | "msi" | "msix" | "msixbundle" | "appx" => Installers,
        "json" | "xml" | "yaml" | "yml" | "toml" | "js" | "ts" | "py" | "ipynb" | "java" | "c" | "cpp" | "h" | "cs" | "go"
        | "rs" | "sql" | "sh" | "ps1" | "bat" | "html" | "css" => Code,
        _ => return None,
    })
}

/// Extensions browsers use while a download is in progress or after it was abandoned.
pub fn is_partial(ext: &str) -> bool {
    matches!(ext, "crdownload" | "part" | "partial" | "download" | "opdownload" | "tmp")
}
