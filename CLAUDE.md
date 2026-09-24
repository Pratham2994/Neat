# Neat

Neat is a local-first Windows utility that turns the Downloads folder into a managed inbox.

Prioritize intelligent organization, related/versioned-file grouping, duplicate detection, useful cleanup suggestions, personalization from user decisions, and a fast review workflow.

> Baseline only. Scope, features and requirements are still under discussion. Do not treat this file or README.md as the final spec.

## Scope decisions

- Neat works only inside the Downloads folder. It creates its folders inside Downloads. Files never move out of Downloads.
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

- `src/` React UI. `src/lib/types.ts` holds the shapes the Rust core returns. `src/lib/mock.ts` is placeholder data; the UI is not wired to the core yet.
- `core/` (`neat-core`): scanning, detectors, rules, SQLite journal, moves, Recycle Bin and undo. Platform-neutral except `source.rs` (Zone.Identifier), `installers.rs` (registry) and the hidden marker attribute, which are `cfg(windows)`.
- `src-tauri/` Tauri shell. `src/lib.rs` exposes the core as commands (`scan`, `apply`, `apply_suggested`, `undo`, `activity`, `rules`, `set_rule_enabled`).
- Cargo workspace at the root. `cargo test -p neat-core` runs the end-to-end test (`core/tests/e2e.rs`) against a fake Downloads folder.
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
