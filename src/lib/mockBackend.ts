import type { Backend } from "./api";
import { mockActivity, mockFolder, mockLastSession, mockRules, mockStacks } from "./mock";
import type { ActionKind, ActivityEntry, Inbox, Outcome, Rule, Settings, Stack } from "./types";

// An in-memory stand-in for the Rust core, so the UI runs in a browser (`npm run dev`) with the same
// behaviour: decisions remove groups and log entries, undo restores them, kept groups stay dismissed.

const LATENCY_MS = 120;
const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS));

let stacks: Stack[] = structuredClone(mockStacks);
let activity: ActivityEntry[] = structuredClone(mockActivity);
let rules: Rule[] = structuredClone(mockRules);
const settings: Settings = {
  autoRules: true,
  startAtLogin: false,
  folder: mockFolder.path,
  homeFolder: mockFolder.path,
  customFolder: false,
  testFolder: false,
  version: "0.1.0 (browser preview)",
  updates: true,
};
// What undo needs: the stack an entry removed, or the rule it created.
const undoable = new Map<string, { stack?: Stack; ruleId?: string }>();
let nextId = 100;

function affected(stack: Stack) {
  return stack.files.filter((f) => f.fate !== "kept");
}

function decide(stack: Stack, action: ActionKind, always: boolean): ActivityEntry[] {
  const now = new Date().toISOString();
  const touched = action === "keep" ? stack.files : affected(stack);
  const entry: ActivityEntry = {
    id: String(nextId++),
    at: now,
    action,
    auto: false,
    title: stack.title,
    count: touched.length,
    bytes: touched.reduce((n, f) => n + f.size, 0),
    destination: action === "move" ? stack.destination : undefined,
    undone: false,
  };
  const entries = [entry];
  undoable.set(entry.id, { stack });
  if (always && action === "move" && stack.destination) {
    const rule: Rule = {
      id: String(nextId++),
      when: "Files like",
      value: stack.title,
      then: `Move to ${stack.destination}`,
      auto: true,
      matched: touched.length,
      enabled: true,
    };
    rules = [...rules, rule];
    const ruleEntry: ActivityEntry = {
      id: String(nextId++),
      at: now,
      action: "rule",
      auto: false,
      title: `Files like “${stack.title}”`,
      count: 0,
      bytes: 0,
      destination: stack.destination,
      undone: false,
    };
    undoable.set(ruleEntry.id, { ruleId: rule.id });
    entries.unshift(ruleEntry);
  }
  stacks = stacks.filter((s) => s.id !== stack.id);
  activity = [...entries.slice().reverse(), ...activity];
  return entries;
}

function inbox(): Inbox {
  return { stacks, folder: { ...mockFolder, watching: true, lastScan: new Date().toISOString() }, lastSession: mockLastSession };
}

export const mockBackend: Backend = {
  scan: () => wait(inbox()),

  apply(stackId, action, always) {
    const stack = stacks.find((s) => s.id === stackId);
    if (!stack) return Promise.reject("That group changed since the last scan. Scan again.");
    return wait<Outcome>({ entries: decide(stack, action, always), skipped: [] });
  },

  applySuggested(stackIds) {
    const entries = stackIds.flatMap((id) => {
      const stack = stacks.find((s) => s.id === id);
      return stack ? decide(stack, stack.action, false) : [];
    });
    return wait<Outcome>({ entries, skipped: [] });
  },

  undo(activityIds) {
    const entries: ActivityEntry[] = [];
    for (const id of activityIds) {
      const entry = activity.find((e) => e.id === id);
      if (!entry || entry.undone) continue;
      entry.undone = true;
      const info = undoable.get(id);
      if (info?.stack) stacks = [...stacks, info.stack];
      if (info?.ruleId) rules = rules.filter((r) => r.id !== info.ruleId);
      entries.push(entry);
    }
    return wait<Outcome>({ entries, skipped: [] });
  },

  activity: () => wait(activity),
  rules: () => wait(rules),

  setRuleEnabled(id, enabled) {
    rules = rules.map((r) => (r.id === id ? { ...r, enabled } : r));
    return wait(undefined);
  },

  settings: () => wait(settings),

  setAutoRules(on) {
    settings.autoRules = on;
    return wait(undefined);
  },

  setStartAtLogin(on) {
    settings.startAtLogin = on;
    return wait(undefined);
  },

  // The browser has no folder picker; pretend the user chose this one.
  pickFolder: () => wait("C:\\Users\\Pratham\\Desktop\\Inbox"),

  setFolder(path) {
    settings.folder = path ?? settings.homeFolder;
    settings.customFolder = path !== null && path !== settings.homeFolder;
    return wait(settings);
  },

  updateStatus: () => wait(null),
  checkForUpdate: () => wait(null),
  installUpdate: () => Promise.reject("The browser preview cannot update itself."),

  // The browser has no watcher and no updater.
  onInboxChanged: () => Promise.resolve(() => {}),
  onUpdateReady: () => Promise.resolve(() => {}),
};
