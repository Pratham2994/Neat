import { useCallback, useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { Activity } from "./components/Activity";
import { Inbox } from "./components/Inbox";
import { Rules } from "./components/Rules";
import { Sidebar } from "./components/Sidebar";
import { StackDetail } from "./components/StackDetail";
import { Toast } from "./components/Toast";
import { autoToday, useNeatStore, visibleStacks, type View } from "./lib/store";
import type { ActionKind } from "./lib/types";

const views: View[] = ["inbox", "activity", "rules"];

export default function App() {
  const [state, dispatch] = useNeatStore();
  // "Always do this" applies to the selected stack only; selecting another stack clears it.
  const [alwaysFor, setAlwaysFor] = useState<string | null>(null);

  useEffect(() => setAlwaysFor(null), [state.selectedId]);

  const visible = visibleStacks(state);
  const selected = state.stacks.find((s) => s.id === state.selectedId) ?? null;
  const autoMoves = state.summaryDismissed ? [] : autoToday(state);

  const resolve = useCallback(
    (id: string, action: ActionKind) => {
      dispatch({ type: "resolve", id, action, always: alwaysFor === id });
      setAlwaysFor(null);
    },
    [alwaysFor, dispatch],
  );

  const scan = useCallback(() => {
    // Placeholder until the Rust scanner exists.
    dispatch({ type: "scan", done: false });
    setTimeout(() => dispatch({ type: "scan", done: true }), 1400);
  }, [dispatch]);

  const dismissToast = useCallback((id: number) => dispatch({ type: "dismissToast", id }), [dispatch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      // Let a focused button handle its own Enter/Space.
      if ((e.key === "Enter" || e.key === " ") && target.closest("button")) return;

      if (e.ctrlKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        dispatch({ type: "view", view: views[Number(e.key) - 1] });
        return;
      }
      if (e.key.toLowerCase() === "z" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
        return;
      }
      if (state.view !== "inbox" || e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "step", delta: 1 });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "step", delta: -1 });
          break;
        case "Enter":
          if (selected) resolve(selected.id, selected.action);
          break;
        case "k":
        case "K":
          if (selected) resolve(selected.id, "keep");
          break;
        case "r":
        case "R":
          if (selected) resolve(selected.id, "recycle");
          break;
        case "m":
        case "M":
          if (selected?.destination) resolve(selected.id, "move");
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.view, selected, resolve, dispatch]);

  return (
    <MotionConfig reducedMotion="user">
      {/* Mouse clicks must not leave focus on buttons, or Enter would re-click them instead of applying the suggestion. Tab focus still works. */}
      <div
        className="flex h-full"
        onMouseDownCapture={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
        }}
      >
        <Sidebar
          view={state.view}
          inboxCount={state.stacks.length}
          folder={state.folder}
          onView={(view) => dispatch({ type: "view", view })}
        />

        <motion.main
          key={state.view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.14 }}
          className="flex min-w-0 flex-1"
        >
          {state.view === "inbox" && (
            <>
              <Inbox
                stacks={state.stacks}
                visible={visible}
                filter={state.filter}
                selectedId={state.selectedId}
                autoMoves={autoMoves}
                session={state.session}
                scanning={state.scanning}
                onFilter={(filter) => dispatch({ type: "filter", filter })}
                onSelect={(id) => dispatch({ type: "select", id })}
                onScan={scan}
                onUndoAuto={() => dispatch({ type: "undoAuto" })}
                onShowActivity={() => dispatch({ type: "view", view: "activity" })}
                onDismissSummary={() => dispatch({ type: "dismissSummary" })}
              />
              {selected && visible.includes(selected) && (
                <StackDetail
                  stack={selected}
                  always={alwaysFor === selected.id}
                  onAlways={(on) => setAlwaysFor(on ? selected.id : null)}
                  onResolve={(action) => resolve(selected.id, action)}
                />
              )}
            </>
          )}
          {state.view === "activity" && (
            <Activity entries={state.activity} onUndo={(entryId) => dispatch({ type: "undo", entryId })} />
          )}
          {state.view === "rules" && (
            <Rules rules={state.rules} onToggle={(id) => dispatch({ type: "toggleRule", id })} />
          )}
        </motion.main>

        <Toast
          toast={state.toast}
          onUndo={(entryId) => dispatch({ type: "undo", entryId })}
          onDismiss={dismissToast}
        />
      </div>
    </MotionConfig>
  );
}
