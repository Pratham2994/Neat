import { motion } from "motion/react";
import {
  Check,
  File,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderInput,
  Package,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatBytes, plural, relativeTime } from "../lib/format";
import { affectedFiles } from "../lib/store";
import type { ActionKind, FileItem, Stack } from "../lib/types";
import { Button, ConfidenceDot, cx, Kbd, KindIcon, kindMeta, SectionLabel } from "./ui";

interface Props {
  stack: Stack;
  always: boolean;
  onAlways: (value: boolean) => void;
  onResolve: (action: ActionKind) => void;
}

export function StackDetail({ stack, always, onAlways, onResolve }: Props) {
  const affected = affectedFiles(stack);
  const affectedBytes = affected.reduce((n, f) => n + f.size, 0);
  const mixed = stack.files.some((f) => f.fate === "kept");

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-sidebar">
      <motion.div
        key={stack.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 overflow-y-auto px-5 pb-5 pt-5"
      >
        <div className="flex items-center gap-3">
          <KindIcon kind={stack.kind} size="lg" />
          <div className="text-[12px]">
            <div className="font-medium text-fg-2">{kindMeta[stack.kind].label}</div>
            <ConfidenceDot level={stack.confidence} withLabel />
          </div>
        </div>

        <h2 className="mt-4 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{stack.title}</h2>
        <p className="mt-1 text-fg-2">{stack.summary}</p>

        <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
          <SectionLabel>Suggested</SectionLabel>
          <div className="flex items-center gap-2 text-[14px] font-medium">
            {stack.action === "recycle" ? (
              <Trash2 size={15} className="text-danger" />
            ) : (
              <FolderInput size={15} className="text-accent" />
            )}
            {suggestionText(stack)}
          </div>
          <p className="mt-1 text-[12px] text-fg-3">
            {stack.action === "recycle"
              ? `Frees ${formatBytes(affectedBytes)}. Files go to the Recycle Bin and can be restored.`
              : "The folder is created inside Downloads. Nothing leaves Downloads."}
          </p>
        </div>

        <section className="mt-6">
          <SectionLabel>Why</SectionLabel>
          <ul className="space-y-2.5">
            {stack.evidence.map((e) => (
              <li key={e.text} className="flex gap-2.5">
                <Check size={14} strokeWidth={2.2} className="mt-[3px] shrink-0 text-accent" />
                <div>
                  <div>{e.text}</div>
                  {e.detail && <div className="text-[12px] text-fg-3">{e.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <SectionLabel>{plural(stack.files.length, "file")}</SectionLabel>
          <ul className="-mx-2">
            {stack.files.map((file) => (
              <FileRow key={file.id} file={file} showFate={mixed} />
            ))}
          </ul>
        </section>
      </motion.div>

      <footer className="space-y-3 border-t border-line px-5 py-4">
        {stack.action === "move" && (
          <label className="flex items-center gap-2.5 text-[12.5px] text-fg-2">
            <input
              type="checkbox"
              checked={always}
              onChange={(e) => onAlways(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={cx(
                "grid size-4 place-items-center rounded-[5px] border transition-colors duration-150",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/70",
                always ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface-2",
              )}
            >
              {always && <Check size={11} strokeWidth={3} />}
            </span>
            Always do this for similar files
          </label>
        )}
        <div className="flex gap-2">
          <Button
            variant={stack.action === "recycle" ? "danger" : "primary"}
            className="flex-1"
            onClick={() => onResolve(stack.action)}
          >
            {stack.action === "recycle" ? "Recycle" : "Move"} {plural(affected.length, "file")}
            <Kbd>↵</Kbd>
          </Button>
          <Button variant="secondary" onClick={() => onResolve("keep")}>
            Keep
            <Kbd>K</Kbd>
          </Button>
          {stack.action === "move" && (
            <Button variant="secondary" size="icon" title="Recycle instead (R)" aria-label="Recycle instead" onClick={() => onResolve("recycle")}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </footer>
    </aside>
  );
}

function suggestionText(stack: Stack): string {
  const n = affectedFiles(stack).length;
  if (stack.action === "move") return `Move ${plural(n, "file")} to ${stack.destination}`;
  if (stack.action === "recycle") return `Recycle ${plural(n, "file")}`;
  return "Keep as they are";
}

const extIcons: Record<string, LucideIcon> = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
  jpg: FileImage, jpeg: FileImage, png: FileImage, webp: FileImage, gif: FileImage,
  mp4: FileVideo, mkv: FileVideo, mov: FileVideo,
  zip: FileArchive, "7z": FileArchive, rar: FileArchive, gz: FileArchive, iso: FileArchive,
  exe: Package, msi: Package,
};

function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

function FileRow({ file, showFate }: { file: FileItem; showFate: boolean }) {
  const [base, ext] = splitName(file.name);
  const isFolder = file.note?.startsWith("Folder");
  const Icon = isFolder ? Folder : (extIcons[ext.slice(1).toLowerCase()] ?? File);
  const faded = showFate && file.fate === "affected";

  return (
    <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
      <Icon size={15} strokeWidth={1.7} className="shrink-0 text-fg-3" />
      <div className="min-w-0 flex-1">
        <div className={cx("selectable flex min-w-0 text-[12.5px]", faded && "text-fg-2")} title={file.name}>
          <span className="truncate">{base}</span>
          <span className="shrink-0">{ext}</span>
        </div>
        <div className="tabular truncate text-[11.5px] text-fg-3">
          {formatBytes(file.size)} · {relativeTime(file.modified)}
          {file.source && ` · ${file.source}`}
        </div>
      </div>
      {showFate && file.fate === "kept" && (
        <span className="shrink-0 rounded-md bg-accent/10 px-1.5 text-[11px] font-medium leading-5 text-accent">Kept</span>
      )}
      {showFate && file.fate === "affected" && (
        <span className="shrink-0 rounded-md bg-danger/[0.08] px-1.5 text-[11px] font-medium leading-5 text-danger/90">Recycle</span>
      )}
      {file.note && !isFolder && (
        <span className="shrink-0 rounded-md bg-surface-3 px-1.5 text-[11px] leading-5 text-fg-2">{file.note}</span>
      )}
    </li>
  );
}
