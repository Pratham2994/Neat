# Neat

Neat is a local-first Windows utility that turns the Downloads folder into a managed inbox.

Prioritize intelligent organization, related/versioned-file grouping, duplicate detection, useful cleanup suggestions, personalization from user decisions, and a fast review workflow.

> Baseline only. Scope, features and requirements are still under discussion. Do not treat this file or README.md as the final spec.

## Scope decisions

- Neat works inside one folder: Downloads by default, or a folder the user picks in Settings (`core/src/folder.rs` refuses drive roots, the profile root, system and app folders, OneDrive, and Neat-made folders). It creates its folders inside that folder. Files never move out of it. Each folder has its own history database.
- No OneDrive or synced-folder support.
- When confidence is high, Neat acts without asking. Every automatic action is logged and can be undone. Anything less certain goes to the review queue.
- Automatic actions are moves inside Downloads only, triggered by deterministic signals or rules the user confirmed. Never auto-act on model confidence alone.
- Recycle and delete always go through the review queue. Never automatic.
- Show a summary of automatic actions (for example "Neat moved 12 files today") with one-click undo.
- Skip files that are in use or still downloading (`.crdownload`, `.part`). Wait and retry.
- Mark every folder Neat creates with a hidden marker file. Never reorganise folders the user made or extracted.
- Built for the author's own use first. Defaults must still be safe for non-technical users.
- Stack: Tauri 2, Rust core, React + TypeScript UI, SQLite.

## UI

- Dark mode first. Sleek, modern, clean, fast. Never cluttered.
- The review queue is grouped into stacks (one decision per group), not a flat list of files.
- Keyboard-first: every review action has a shortcut.
- Motion is short and purposeful (under 200 ms). No decorative animation.
- Design tokens live in `src/styles.css`. Use them, do not hard-code colours.

## Layout and commands

- `src/` React UI. `src/lib/api.ts` talks to the core through Tauri commands; in a plain browser it falls back to `src/lib/mockBackend.ts` (sample data in `mock.ts`). `src/lib/types.ts` mirrors `core/src/model.rs`. `src/lib/store.ts` holds state and the actions that call the core.
- `core/` (`neat-core`): scanning, detectors, rules, SQLite journal, moves, Recycle Bin and undo. Platform-neutral except `source.rs` (Zone.Identifier), `installers.rs` (registry) and the hidden marker attribute, which are `cfg(windows)`.
- `src-tauri/` Tauri shell. `src/lib.rs` exposes the core as commands, runs the tray (closing the window hides it), start at sign-in, single instance, and the folder switch (choice saved in `config.json` in app data). `src/watcher.rs` watches the folder, rescans after changes and emits `inbox-changed`. `src/updates.rs` checks GitHub Releases and emits `update-ready`; it is on only when the build config has `plugins.updater.pubkey`, which the release workflow adds.
- `NEAT_DOWNLOADS=<folder>` points the app at a test folder with its own history (`neat-test.db`).
- Cargo workspace at the root. `cargo test -p neat-core` runs the core end-to-end test (`core/tests/e2e.rs`) against a fake Downloads folder.
- `npm run e2e` (Linux) builds the app and drives the real app through `tauri-driver` on a fake Downloads folder (`e2e/app.e2e.mjs`). Needs Xvfb, WebKitWebDriver, dbus-run-session and `cargo install tauri-driver --locked`. Run it at milestones, not after every change.
- CI (`.github/workflows/windows.yml`) builds on Windows, runs the core test there, and uploads the installer. A `v*` tag also signs the update (secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `TAURI_UPDATER_PUBKEY`), takes the version from the tag, and publishes a GitHub release with `latest.json`.
- `npm run typecheck`, `npm run build`, `npm run format` for the UI (Prettier, print width 130).
- On Linux, `cargo check -p neat` needs `libwebkit2gtk-4.1-dev`. A Windows cross-check of `neat-core` does not work from Linux because bundled SQLite needs MSVC headers. Running the app needs Windows.

## Design

- `PRODUCT.md` (product truth) and `DESIGN.md` (visual system, tokens) are written and maintained with the impeccable skill. `.impeccable/surfaces/` holds the direction contract for the app shell.
- The visual direction is "Manifest": one ruled table, hairlines instead of cards, warm near-black ground, cobalt only for the chosen action, brick only for recycle.

## Rules

- Prefer deterministic logic over AI when possible.
- Use local AI only for genuinely semantic/ambiguous classification.
- Never let an LLM directly perform destructive actions.
- Permanent deletion must never happen silently.
- Filesystem actions should be explainable and reversible.
- Preserve user trust, privacy, and data locally.
- Do not over-engineer speculative features or lock architecture prematurely.
