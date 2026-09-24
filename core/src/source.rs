//! Where a download came from, read from the `Zone.Identifier` stream that browsers attach on Windows.
//!
//! Chrome and Edge write `HostUrl` and `ReferrerUrl`. Firefox writes only `ZoneId`
//! (https://bugzilla.mozilla.org/show_bug.cgi?id=1433179).

use std::path::Path;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Source {
    pub zone_id: Option<u32>,
    pub host_url: Option<String>,
    pub referrer_url: Option<String>,
}

impl Source {
    /// The site the file came from, without scheme or "www.", e.g. "amazon.in".
    /// Blob and data URLs fall back to the referrer.
    pub fn host(&self) -> Option<String> {
        [&self.host_url, &self.referrer_url]
            .into_iter()
            .flatten()
            .find_map(|url| host_of(url))
    }
}

pub fn host_of(url: &str) -> Option<String> {
    let rest = url.split_once("://").map(|(_, r)| r)?;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.rsplit_once('@').map_or(host, |(_, h)| h);
    let host = host.split(':').next()?.to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();
    (!host.is_empty() && host.contains('.')).then_some(host)
}

/// Parses the INI text of a Zone.Identifier stream.
pub fn parse(text: &str) -> Source {
    let mut source = Source::default();
    for line in text.trim_start_matches('\u{feff}').lines() {
        let Some((key, value)) = line.split_once('=') else { continue };
        let value = value.trim().to_string();
        match key.trim() {
            "ZoneId" => source.zone_id = value.parse().ok(),
            "HostUrl" => source.host_url = Some(value),
            "ReferrerUrl" => source.referrer_url = Some(value),
            _ => {}
        }
    }
    source
}

#[cfg(windows)]
pub fn read(path: &Path) -> Option<Source> {
    let mut stream = path.as_os_str().to_owned();
    stream.push(":Zone.Identifier");
    let bytes = std::fs::read(stream).ok()?;
    Some(parse(&String::from_utf8_lossy(&bytes)))
}

#[cfg(not(windows))]
pub fn read(_path: &Path) -> Option<Source> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_chrome_stream() {
        let s = parse("[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://www.amazon.in/gp/your-account/order-details\r\nHostUrl=https://m.media-amazon.com/invoice.pdf\r\n");
        assert_eq!(s.zone_id, Some(3));
        assert_eq!(s.host().as_deref(), Some("m.media-amazon.com"));
    }

    #[test]
    fn blob_url_falls_back_to_referrer() {
        let s = parse("[ZoneTransfer]\nZoneId=3\nReferrerUrl=https://classroom.google.com/c/abc\nHostUrl=blob:https://x\n");
        assert_eq!(s.host().as_deref(), Some("classroom.google.com"));
    }
}
