import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { formatBytes, formatCount, plural, relativeTime, sinceLabel } from "../lib/format";
import { affectedFiles } from "../lib/store";
import type { ActionKind, ActivityEntry, Confidence, FileItem, Stack } from "../lib/types";
import { Button, Chevron, cx, Key } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

// One column template shared by the header, every row and every expanded file line.
// Below 1020px the From column and the Sure column fold into the group's summary line, and the action slots shrink.
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,150px)_48px_76px_56px_376px] max-[1020px]:grid-cols-[minmax(0,1fr)_48px_76px_322px] items-center gap-x-4";
const SLOTS = "grid grid-cols-[188px_80px_96px] max-[1020px]:grid-cols-[170px_62px_78px] gap-1.5";
const WIDE_ONLY = "max-[1020px]:hidden";
const NARROW_ONLY = "min-[1021px]:hidden";

interface Props {
  loading: boolean;
  stacks: Stack[];
  selectedId: string | null;
  expandedId: string | null;
  lastSession: string | null;
  away: ActivityEntry[];
  sure: Stack[];
  done: { entry: ActivityEntry; stack?: Stack }[];
  always: boolean;
  onAlways: (value: boolean) => void;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onResolve: (id: string, action: ActionKind) => void;
  onResolveSure: () => void;
  onUndo: (entryIds: string[]) => void;
  onUndoAway: () => void;
  onDismissAway: () => void;
  onShowActivity: () => void;
  onShowRules: () => void;
}

export function Inbox(props: Props) {
  const { stacks, away, sure, done } = props;
  // While the batch button is hovered or focused, the rows it will apply are marked.
  const [previewBatch, setPreviewBatch] = useState(false);
  const sureIds = new Set(sure.map((s) => s.id));
  const files = stacks.reduce((n, s) => n + s.files.length, 0);
  const bytes = stacks.reduce((n, s) => n + s.files.reduce((m, f) => m + f.size, 0), 0);
  const since = props.lastSession ? sinceLabel(props.lastSession) : "First look at Downloads";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pb-12 pt-6">
        <header>
          <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Inbox</h1>
          <p className="mt-0.5 text-ink-2">
            {props.loading
              ? "Reading Downloads"
              : stacks.length > 0
                ? `${since}: ${plural(stacks.length, "group")}, ${plural(files, "file")}, ${formatBytes(bytes)}`
                : `${since}: nothing left to decide`}
          </p>
        </header>

        {(away.length > 0 || sure.length > 0) && (
          <div className="mt-5 border-b border-rule">
            {away.length > 0 && (
              <AwayLine entries={away} onView={props.onShowActivity} onUndo={props.onUndoAway} onDismiss={props.onDismissAway} />
            )}
            {sure.length > 0 && <BatchBar sure={sure} onApply={props.onResolveSure} onPreview={setPreviewBatch} />}
          </div>
        )}

        <LayoutGroup>
          {props.loading ? (
            <Skeleton />
          ) : stacks.length > 0 ? (
            <div role="table" aria-label="Groups to review" className="mt-6">
              <div
                role="row"
                className={cx(
                  COLUMNS,
                  "sticky top-0 z-10 border-b border-rule-strong bg-ground px-3 pb-2 text-[12px] text-ink-3",
                )}
              >
                <span role="columnheader" className="pl-5">
                  Group
                </span>
                <span role="columnheader" className={WIDE_ONLY}>
                  From
                </span>
                <span role="columnheader" className="text-right">
                  Files
                </span>
                <span role="columnheader" className="text-right">
                  Size
                </span>
                <span role="columnheader" className={WIDE_ONLY}>
                  <span className="sr-only">Confidence</span>
                </span>
                <span role="columnheader" className="pl-0.5">
                  Action
                </span>
              </div>
              <AnimatePresence initial={false}>
                {stacks.map((stack) => (
                  <Row
                    key={stack.id}
                    stack={stack}
                    selected={stack.id === props.selectedId}
                    expanded={stack.id === props.expandedId}
                    inBatch={previewBatch && sureIds.has(stack.id)}
                    previewing={previewBatch}
                    always={props.always}
                    onAlways={props.onAlways}
                    onSelect={() => props.onSelect(stack.id)}
                    onToggle={() => props.onToggle(stack.id)}
                    onResolve={(action) => props.onResolve(stack.id, action)}
                  />
                ))}
              </AnimatePresence>
              <div role="row" className={cx(COLUMNS, "px-3 pt-2.5 text-[12px] text-ink-3")}>
                <span className="pl-5">Total, {plural(stacks.length, "group")}</span>
                <span className={WIDE_ONLY} />
                <span className="text-right font-mono">{formatCount(files)}</span>
                <span className="text-right font-mono">{formatBytes(bytes)}</span>
              </div>
            </div>
          ) : (
            <EmptyState onShowRules={props.onShowRules} />
          )}

          {done.length > 0 && <Done done={done} onUndo={props.onUndo} />}
        </LayoutGroup>
      </div>
    </div>
  );
}

