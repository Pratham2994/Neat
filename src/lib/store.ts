import { useReducer } from "react";
import { mockActivity, mockFolder, mockLastSession, mockRules, mockStacks } from "./mock";
import { plural } from "./format";
import type { ActionKind, ActivityEntry, Confidence, FolderStatus, Rule, Stack } from "./types";

export type View = "inbox" | "activity" | "rules";

interface Removed {
  entryId: string;
  stack: Stack;
  index: number;
}

// A short confirmation shown in the status strip. `undo` lists the activity entries it reverts.
export interface Notice {
  id: number;
  message: string;
  undo?: string[];
}

export interface State {
  view: View;
  stacks: Stack[];
  selectedId: string | null;
  expandedId: string | null;
  activity: ActivityEntry[];
  rules: Rule[];
  folder: FolderStatus;
  lastSession: string;
  removed: Removed[];
  notice: Notice | null;
  awayDismissed: boolean;
  scanning: boolean;
}

export type Action =
  | { type: "view"; view: View }
  | { type: "select"; id: string }
  | { type: "step"; delta: number }
  | { type: "toggleExpand"; id?: string }
  | { type: "resolve"; id: string; action: ActionKind; always?: boolean }
  | { type: "resolveSure" }
  | { type: "undo"; entryIds?: string[] }
  | { type: "undoAway" }
  | { type: "dismissNotice"; id: number }
  | { type: "dismissAway" }
  | { type: "toggleRule"; id: string }
  | { type: "scan"; done: boolean };

let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

const confidenceRank: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

// Organising comes before cleanup, then the most certain groups first.
export function orderedStacks(stacks: Stack[]): Stack[] {
  return [...stacks].sort((a, b) => {
    const byAction = Number(a.action !== "move") - Number(b.action !== "move");
    return byAction || confidenceRank[a.confidence] - confidenceRank[b.confidence];
  });
}

// Files the suggested action touches. In a duplicate stack the kept copy is excluded.
export function affectedFiles(stack: Stack) {
  return stack.files.filter((f) => f.fate !== "kept");
}

export function sureStacks(state: State): Stack[] {
  return state.stacks.filter((s) => s.confidence === "high");
}

// Automatic moves since the last session, not yet undone.
export function awayMoves(state: State): ActivityEntry[] {
  const since = new Date(state.lastSession).getTime();
  return state.activity.filter((e) => e.auto && !e.undone && new Date(e.at).getTime() > since);
}

// Groups decided in this session, newest first, with the action taken.
export function doneThisSession(state: State) {
  return [...state.removed].reverse().flatMap((r) => {
    const entry = state.activity.find((e) => e.id === r.entryId);
    return entry ? [{ entry, stack: r.stack }] : [];
  });
}

function describe(stack: Stack, action: ActionKind): string {
  const n = action === "keep" ? stack.files.length : affectedFiles(stack).length;
  if (action === "recycle") return `Recycled ${plural(n, "file")}`;
  if (action === "move") return `Moved ${plural(n, "file")} to ${stack.destination}`;
  return `Kept ${plural(n, "file")} where they are`;
}

function initialState(): State {
  const stacks = orderedStacks(mockStacks);
  return {
    view: "inbox",
    stacks,
    selectedId: stacks[0]?.id ?? null,
    expandedId: null,
    activity: mockActivity,
    rules: mockRules,
    folder: mockFolder,
    lastSession: mockLastSession,
    removed: [],
    notice: null,
    awayDismissed: false,
    scanning: false,
  };
}

