import type { Settings } from "../lib/types";
import { Switch } from "./ui";

type Change = Partial<Pick<Settings, "autoRules" | "startAtLogin">>;

export function SettingsView({ settings, onChange }: { settings: Settings | null; onChange: (change: Change) => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pb-12 pt-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Settings</h1>
        <p className="mt-0.5 max-w-[75ch] text-ink-2">
          Closing the window keeps Neat running in the tray, so rules keep working. Quit from the tray icon.
        </p>

        {settings ? (
          <div className="mt-6 border-t border-rule-strong">
            <Row
              title="Move files that match a rule without asking"
              detail="When this is off, rules wait and Neat only suggests. Recycling always waits for you either way."
              control={
                <Switch
                  on={settings.autoRules}
                  onChange={() => onChange({ autoRules: !settings.autoRules })}
                  label="Automatic rules"
                />
              }
            />
            <Row
              title="Start Neat when you sign in to Windows"
              detail="Neat starts in the tray and keeps Downloads tidy between visits."
              control={
                <Switch
                  on={settings.startAtLogin}
                  onChange={() => onChange({ startAtLogin: !settings.startAtLogin })}
                  label="Start at sign-in"
                />
              }
            />
            <Row
              title={settings.testFolder ? "Test folder" : "Folder"}
              detail={
                settings.testFolder
                  ? "Set by NEAT_DOWNLOADS. Neat keeps a separate history for it and never touches your real Downloads."
                  : "Neat only works inside this folder. Everything it files stays in here."
              }
              control={<FolderPath path={settings.folder} />}
            />
            <Row title="Version" control={<span className="font-mono text-[12px] text-ink-2">{settings.version}</span>} />
          </div>
        ) : (
          <p className="mt-6 border-t border-rule-strong pt-4 text-ink-2">
            Neat could not read its settings. Quit Neat from the tray icon and open it again.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ title, detail, control }: { title: string; detail?: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-8 border-b border-rule px-3 py-3">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        {detail && <div className="max-w-[75ch] text-[12px] text-ink-2">{detail}</div>}
      </div>
      <div className="flex min-w-0 justify-end">{control}</div>
    </div>
  );
}

// Long paths lose their start, not their end: the last folder name is what tells them apart.
function FolderPath({ path }: { path: string }) {
  return (
    <span className="selectable block max-w-[48ch] truncate font-mono text-[12px] text-ink-2 [direction:rtl]" title={path}>
      <bdi>{path}</bdi>
    </span>
  );
}
