// Shapes shared between the UI and the Rust core.
// The core will return these from Tauri commands; for now src/lib/mock.ts fills them.

export type ActionKind = "move" | "keep" | "recycle";

export type StackKind = "installers" | "duplicates" | "versions" | "archive" | "partial" | "stale" | "receipts" | "images";

export type Confidence = "high" | "medium" | "low";

export interface FileItem {
  id: string;
  name: string;
  size: number; // bytes
  modified: string; // ISO timestamp
  source?: string; // host the file was downloaded from, from Zone.Identifier
  note?: string; // short per-file hint, e.g. "Installed: 124.3"
  // What the suggested action does to this file. Undefined means the whole stack gets the action.
  fate?: "kept" | "affected";
}

export interface Evidence {
  text: string;
  detail?: string;
}

export interface Stack {
  id: string;
  kind: StackKind;
  title: string;
  summary: string;
  action: ActionKind;
  destination?: string; // folder inside Downloads, e.g. "Finance/Receipts"
  confidence: Confidence;
  evidence: Evidence[];
  files: FileItem[];
}

export interface ActivityEntry {
  id: string;
  at: string; // ISO timestamp
  action: ActionKind | "rule";
  auto: boolean;
  title: string;
  count: number;
  bytes: number;
  destination?: string;
  undone?: boolean;
}

export interface Rule {
  id: string;
  when: string; // plain words, e.g. "Downloaded from"
  value?: string; // the typed part, shown in mono, e.g. "hdfcbank.com"
  then: string;
  auto: boolean;
  matched: number;
  enabled: boolean;
}

export interface FolderStatus {
  path: string;
  files: number;
  bytes: number;
  watching: boolean;
  lastScan: string;
}
