import type { ComponentProps, ReactNode } from "react";
import {
  Archive,
  CircleDashed,
  Copy,
  HardDrive,
  Image,
  Layers,
  PackageCheck,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { Confidence, StackKind } from "../lib/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1",
        "font-sans text-[10.5px] font-medium leading-none",
        "border border-current/15 bg-current/[0.06] opacity-70",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type ButtonVariant = "primary" | "danger" | "secondary" | "ghost";
type ButtonSize = "md" | "sm" | "icon";

const buttonSizes: Record<ButtonSize, string> = {
  md: "h-8 px-3",
  sm: "h-7 px-2.5",
  icon: "size-8",
};

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_1px_0_rgb(255_255_255/0.25)_inset]",
  danger: "bg-danger/15 text-danger hover:bg-danger/22 border border-danger/25",
  secondary: "bg-surface-3 text-fg hover:bg-surface-4 border border-line",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-3",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-[12.5px] font-medium",
        "transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40",
        buttonSizes[size],
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export const kindMeta: Record<StackKind, { icon: LucideIcon; tint: string; label: string }> = {
  installers: { icon: PackageCheck, tint: "text-info bg-info/10", label: "Installers" },
  duplicates: { icon: Copy, tint: "text-warn bg-warn/10", label: "Duplicates" },
  versions: { icon: Layers, tint: "text-violet bg-violet/10", label: "Versions" },
  archive: { icon: Archive, tint: "text-cyan bg-cyan/10", label: "Archive" },
  partial: { icon: CircleDashed, tint: "text-fg-2 bg-white/5", label: "Unfinished" },
  stale: { icon: HardDrive, tint: "text-orange bg-orange/10", label: "Large and old" },
  receipts: { icon: Receipt, tint: "text-accent bg-accent/10", label: "Receipts" },
  images: { icon: Image, tint: "text-accent bg-accent/10", label: "Images" },
};

export function KindIcon({ kind, size = "md" }: { kind: StackKind; size?: "md" | "lg" }) {
  const { icon: Icon, tint } = kindMeta[kind];
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-[9px]",
        size === "lg" ? "size-10" : "size-8",
        tint,
      )}
    >
      <Icon size={size === "lg" ? 19 : 16} strokeWidth={1.8} />
    </span>
  );
}

const confidenceMeta: Record<Confidence, { label: string; dot: string }> = {
  high: { label: "High confidence", dot: "bg-accent" },
  medium: { label: "Medium confidence", dot: "bg-warn" },
  low: { label: "Low confidence", dot: "bg-fg-3" },
};

export function ConfidenceDot({ level, withLabel }: { level: Confidence; withLabel?: boolean }) {
  const meta = confidenceMeta[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-2" title={meta.label}>
      <span className={cx("size-1.5 rounded-full", meta.dot)} />
      {withLabel && <span>{meta.label}</span>}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">{children}</div>;
}
