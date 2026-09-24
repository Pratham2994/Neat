---
name: Neat
description: A ruled manifest for the Downloads folder. Warm near-black ground, hairline rules, one cobalt ink for the chosen action.
colors:
  cobalt: "#8aa4ff"
  cobalt-soft: "#a9bcff"
  cobalt-deep: "#0e1330"
  brick: "#e5806f"
  chrome: "#0e0d0c"
  ground: "#121110"
  row-hover: "#181715"
  row-selected: "#1d1b19"
  rule: "#2a2724"
  rule-strong: "#3b3834"
  ink: "#ede8e0"
  ink-2: "#aba49a"
  ink-3: "#8a847b"
typography:
  wordmark:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
  title-row:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  body:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  button:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  label-strong:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
  data:
    fontFamily: "JetBrains Mono Variable, Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  key:
    fontFamily: "Public Sans Variable, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
rounded:
  thumb: "2px"
  key: "3px"
  control: "4px"
spacing:
  slot-gap: "6px"
  line-y: "10px"
  row-inset: "12px"
  column-gap: "16px"
  gutter: "24px"
  section: "40px"
  page-end: "48px"
  container-max: "1240px"
components:
  top-bar:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.ink}"
    height: "48px"
    padding: "0 24px"
  tab:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
  tab-active:
    textColor: "{colors.ink}"
  status-strip:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    height: "36px"
    padding: "0 24px"
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.cobalt-deep}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-soft}"
  button-primary-md:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.cobalt-deep}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-suggestion:
    textColor: "{colors.cobalt-soft}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-suggestion-hover:
    backgroundColor: "{colors.row-hover}"
  button-outline:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-outline-hover:
    backgroundColor: "{colors.row-hover}"
  button-recycle:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-recycle-hover:
    textColor: "{colors.brick}"
  button-ghost:
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-ghost-hover:
    backgroundColor: "{colors.row-hover}"
    textColor: "{colors.ink}"
  key:
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    padding: "0 4px"
    height: "17px"
  manifest-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    padding: "12px"
  manifest-row-hover:
    backgroundColor: "{colors.row-hover}"
  manifest-row-selected:
    backgroundColor: "{colors.row-selected}"
  ledger-line:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "8px 0 8px 12px"
  ledger-line-settled:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "6px 0 6px 12px"
  switch:
    rounded: "{rounded.control}"
    height: "18px"
    width: "32px"
---

# Design System: Neat

## Overview

**Creative North Star: "The Manifest"**

Downloads are consignments arriving at a desk. Each one is entered on a ruled manifest with its origin, contents and weight, and each gets one disposition. The whole window is that manifest: a warm near-black sheet ruled with hairlines, warm off-white ink, and a single cobalt stamp for the action being taken. Nothing floats above the sheet. There are no cards, no panels, no shadows and no glow; structure comes from rules, alignment and a few steps of ground.

Density is that of a working ledger rather than a dashboard. Body text sits at 13px, figures are tabular, numeric columns are right-aligned, and every typed entry (a host, a file name, a size, a count, a time, a rule pattern) is set in monospace so it reads as recorded data rather than prose. Actions are words with their keys beside them, sized for a mouse and mirrored on the keyboard. Motion is short and purposeful: a decided row folds shut and its title settles into the ledger below, so the manifest visibly empties.

The world is dark only. It rejects the sidebar, list and detail pane with icon tiles, the generic dark-SaaS look, glow effects and decorative icon tiles.

**Key Characteristics:**
- Warm near-black ground in four close steps; chrome sits one step darker than the manifest.
- Hairline rules are the only structure. No cards, no shadows.
- One cobalt ink for the chosen action and its states; brick only on recycle.
- Public Sans for words, JetBrains Mono for typed data, tabular figures throughout.
- Rectangular 4px controls labelled with words, each paired with its key.
- One shared column template, so every figure lines up from header to total.

## Colors

A warm, almost colourless palette of near-blacks and off-whites, with one cool cobalt accent and one warm brick signal.

