import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { backend, errorText } from "./api";
import { plural } from "./format";
import type { ActionKind, ActivityEntry, Confidence, FolderStatus, Inbox, Outcome, Rule, Settings, Stack } from "./types";

export type View = "inbox" | "activity" | "rules" | "settings";

// A short message in the status strip. `undo` lists the activity entries it reverts.
export interface Notice {
  id: number;
  message: string;
  tone: "done" | "error";
  undo?: string[];
}

export interface State {
  loading: boolean;
  view: View;
  stacks: Stack[];
  selectedId: string | null;
  expandedId: string | null;
  activity: ActivityEntry[];
  rules: Rule[];
  settings: Settings | null;
  folder: FolderStatus | null;
  lastSession: string | null;
  // Groups removed on screen while the core applies the decision. Restored if it fails.
  pending: Record<string, { stack: Stack; index: number }>;
  // Groups decided in this session, by the activity entry that records them. Feeds "Done this session".
  decided: Record<string, Stack>;
  notice: Notice | null;
  awayDismissed: boolean;
  scanning: boolean;
}

type Action =
  | { type: "view"; view: View }
  | { type: "select"; id: string }
  | { type: "step"; delta: number }
  | { type: "toggleExpand"; id?: string }
  | { type: "inbox"; inbox: Inbox }
  | { type: "activity"; activity: ActivityEntry[] }
  | { type: "rules"; rules: Rule[] }
  | { type: "settings"; settings: Settings }
  | { type: "scanning"; on: boolean }
  | { type: "removing"; ids: string[] }
  | { type: "applied"; ids: string[]; outcome: Outcome; message: string }
  | { type: "failed"; ids: string[]; message: string }
  | { type: "undone"; outcome: Outcome; message: string }
  | { type: "notice"; message: string; tone: Notice["tone"] }
  | { type: "dismissNotice"; id: number }
  | { type: "dismissAway" };

let noticeId = 1;

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

// Automatic moves since the previous session, not yet undone.
export function awayMoves(state: State): ActivityEntry[] {
  if (!state.lastSession) return [];
  const since = new Date(state.lastSession).getTime();
  return state.activity.filter((e) => e.auto && !e.undone && new Date(e.at).getTime() > since);
}

// Decisions made in this session, newest first.
export function doneThisSession(state: State): { entry: ActivityEntry; stack?: Stack }[] {
  return state.activity
    .filter((e) => e.id in state.decided && !e.undone && e.action !== "rule")
    .map((entry) => ({ entry, stack: state.decided[entry.id] }));
}

// Newest first by time; ids break ties between entries written in the same instant.
function byNewest(entries: ActivityEntry[]): ActivityEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || Number(b.id) - Number(a.id));
}

// Replaces entries that already exist and adds new ones, newest first.
function mergeActivity(current: ActivityEntry[], incoming: ActivityEntry[]): ActivityEntry[] {
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return byNewest([...byId.values()]);
}

// Keeps the selection on the same group, or on the row that took its place.
function reselect(previous: Stack[], next: Stack[], selectedId: string | null): string | null {
  if (selectedId && next.some((s) => s.id === selectedId)) return selectedId;
  const index = Math.max(
    0,
    previous.findIndex((s) => s.id === selectedId),
  );
  return next[Math.min(index, next.length - 1)]?.id ?? null;
}

function skippedText(outcome: Outcome): string {
  const n = outcome.skipped.length;
  if (n === 0) return "";
  const reasons = [...new Set(outcome.skipped.map((s) => s.reason.toLowerCase()))];
  return ` ${plural(n, "file")} left alone: ${reasons.join("; ")}.`;
}