// Removes the given stacks, logs one activity entry per stack, and keeps what undo needs.
function resolveStacks(state: State, picks: { stack: Stack; action: ActionKind; always?: boolean }[], message: string): State {
  const now = new Date().toISOString();
  const ids = new Set(picks.map((p) => p.stack.id));
  const entries: ActivityEntry[] = [];
  const removed: Removed[] = [];
  let rules = state.rules;

  for (const { stack, action, always } of picks) {
    const touched = action === "keep" ? stack.files : affectedFiles(stack);
    const entry: ActivityEntry = {
      id: uid("a"),
      at: now,
      action,
      auto: false,
      title: stack.title,
      count: touched.length,
      bytes: touched.reduce((sum, f) => sum + f.size, 0),
      destination: action === "move" ? stack.destination : undefined,
    };
    // Policy: only moves can become automatic rules. Recycling always needs review.
    if (always && action === "move" && stack.destination) {
      const rule: Rule = {
        id: uid("r"),
        when: `Files like “${stack.title}”`,
        then: `Move to ${stack.destination}`,
        auto: true,
        matched: touched.length,
        enabled: true,
      };
      rules = [rule, ...rules];
      entries.push({
        id: uid("a"),
        at: now,
        action: "rule",
        auto: false,
        title: rule.when,
        count: 0,
        bytes: 0,
        destination: stack.destination,
      });
    }
    entries.push(entry);
    removed.push({ entryId: entry.id, stack, index: state.stacks.indexOf(stack) });
  }

  // Keep review flowing: select the next remaining stack after the current one.
  const current = state.stacks.findIndex((s) => s.id === state.selectedId);
  const remaining = state.stacks.filter((s) => !ids.has(s.id));
  const after = state.stacks.slice(current + 1).find((s) => !ids.has(s.id));
  const before = state.stacks
    .slice(0, Math.max(current, 0))
    .reverse()
    .find((s) => !ids.has(s.id));
  const keepSelection = remaining.some((s) => s.id === state.selectedId);

  return {
    ...state,
    stacks: remaining,
    selectedId: keepSelection ? state.selectedId : ((after ?? before ?? remaining[0])?.id ?? null),
    expandedId: state.expandedId && ids.has(state.expandedId) ? null : state.expandedId,
    activity: [...entries.reverse(), ...state.activity],
    rules,
    removed: [...state.removed, ...removed],
    notice: { id: nextId++, message, undo: removed.map((r) => r.entryId) },
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, view: action.view };

    case "select":
      return { ...state, selectedId: action.id };

    case "step": {
      if (state.stacks.length === 0) return state;
      const current = state.stacks.findIndex((s) => s.id === state.selectedId);
      const target = Math.min(state.stacks.length - 1, Math.max(0, current + action.delta));
      return { ...state, selectedId: state.stacks[target].id };
    }

    case "toggleExpand": {
      const id = action.id ?? state.selectedId;
      if (!id) return state;
      return { ...state, selectedId: id, expandedId: state.expandedId === id ? null : id };
    }

    case "resolve": {
      const stack = state.stacks.find((s) => s.id === action.id);
      if (!stack) return state;
      return resolveStacks(state, [{ stack, action: action.action, always: action.always }], describe(stack, action.action));
    }

    case "resolveSure": {
      const sure = sureStacks(state);
      if (sure.length === 0) return state;
      const files = sure.reduce((n, s) => n + affectedFiles(s).length, 0);
      return resolveStacks(
        state,
        sure.map((stack) => ({ stack, action: stack.action })),
        `Applied ${plural(sure.length, "suggestion")} to ${plural(files, "file")}`,
      );
    }

    case "undo": {
      const targets = action.entryIds ?? state.notice?.undo ?? state.removed.slice(-1).map((r) => r.entryId);
      const live = new Set(targets.filter((id) => state.activity.some((e) => e.id === id && !e.undone)));
      if (live.size === 0) return state;

      const activity = state.activity.map((e) => (live.has(e.id) ? { ...e, undone: true } : e));
      const restoring = state.removed.filter((r) => live.has(r.entryId));
      if (restoring.length === 0) {
        // An automatic move from before this session: the core moves the files back.
        const entry = state.activity.find((e) => live.has(e.id));
        return { ...state, activity, notice: { id: nextId++, message: `Undid “${entry?.title}”` } };
      }

      const stacks = [...state.stacks];
      for (const r of [...restoring].sort((a, b) => a.index - b.index)) {
        stacks.splice(Math.min(r.index, stacks.length), 0, r.stack);
      }
      return {
        ...state,
        stacks,
        activity,
        selectedId: restoring[0].stack.id,
        removed: state.removed.filter((r) => !live.has(r.entryId)),
        notice: {
          id: nextId++,
          message:
            restoring.length === 1 ? `Restored “${restoring[0].stack.title}”` : `Restored ${plural(restoring.length, "group")}`,
        },
      };
    }

    case "undoAway": {
      const targets = new Set(awayMoves(state).map((e) => e.id));
      if (targets.size === 0) return state;
      const files = state.activity.filter((e) => targets.has(e.id)).reduce((n, e) => n + e.count, 0);
      return {
        ...state,
        activity: state.activity.map((e) => (targets.has(e.id) ? { ...e, undone: true } : e)),
        awayDismissed: true,
        notice: { id: nextId++, message: `Moved ${plural(files, "file")} back to Downloads` },
      };
    }

    case "dismissNotice":
      return state.notice?.id === action.id ? { ...state, notice: null } : state;

    case "dismissAway":
      return { ...state, awayDismissed: true };

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