function AwayLine({
  entries,
  onView,
  onUndo,
  onDismiss,
}: {
  entries: ActivityEntry[];
  onView: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const files = entries.reduce((n, e) => n + e.count, 0);
  return (
    <div className="flex items-center gap-3 border-t border-rule py-2.5">
      <p className="min-w-0 flex-1">
        <span className="font-medium">While you were away, Neat moved {plural(files, "file")}.</span>{" "}
        <span className="text-ink-2">{entries.map((e) => `${e.title} to ${e.destination}`).join(", ")}.</span>
      </p>
      <Button variant="ghost" onClick={onView}>
        View
      </Button>
      <Button variant="ghost" onClick={onUndo}>
        Undo all
      </Button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-[30px] place-items-center rounded-[4px] text-ink-3 transition-colors hover:bg-row-hover hover:text-ink"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function BatchBar({ sure, onApply, onPreview }: { sure: Stack[]; onApply: () => void; onPreview: (on: boolean) => void }) {
  const recycled = sure.filter((s) => s.action === "recycle");
  const moved = sure.filter((s) => s.action === "move");
  const recycledFiles = recycled.reduce((n, s) => n + affectedFiles(s).length, 0);
  const movedFiles = moved.reduce((n, s) => n + affectedFiles(s).length, 0);
  const freed = recycled.reduce((n, s) => n + affectedFiles(s).reduce((m, f) => m + f.size, 0), 0);
  const effects = [
    movedFiles > 0 && `moves ${plural(movedFiles, "file")}`,
    recycledFiles > 0 && `recycles ${plural(recycledFiles, "file")} and frees ${formatBytes(freed)}`,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-4 border-t border-rule py-2.5">
      <p className="min-w-0 flex-1">
        <span className="font-medium">Neat is sure about {plural(sure.length, "group")}</span>
        <span className="text-ink-2">, marked Sure below. Applying them {effects.join(" and ")}. You can undo it.</span>
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={onApply}
        onMouseEnter={() => onPreview(true)}
        onMouseLeave={() => onPreview(false)}
        onFocus={() => onPreview(true)}
        onBlur={() => onPreview(false)}
      >
        Apply {plural(sure.length, "suggestion")}
        <Key>Shift Enter</Key>
      </Button>
    </div>
  );
}

function hosts(stack: Stack): string[] {
  return [...new Set(stack.files.map((f) => f.source).filter(Boolean))] as string[];
}

function origin(stack: Stack): string | null {
  const list = hosts(stack);
  if (list.length === 0) return null;
  return list.length === 1 ? list[0] : `${list[0]} +${list.length - 1}`;
}

function suggestionLabel(stack: Stack): string {
  if (stack.action === "move") return `Move to ${stack.destination?.split("/").pop()}`;
  if (stack.action === "recycle") return `Recycle ${affectedFiles(stack).length}`;
  return "Keep";
}

const confidenceWord: Record<Confidence, { word: string; tone: string }> = {
  high: { word: "Sure", tone: "text-ink-2" },
  medium: { word: "", tone: "" },
  low: { word: "Unsure", tone: "text-ink-3" },
};

interface RowProps {
  stack: Stack;
  selected: boolean;
  expanded: boolean;
  inBatch: boolean;
  previewing: boolean;
  always: boolean;
  onAlways: (value: boolean) => void;
  onSelect: () => void;
  onToggle: () => void;
  onResolve: (action: ActionKind) => void;
}

function Row({ stack, selected, expanded, inBatch, previewing, always, onAlways, onSelect, onToggle, onResolve }: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const bytes = stack.files.reduce((n, f) => n + f.size, 0);
  const from = origin(stack);
  const confidence = confidenceWord[stack.confidence];

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // Buttons act on the row without also toggling or selecting it.
  const act = (action: ActionKind) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onResolve(action);
  };

  return (
    <motion.div
      ref={ref}
      layout="position"
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2, ease: EASE } }}
      transition={{ layout: { duration: 0.22, ease: EASE } }}
      className={cx(
        "overflow-hidden border-b border-rule transition-colors duration-150",
        inBatch || (selected && !previewing) ? "bg-row-selected" : "hover:bg-row-hover",
      )}
    >
      <div role="row" aria-selected={selected} onClick={onSelect} className={cx(COLUMNS, "px-3 py-3")}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={expanded}
          className="flex min-w-0 items-start gap-2 text-left"
        >
          <span className="pt-[4px]">
            <Chevron open={expanded} />
          </span>
          <span className="min-w-0">
            <motion.span layoutId={`title-${stack.id}`} className="block truncate text-[14px] font-medium" title={stack.title}>
              {stack.title}
            </motion.span>
            <span className="block truncate text-[12px] text-ink-2">
              {confidence.word && <span className={cx(NARROW_ONLY, confidence.tone)}>{confidence.word} · </span>}
              {from && <span className={cx(NARROW_ONLY, "font-mono text-ink-2")}>{from} · </span>}
              {stack.summary}
            </span>
          </span>
        </button>
        <span className={cx(WIDE_ONLY, "truncate font-mono text-[12px]", from ? "text-ink-2" : "text-ink-3")}>
          {from ?? "Not recorded"}
        </span>
        <span className="text-right font-mono text-[12px] text-ink-2">{formatCount(stack.files.length)}</span>
        <span className="text-right font-mono text-[12px] text-ink-2">{formatBytes(bytes)}</span>
        <span
          className={cx(WIDE_ONLY, "text-[12px] transition-colors duration-150", inBatch ? "text-cobalt-soft" : confidence.tone)}
        >
          {confidence.word}
        </span>
        {/* Fixed slots: suggestion | Keep | Recycle, so each verb sits in one vertical line. */}
        <div className={SLOTS}>
          <Button
            variant={selected ? "primary" : "soft"}
            onClick={act(stack.action)}
            className="justify-between"
            title={stack.action === "move" ? `Move to Downloads/${stack.destination}` : undefined}
          >
            <span className="truncate">{suggestionLabel(stack)}</span>
            {selected && <Key className={WIDE_ONLY}>Enter</Key>}
          </Button>
          <Button variant="outline" onClick={act("keep")} className="justify-between">
            Keep
            {selected && <Key className={WIDE_ONLY}>K</Key>}
          </Button>
          {stack.action === "move" ? (
            <Button variant="recycle" onClick={act("recycle")} className="justify-between">
              Recycle
              {selected && <Key className={WIDE_ONLY}>R</Key>}
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <Details stack={stack} always={always} onAlways={onAlways} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const confidenceText = {
  high: "Neat is sure about this group.",
  medium: "Neat thinks this is right. Check before applying.",
  low: "Neat is unsure. Size and age alone are weak evidence.",
};

// Expanded rows sit on the table's own columns: name under Group, host under From, size under Size, fate under Action.
function Details({ stack, always, onAlways }: { stack: Stack; always: boolean; onAlways: (v: boolean) => void }) {
  const mixed = stack.files.some((f) => f.fate === "kept");
  return (
    <div className="pb-4">
      {stack.files.map((file) => (
        <FileLine key={file.id} file={file} mixed={mixed} />
      ))}
      <div className={cx(COLUMNS, "items-start px-3 pt-4")}>
        <div className="col-span-2 pl-5 max-[1020px]:col-span-1">
          <h3 className="mb-1.5 text-[12px] font-semibold text-ink-2">Why</h3>
          <ul className="space-y-1.5">
            {stack.evidence.map((e) => (
              <li key={e.text} className="flex gap-2">
                <Check size={13} strokeWidth={2} className="mt-[3px] shrink-0 text-ink-3" />
                <span>
                  {e.text}
                  {e.detail && <span className="block text-[12px] text-ink-3">{e.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">{confidenceText[stack.confidence]}</p>
          {stack.action === "move" && (
            <label className="mt-3 flex items-center gap-2 text-[12px] text-ink-2">
              <input type="checkbox" checked={always} onChange={(e) => onAlways(e.target.checked)} className="peer sr-only" />
              <span
                aria-hidden
                className={cx(
                  "grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors duration-150",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt",
                  always ? "border-cobalt bg-cobalt text-cobalt-deep" : "border-rule-strong",
                )}
              >
                {always && <Check size={10} strokeWidth={3} />}
              </span>
              Always move files like these to {stack.destination}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

function FileLine({ file, mixed }: { file: FileItem; mixed: boolean }) {
  const [base, ext] = splitName(file.name);
  const fate = mixed ? (file.fate === "kept" ? "Stays" : "Recycle") : null;
  return (
    <div className={cx(COLUMNS, "px-3 py-1")}>
      <span className="min-w-0 pl-5">
        <span className="selectable flex min-w-0 font-mono text-[12px]" title={file.name}>
          <span className="truncate">{base}</span>
          <span className="shrink-0">{ext}</span>
        </span>
        <span className="block truncate text-[12px] text-ink-3">
          {[relativeTime(file.modified), file.note].filter(Boolean).join(" · ")}
          {file.source && <span className={cx(NARROW_ONLY, "font-mono")}> · {file.source}</span>}
        </span>
      </span>
      <span className={cx(WIDE_ONLY, "truncate font-mono text-[12px] text-ink-3")}>{file.source ?? ""}</span>
      <span />
      <span className="text-right font-mono text-[12px] text-ink-2">{formatBytes(file.size)}</span>
      <span className={WIDE_ONLY} />
      <span className={cx("pl-2.5 text-[12px]", fate === "Stays" ? "text-ink" : "text-ink-3")}>{fate}</span>
    </div>
  );
}

const verbs: Record<ActionKind, { word: string; tone: string }> = {
  move: { word: "Moved", tone: "text-cobalt-soft" },
  recycle: { word: "Recycled", tone: "text-brick" },
  keep: { word: "Kept", tone: "text-ink-2" },
};

function Done({ done, onUndo }: { done: { entry: ActivityEntry; stack?: Stack }[]; onUndo: (ids: string[]) => void }) {
  const freed = done.filter((d) => d.entry.action === "recycle").reduce((n, d) => n + d.entry.bytes, 0);
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between border-b border-rule-strong pb-2">
        <h2 className="text-[14px] font-semibold">Done this session</h2>
        <span className="font-mono text-[12px] text-ink-3">
          {plural(done.length, "group")}
          {freed > 0 && `, ${formatBytes(freed)} freed`}
        </span>
      </div>
      <ul>
        {done.map(({ entry, stack }) => {
          const verb = verbs[entry.action as ActionKind];
          return (
            <motion.li
              key={entry.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="grid grid-cols-[76px_minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-rule py-1.5 pl-3"
            >
              <span className={cx("text-[12px] font-medium", verb.tone)}>{verb.word}</span>
              <motion.span layoutId={stack ? `title-${stack.id}` : undefined} className="truncate text-ink-2">
                {entry.title}
                {entry.destination && <span className="text-ink-3"> to {entry.destination}</span>}
              </motion.span>
              <span className="font-mono text-[12px] text-ink-3">
                {plural(entry.count, "file")}, {formatBytes(entry.bytes)}
              </span>
              <Button variant="ghost" onClick={() => onUndo([entry.id])}>
                Undo
              </Button>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="mt-6 border-t border-rule-strong">
      {[0.62, 0.48, 0.55].map((w, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-rule px-3 py-4 pl-8">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 animate-pulse rounded-[2px] bg-rule-strong" style={{ width: `${w * 60}%` }} />
            <div className="h-2.5 animate-pulse rounded-[2px] bg-rule" style={{ width: `${w * 90}%` }} />
          </div>
          <div className="h-[30px] w-[188px] animate-pulse rounded-[4px] border border-rule" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onShowRules }: { onShowRules: () => void }) {
  return (
    <div className="mt-10">
      <h2 className="text-[14px] font-semibold">Nothing waiting</h2>
      <p className="mt-1 max-w-[60ch] text-ink-2">
        New downloads appear here when they finish. Files your rules cover are moved without asking, and the next visit shows what
        moved.
      </p>
      <Button variant="outline" className="mt-4" onClick={onShowRules}>
        See rules
      </Button>
    </div>
  );
}
