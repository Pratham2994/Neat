import type { ActivityEntry, FolderStatus, Rule, Stack } from "./types";

// Mock data until the Rust core exists. Dates are relative to now so the UI always looks current.

const MB = 1024 * 1024;
const GB = 1024 * MB;

function ago(days: number, hours = 0, minutes = 0): string {
  const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

export const mockStacks: Stack[] = [
  {
    id: "s-installers",
    kind: "installers",
    title: "Installers for apps you already have",
    summary: "Figma, VS Code, Python, Zoom, Discord",
    action: "recycle",
    confidence: "high",
    evidence: [
      { text: "All 5 apps are installed", detail: "Matched against the Windows installed-apps list" },
      { text: "Installed versions are the same or newer" },
      { text: "None of these installers was opened in the last 30 days" },
    ],
    files: [
      { id: "f1", name: "Figma-124.1.2.exe", size: 186 * MB, modified: ago(41), source: "figma.com", note: "Installed: 124.3" },
      {
        id: "f2",
        name: "VSCodeUserSetup-x64-1.104.0.exe",
        size: 102 * MB,
        modified: ago(38),
        source: "code.visualstudio.com",
        note: "Installed: 1.105",
      },
      {
        id: "f3",
        name: "python-3.13.5-amd64.exe",
        size: 28 * MB,
        modified: ago(73),
        source: "python.org",
        note: "Installed: 3.13.7",
      },
      { id: "f4", name: "ZoomInstallerFull.msi", size: 94 * MB, modified: ago(120), source: "zoom.us", note: "Installed: 6.4.1" },
      { id: "f5", name: "DiscordSetup.exe", size: 112 * MB, modified: ago(95), source: "discord.com", note: "Installed" },
    ],
  },
  {
    id: "s-receipts",
    kind: "receipts",
    title: "Receipts and invoices",
    summary: "From amazon.in, flipkart.com, swiggy.com",
    action: "move",
    destination: "Finance/Receipts",
    confidence: "medium",
    evidence: [
      { text: "Downloaded from 3 shopping sites", detail: "amazon.in, flipkart.com, swiggy.com" },
      { text: "Names contain \u201cinvoice\u201d or \u201corder\u201d" },
      { text: "No rule covers these yet", detail: "Tick \u201cAlways move files like these\u201d and Neat files them by itself next time" },
    ],
    files: [
      { id: "f6", name: "Invoice_402-8831127-4432.pdf", size: 0.2 * MB, modified: ago(2), source: "amazon.in" },
      { id: "f7", name: "Invoice_171-2210094-1180.pdf", size: 0.2 * MB, modified: ago(9), source: "amazon.in" },
      { id: "f8", name: "OD331942773514900100.pdf", size: 0.1 * MB, modified: ago(16), source: "flipkart.com" },
      { id: "f9", name: "order_invoice_18842.pdf", size: 0.1 * MB, modified: ago(21), source: "swiggy.com" },
      { id: "f10", name: "Invoice_408-1197302-9921.pdf", size: 0.2 * MB, modified: ago(34), source: "amazon.in" },
      { id: "f11", name: "OD331877102294011200.pdf", size: 0.1 * MB, modified: ago(47), source: "flipkart.com" },
    ],
  },
  {
    id: "s-duplicates",
    kind: "duplicates",
    title: "Same file, downloaded 3 times",
    summary: "Semester 5 Timetable.pdf",
    action: "recycle",
    confidence: "high",
    evidence: [
      { text: "Identical content", detail: "All 3 files have the same hash" },
      { text: "Keeps the copy with the original name" },
    ],
    files: [
      {
        id: "f12",
        name: "Semester 5 Timetable.pdf",
        size: 1.4 * MB,
        modified: ago(58),
        source: "classroom.google.com",
        fate: "kept",
      },
      {
        id: "f13",
        name: "Semester 5 Timetable (1).pdf",
        size: 1.4 * MB,
        modified: ago(44),
        source: "classroom.google.com",
        fate: "affected",
      },
      {
        id: "f14",
        name: "Semester 5 Timetable (2).pdf",
        size: 1.4 * MB,
        modified: ago(12),
        source: "classroom.google.com",
        fate: "affected",
      },
    ],
  },
  {
    id: "s-versions",
    kind: "versions",
    title: "DBMS Project Report, 4 versions",
    summary: "report, report (1), report_final, report_final_v2",
    action: "move",
    destination: "University/DBMS Project",
    confidence: "medium",
    evidence: [
      { text: "Same base name, 4 versions" },
      { text: "Newest is \u201cfinal_v2\u201d", detail: "Older versions stay in the folder, marked as older" },
      { text: "All from classroom.google.com", detail: "Your rule files this site under University" },
    ],
    files: [
      {
        id: "f15",
        name: "DBMS_Project_Report_final_v2.docx",
        size: 2.1 * MB,
        modified: ago(6),
        source: "classroom.google.com",
        note: "Newest",
      },
      { id: "f16", name: "DBMS_Project_Report_final.docx", size: 2.0 * MB, modified: ago(8), source: "classroom.google.com" },
      { id: "f17", name: "DBMS_Project_Report (1).docx", size: 1.7 * MB, modified: ago(15), source: "classroom.google.com" },
      { id: "f18", name: "DBMS_Project_Report.docx", size: 1.6 * MB, modified: ago(19), source: "classroom.google.com" },
    ],
  },
  {
    id: "s-archive",
    kind: "archive",
    title: "Archive already extracted",
    summary: "brand-assets.zip and its folder",
    action: "recycle",
    confidence: "high",
    evidence: [
      { text: "All 214 files in the zip are in the folder" },
      { text: "Names, sizes and checksums match" },
      { text: "Keeps the extracted folder" },
    ],
    files: [
      { id: "f19", name: "brand-assets.zip", size: 342 * MB, modified: ago(26), source: "drive.google.com", fate: "affected" },
      { id: "f20", name: "brand-assets", size: 351 * MB, modified: ago(26), note: "Folder \u00b7 214 files", fate: "kept" },
    ],
  },
  {
    id: "s-images",
    kind: "images",
    title: "Wallpapers and images",
    summary: "4 images from unsplash.com and pexels.com",
    action: "move",
    destination: "Images",
    confidence: "medium",
    evidence: [{ text: "All files are images" }, { text: "Downloaded from stock photo sites" }],
    files: [
      { id: "f21", name: "pawel-czerwinski-6lQDFGOB1iw-unsplash.jpg", size: 4.2 * MB, modified: ago(3), source: "unsplash.com" },
      { id: "f22", name: "pexels-eberhardgross-1062249.jpg", size: 6.8 * MB, modified: ago(11), source: "pexels.com" },
      { id: "f23", name: "casey-horner-4rDCa5hBlCs-unsplash.jpg", size: 3.9 * MB, modified: ago(18), source: "unsplash.com" },
      { id: "f24", name: "pexels-pixabay-417074.jpg", size: 5.1 * MB, modified: ago(29), source: "pexels.com" },
    ],
  },
  {
    id: "s-partial",
    kind: "partial",
    title: "Unfinished downloads",
    summary: "2 downloads the browser never completed",
    action: "recycle",
    confidence: "high",
    evidence: [{ text: "The browser stopped these downloads" }, { text: "No change in 3 weeks" }],
    files: [
      { id: "f25", name: "Unconfirmed 481223.crdownload", size: 734 * MB, modified: ago(22) },
      { id: "f26", name: "dataset-full.tar.gz.crdownload", size: 1.3 * GB, modified: ago(25) },
    ],
  },
  {
    id: "s-stale",
    kind: "stale",
    title: "Large files not opened in 6 months",
    summary: "ubuntu-24.04.3-desktop-amd64.iso and 2 videos",
    action: "recycle",
    confidence: "low",
    evidence: [
      { text: "Together they take 8.9 GB" },
      { text: "Not opened since March" },
      { text: "Low confidence", detail: "Size and age alone do not prove a file is junk" },
    ],
    files: [
      { id: "f27", name: "ubuntu-24.04.3-desktop-amd64.iso", size: 6.1 * GB, modified: ago(190), source: "releases.ubuntu.com" },
      { id: "f28", name: "lecture-recording-week3.mp4", size: 1.6 * GB, modified: ago(205), source: "drive.google.com" },
      { id: "f29", name: "screen-2026-03-02.mp4", size: 1.2 * GB, modified: ago(207) },
    ],
  },
];

export const mockActivity: ActivityEntry[] = [
  {
    id: "a1",
    at: ago(0, 0, 42),
    action: "move",
    auto: true,
    title: "8 bank statements",
    count: 8,
    bytes: 3 * MB,
    destination: "Finance/Bank",
  },
  {
    id: "a2",
    at: ago(0, 2, 5),
    action: "move",
    auto: true,
    title: "4 screenshots",
    count: 4,
    bytes: 9 * MB,
    destination: "Images/Screenshots",
  },
  { id: "a3", at: ago(1, 3), action: "recycle", auto: false, title: "Old Chrome installers", count: 3, bytes: 410 * MB },
  {
    id: "a4",
    at: ago(1, 5),
    action: "move",
    auto: true,
    title: "Assignment 4 brief.pdf",
    count: 1,
    bytes: 1 * MB,
    destination: "University",
  },
  {
    id: "a5",
    at: ago(3, 1),
    action: "rule",
    auto: false,
    title: "Files from hdfcbank.com",
    count: 0,
    bytes: 0,
    destination: "Finance/Bank",
  },
  {
    id: "a6",
    at: ago(3, 1, 2),
    action: "move",
    auto: false,
    title: "HDFC statements",
    count: 14,
    bytes: 6 * MB,
    destination: "Finance/Bank",
  },
];

export const mockRules: Rule[] = [
  {
    id: "r1",
    when: "Downloaded from",
    value: "hdfcbank.com",
    then: "Move to Finance/Bank",
    auto: true,
    matched: 22,
    enabled: true,
  },
  {
    id: "r2",
    when: "Downloaded from",
    value: "classroom.google.com",
    then: "Move to University",
    auto: true,
    matched: 117,
    enabled: true,
  },
  {
    id: "r3",
    when: "Name matches",
    value: "Screenshot*.png",
    then: "Move to Images/Screenshots",
    auto: true,
    matched: 64,
    enabled: true,
  },
  { id: "r4", when: "Name matches", value: "*.torrent", then: "Never suggest", auto: false, matched: 9, enabled: true },
];

// When the user last opened Neat on this machine.
export const mockLastSession = ago(3, 2);

export const mockFolder: FolderStatus = {
  path: "C:\\Users\\Pratham\\Downloads",
  files: 1284,
  bytes: 18.4 * GB,
  watching: true,
  lastScan: ago(0, 0, 2),
};
