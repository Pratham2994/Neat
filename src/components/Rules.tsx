import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Rule } from "../lib/types";
import { cx } from "./ui";

export function Rules({ rules, onToggle }: { rules: Rule[]; onToggle: (id: string) => void }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="px-6 pb-4 pt-5">
        <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Rules</h1>
        <p className="mt-0.5 text-fg-2">Rules run on new downloads without asking. Tick “Always do this” in the inbox to add one.</p>
      </header>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-[760px]">
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[12.5px] text-fg-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />
            Rules only move files between folders inside Downloads. Recycling always waits for your review.
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {rules.map((rule) => (
              <li key={rule.id} className={cx("flex items-center gap-4 px-4 py-3 transition-opacity", !rule.enabled && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{rule.when}</div>
                  <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
                    <ArrowRight size={12} className="text-fg-3" />
                    {rule.then}
                  </div>
                </div>
                <span className="tabular shrink-0 text-[12px] text-fg-3">{rule.matched} matched</span>
                <Switch on={rule.enabled} onChange={() => onToggle(rule.id)} label={`Turn ${rule.enabled ? "off" : "on"} rule`} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cx(
        "relative flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200",
        on ? "justify-end bg-accent" : "justify-start bg-surface-4",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 40 }}
        className={cx("size-4 rounded-full shadow-sm", on ? "bg-accent-ink" : "bg-fg-2")}
      />
    </button>
  );
}
