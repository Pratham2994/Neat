import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// A keyboard key, drawn as a small hairline box. Inherits colour from its parent.
export function Key({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[3px] px-1",
        "border border-current/30 font-sans text-[10.5px] font-medium leading-none",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type Variant = "primary" | "soft" | "outline" | "recycle" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  // The chosen action, at full strength.
  primary: "bg-cobalt text-cobalt-deep hover:bg-cobalt-soft active:bg-cobalt",
  // Neat's suggestion on a row that is not selected: cobalt ink on a hairline, no fill.
  soft: "border border-cobalt/40 text-cobalt-soft hover:border-cobalt/70 hover:bg-row-hover active:bg-row-selected",
  outline: "border border-rule-strong text-ink hover:border-ink-3 hover:bg-row-hover active:bg-row-selected",
  recycle: "border border-rule-strong text-ink hover:border-brick/60 hover:text-brick active:bg-brick/10",
  ghost: "text-ink-2 hover:bg-row-hover hover:text-ink active:bg-row-selected",
};

const sizes: Record<Size, string> = {
  sm: "h-[30px] px-2.5 text-[13px]",
  md: "h-8 px-3 text-[13px]",
};

export function Button({
  variant = "outline",
  size = "sm",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] font-medium",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className={cx("shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-90")}
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cx(
        "relative h-[18px] w-8 shrink-0 rounded-[4px] border transition-colors duration-150",
        on ? "border-cobalt/60" : "border-rule-strong hover:border-ink-3",
      )}
    >
      <span
        className={cx(
          "absolute top-[3px] size-2.5 rounded-[2px] transition-[left,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          on ? "left-[17px] bg-cobalt" : "left-[3px] bg-ink-3",
        )}
      />
    </button>
  );
}
