import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, RefreshCw, Sparkles, X } from "lucide-react";
import { formatBytes, formatCount, plural } from "../lib/format";
import { affectedFiles, matchesFilter, type Filter } from "../lib/store";
import type { ActivityEntry, Stack } from "../lib/types";
import { Button, ConfidenceDot, cx, KindIcon } from "./ui";

interface Props {
  stacks: Stack[]; // all stacks, unfiltered
  visible: Stack[];
  filter: Filter;
  selectedId: string | null;
  autoMoves: ActivityEntry[];
  session: { groups: number; bytesFreed: number };
  scanning: boolean;
  onFilter: (filter: Filter) => void;
  onSelect: (id: string) => void;
  onScan: () => void;
  onUndoAuto: () => void;
  onShowActivity: () => void;
  onDismissSummary: () => void;
}

export function Inbox(props: Props) {
  const { stacks, visible, filter, selectedId, autoMoves, scanning } = props;
  const fileCount = stacks.reduce((n, s) => n + s.files.length, 0);
  const bytes = stacks.reduce((n, s) => n + s.files.reduce((m, f) => m + f.size, 0), 0);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-end justify-between px-6 pb-4 pt-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Inbox</h1>
          <p className="tabular mt-0.5 text-fg-2">
            {stacks.length === 0
              ? "Nothing to review"
              : `${plural(stacks.length, "group")} · ${plural(fileCount, "file")} · ${formatBytes(bytes)}`}
          </p>
        </div>
        <Button variant="ghost" onClick={props.onScan} disabled={scanning}>
          <RefreshCw size={14} strokeWidth={2} className={cx(scanning && "animate-spin")} />
          {scanning ? "Scanning" : "Scan now"}
        </Button>
      </header>

      <AnimatePresence initial={false}>
        {autoMoves.length > 0 && (
          <AutoSummary
            entries={autoMoves}
            onUndo={props.onUndoAuto}
            onDetails={props.onShowActivity}
            onDismiss={props.onDismissSummary}
          />
        )}
      </AnimatePresence>

      {stacks.length > 0 && <FilterTabs stacks={stacks} filter={filter} onFilter={props.onFilter} />}

      {visible.length > 0 ? (
        <ul className="flex-1 overflow-y-auto px-3 pb-6">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((stack) => (
              <StackRow
                key={stack.id}
                stack={stack}
                selected={stack.id === selectedId}
                onSelect={() => props.onSelect(stack.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <EmptyState
          allClear={stacks.length === 0}
          session={props.session}
          onShowAll={() => props.onFilter("all")}
        />
      )}
    </section>
  );
}

function AutoSummary({
  entries,
  onUndo,
  onDetails,
  onDismiss,
}: {
  entries: ActivityEntry[];
  onUndo: () => void;
  onDetails: () => void;
  onDismiss: () => void;
}) {
  const files = entries.reduce((n, e) => n + e.count, 0);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden px-6"
    >
      <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-accent/15 bg-accent/[0.06] py-2.5 pl-3 pr-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-accent/12 text-accent">
          <Sparkles size={15} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Neat moved {formatCount(files)} files today</div>
          <div className="truncate text-[12px] text-fg-2">
            {entries.map((e, i) => (
              <span key={e.id}>
                {i > 0 && <span className="text-fg-3"> · </span>}
                {e.title}
                <ArrowRight size={11} className="mx-1 inline -translate-y-px text-fg-3" />
                {e.destination}
              </span>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDetails}>
          Details
        </Button>
        <Button variant="ghost" size="sm" onClick={onUndo}>
          Undo
        </Button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

const tabs: { filter: Filter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "organise", label: "Organise" },
  { filter: "cleanup", label: "Clean up" },
];

function FilterTabs({ stacks, filter, onFilter }: { stacks: Stack[]; filter: Filter; onFilter: (f: Filter) => void }) {
  return (
    <div className="mb-2 flex gap-1 px-6">
      {tabs.map((tab) => {
        const count = stacks.filter((s) => matchesFilter(s, tab.filter)).length;
        const active = tab.filter === filter;
        return (
          <button
            key={tab.filter}
            onClick={() => onFilter(tab.filter)}
            className={cx(
              "relative flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] transition-colors duration-150",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {active && (
              <motion.span
                layoutId="filter-active"
                className="absolute inset-0 rounded-lg border border-line bg-surface-2"
                transition={{ type: "spring", stiffness: 700, damping: 50 }}
              />
            )}
            <span className="relative">{tab.label}</span>
            <span className="tabular relative text-fg-3">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function StackRow({ stack, selected, onSelect }: { stack: Stack; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const bytes = stack.files.reduce((n, f) => n + f.size, 0);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 44 } }}
      className="list-none py-px"
    >
      <button
        onClick={onSelect}
        className={cx(
          "group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150",
          !selected && "hover:bg-surface-2",
        )}
      >
        {selected && (
          <motion.span
            layoutId="stack-selection"
            className="absolute inset-0 rounded-[10px] border border-line-strong bg-surface-3"
            transition={{ type: "spring", stiffness: 650, damping: 48 }}
          />
        )}
        <span className="relative">
          <KindIcon kind={stack.kind} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block truncate font-medium">{stack.title}</span>
          <span className="block truncate text-[12px] text-fg-3">{stack.summary}</span>
        </span>
        <span className="relative flex shrink-0 items-center gap-3">
          <span className="tabular text-[12px] text-fg-3">
            {plural(stack.files.length, "file")} · {formatBytes(bytes)}
          </span>
          <ActionPill stack={stack} />
        </span>
      </button>
    </motion.li>
  );
}

function ActionPill({ stack }: { stack: Stack }) {
  const label =
    stack.action === "move"
      ? `Move to ${stack.destination?.split("/").pop()}`
      : stack.action === "recycle"
        ? `Recycle ${affectedFiles(stack).length}`
        : "Keep";
  return (
    <span
      className={cx(
        "inline-flex h-6 w-[148px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium",
        stack.action === "move" && "bg-accent/[0.08] text-accent",
        stack.action === "recycle" && "bg-white/[0.04] text-fg-2",
        stack.action === "keep" && "bg-surface-3 text-fg-2",
      )}
    >
      <ConfidenceDot level={stack.confidence} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function EmptyState({
  allClear,
  session,
  onShowAll,
}: {
  allClear: boolean;
  session: { groups: number; bytesFreed: number };
  onShowAll: () => void;
}) {
  return (
    <div className="grid flex-1 place-items-center pb-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-w-[300px] flex-col items-center text-center"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Check size={22} strokeWidth={2.2} />
        </span>
        <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">
          {allClear ? "Downloads is neat" : "Nothing here"}
        </h2>
        <p className="mt-1 text-fg-2">
          {allClear
            ? session.groups > 0
              ? `You cleared ${plural(session.groups, "group")}${session.bytesFreed > 0 ? ` and freed ${formatBytes(session.bytesFreed)}` : ""}. New downloads will show up here.`
              : "New downloads will show up here."
            : "Other groups are still waiting for review."}
        </p>
        {!allClear && (
          <Button variant="secondary" className="mt-4" onClick={onShowAll}>
            Show all
          </Button>
        )}
      </motion.div>
    </div>
  );
}