### Primary
- **Cobalt Stamp** (cobalt): the chosen action at full strength. Fills the primary button (the selected row's suggestion and the batch "Apply" button), draws the active tab underline, the focus ring, the ticked checkbox, the switch thumb when on, the "watching" dot, the tick on an applied notice, and the text selection highlight (at 32%).
- **Pale Cobalt** (cobalt-soft): cobalt as ink rather than fill. Labels Neat's suggestion on rows that are not selected, the "Moved" verb in ledgers, the inline Undo in the status strip, and the "Sure" word while the batch button is previewing. Also the primary button's hover fill.
- **Cobalt Deep** (cobalt-deep): text and ticks on a cobalt fill only (7.6:1 on cobalt).

### Secondary
- **Brick** (brick): recycling and nothing else. Colours the "Recycled" verb in ledgers and the Recycle button's text and border on hover, with a 10% brick wash when pressed.

### Neutral
- **Desk Black** (chrome): the top bar and the status strip, one step darker than the manifest so the sheet reads as lying on the desk.
- **Manifest Ground** (ground): the page, the sticky column header and every row at rest.
- **Hover Step** (row-hover): a row or quiet control under the pointer.
- **Selected Step** (row-selected): the selected row, an expanded row's details, and the rows the batch will apply while its button is hovered or focused.
- **Hairline** (rule): the 1px line between rows, notice lines and bars.
- **Header Rule** (rule-strong): the 1px line under column headers and section headings, the border of outline and recycle buttons and of an off switch, and the scrollbar thumb.
- **Warm Off-White** (ink): primary text, row titles, headings, the wordmark, the active tab.
- **Pencil Grey** (ink-2): secondary text: summaries, subtitles, host names, figures, inactive tabs, ghost buttons, the key legend.
- **Faint Ink** (ink-3): the lowest text step: column headers, timestamps, "Not recorded", evidence detail, undone entries, the status strip. It still clears 4.5:1 on every ground step (4.63:1 on the selected step), and no text colour may go below it.

### Named Rules
**The One Ink Rule.** Cobalt marks the chosen action and the states that follow from it: selected, active, on, focused, applied, moved. It never decorates, never heads a section and never colours an inert word.

**The Suggestion Is Cobalt Rule.** Neat's suggestion always takes the cobalt slot, whatever its verb. "Recycle 5" as a suggestion is cobalt; brick belongs to the alternative Recycle button and to recycling already done.

**The Brick Is Recycle Rule.** Brick appears only on recycle. It is not a general danger, error or warning colour.

**The Ground Step Rule.** State is shown by stepping the ground (ground, then hover step, then selected step), never by adding a border, a tint of the accent or a glow.

## Typography

**Text Font:** Public Sans Variable (with Segoe UI Variable Text, Segoe UI, system-ui)
**Data Font:** JetBrains Mono Variable (with Cascadia Mono, Consolas)

**Character:** Public Sans is a plain, even grotesque that stays out of the way at small sizes; JetBrains Mono makes every recorded value look typed onto the manifest. The pairing splits words from data rather than headings from body, so hierarchy comes from weight and ink step, not size jumps.

### Hierarchy
- **Wordmark** (700, 15px, -0.02em): "Neat" in the top bar. Text only; there is no logo mark.
- **Headline** (600, 18px, -0.01em): the one page title per view (Inbox, Activity, Rules), followed by a Pencil Grey count line or short explanation.
- **Title** (600, 14px): section headings such as "Done this session" and "Nothing waiting". Activity day headings use the same weight at 13px.
- **Row title** (500, 14px): the group name on a manifest row.
- **Body** (400, 13px, 1.45, tabular figures): all running text, ledger entries, notice lines and tab labels. Explanatory paragraphs are capped at 60 to 75ch.
- **Button** (500, 13px): every action label.
- **Label** (400, 12px): column headers, summaries under row titles, evidence detail, the status strip and the key legend.
- **Label strong** (500, 12px): the verb column in ledgers (Moved, Recycled, Kept, New rule).
- **Data** (400, 12px, JetBrains Mono): hosts, file names, sizes, counts, times and rule patterns.
- **Key** (500, 10.5px, line height 1): the legend inside a key cap, and nowhere else.

### Named Rules
**The Mono Is Data Rule.** Monospace is for typed entries only: hosts, file names, sizes, counts, times, rule patterns. Never for labels, headings, prose or key caps.

**The Twelve Floor Rule.** No text is smaller than 12px except the legend inside a key cap (10.5px).

**The Figures Align Rule.** Figures are tabular everywhere and right-aligned in numeric columns, so sizes and counts read down the page like a ledger.

## Layout

The window is three bands: a 48px top bar in Desk Black, the scrolling manifest, and a 36px status strip in Desk Black. All three share one centred container, capped at 1240px with a 24px side gutter, so the wordmark, the page title, the table edges and the status text sit on the same left line.

Each view opens with its headline and one count line, then (on the Inbox) up to two full-width notice lines between hairlines: what Neat moved while the user was away, and the batch line with the primary button. The manifest table follows 24px below. Rows use a 12px inset and a 16px column gap. The Inbox columns are Group (flexible), From (up to 150px), Files (48px), Size (76px), Confidence (56px) and Action (376px), and the column header is sticky at the top of the scroll area on the Manifest Ground.

Actions live in fixed slots (188px, 80px and 96px, 6px apart): suggestion, Keep, Recycle. When a group has no Recycle alternative, that slot stays empty so every verb keeps its vertical line. "Done this session" sits 40px below the table; pages end with 48px of space.

Expanded details open in place under their row and reuse the row's own columns: file names under Group, hosts under From, sizes under Size, each file's fate under Action. The evidence list ("Why") spans the first two columns.

Responsive behaviour is for window widths, not phones. The window defaults to 1180 by 760 and cannot go below 900 by 600. At 1020px and below, the From and Confidence columns fold into each group's summary line (host in monospace, "Sure" or "Unsure" as a leading word), the action slots shrink to 170px, 62px and 78px, the Select and Details entries leave the key legend, and key caps inside row buttons are hidden.

### Named Rules
**The Shared Column Rule.** The column header, every row, the total line and every expanded file line sit on one column template. A new column is added to the template, never to a single row.

**The Fixed Slot Rule.** Each action verb owns a slot and keeps it. A missing action leaves its slot empty rather than shifting its neighbours.

**The Fold, Don't Squeeze Rule.** When width runs out, secondary columns fold into the summary line in their own type (mono stays mono). Columns are never squeezed into truncated slivers.

## Elevation & Depth

The system is flat. There are no shadows anywhere, no glow and no backdrop blur. Depth is conveyed by ground steps alone: the chrome bands sit one step darker than the manifest, and a row lifts by lightening one step on hover and two when selected. Separation comes from 1px hairlines, with the stronger Header Rule marking the start of a table or section.

### Named Rules
**The Hairline Rule.** Hairlines are the only structure. No cards, no filled panels, no boxed groups; if something needs separating, it gets a rule or a step of ground.

**The Flat Sheet Rule.** Nothing casts a shadow. A surface that seems to need one needs a ground step instead.

## Shapes

The form language is rectangular. Controls have gently squared corners (4px): buttons, the dismiss control and the switch track. Smaller marks take 3px (key caps, the checkbox, the inline Undo) and the switch thumb takes 2px, so the corner shrinks with the object. Rows, tables and sections have no corners at all; they are bounded by rules that run the full width of the container. The only circle is the 6px "watching" dot in the status strip.

Icons are functional line marks at 10 to 14px, drawn in the current ink: the disclosure chevron (rotates 90 degrees when open), the tick on evidence lines and notices, the dismiss cross, and arrows inside key caps. They are never filled, tiled or placed on a background.

## Components

### Buttons
Firm, rectangular and word-led. Every button is a label; the dismiss cross on a notice line is the only icon-only control.
- **Shape:** gently squared (4px), 30px tall with 10px side padding; the batch button is 32px tall with 12px padding. Content is a label, then a key cap when the action has a shortcut.
- **Primary:** Cobalt Stamp fill with Cobalt Deep text. Used for the selected row's suggestion and the batch "Apply" button only. Hover lightens to Pale Cobalt.
- **Suggestion:** Pale Cobalt text on a cobalt hairline at 40% strength, no fill. It is the suggestion on rows that are not selected; when the row becomes selected the same button becomes Primary. Hover strengthens the border to 70% and adds the hover step.
- **Outline:** Warm Off-White text on a Header Rule border (Keep, See rules). Hover moves the border to Faint Ink and adds the hover step.
- **Recycle:** looks like Outline at rest. On hover the text turns brick and the border turns brick at 60%; pressed adds a 10% brick wash.
- **Ghost:** Pencil Grey text, no border (Scan now, View, Undo, Undo all). Hover adds the hover step and lifts the text to Warm Off-White.
- **Pressed / Focus / Disabled:** pressed settles the quiet buttons (suggestion, outline, ghost) to the selected step; keyboard focus draws a 2px cobalt outline 2px outside the button; disabled drops to 40% opacity. Colour transitions take 150ms.

### Key Caps
A keyboard key drawn as a small hairline box: 17px tall, at least 17px wide, 4px side padding, 3px corners, a border of the current colour at 30%, and the 10.5px key legend. It inherits the ink of whatever holds it, so it reads cobalt-deep inside a primary button and Pencil Grey in the legend. Key caps appear inside row buttons only on the selected row, inside the batch button, inside the status strip's Undo, and in the key legend.

### Navigation
Text tabs in the top bar, 20px apart, beside the wordmark. Inactive tabs are Pencil Grey and lift to Warm Off-White on hover; the active tab is Warm Off-White with a 2px cobalt underline sitting on the top bar's bottom rule. The underline slides between tabs (220ms). The Inbox tab carries its open group count in Faint Ink. Ctrl 1, 2 and 3 switch tabs.

### Manifest Row (signature component)
One consignment per row: a disclosure chevron, the group name in the row title style with a one-line Label summary beneath, the origin host in Data type (or "Not recorded" in Faint Ink), file count and total size right-aligned in Data type, a confidence word, and the three action slots. Rows are separated by hairlines, sit on the Manifest Ground at rest, take the hover step under the pointer and the selected step when selected. Rows are not numbered, because the numbers would change as the manifest empties.

Confidence is a word, not a badge or a bar: "Sure" in Pencil Grey, "Unsure" in Faint Ink, nothing for the middle case. While the batch button is hovered or focused, the rows it will apply take the selected step and their "Sure" turns Pale Cobalt, and the selected row gives up its highlight so only the batch is marked.

Expanding a row opens its details beneath on the selected step (220ms height and fade). File names are the only selectable text in the window; everything else is chrome. When a row is decided, it folds to nothing (200ms height and fade) and its title travels into "Done this session" through a shared layout transition.

### Ledger Line
The settled form of a decision, used by "Done this session" and by Activity. A verb column in Label strong, coloured by the action (Moved in Pale Cobalt, Recycled in Brick, Kept in Pencil Grey, New rule in Warm Off-White), then what happened in Body, then files and bytes in Data type, then a ghost Undo on the right. Activity lines have 8px vertical padding, a time column in Data type and a "By rule" or "By you" column; Done lines compress to 6px with the title in Pencil Grey. An undone entry drops to Faint Ink with its description struck through, and its Undo becomes the word "Undone".

### Notice Lines and Status Strip
Notice lines are full-width sentences between hairlines, 10px above and below: a Body sentence opening with a medium-weight clause, then Pencil Grey detail, then its actions on the right. The status strip at the foot of the window shows the folder's state in Faint Ink (file count, size, watching state, last scan) and the key legend on the right. After an action it swaps to a notice (a cobalt tick, the message in Warm Off-White and an inline Undo with its key) that rises in over 180ms and returns to the folder line after six seconds.

### Switch and Checkbox
The switch is a 32 by 18px rectangle with 4px corners and a 10px square thumb (2px corners). Off: Header Rule border, Faint Ink thumb on the left. On: cobalt border at 60% and a cobalt thumb on the right; the thumb slides in 200ms. The checkbox is a 14px square with 3px corners on a Header Rule border; ticked, it fills cobalt with a Cobalt Deep tick. Both show the standard cobalt focus outline.

## Do's and Don'ts

### Do:
- **Do** separate everything with 1px hairlines: Hairline between rows and lines, Header Rule under column headers and section headings.
- **Do** show hover and selection by stepping the ground (row-hover, then row-selected), per the Ground Step Rule.
- **Do** set hosts, file names, sizes, counts, times and rule patterns in JetBrains Mono at 12px wherever they stand as entries in a column, ledger or summary; figures inside a sentence stay in Public Sans.
- **Do** keep figures tabular and right-align numeric columns.
- **Do** write actions as words with their object ("Move to Receipts", "Recycle 5", "Keep") and pair each with its key cap on the selected row.
- **Do** put every row, header, total and expanded file line on the one shared column template, and keep each action in its fixed slot.
- **Do** open detail in place under its row, on the row's own columns.
- **Do** fold secondary columns into the summary line at 1020px and below rather than squeezing them.
- **Do** animate only with the expo-out ease at 150 to 220ms, and respect the system's reduced-motion setting.

### Don't:
- **Don't** use cards, filled panels, drop shadows or glow.
- **Don't** add decorative icon tiles, filled icon backgrounds or icons that stand in for a word label.
- **Don't** use cobalt for anything that is not an action or the state of one.
- **Don't** use brick for anything but recycling, including errors and warnings.
- **Don't** set readable text below 12px outside a key cap, or fainter than Faint Ink; only disabled controls (40% opacity) go lower.
- **Don't** round corners beyond 4px or use pills; the only circle is the watching dot.
- **Don't** show confidence as a badge, bar or percentage; it is a word.
- **Don't** number manifest rows.
