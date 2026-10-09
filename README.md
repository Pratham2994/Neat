# Neat

A Windows tray app that keeps the Downloads folder organised. It treats Downloads as an
inbox to clear, not a place where files live for ever.

Most organisers sort one file at a time, by extension or by an AI label. Neat looks at
how files relate to each other and where they came from, and asks you one question per
group.

Three things make it worth running:

- **It reviews groups, not files.** Five installers for apps you already have is one
  decision, not five. So is the same PDF downloaded three times.
- **Every suggestion says why.** The site the browser recorded, the matching hash, the
  version already installed. You see the evidence before anything moves.
- **Nothing is final.** Every change is logged and can be undone. Recycling goes through
  the Windows Recycle Bin, and it never happens without you.

> Status: v0.2. In daily use on Windows.

## What it finds

| Group                | How Neat knows                                                    | Suggests |
| -------------------- | ----------------------------------------------------------------- | -------- |
| Unfinished downloads | Partial files the browser left behind                             | Recycle  |
| Duplicate downloads  | Identical content, by hash. The copy with the first name is kept  | Recycle  |
| Extracted archives   | The archive's listing matches a folder next to it                 | Recycle  |
| Installers           | The app is in the Windows installed-apps list, same or newer      | Recycle  |
| Document versions    | One base name: report, report (1), report_final                   | Move     |
| Receipts             | The source site, and invoice, receipt, order or bill in the name  | Move     |
| File types           | What is left, grouped by kind                                     | Move     |
| Large and stale      | Big files not changed in six months. Weak evidence, so it says so | Recycle  |

All of this is plain logic: names, sizes, hashes, archive listings, installer metadata.
No model decides anything. Each file lands in at most one group.

## How a session goes

Open Neat every few days. The first screen shows what it did since your last visit and
what needs a decision.

- One decision per group: move into a folder inside Downloads, keep, or recycle.
- "Apply all sure suggestions" handles the certain ones in one press.
- Tick "Always move files like these" and Neat files matching downloads by itself from
  then on. Rules only ever move files. Recycling always waits for you.

It runs in the tray, watches the folder, and can start when you sign in. Closing the
window keeps it running.

## What it will not do

- Move a file out of the folder it manages. It makes its own folders inside it.
- Delete anything permanently, or recycle anything without a decision from you.
- Touch files that are in use or still downloading.
- Reorganise folders you made or extracted yourself.
- Run on a whole drive, your user profile root, Windows or app folders, or OneDrive.
- Send anything off the machine.

## Install

1. Open [Releases](https://github.com/Pratham2994/Neat/releases) and download
   `Neat_<version>_x64-setup.exe` from the latest one.
2. Run it. It installs for your user only, so it needs no admin rights.

The installer is not code-signed yet, so Windows SmartScreen warns on the first install.
Choose "More info", then "Run anyway".

After that, Neat updates itself. It checks GitHub every six hours, downloads a new
version in the background, and shows "Restart to update". It installs only when you
press that. Each update is checked against a public key built into Neat, so a changed
or older file is refused.

By default Neat manages Downloads. Settings → Folder → Change points it at another
folder. Each folder keeps its own history and rules.

## Try it on a copy first

If you do not want Neat near your real Downloads yet, run it on a copy. Quit any
running Neat first (tray icon → Quit Neat), then in PowerShell:

```powershell
robocopy "$env:USERPROFILE\Downloads" "$env:USERPROFILE\NeatTest" /E /COPY:DAT /DCOPY:T /XF desktop.ini
$env:NEAT_DOWNLOADS = "$env:USERPROFILE\NeatTest"
& "$env:LOCALAPPDATA\Neat\Neat.exe"
```

With `NEAT_DOWNLOADS` set, Neat works only in that folder and keeps a separate history.
Settings and the status strip say "Test folder". `robocopy` keeps the dates and normally
the browser's source-site records, so the copy behaves like the real folder.

`/XF desktop.ini` matters. Without it, Explorer shows the copy as a second "Downloads".
If that already happened:

```powershell
Remove-Item "$env:USERPROFILE\NeatTest\desktop.ini" -Force
attrib -r -s "$env:USERPROFILE\NeatTest"
```

Delete the NeatTest folder when you are done.

## Layout

```
core/        The engine, in Rust. No UI and no Tauri, so it can be tested alone.
             scan       reads the top level of the folder
             detect     turns a scan into review groups
             engine     applies decisions, logs them, undoes them
             rules      what you told it to always do
             hash, names, installers, source   the signals detect uses

src-tauri/   The desktop shell: tray, folder watcher, updater, commands for the UI.

src/         The UI, in React and TypeScript. `npm run dev` runs it in a browser
             against a mock backend with sample data.

e2e/         The real app, driven through tauri-driver.
```

History and rules live in a local SQLite file. A test folder gets its own.

## Development

Requirements: [Rust](https://rustup.rs) and Node.js 20 or newer. Running the app needs
Windows 10 or 11 with WebView2, which Windows 11 includes.

| Command                   | What it does                                            |
| ------------------------- | ------------------------------------------------------- |
| `npm install`             | Once                                                    |
| `npm run tauri dev`       | The desktop app, with hot reload                        |
| `npm run dev`             | The UI only, in a browser, with sample data             |
| `npm run typecheck`       | TypeScript                                              |
| `npm run format`          | Prettier                                                |
| `cargo test -p neat-core` | The core, end to end, on a fake Downloads folder        |
| `npm run e2e`             | Linux only: the real app through tauri-driver           |

CI builds on Windows, runs the core test there, and uploads the installer. A `v*` tag
also signs the update and publishes a GitHub release.

## Not built, on purpose

- **A local model.** The plan allows a small one later, only for questions plain logic
  cannot answer, such as "is this document a receipt". It will never be the reason a
  file moves by itself.
- **Synced folders.** OneDrive and similar are refused.
- **Shared rules between machines.** Rules and history are per machine today.
- **A signed installer.** Updates are signed. The installer itself is not yet, which is
  why SmartScreen warns once.

## Licence

MIT.
