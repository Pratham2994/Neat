import { motion } from "motion/react";
import { Check, FolderInput, ListPlus, Trash2, type LucideIcon } from "lucide-react";
import { dayLabel, formatBytes, formatTime } from "../lib/format";
import type { ActivityEntry } from "../lib/types";
import { Button, cx, SectionLabel } from "./ui";

const actionMeta: Record<ActivityEntry["action"], { icon: LucideIcon; tint: string }> = {
  move: { icon: FolderInput, tint: "text-accent bg-accent/10" },
  recycle: { icon: Trash2, tint: "text-danger bg-danger/10" },
  keep: { icon: Check, tint: "text-fg-2 bg-white/5" },
  rule: { icon: ListPlus, tint: "text-violet bg-violet/10" },
};

function sentence(e: ActivityEntry): string {
  switch (e.action) {
    case "move":
      return `Moved ${e.title} to ${e.destination}`;
    case "recycle":
      return `Recycled ${e.title}`;
    case "keep":
      return `Kept ${e.title}`;
    case "rule":
      return `New rule: ${e.title} go to ${e.destination}`;
  }
}

export function Activity({ entries, onUndo }: { entries: ActivityEntry[]; onUndo: (id: string) => void }) {
  const days: { label: string; items: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.at);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="px-6 pb-4 pt-5">
        <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Activity</h1>
        <p className="mt-0.5 text-fg-2">Everything Neat did, newest first. Any action can be undone.</p>
      </header>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-[760px] space-y-6">
          {days.map((day) => (
            <section key={day.label}>
              <SectionLabel>{day.label}</SectionLabel>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {day.items.map((entry) => (
                  <Row key={entry.id} entry={entry} onUndo={() => onUndo(entry.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({ entry, onUndo }: { entry: ActivityEntry; onUndo: () => void }) {
  const { icon: Icon, tint } = actionMeta[entry.action];
  return (
    <motion.li layout="position" className="flex items-center gap-3 px-4 py-3">
      <span className={cx("grid size-7 shrink-0 place-items-center rounded-lg", tint, entry.undone && "opacity-40")}>
        <Icon size={14} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cx("truncate", entry.undone && "text-fg-3 line-through decoration-fg-3/50")}>{sentence(entry)}</div>
        <div className="tabular flex items-center gap-1.5 text-[11.5px] text-fg-3">
          <span>{formatTime(entry.at)}</span>
          {entry.auto && (
            <>
              <span>·</span>
              <span className="text-accent/80">Automatic</span>
            </>
          )}
          {entry.count > 0 && (
            <>
              <span>·</span>
              <span>
                {entry.count} {entry.count === 1 ? "file" : "files"}, {formatBytes(entry.bytes)}
              </span>
            </>
          )}
        </div>
      </div>
      {entry.undone ? (
        <span className="px-2.5 text-[12px] text-fg-3">Undone</span>
      ) : entry.action !== "rule" ? (
        <Button variant="ghost" size="sm" onClick={onUndo}>
          Undo
        </Button>
      ) : null}
    </motion.li>
  );
}
