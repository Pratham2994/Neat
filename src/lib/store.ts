import { useReducer } from "react";
import { mockActivity, mockFolder, mockRules, mockStacks } from "./mock";
import { dayLabel, formatCount, plural } from "./format";
import type { ActionKind, ActivityEntry, FolderStatus, Rule, Stack } from "./types";

export type View = "inbox" | "activity" | "rules";
export type Filter = "all" | "organise" | "cleanup";

interface Removed {
  entryId: string;
  stack: Stack;
  index: number;
}

export interface Toast {
  id: number;
  message: string;
  undoEntryId?: string;
}

export interface State {
  view: View;
  filter: Filter;
  stacks: Stack[];
  selectedId: string | null;
  activity: ActivityEntry[];
  rules: Rule[];
  folder: FolderStatus;
  removed: Removed[];
  toast: Toast | null;
  session: { groups: number; files: number; bytesFreed: number };
  summaryDismissed: boolean;
  scanning: boolean;
}

export type Action =
  | { type: "view"; view: View }
  | { type: "filter"; filter: Filter }
  | { type: "select"; id: string }
  | { type: "step"; delta: number }
  | { type: "resolve"; id: string; action: ActionKind; always?: boolean }
  | { type: "undo"; entryId?: string }
  | { type: "undoAuto" }
  | { type: "dismissToast"; id: number }
  | { type: "dismissSummary" }
  | { type: "toggleRule"; id: string }
  | { type: "scan"; done: boolean };

let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

export function matchesFilter(stack: Stack, filter: Filter): boolean {
  if (filter === "organise") return stack.action === "move";
  if (filter === "cleanup") return stack.action === "recycle";
  return true;
}

export function visibleStacks(state: State): Stack[] {
  return state.stacks.filter((s) => matchesFilter(s, state.filter));
}

// Files the suggested action touches. In a duplicate stack the kept copy is excluded.
export function affectedFiles(stack: Stack) {
  return stack.files.filter((f) => f.fate !== "kept");
}

export function autoToday(state: State): ActivityEntry[] {
  return state.activity.filter((e) => e.auto && !e.undone && dayLabel(e.at) === "Today");
}

function toastMessage(stack: Stack, action: ActionKind): string {
  const n = action === "keep" ? stack.files.length : affectedFiles(stack).length;
  if (action === "recycle") return `Recycled ${plural(n, "file")}`;
  if (action === "move") return `Moved ${plural(n, "file")} to ${stack.destination}`;
  return `Kept ${plural(n, "file")} as they are`;
}

