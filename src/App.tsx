import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowDown, ArrowUp, Check, CircleAlert } from "lucide-react";
import { Activity } from "./components/Activity";
import { Inbox } from "./components/Inbox";
import { Rules } from "./components/Rules";
import { SettingsView } from "./components/Settings";
import { Button, cx, Key } from "./components/ui";
import { formatBytes, formatCount, relativeTime } from "./lib/format";
import { awayMoves, doneThisSession, sureStacks, useNeat, type Notice, type State, type View } from "./lib/store";
import type { ActionKind } from "./lib/types";

const views: { view: View; label: string }[] = [
  { view: "inbox", label: "Inbox" },
  { view: "activity", label: "Activity" },
  { view: "rules", label: "Rules" },
  { view: "settings", label: "Settings" },
];

const NOTICE_MS = 6000;
const ERROR_NOTICE_MS = 10000;

export default function App() {
  const { state, actions } = useNeat();
  // "Always move files like these" applies to the selected group only.
  const [alwaysFor, setAlwaysFor] = useState<string | null>(null);
  useEffect(() => setAlwaysFor(null), [state.selectedId]);

  const selected = state.stacks.find((s) => s.id === state.selectedId) ?? null;
  const sure = sureStacks(state);

  const resolve = (id: string, action: ActionKind) => {
    void actions.resolve(id, action, alwaysFor === id);
    setAlwaysFor(null);
  };

  useEffect(() => {
    if (!state.notice) return;
    const { id, tone } = state.notice;
    const timer = setTimeout(() => actions.dismissNotice(id), tone === "error" ? ERROR_NOTICE_MS : NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state.notice, actions]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Keys sent to the window itself (not an element) are treated as page-level keys.
      const target = e.target instanceof HTMLElement ? e.target : document.body;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      // Let a focused control handle its own Enter and Space.
      if ((e.key === "Enter" || e.key === " ") && target.closest("button, [role=switch]")) return;

      if (e.ctrlKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        actions.view(views[Number(e.key) - 1].view);
        return;
      }
      if (e.key.toLowerCase() === "z" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        void actions.undo();
        return;
      }
      if (state.view !== "inbox" || e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        void actions.resolveSure();
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          actions.step(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          actions.step(-1);
          break;
        case " ":
          e.preventDefault();
          actions.toggleExpand();
          break;
        case "Escape":
          if (state.expandedId) actions.toggleExpand(state.expandedId);
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
  });

  return (
    <MotionConfig reducedMotion="user">
      {/* Mouse clicks must not leave focus on buttons, or Enter would re-click them instead of applying the suggestion. Tab focus still works. */}
      <div
        className="flex h-full flex-col"
        onMouseDownCapture={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
        }}
      >
        <TopBar
          view={state.view}
          inboxCount={state.stacks.length}
          scanning={state.scanning}
          onView={actions.view}
          onScan={() => void actions.scan()}
        />

        <main className="flex min-h-0 flex-1 flex-col">
          {state.view === "inbox" && (
            <Inbox
              loading={state.loading}
              stacks={state.stacks}
              selectedId={state.selectedId}
              expandedId={state.expandedId}
              lastSession={state.lastSession}
              away={state.awayDismissed ? [] : awayMoves(state)}
              sure={sure}
              done={doneThisSession(state)}
              always={alwaysFor !== null && alwaysFor === state.selectedId}
              onAlways={(on) => setAlwaysFor(on ? state.selectedId : null)}
              onSelect={actions.select}
              onToggle={actions.toggleExpand}
              onResolve={resolve}
              onResolveSure={() => void actions.resolveSure()}
              onUndo={(entryIds) => void actions.undo(entryIds)}
              onUndoAway={() => void actions.undoAway()}
              onDismissAway={actions.dismissAway}
              onShowActivity={() => actions.view("activity")}
              onShowRules={() => actions.view("rules")}
            />
          )}
          {state.view === "activity" && <Activity entries={state.activity} onUndo={(id) => void actions.undo([id])} />}
          {state.view === "rules" && <Rules rules={state.rules} onToggle={(id) => void actions.toggleRule(id)} />}
          {state.view === "settings" && (
            <SettingsView settings={state.settings} onChange={(change) => void actions.updateSettings(change)} />
          )}
        </main>

        <StatusBar
          state={state}
          notice={state.notice}
          showKeys={state.view === "inbox" && state.stacks.length > 0}
          onUndo={(ids) => void actions.undo(ids)}
        />
      </div>
    </MotionConfig>
  );
}

function TopBar({
  view,
  inboxCount,
  scanning,
  onView,
  onScan,
}: {
  view: View;
  inboxCount: number;
  scanning: boolean;
  onView: (view: View) => void;
  onScan: () => void;
}) {
  return (
    <header className="h-12 shrink-0 border-b border-rule bg-chrome">
      <div className="mx-auto flex h-full w-full max-w-[1240px] items-stretch gap-7 px-6">
        <span className="self-center text-[15px] font-bold tracking-[-0.02em]">Neat</span>
        <nav className="flex items-stretch gap-5" aria-label="Sections">
          {views.map((item, i) => {
            const active = item.view === view;
            return (
              <button
                key={item.view}
                onClick={() => onView(item.view)}
                aria-current={active ? "page" : undefined}
                title={`Ctrl ${i + 1}`}
                className={cx(
                  "relative flex items-center gap-1.5 text-[13px] transition-colors duration-150",
                  active ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
                {item.view === "inbox" && inboxCount > 0 && <span className="text-ink-3">{inboxCount}</span>}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-0 -bottom-px h-[2px] bg-cobalt"
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto self-center">
          <Button variant="ghost" onClick={onScan} disabled={scanning}>
            {scanning ? "Scanning Downloads" : "Scan now"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function StatusBar({
  state,
  notice,
  showKeys,
  onUndo,
}: {
  state: State;
  notice: Notice | null;
  showKeys: boolean;
  onUndo: (ids: string[]) => void;
}) {
  const { folder } = state;
  return (
    <footer className="h-9 shrink-0 border-t border-rule bg-chrome text-[12px] text-ink-3">
      <div className="mx-auto flex h-full w-full max-w-[1240px] items-center gap-6 px-6">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {notice ? (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                role={notice.tone === "error" ? "alert" : "status"}
                className="flex items-center gap-2.5"
              >
                {notice.tone === "error" ? (
                  <CircleAlert size={13} strokeWidth={2.2} className="shrink-0 text-brick" />
                ) : (
                  <Check size={13} strokeWidth={2.2} className="shrink-0 text-cobalt" />
                )}
                <span className="truncate text-[13px] text-ink" title={notice.message}>
                  {notice.message}
                </span>
                {notice.undo && (
                  <button
                    onClick={() => onUndo(notice.undo!)}
                    className="flex shrink-0 items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 font-medium text-cobalt-soft transition-colors hover:bg-cobalt/12"
                  >
                    Undo <Key>Z</Key>
                  </button>
                )}
              </motion.div>
            ) : folder ? (
              <motion.div
                key="folder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 truncate"
              >
                <span className="text-ink-2">{state.settings?.testFolder ? "Test folder" : "Downloads"}</span>
                <span>
                  {formatCount(folder.files)} files, {formatBytes(folder.bytes)}
                </span>
                <span aria-hidden>·</span>
                {state.scanning ? (
                  <span>Scanning</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {folder.watching && <span className="size-1.5 rounded-full bg-cobalt" />}
                    {folder.watching ? "Watching for new downloads" : "Not watching"}
                  </span>
                )}
                <span aria-hidden>·</span>
                <span>Scanned {relativeTime(folder.lastScan)}</span>
              </motion.div>
            ) : (
              <span key="loading">Reading Downloads</span>
            )}
          </AnimatePresence>
        </div>
        {showKeys && (
          <div className="flex shrink-0 items-center gap-3.5 text-ink-2">
            <span className="max-[1020px]:hidden">
              <Legend
                keys={[<ArrowUp key="u" size={10} strokeWidth={2.4} />, <ArrowDown key="d" size={10} strokeWidth={2.4} />]}
                label="Select"
              />
            </span>
            <span className="max-[1020px]:hidden">
              <Legend keys={["Space"]} label="Details" />
            </span>
            <Legend keys={["Enter"]} label="Apply" />
            <Legend keys={["K"]} label="Keep" />
            <Legend keys={["R"]} label="Recycle" />
            <Legend keys={["Z"]} label="Undo" />
          </div>
        )}
      </div>
    </footer>
  );
}

function Legend({ keys, label }: { keys: React.ReactNode[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <Key key={i}>{k}</Key>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}
