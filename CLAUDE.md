# Neat

Neat is a local-first Windows utility that turns the Downloads folder into a managed inbox.

Prioritize intelligent organization, related/versioned-file grouping, duplicate detection, useful cleanup suggestions, personalization from user decisions, and a fast review workflow.

> Baseline only. Scope, features and requirements are still under discussion. Do not treat this file or README.md as the final spec.

## Scope decisions

- Neat works only inside the Downloads folder. It creates its folders inside Downloads. Files never move out of Downloads.
- No OneDrive or synced-folder support.
- When confidence is high, Neat acts without asking. Every automatic action is logged and can be undone. Anything less certain goes to the review queue.
- Built for the author's own use first. Defaults must still be safe for non-technical users.
- Stack: Tauri 2, Rust core, TypeScript UI, SQLite.

## Rules

- Prefer deterministic logic over AI when possible.
- Use local AI only for genuinely semantic/ambiguous classification.
- Never let an LLM directly perform destructive actions.
- Permanent deletion must never happen silently.
- Filesystem actions should be explainable and reversible.
- Preserve user trust, privacy, and data locally.
- Do not over-engineer speculative features or lock architecture prematurely.
