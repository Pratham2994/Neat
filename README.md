# Neat

A local-first Windows utility that treats the Downloads folder as an inbox that needs processing, not permanent storage.

> Status: v0.1, ready for a first real test on Windows. Scope beyond v0.1 is still open.

## What it does

- Scans the top level of Downloads and groups files for review: unfinished downloads, duplicate downloads, archives you already extracted, installers for apps you already have, several versions of one document, receipts, file-type groups, and large files untouched for six months.
- Shows where each file came from (the site the browser recorded) and why Neat suggests what it does.
- One decision per group: move into a folder inside Downloads, keep, or recycle. "Apply all sure suggestions" handles the certain ones in one press.
- Rules: tick "Always move files like these" and Neat files matching downloads by itself from then on. Rules only move files; recycling always waits for you.
- Every change is logged and can be undone. Recycling goes through the Windows Recycle Bin, never a permanent delete.
- Runs in the tray, watches Downloads, and can start when you sign in. Closing the window keeps it running.

## Decisions so far

- **Users:** power users and non-technical users. The first real user is the author, so it must be useful to the author first.
- **Where files go:** Neat organises inside the Downloads folder. It creates its folders there. No file is moved out of Downloads.
- **Synced folders:** OneDrive and other synced folders are not supported.
- **Automation:** when Neat is sure, it acts without asking. When it is not sure, the item goes to the review queue. Automatic actions are moves inside Downloads only, based on fixed signals or confirmed rules. Recycle and delete always need review. The inbox shows what Neat did since your last visit, with undo.
- **UI:** dark mode first. Sleek, modern, clean and fast. Grouped review, keyboard-first.
- **Distribution:** a Windows installer built by CI. Not code-signed yet.
- **Tech stack:** Tauri 2 (Rust core, TypeScript UI) and SQLite. Local models are optional and come later.

## Try it on Windows

1. **Get the installer.** On GitHub, open Actions → "Windows build" → the latest green run on `main` → download the `neat-windows-installer` artifact and unzip it.
2. **Install.** Run `Neat_0.1.0_x64-setup.exe`. It installs for your user only, no admin rights needed. The installer is not signed yet, so Windows SmartScreen warns: choose "More info" → "Run anyway".
3. **First run on a copy, not your real Downloads.** Quit any running Neat first (tray icon → Quit Neat); a second launch only brings the running one forward. Then, in PowerShell:

   ```powershell
   robocopy "$env:USERPROFILE\Downloads" "$env:USERPROFILE\NeatTest" /E /COPY:DAT /DCOPY:T
   $env:NEAT_DOWNLOADS = "$env:USERPROFILE\NeatTest"
   & "$env:LOCALAPPDATA\Neat\Neat.exe"
   ```

   `robocopy` keeps the dates and normally the browser's source-site records too, so the copy behaves like the real folder. If the From column says "Not recorded" for everything, the copy lost them. With `NEAT_DOWNLOADS` set, Neat works only in that folder and keeps a separate history; Settings and the status strip say "Test folder". Quit Neat from the tray icon before switching back.
4. **Real use.** Start Neat from the Start menu. It uses your real Downloads folder.

Closing the window keeps Neat in the tray. Quit from the tray icon.

## Development

Requirements: [Rust](https://rustup.rs), Node.js 20+. Running the app needs Windows 10/11 with WebView2 (included in Windows 11).

```sh
npm install
npm run tauri dev      # desktop app with hot reload
npm run dev            # UI only, in the browser, with a mock backend and sample data
npm run typecheck
npm run format         # Prettier
cargo test -p neat-core   # the core, end to end, on a fake Downloads folder
npm run e2e            # Linux only: the real app, driven through tauri-driver (see CLAUDE.md)
```

CI (`.github/workflows/windows.yml`) builds on Windows, runs the core test there, and uploads the installer.

## Core job

Periodically or manually inspect Downloads and intelligently:

- Organize files into useful folders/categories.
- Group related files and versions.
- Detect exact and near-duplicates.
- Recognize archives and their extracted copies.
- Recognize installers that have likely served their purpose.
- Surface old, large, stale, temporary, or redundant files.
- Suggest Keep / Move / Archive / Delete actions.
- Learn from the user's previous decisions.

## Decision signals

Use normal programmatic signals first:

- Filename and extension/type
- Size
- Age and timestamps
- Exact hashes
- Similar filenames/content
- File relationships
- Archive contents/extraction
- Installed software where relevant
- Usage/access information where reliably available
- Document/media metadata
- Existing folder structure

Use a small local 2–4B model only when semantic understanding is useful, such as deciding whether a document is a receipt, university file, project asset, reference material, temporary download, etc.

## Personalization

Every recommendation should let the user respond with actions such as:

- Keep
- Move
- Archive
- Delete
- Always do this
- Never suggest this again

Those decisions gradually build personal organization rules. ML can later learn predicted actions from this history.

## UX

The primary experience should be a review queue:

File → What Neat thinks it is → Why → Suggested destination/action → Confidence

Support bulk approval and manual corrections.

Every filesystem operation should be logged and reversible.

## Important features

- Semantic organization, not merely extension-based folders
- Version-family detection such as report, report (1), report_final, etc.
- Duplicate and near-duplicate detection
- Archive ↔ extracted-folder relationships
- Installer cleanup suggestions
- Large/stale-file discovery
- User-created rules
- Learned preferences
- Local processing/privacy
- Undo/history
- Conservative cleanup

## Product principle

Organization is the product. Cleanup is secondary.

The application should help Downloads stop becoming a digital junk drawer without becoming an aggressive disk-cleaner that users cannot trust.
