use std::time::SystemTime;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

pub fn rfc3339(t: SystemTime) -> String {
    OffsetDateTime::from(t).format(&Rfc3339).unwrap_or_default()
}

pub fn now_rfc3339() -> String {
    rfc3339(SystemTime::now())
}

/// "March 2026"
pub fn month_year(t: SystemTime) -> String {
    let d = OffsetDateTime::from(t);
    format!("{} {}", d.month(), d.year())
}

/// 1024-based, to match File Explorer.
pub fn fmt_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if value >= 100.0 || unit < 2 {
        format!("{value:.0} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

/// "1 file", "3 files", "2 extra copies".
pub fn plural(n: u64, word: &str) -> String {
    if n == 1 {
        return format!("1 {word}");
    }
    let many = match word.strip_suffix('y') {
        Some(stem) if !stem.ends_with(['a', 'e', 'i', 'o', 'u']) => format!("{stem}ies"),
        _ => format!("{word}s"),
    };
    format!("{n} {many}")
}

/// "3 weeks", "2 days", "an hour".
pub fn duration_words(secs: u64) -> String {
    const HOUR: u64 = 3600;
    const DAY: u64 = 24 * HOUR;
    match secs {
        s if s >= 60 * DAY => plural(s / (30 * DAY), "month"),
        s if s >= 14 * DAY => plural(s / (7 * DAY), "week"),
        s if s >= DAY => plural(s / DAY, "day"),
        s if s >= HOUR => plural(s / HOUR, "hour"),
        s => plural((s / 60).max(1), "minute"),
    }
}
