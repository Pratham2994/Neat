# Neat

A local-first Windows utility that treats the Downloads folder as an inbox that needs processing, not permanent storage.

> Status: early baseline. Scope, features and requirements are still being discussed. Nothing here is final.

## Decisions so far

- **Users:** power users and non-technical users. The first real user is the author, so it must be useful to the author first.
- **Where files go:** Neat organises inside the Downloads folder. It creates its folders there. No file is moved out of Downloads.
- **Synced folders:** OneDrive and other synced folders are not supported.
- **Automation:** when Neat is sure, it acts without asking. When it is not sure, the item goes to the review queue.
- **Distribution:** undecided.
- **Tech stack:** Tauri 2 (Rust core, TypeScript UI) and SQLite. Local models are optional and come later.

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
