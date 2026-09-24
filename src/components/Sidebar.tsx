import { motion } from "motion/react";
import { History, Inbox, ListChecks, type LucideIcon } from "lucide-react";
import { formatBytes, formatCount, relativeTime } from "../lib/format";
import type { View } from "../lib/store";
import type { FolderStatus } from "../lib/types";
import { cx, Kbd } from "./ui";

interface Props {
  view: View;
  inboxCount: number;
  folder: FolderStatus;
  onView: (view: View) => void;
}

const items: { view: View; label: string; icon: LucideIcon; key: string }[] = [
  { view: "inbox", label: "Inbox", icon: Inbox, key: "1" },
  { view: "activity", label: "Activity", icon: History, key: "2" },
  { view: "rules", label: "Rules", icon: ListChecks, key: "3" },
];

export function Sidebar({ view, inboxCount, folder, onView }: Props) {
  return (
    <aside className="flex w-[216px] shrink-0 flex-col border-r border-line bg-sidebar px-3 pb-3 pt-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <Logo />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Neat</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.view === view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => onView(item.view)}
              className={cx(
                "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
                active ? "text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-surface-3"
                  transition={{ type: "spring", stiffness: 700, damping: 50 }}
                />
              )}
              <Icon size={15} strokeWidth={1.8} className="relative" />
              <span className="relative flex-1 text-left">{item.label}</span>
              {item.view === "inbox" && inboxCount > 0 ? (
                <span className="tabular relative rounded-md bg-accent/12 px-1.5 text-[11px] font-medium leading-[18px] text-accent">
                  {inboxCount}
                </span>
              ) : (
                <span className="relative opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <Kbd>Ctrl {item.key}</Kbd>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium">Downloads</span>
          {folder.watching && (
            <span className="flex items-center gap-1.5 text-[11px] text-fg-2">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50 [animation-duration:2.4s]" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              Watching
            </span>
          )}
        </div>
        <div className="tabular mt-0.5 text-[11.5px] text-fg-3">
          {formatCount(folder.files)} files · {formatBytes(folder.bytes)}
        </div>
        <div className="mt-0.5 text-[11px] text-fg-3">Scanned {relativeTime(folder.lastScan)}</div>
      </div>
    </aside>
  );
}

function Logo() {
  // Four tiles in a grid, fading from solid to faint: things put in order.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="1" width="9" height="9" rx="2.5" className="fill-accent" />
      <rect x="12" y="1" width="9" height="9" rx="2.5" className="fill-accent/45" />
      <rect x="1" y="12" width="9" height="9" rx="2.5" className="fill-accent/45" />
      <rect x="12" y="12" width="9" height="9" rx="2.5" className="fill-accent/20" />
    </svg>
  );
}
