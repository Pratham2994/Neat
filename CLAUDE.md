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

- `src/` React UI. `src/lib/types.ts` holds the shapes the Rust core must return. `src/lib/mock.ts` is placeholder data.
- `src-tauri/` Tauri shell and Rust core.
- `npm run typecheck` and `npm run build` for the UI.
- `cargo check --target x86_64-pc-windows-msvc` in `src-tauri/` to type-check for Windows from Linux. Running the app needs Windows.

## Rules

- Prefer deterministic logic over AI when possible.
- Use local AI only for genuinely semantic/ambiguous classification.
- Never let an LLM directly perform destructive actions.
- Permanent deletion must never happen silently.
- Filesystem actions should be explainable and reversible.
- Preserve user trust, privacy, and data locally.
- Do not over-engineer speculative features or lock architecture prematurely.
