import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import type { Toast as ToastData } from "../lib/store";
import { Kbd } from "./ui";

const VISIBLE_MS = 5000;

export function Toast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: ToastData | null;
  onUndo: (entryId: string) => void;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onDismiss(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 600, damping: 38 }}
            role="status"
            className="pointer-events-auto flex h-10 items-center gap-2.5 rounded-xl border border-line-strong bg-surface-4/95 pl-3 pr-1.5 shadow-[0_12px_40px_rgb(0_0_0/0.45)] backdrop-blur"
          >
            <CheckCircle2 size={15} className="text-accent" />
            <span className="text-[12.5px]">{toast.message}</span>
            {toast.undoEntryId ? (
              <button
                onClick={() => onUndo(toast.undoEntryId!)}
                className="ml-1 flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-white/8"
              >
                Undo <Kbd>Z</Kbd>
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
