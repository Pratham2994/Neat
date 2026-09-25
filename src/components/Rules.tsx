import type { Rule } from "../lib/types";
import { cx, Switch } from "./ui";

export function Rules({ rules, onToggle }: { rules: Rule[]; onToggle: (id: string) => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pb-12 pt-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Rules</h1>
        <p className="mt-0.5 max-w-[75ch] text-ink-2">
          Rules run on new downloads without asking. They only move files between folders inside the folder Neat looks after.
          Recycling always waits for you. Add a rule by ticking “Always move files like these” on a group in the inbox.
        </p>

        <div role="table" aria-label="Rules" className="mt-6">
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_52px] gap-x-4 border-b border-rule-strong px-3 pb-2 text-[12px] text-ink-3"
          >
            <span role="columnheader">When a download is</span>
            <span role="columnheader">Neat does</span>
            <span role="columnheader" className="text-right">
              Matched
            </span>
            <span role="columnheader" className="text-right">
              On
            </span>
          </div>
          {rules.map((rule) => (
            <div
              key={rule.id}
              role="row"
              className={cx(
                "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_52px] items-center gap-x-4 border-b border-rule px-3 py-2.5",
                !rule.enabled && "text-ink-3",
              )}
            >
              <span className="truncate">
                {rule.when}
                {rule.value && <span className="font-mono text-[12px]"> {rule.value}</span>}
              </span>
              <span className={cx("truncate", rule.enabled ? "text-ink-2" : "text-ink-3")}>{rule.then}</span>
              <span className="text-right font-mono text-[12px] text-ink-2">{rule.matched}</span>
              <span className="flex justify-end">
                <Switch on={rule.enabled} onChange={() => onToggle(rule.id)} label={rule.when} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