function initialState(): State {
  return {
    loading: true,
    view: "inbox",
    stacks: [],
    selectedId: null,
    expandedId: null,
    activity: [],
    rules: [],
    settings: null,
    folder: null,
    lastSession: null,
    pending: {},
    decided: {},
    notice: null,
    awayDismissed: false,
    scanning: false,
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

    case "inbox": {
      // Groups still being applied stay hidden even if a background scan still lists them.
      const stacks = orderedStacks(action.inbox.stacks.filter((s) => !(s.id in state.pending)));
      return {
        ...state,
        loading: false,
        stacks,
        folder: action.inbox.folder,
        lastSession: action.inbox.lastSession ?? null,
        selectedId: reselect(state.stacks, stacks, state.selectedId),
        expandedId: stacks.some((s) => s.id === state.expandedId) ? state.expandedId : null,
      };
    }

    case "activity":
      return { ...state, activity: byNewest(action.activity) };

    case "rules":
      return { ...state, rules: action.rules };

    case "settings":
      return { ...state, settings: action.settings };

    case "scanning":
      return { ...state, scanning: action.on };

    case "removing": {
      const ids = new Set(action.ids);
      const pending = { ...state.pending };
      state.stacks.forEach((stack, index) => {
        if (ids.has(stack.id)) pending[stack.id] = { stack, index };
      });
      const stacks = state.stacks.filter((s) => !ids.has(s.id));
      // Keep review flowing: the next row takes the selection.
      const current = state.stacks.findIndex((s) => s.id === state.selectedId);
      const next =
        state.stacks.slice(current + 1).find((s) => !ids.has(s.id)) ??
        [...state.stacks.slice(0, Math.max(current, 0))].reverse().find((s) => !ids.has(s.id));
      return {
        ...state,
        stacks,
        pending,
        selectedId: ids.has(state.selectedId ?? "") ? (next?.id ?? null) : state.selectedId,
        expandedId: ids.has(state.expandedId ?? "") ? null : state.expandedId,
      };
    }

    case "applied": {
      const pending = { ...state.pending };
      const decided = { ...state.decided };
      // Entries come back in the order the groups were applied; rule entries sit beside their move.
      const decisions = action.outcome.entries.filter((e) => e.action !== "rule");
      action.ids.forEach((id, i) => {
        const entry = decisions[i];
        if (entry && pending[id]) decided[entry.id] = pending[id].stack;
        delete pending[id];
      });
      return {
        ...state,
        pending,
        decided,
        activity: mergeActivity(state.activity, action.outcome.entries),
        notice: {
          id: noticeId++,
          message: action.message + skippedText(action.outcome),
          tone: "done",
          undo: action.outcome.entries.map((e) => e.id),
        },
      };
    }

    case "failed": {
      const pending = { ...state.pending };
      const stacks = [...state.stacks];
      for (const id of action.ids) {
        const item = pending[id];
        if (!item) continue;
        stacks.splice(Math.min(item.index, stacks.length), 0, item.stack);
        delete pending[id];
      }
      return { ...state, stacks, pending, notice: { id: noticeId++, message: action.message, tone: "error" } };
    }

    case "undone":
      return {
        ...state,
        activity: mergeActivity(state.activity, action.outcome.entries),
        notice: { id: noticeId++, message: action.message + skippedText(action.outcome), tone: "done" },
      };

    case "notice":
      return { ...state, notice: { id: noticeId++, message: action.message, tone: action.tone } };

    case "dismissNotice":
      return state.notice?.id === action.id ? { ...state, notice: null } : state;

    case "dismissAway":
      return { ...state, awayDismissed: true };
  }
}

function describe(stack: Stack, action: ActionKind): string {
  const n = action === "keep" ? stack.files.length : affectedFiles(stack).length;
  if (action === "recycle") return `Recycled ${plural(n, "file")}`;
  if (action === "move") return `Moved ${plural(n, "file")} to ${stack.destination}`;
  return `Kept ${plural(n, "file")} where they are`;
}

