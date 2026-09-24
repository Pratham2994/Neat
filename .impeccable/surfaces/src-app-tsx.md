---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/Inbox.tsx","src/components/Activity.tsx","src/components/Rules.tsx"]
---

# Surface: Neat app shell (Inbox, Activity, Rules)

Scope: the whole desktop window. Mode: Operate.

Audience and job: the author, every few days per machine, one to two minutes. Clear what piled up since the last visit, check what Neat did alone, undo if needed. Secondary: non-technical users; detail stays hidden until asked.

Task and states: decide each group (apply suggestion, keep, recycle, move); apply all high-confidence groups in one click; review automatic moves since last visit; undo anything. States: backlog, partially cleared, all clear, scanning, file in use.

Constraints: dark first; no glow, no decorative icon tiles, no generic dark-SaaS look; plain brief voice; keyboard and mouse equal; large obvious action buttons.

Memorable moment: a decided row compresses into a one-line ledger entry and settles into "Done this session", so the manifest visibly empties.

Deviations from the contract, cited: no row numbers, because rows renumber as the manifest empties and the numbers would carry no information (craft floor: numbering must carry information). Below 1020px the From column folds into each group's summary line in mono instead of taking its own column.

Unresolved: sharing rules between machines; how a scan in progress reads at 1,000+ files.

## Direction contract

THESIS: Downloads are consignments arriving at a desk. Each shows its origin, contents and weight on a ruled manifest, and gets one disposition. Refuses the sidebar, list and detail pane with icon tiles.

OWN-WORLD: warm near-black ground, warm off-white ink, hairline rules as the only structure, no cards. One cobalt ink for the chosen action, brick only on recycle. Public Sans for text; a monospace for typed entries (origin hosts, file names, sizes, counts, rule patterns). Rectangular 4px buttons, labels plus key.

STORY: the visitor sees what arrived since the last visit, why each group is what it is, and clears it with one press per row or one batch press.

FIRST VIEWPORT: top bar with wordmark and text tabs; "Since Tuesday" count line; one ledger line for automatic moves; batch bar with the primary button; the manifest table filling the width, a disposition button row on every line; status strip with the key legend at the bottom.

FORM: shipping manifest, position 6 of 7, seed key 129ee1b7.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