function initialState(): State {
  return {
    view: "inbox",
    filter: "all",
    stacks: mockStacks,
    selectedId: mockStacks[0]?.id ?? null,
    activity: mockActivity,
    rules: mockRules,
    folder: mockFolder,
    removed: [],
    toast: null,
    session: { groups: 0, files: 0, bytesFreed: 0 },
    summaryDismissed: false,
    scanning: false,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, view: action.view };

    case "filter": {
      const next = { ...state, filter: action.filter };
      const visible = visibleStacks(next);
      const stillVisible = visible.some((s) => s.id === state.selectedId);
      return { ...next, selectedId: stillVisible ? state.selectedId : (visible[0]?.id ?? null) };
    }

    case "select":
      return { ...state, selectedId: action.id };

    case "step": {
      const visible = visibleStacks(state);
      if (visible.length === 0) return state;
      const current = visible.findIndex((s) => s.id === state.selectedId);
      const target = Math.min(visible.length - 1, Math.max(0, current + action.delta));
      return { ...state, selectedId: visible[target].id };
    }

    case "resolve": {
      const index = state.stacks.findIndex((s) => s.id === action.id);
      if (index === -1) return state;
      const stack = state.stacks[index];

      // Move the selection to the next visible stack so review keeps flowing.
      const visible = visibleStacks(state);
      const visibleIndex = visible.findIndex((s) => s.id === stack.id);
      const neighbour = visible[visibleIndex + 1] ?? visible[visibleIndex - 1];

      const touched = action.action === "keep" ? stack.files : affectedFiles(stack);
      const bytes = touched.reduce((sum, f) => sum + f.size, 0);
      const now = new Date().toISOString();
      const entry: ActivityEntry = {
        id: uid("a"),
        at: now,
        action: action.action,
        auto: false,
        title: stack.title,
        count: touched.length,
        bytes,
        destination: action.action === "move" ? stack.destination : undefined,
      };

      let rules = state.rules;
      const extra: ActivityEntry[] = [];
      // Policy: only moves can become automatic rules. Recycle always needs review.
      if (action.always && action.action === "move" && stack.destination) {
        const rule: Rule = {
          id: uid("r"),
          when: `Files like “${stack.title}”`,
          then: `Move to ${stack.destination}`,
          auto: true,
          matched: touched.length,
          enabled: true,
        };
        rules = [rule, ...rules];
        extra.push({ id: uid("a"), at: now, action: "rule", auto: false, title: rule.when, count: 0, bytes: 0, destination: stack.destination });
      }

      return {
        ...state,
        stacks: state.stacks.filter((s) => s.id !== stack.id),
        selectedId: neighbour?.id ?? null,
        activity: [...extra, entry, ...state.activity],
        rules,
        removed: [...state.removed, { entryId: entry.id, stack, index }],
        toast: { id: nextId++, message: toastMessage(stack, action.action), undoEntryId: entry.id },
        session: {
          groups: state.session.groups + 1,
          files: state.session.files + touched.length,
          bytesFreed: state.session.bytesFreed + (action.action === "recycle" ? bytes : 0),
        },
      };
    }

    case "undo": {
      const removed = action.entryId
        ? state.removed.find((r) => r.entryId === action.entryId)
        : state.removed[state.removed.length - 1];
      const entry = state.activity.find((e) => e.id === (action.entryId ?? removed?.entryId));
      if (!entry || entry.undone) return state;

      const activity = state.activity.map((e) => (e.id === entry.id ? { ...e, undone: true } : e));
      if (!removed) {
        // An automatic move from before this session: the core would move the files back.
        return { ...state, activity, toast: { id: nextId++, message: `Undid “${entry.title}”` } };
      }

      const stacks = [...state.stacks];
      stacks.splice(Math.min(removed.index, stacks.length), 0, removed.stack);
      const wasRecycle = entry.action === "recycle";
      return {
        ...state,
        stacks,
        activity,
        filter: matchesFilter(removed.stack, state.filter) ? state.filter : "all",
        selectedId: removed.stack.id,
        removed: state.removed.filter((r) => r !== removed),
        toast: { id: nextId++, message: `Restored “${removed.stack.title}”` },
        session: {
          groups: state.session.groups - 1,
          files: state.session.files - entry.count,
          bytesFreed: state.session.bytesFreed - (wasRecycle ? entry.bytes : 0),
        },
      };
    }

    case "undoAuto": {
      const targets = new Set(autoToday(state).map((e) => e.id));
      if (targets.size === 0) return state;
      const files = state.activity.filter((e) => targets.has(e.id)).reduce((n, e) => n + e.count, 0);
      return {
        ...state,
        activity: state.activity.map((e) => (targets.has(e.id) ? { ...e, undone: true } : e)),
        summaryDismissed: true,
        toast: { id: nextId++, message: `Moved ${formatCount(files)} files back` },
      };
    }

    case "dismissToast":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;

    case "dismissSummary":
      return { ...state, summaryDismissed: true };

    case "toggleRule":
      return {
        ...state,
        rules: state.rules.map((r) => (r.id === action.id ? { ...r, enabled: !r.enabled } : r)),
      };

    case "scan":
      return action.done
        ? { ...state, scanning: false, folder: { ...state.folder, lastScan: new Date().toISOString() } }
        : { ...state, scanning: true };
  }
}

export function useNeatStore() {
  return useReducer(reducer, undefined, initialState);
}
