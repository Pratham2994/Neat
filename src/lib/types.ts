// Shapes shared between the UI and the Rust core. They match core/src/model.rs and the
// commands in src-tauri/src/lib.rs; src/lib/mockBackend.ts returns the same shapes in a browser.

export type ActionKind = "move" | "keep" | "recycle";

export type StackKind = "installers" | "duplicates" | "versions" | "archive" | "partial" | "stale" | "category";

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
  canLearn: boolean; // whether "Always move files like these" can become a rule
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
  value: string; // the typed part, shown in mono, e.g. "hdfcbank.com"
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

export interface Inbox {
  stacks: Stack[];
  folder: FolderStatus;
  lastSession?: string; // when Neat was last opened on this machine
}

export interface Skipped {
  path: string;
  reason: string;
}

// What an apply or undo did. `skipped` lists files that were left alone, with a plain reason.
export interface Outcome {
  entries: ActivityEntry[];
  skipped: Skipped[];
}

export interface Settings {
  autoRules: boolean;
  startAtLogin: boolean;
  folder: string;
  testFolder: boolean;
  version: string;
}
