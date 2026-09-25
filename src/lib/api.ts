import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { mockBackend } from "./mockBackend";
import type { ActionKind, ActivityEntry, Inbox, Outcome, Rule, Settings, UpdateInfo } from "./types";

// Everything the UI asks of Neat. In the desktop app these are Tauri commands backed by the Rust core
// (src-tauri/src/lib.rs); in a plain browser the mock backend answers with sample data.
export interface Backend {
  scan(): Promise<Inbox>;
  apply(stackId: string, action: ActionKind, always: boolean): Promise<Outcome>;
  applySuggested(stackIds: string[]): Promise<Outcome>;
  undo(activityIds: string[]): Promise<Outcome>;
  activity(limit?: number): Promise<ActivityEntry[]>;
  rules(): Promise<Rule[]>;
  setRuleEnabled(id: string, enabled: boolean): Promise<void>;
  settings(): Promise<Settings>;
  setAutoRules(on: boolean): Promise<void>;
  setStartAtLogin(on: boolean): Promise<void>;
  // Opens the folder picker; null when cancelled.
  pickFolder(): Promise<string | null>;
  // Points Neat at `path`, or back at Downloads when null.
  setFolder(path: string | null): Promise<Settings>;
  updateStatus(): Promise<UpdateInfo | null>;
  checkForUpdate(): Promise<UpdateInfo | null>;
  // Closes Neat and opens the new version.
  installUpdate(): Promise<void>;
  // The watcher rescans after changes in the folder and sends the new inbox.
  onInboxChanged(handler: (inbox: Inbox) => void): Promise<() => void>;
  onUpdateReady(handler: (update: UpdateInfo) => void): Promise<() => void>;
}

const tauriBackend: Backend = {
  scan: () => invoke("scan"),
  apply: (stackId, action, always) => invoke("apply", { stackId, action, always }),
  applySuggested: (stackIds) => invoke("apply_suggested", { stackIds }),
  undo: (activityIds) => invoke("undo", { activityIds }),
  activity: (limit) => invoke("activity", { limit }),
  rules: () => invoke("rules"),
  setRuleEnabled: (id, enabled) => invoke("set_rule_enabled", { id, enabled }),
  settings: () => invoke("settings"),
  setAutoRules: (on) => invoke("set_auto_rules", { on }),
  setStartAtLogin: (on) => invoke("set_start_at_login", { on }),
  pickFolder: () => invoke("pick_folder"),
  setFolder: (path) => invoke("set_folder", { path }),
  updateStatus: () => invoke("update_status"),
  checkForUpdate: () => invoke("check_for_update"),
  installUpdate: () => invoke("install_update"),
  onInboxChanged: (handler) => listen<Inbox>("inbox-changed", (event) => handler(event.payload)),
  onUpdateReady: (handler) => listen<UpdateInfo>("update-ready", (event) => handler(event.payload)),
};

export const backend: Backend = isTauri() ? tauriBackend : mockBackend;

// Command errors arrive as plain strings from Rust; anything else is a bug worth showing as-is.
export function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : "Something went wrong.";
}
