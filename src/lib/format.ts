const UNITS = ["B", "KB", "MB", "GB", "TB"];

// 1024-based to match what File Explorer shows.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit < 2 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

const countFormat = new Intl.NumberFormat("en-IN");

export function formatCount(n: number): string {
  return countFormat.format(n);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return relative.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / (86400 * 7)), "week");
  if (abs < 86400 * 365) return relative.format(Math.round(seconds / (86400 * 30)), "month");
  return relative.format(Math.round(seconds / (86400 * 365)), "year");
}

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dayFormat.format(date);
}
