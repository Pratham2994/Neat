import { dayLabel, formatBytes, formatTime, plural } from "../lib/format";
import type { ActivityEntry } from "../lib/types";
import { Button, cx } from "./ui";

const verbs: Record<ActivityEntry["action"], { word: string; tone: string }> = {
  move: { word: "Moved", tone: "text-cobalt-soft" },
  recycle: { word: "Recycled", tone: "text-brick" },
  keep: { word: "Kept", tone: "text-ink-2" },
  rule: { word: "New rule", tone: "text-ink" },
};

function what(e: ActivityEntry): string {
  if (e.action === "rule") return `${e.title} go to ${e.destination}`;
  return e.destination ? `${e.title} to ${e.destination}` : e.title;
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
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pb-12 pt-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Activity</h1>
        <p className="mt-0.5 text-ink-2">Everything Neat did on this computer, newest first. Any change can be undone.</p>

        {days.map((day) => (
          <section key={day.label} className="mt-7">
            <h2 className="border-b border-rule-strong pb-2 text-[13px] font-semibold">{day.label}</h2>
            <ul>
              {day.items.map((entry) => {
                const verb = verbs[entry.action];
                return (
                  <li
                    key={entry.id}
                    className={cx(
                      "grid grid-cols-[52px_84px_minmax(0,1fr)_auto_64px_72px] items-center gap-x-4 border-b border-rule py-2 pl-3",
                      entry.undone && "text-ink-3",
                    )}
                  >
                    <span className="font-mono text-[12px] text-ink-3">{formatTime(entry.at)}</span>
                    <span className={cx("text-[12px] font-medium", entry.undone ? "text-ink-3" : verb.tone)}>{verb.word}</span>
                    <span className={cx("truncate", entry.undone && "line-through decoration-ink-3/60")}>{what(entry)}</span>
                    <span className="font-mono text-[12px] text-ink-3">
                      {entry.count > 0 ? `${plural(entry.count, "file")}, ${formatBytes(entry.bytes)}` : ""}
                    </span>
                    <span className="text-[12px] text-ink-3">
                      {entry.action === "rule" ? "" : entry.auto ? "By rule" : "By you"}
                    </span>
                    <span className="flex justify-end">
                      {entry.undone ? (
                        <span className="px-2.5 text-[12px] text-ink-3">Undone</span>
                      ) : entry.action !== "rule" ? (
                        <Button variant="ghost" onClick={() => onUndo(entry.id)}>
                          Undo
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