// State plus the actions that talk to the core. Every change on disk goes through `backend`.
export function useNeat() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshInbox = useCallback(async (): Promise<Inbox | null> => {
    dispatch({ type: "scanning", on: true });
    try {
      const inbox = await backend.scan();
      dispatch({ type: "inbox", inbox });
      return inbox;
    } catch (error) {
      dispatch({ type: "notice", message: `Could not scan Downloads: ${errorText(error)}`, tone: "error" });
      return null;
    } finally {
      dispatch({ type: "scanning", on: false });
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      dispatch({ type: "activity", activity: await backend.activity(200) });
    } catch {
      // The inbox is what matters; the log catches up on the next refresh.
    }
  }, []);

  const refreshRules = useCallback(async () => {
    try {
      dispatch({ type: "rules", rules: await backend.rules() });
    } catch {
      // As above.
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      await refreshInbox();
      await Promise.all([refreshActivity(), refreshRules()]);
      try {
        dispatch({ type: "settings", settings: await backend.settings() });
      } catch {
        // Settings show as unavailable until the next open.
      }
      const stop = await backend.onInboxChanged((inbox) => {
        dispatch({ type: "inbox", inbox });
        // A background scan may have run rules, so the log may have new automatic moves.
        void refreshActivity();
      });
      if (cancelled) stop();
      else unlisten = stop;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshInbox, refreshActivity, refreshRules]);

  const resolve = useCallback(
    async (id: string, action: ActionKind, always = false) => {
      const stack = stateRef.current.stacks.find((s) => s.id === id);
      if (!stack) return;
      dispatch({ type: "removing", ids: [id] });
      try {
        const outcome = await backend.apply(id, action, always);
        dispatch({ type: "applied", ids: [id], outcome, message: describe(stack, action) });
        if (always) void refreshRules();
        if (outcome.skipped.length > 0) void refreshInbox();
      } catch (error) {
        dispatch({ type: "failed", ids: [id], message: errorText(error) });
        void refreshInbox();
      }
    },
    [refreshInbox, refreshRules],
  );

  const resolveSure = useCallback(async () => {
    const sure = sureStacks(stateRef.current);
    if (sure.length === 0) return;
    const ids = sure.map((s) => s.id);
    const files = sure.reduce((n, s) => n + affectedFiles(s).length, 0);
    dispatch({ type: "removing", ids });
    try {
      const outcome = await backend.applySuggested(ids);
      const message = `Applied ${plural(sure.length, "suggestion")} to ${plural(files, "file")}`;
      dispatch({ type: "applied", ids, outcome, message });
      if (outcome.skipped.length > 0) void refreshInbox();
    } catch (error) {
      dispatch({ type: "failed", ids, message: errorText(error) });
      void refreshInbox();
    }
  }, [refreshInbox]);

  const undo = useCallback(
    async (entryIds?: string[]) => {
      const current = stateRef.current;
      const targets = entryIds ?? current.notice?.undo ?? doneThisSession(current)[0]?.entry.id;
      const ids = (Array.isArray(targets) ? targets : targets ? [targets] : []).filter((id) =>
        current.activity.some((e) => e.id === id && !e.undone),
      );
      if (ids.length === 0) return;
      try {
        const outcome = await backend.undo(ids);
        const restored = outcome.entries.filter((e) => e.action !== "rule");
        const message =
          restored.length === 1
            ? `Undid “${restored[0].title}”`
            : `Undid ${plural(restored.length || outcome.entries.length, "change")}`;
        dispatch({ type: "undone", outcome, message });
        // Restored files come back as groups on the next scan; a removed rule leaves the rules list.
        const [inbox] = await Promise.all([refreshInbox(), refreshRules()]);
        // Put the selection on the group that came back, so it can be decided again straight away.
        const back = inbox?.stacks.find((s) => restored.some((e) => e.title === s.title));
        if (back) dispatch({ type: "select", id: back.id });
      } catch (error) {
        dispatch({ type: "notice", message: errorText(error), tone: "error" });
      }
    },
    [refreshInbox, refreshRules],
  );

  const undoAway = useCallback(async () => {
    const away = awayMoves(stateRef.current);
    if (away.length === 0) return;
    dispatch({ type: "dismissAway" });
    const files = away.reduce((n, e) => n + e.count, 0);
    try {
      const outcome = await backend.undo(away.map((e) => e.id));
      dispatch({ type: "undone", outcome, message: `Moved ${plural(files, "file")} back to Downloads` });
      await refreshInbox();
    } catch (error) {
      dispatch({ type: "notice", message: errorText(error), tone: "error" });
    }
  }, [refreshInbox]);

  const toggleRule = useCallback(
    async (id: string) => {
      const rule = stateRef.current.rules.find((r) => r.id === id);
      if (!rule) return;
      dispatch({ type: "rules", rules: stateRef.current.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) });
      try {
        await backend.setRuleEnabled(id, !rule.enabled);
      } catch (error) {
        dispatch({ type: "notice", message: errorText(error), tone: "error" });
        void refreshRules();
      }
    },
    [refreshRules],
  );

  const updateSettings = useCallback(async (change: Partial<Pick<Settings, "autoRules" | "startAtLogin">>) => {
    const current = stateRef.current.settings;
    if (!current) return;
    dispatch({ type: "settings", settings: { ...current, ...change } });
    try {
      if (change.autoRules !== undefined) await backend.setAutoRules(change.autoRules);
      if (change.startAtLogin !== undefined) await backend.setStartAtLogin(change.startAtLogin);
    } catch (error) {
      dispatch({ type: "settings", settings: current });
      dispatch({ type: "notice", message: errorText(error), tone: "error" });
    }
  }, []);

  const actions = useMemo(
    () => ({
      view: (view: View) => dispatch({ type: "view", view }),
      select: (id: string) => dispatch({ type: "select", id }),
      step: (delta: number) => dispatch({ type: "step", delta }),
      toggleExpand: (id?: string) => dispatch({ type: "toggleExpand", id }),
      dismissNotice: (id: number) => dispatch({ type: "dismissNotice", id }),
      dismissAway: () => dispatch({ type: "dismissAway" }),
      scan: () => void refreshInbox(),
      resolve,
      resolveSure,
      undo,
      undoAway,
      toggleRule,
      updateSettings,
    }),
    [refreshInbox, resolve, resolveSure, undo, undoAway, toggleRule, updateSettings],
  );

  return { state, actions };
}
