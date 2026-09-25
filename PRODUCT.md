# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Windows desktop app. The UI is web tech inside a Tauri 2 shell rendered by WebView2. Mouse, trackpad and keyboard.)

## Users

The primary user is the author: a software engineer who uses two Windows machines, a desktop PC and a laptop. Neat is installed separately on each one. Each machine gets used every few days, so a Neat session happens roughly every 2 to 6 days per machine, not daily.

The job: open Neat, clear the few days of downloads that piled up, close it. It should take a minute or two.

Secondary audience: non-technical Windows users. Defaults must be safe and understandable for them, but the author's workflow comes first.

## Product Purpose

Neat keeps the Windows Downloads folder organised. It treats Downloads as an inbox: it groups related files, explains what each group is, suggests what to do, and does it with one decision per group. Success means Downloads stays tidy with a short session every few days, and the user trusts Neat enough to let its rules run by themselves.

Organisation is the product. Cleanup (recycling) is secondary.

## Positioning

Most organisers sort one file at a time by extension or by an AI label. Neat understands where a file came from (the source site recorded by the browser) and how files relate: installers for apps already installed, archives already extracted, duplicate downloads, versions of the same document. It reviews those as groups, with the evidence shown.

## Operating Context

- Sessions are occasional and short: every few days per machine, one to two minutes. The first screen must show what changed since the last visit and what needs a decision.
- Automatic moves happen between sessions. The user needs a clear account of what Neat did while they were away, with undo.
- Two machines, two separate installs. Rules and history are per machine today. Sharing rules between machines is an open decision.
- The user is at a desk or on a laptop with a trackpad. Actions must be quick to hit with a mouse and with the keyboard.

## Capabilities and Constraints

- Works inside one folder: Downloads, or a folder the user picks in Settings. It creates its category folders inside that folder. Files never leave it.
- Automatic actions are moves only, triggered by deterministic signals or rules the user confirmed. Never automatic on model confidence alone.
- Recycling always needs review and goes through the Windows Recycle Bin. Nothing is deleted permanently or silently.
- Every action is logged and can be undone.
- Skips files that are in use or still downloading.
- Never reorganises folders the user made or extracted; Neat marks its own folders.
- No OneDrive or synced-folder support.
- Local only. No file data leaves the machine.
- Keyboard-first: every review action has a shortcut. Mouse users get large, obvious action buttons.
- Technical detail (full paths, hashes, rule syntax) is hidden by default and shown on demand.
- Local AI is optional and later; deterministic logic first.
- Distribution: a per-user Windows installer built by CI; not code-signed yet, so SmartScreen warns on install.
- Open decisions: code signing, sharing rules between machines.

## Brand Commitments

- Name: Neat.
- Voice: plain and brief. Facts only. No jokes, no exclamation marks. Example: "Moved 6 receipts to Finance."
- Binding visual constraints from the user: dark mode first; sleek, modern, clean, uncluttered, smooth and fast. It must not look AI-generated ("vibecoded"): no glow effects, no decorative icon tiles.

## Evidence on Hand

- No real user data yet. `src/lib/mock.ts` holds illustrative mock groups; it is not real usage data.
- No testimonials, metrics, press or customers exist. Do not invent any.

## Product Principles

1. Organise first, clean up second.
2. Earn trust with reversibility: every action is explained, logged and undoable; recycling never runs by itself.
3. A session every few days should take a minute or two. One decision per group, one click or one key per decision.
4. Every suggestion says why, in plain words, with the evidence (source site, match, installed version).
5. Local and private by default.
