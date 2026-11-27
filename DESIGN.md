---
name: Tilbagekald Alert
description: Every food recall is a door sticker with a die-cut round badge holding its level's shape. Ink is the only brand fill; red belongs to the health level alone.
colors:
  bg: "#e6eee9"
  surface: "#ffffff"
  surface-sunken: "#d9e4de"
  border: "#c3d1c9"
  border-control: "#5b6b62"
  ink: "#10201a"
  ink-muted: "#46564d"
  frame: "#10201a"
  bar: "#103a2e"
  on-bar: "#f2f8f4"
  bar-hover: "#2a6352"
  bar-active: "#3a735f"
  focus: "#1a5fb4"
  focus-on-bar: "#ffffff"
  brand: "#10201a"
  brand-hover: "#26382f"
  brand-active: "#3d5147"
  on-brand: "#ffffff"
  health: "#b01a2c"
  health-fill: "#d7263d"
  on-health: "#ffffff"
  health-tint: "#fde7ea"
  health-tint-hover: "#fad7dc"
  health-tint-active: "#f6ccd2"
  allergy: "#8a4300"
  allergy-fill: "#e8870e"
  on-allergy: "#10201a"
  allergy-tint: "#ffefd9"
  notacute: "#1d4aa0"
  notacute-fill: "#2f5fb3"
  on-notacute: "#ffffff"
  notacute-tint: "#e3ebfa"
  unfit: "#3f4a44"
  unfit-fill: "#5f6b65"
  on-unfit: "#ffffff"
  unfit-tint: "#e1e8e4"
  ok: "#1b6b43"
  ok-tint: "#dff1e6"
  photo-ground: "#ffffff"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.875rem"
  product:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: "1.5625rem"
  heading:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: "1.5rem"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.5625rem"
  verdict:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: "1.375rem"
  meta:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.3125rem"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
components:
  sticker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px 12px 12px"
  sticker-health:
    backgroundColor: "{colors.health-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  sticker-hover:
    backgroundColor: "{colors.surface-sunken}"
  sticker-health-hover:
    backgroundColor: "{colors.health-tint-hover}"
  sticker-health-pressed:
    backgroundColor: "{colors.health-tint-active}"
  die:
    backgroundColor: "{colors.health-fill}"
    textColor: "{colors.on-health}"
    rounded: "{rounded.pill}"
    size: "56px"
  nav-pill:
    textColor: "{colors.on-bar}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 16px"
  nav-pill-current:
    backgroundColor: "{colors.on-bar}"
    textColor: "{colors.bar}"
  nav-pill-hover:
    backgroundColor: "{colors.bar-hover}"
  nav-pill-pressed:
    backgroundColor: "{colors.bar-active}"
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "8px 16px"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.md}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.brand-active}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 12px"
  chip-selected:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
  chip-selected-hover:
    backgroundColor: "{colors.brand-hover}"
  chip-selected-pressed:
    backgroundColor: "{colors.brand-active}"
  tag:
    backgroundColor: "{colors.allergy-tint}"
    textColor: "{colors.allergy}"
    rounded: "6px"
    padding: "1px 8px"
  tag-solid:
    backgroundColor: "{colors.allergy-fill}"
    textColor: "{colors.on-allergy}"
  badge-mine:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  checker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px 16px"
  facts:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

# Design System: Tilbagekald Alert

## Overview

**Creative North Star: "The Door Sticker"**

Every recall is a food-inspection door sticker, the severity scale a Dane already reads at a glance. The level lives in one object: a die-cut round badge holding its own shape, set in a framed white sticker on a mint-tinted ground. A graphite-green bar holds two pill nav items. Ink (`#10201a`) is the only brand fill; there is no brand hue to compete with a warning.

The reader is one household member on an Android phone, in a kitchen or from a lock-screen push, deciding in seconds whether they have the product. Reading order is badge and verdict first, product second, what to do third, store and date last. The system is flat: depth comes from frames and tonal steps, never from shadows. Type is the system font stack only, with sentence-case verdicts at weight 800.

**Key Characteristics:**
- One 56px die-cut badge per level, shape plus colour, never colour alone.
- Thick ink frame (2px) on every sticker; the health sticker takes a 5px red frame and a red tint ground.
- Ink is the only brand fill: primary button, selected chip, relevance seal.
- Flat slabs for controls with an ink edge; pressed sinks 1px.
- Light and dark both mint-tinted, never plain gray.

## Colors

A mint-tinted neutral ground, ink for every brand moment, and four level hues that each hold one job.

### Primary
- **Ink** (`--ink` / `--brand`, #10201a): body text, sticker frames, die rings, primary button, selected chip, the relevance seal. In dark it inverts to #e9f1ec.

### Secondary
- **Graphite-Green Bar** (`--bar`, #103a2e): the app bar only. Text `--on-bar` #f2f8f4; hover #2a6352; pressed #3a735f. Dark: bar #14382c, hover #2c624f, pressed #3d7863.

### Level colours (each has text colour, badge fill, glyph on the fill, tint)
- **Health red** (text #b01a2c, fill #d7263d, glyph #ffffff, tint #fde7ea; hover tint #fad7dc, pressed tint #f6ccd2): the `health` level and its states only.
- **Allergy orange** (text #8a4300, fill #e8870e, glyph #10201a, tint #ffefd9): `allergy` and `possible`.
- **Not-acute blue** (text #1d4aa0, fill #2f5fb3, glyph #ffffff, tint #e3ebfa): `notacute`.
- **Unfit gray-green** (text #3f4a44, fill #5f6b65, glyph #ffffff, tint #e1e8e4): `unfit`.
- **Unstated**: no hue of its own; ink on white (`--surface`), tint `--surface-sunken`.
- **Pack-check clear** (`--ok` #1b6b43, tint #dff1e6): a pack check that came back clear. Dark #7fd99a / #12301c.

### Neutral
- **Mint Ground** (`--bg`, #e6eee9; dark #0e1411): page.
- **Sticker White** (`--surface`, #ffffff; dark #17201b): stickers, panels, inputs.
- **Sunken Mint** (`--surface-sunken`, #d9e4de; dark #212c26): hover ground, notices, authority quote.
- **Hairline** (`--border`, #c3d1c9; dark #2f3d35): dividers and passive edges.
- **Control Edge** (`--border-control`, #5b6b62; dark #8fa399): input, quiet button, unselected chip, badge outline. At least 3:1.
- **Muted Ink** (`--ink-muted`, #46564d; dark #a9bab0): secondary text, never lighter.
- **Frame** (`--frame`, #10201a; dark #9fb5a9): sticker border; `--frame-w` 2px.
- **Focus Blue** (`--focus`, #1a5fb4; dark #8ab4ff; on the bar #ffffff, dark #8ab4ff): the one focus ring.

### Level mapping

| Level | Shape (icon) | Disc (badge fill) | Glyph on disc | Text colour | Tint |
| --- | --- | --- | --- | --- | --- |
| health | octagon + ! | health-fill | on-health | health | health-tint |
| allergy | triangle + ! | allergy-fill | on-allergy | allergy | allergy-tint |
| possible | hexagon + ! | allergy-fill (shares allergy) | on-allergy | allergy | allergy-tint |
| notacute | diamond + clock | notacute-tint | notacute | notacute | notacute-tint |
| unfit | circle + dash | unfit-tint | unfit | unfit | unfit-tint |
| unstated | rounded square + ? | surface | ink | ink | surface-sunken |

The level class (`.sev-*`) sets `--sev`, `--fill`, `--on-fill`, `--tint`, `--disc`, `--on-disc`; components read those, never the level tokens directly.

### Named Rules
**The Red Is Health Rule.** Red appears only for the `health` level: its badge, frame, tint, and the "bad" pack-check result. It is never brand, hover, selection, or decoration.
**The Ink Is The Brand Rule.** The only brand fill is ink. Primary button, selected chip and relevance seal are ink; there is no brand hue.
**The Shape Beside The Colour Rule.** Every level has its own shape inside the badge; colour is never the only signal.
**The Relevance Is Black Rule.** "This concerns you" is a black ink seal (`.badge-mine`) and a double frame; it never recolours the severity.

## Typography

**Display / Body / Label Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). One family; no webfonts.

**Character:** plain and sturdy. Hierarchy comes from size and weight (400, 600, 700, 800), not from a second face.

### Hierarchy
- **Title** (700, 1.5rem, 1.875rem line): h1 page and detail title.
- **Product** (700, 1.1875rem, 1.5625rem): product name on the card.
- **Heading** (700, 1.125rem, 1.5rem): h2; the detail sticker's verdict.
- **Body** (400, 1.0625rem, 1.5625rem): default text.
- **Verdict** (800, 1.0625rem, 1.375rem): the level's words on a card, in the level's text colour, sentence case.
- **Meta** (400, 0.9375rem, 1.3125rem): facts line, reasons, tags, footer, dates.

### Named Rules
**The Tokens Only Rule.** Font sizes come from `--fs-*` / `--lh-*` in rem; no literal sizes. Dates and `dd` use tabular numerals.
**The Sentence-Case Verdict Rule.** The verdict is sentence case at weight 800; there are no uppercase kickers or eyebrows.

## Layout

A single column, `main` max 42rem, 16px gutters, 4rem bottom padding. The bar's padding aligns to the same column. Spacing scale 4/8/12/16/24/32px (`--space-1..6`). Feed stickers are separated by 12px. Touch target 48px; chip 36px with a 48px hit area. Below 480px the brand name is visually hidden (the mark remains), nav pills tighten to 12px padding and the thumbnail shrinks to 48px. Detail screen order: share and back; level sticker (one note when vulnerable groups are named); authority quote (three lines then "Læs hele citatet"); photo beside relevance badge, title and date; facts list; "Appen er usikker på…" note; "Har jeg den?" check; products; for levels that can hurt (health, allergy, possible, unstated) the full advice text; one "Læs hele meddelelsen" disclosure; official link; original text.

## Elevation & Depth

Flat. There are no shadows. Depth is a frame (2px ink, or 5px for health and personal stickers), a tonal step (white sticker on mint ground, sunken mint on hover), and a 1px sink on pressed buttons. Hover is gated by `@media (hover: hover)`; `:active` applies to all input methods.

### Named Rules
**The Flat Slab Rule.** Controls are flat slabs with an ink edge. Hover tints, pressed sinks, focus is the blue ring. No shadows, no gradients.

## Shapes

Radii: 6px (`--radius-xs`, tags, checkboxes), 8px (`--radius-sm`, thumbnails, links), 12px (`--radius-md`, buttons, inputs, notices), 14px (`--radius-lg`, stickers, panels, facts, checker), 999px (pills: nav, chips, relevance seal). The die-cut badge is a perfect circle (56px, 64px on the detail sticker) with a 3px ink ring, holding a 30px (34px on detail) icon at stroke 2.2. Icons are Lucide-style outline, drawn inline in `public/icons.js`, 24px grid, 2px round stroke, one shape per level. The brand mark in the bar is a 28px ring with an 8px dot.

## Components

### Sticker (feed card and detail sticker)
- **Anatomy:** die badge at left, then verdict, product, reason tags, action, and a footer rule with stores and date. Optional 64px thumbnail on the right (48px below 480px).
- **Rest:** white ground, 2px `--frame` border, 14px radius.
- **Health:** 5px `--health-fill` frame, `--health-tint` ground. Tags on it sit on white.
- **Personal (`.card-mine`):** 5px double frame in the sticker's own frame colour (on a health sticker, red).
- **Hover:** `--surface-sunken` (health: `--health-tint-hover`). **Pressed:** `--border` (health: `--health-tint-active`).
- **Detail sticker:** same frame logic, 64px badge, verdict at heading size, optional `.sticker-note` at weight 600.

### Navigation
Pills on the bar, 36px tall with a 48px hit area, weight 700, no underlines. **Current:** solid slab, `--on-bar` fill with `--bar` text. **Hover:** `--bar-hover` fill (current stays put). **Pressed:** `--bar-active` fill. **Focus:** 3px `--focus-on-bar` ring.

### Buttons
- **Default:** surface fill, 2px ink border, 12px radius, 48px tall, weight 700.
- **Primary:** ink fill and border, `--on-brand` text. Hover `--brand-hover`, pressed `--brand-active` with a 1px sink.
- **Quiet:** control-edge border. **Disabled:** sunken fill, muted text, hairline border.
- **Icon button:** 48px square. **Link button:** underlined (2px, 4px offset), 48px tall.

### Chips
36px tall pills with a 2px control edge; a 48px hit area comes from a pseudo-element. **Selected:** ink fill, on-brand text, weight 700, leading check mark (never colour alone). Hover and pressed follow the brand tokens; red is never used for selection. The remove control `.chip-x` is 36px with a larger hit area.

### Tags and Badges
- **Tag:** a reason or allergen in the recall's level colour, tint ground, 6px radius, weight 700. **Solid tag:** the household's allergen, level fill with the target icon.
- **Relevance seal (`.badge-mine`):** black ink pill with the target icon, on-brand text, weight 700. **Scope badge:** transparent pill with a 1px control edge.

### Checker ("Har jeg den?")
A sticker: surface ground, 2px frame, 14px radius. Results: `bad` in `--health`, `ok` in `--ok`, both weight 700. A "no match" is never read as safe on a level that can hurt; "Jeg kan ikke læse datoen" tells the reader to assume it applies when name and size match.

### Facts list and Panels
Facts: white list, hairline border, 14px radius, rows with a 24px muted icon and a bold title, dividers between rows, min height 60px. Panels (settings): white, hairline border, 14px radius, 16px padding. Products: 12px radius, hairline border.

### Inputs
48px tall, 2px `--border-control` edge, 12px radius, surface ground, ink caret. Check and radio controls are 24px custom boxes (6px radius, circular for radios), filled ink when checked. Focus is the 3px blue ring with a 2px offset.

### Forced colours
Windows high contrast keeps edges: tags, badges and the die take a 2px `CanvasText` border; cards, stickers and the checker border in `CanvasText`; the personal double frame and selected chips use `Highlight`; the current nav pill gets a 2px `Highlight` outline; thumbnails opt out of forced colours; checked controls use `Highlight` / `HighlightText`.

## Do's and Don'ts

### Do:
- **Do** give every level its own badge shape and keep the verdict in sentence case.
- **Do** keep text at 4.5:1 and control edges, focus rings and badge glyphs at 3:1 in both themes; `test/contrast.test.js` reads the tokens from `styles.css`. Add a pair there when you add a colour token.
- **Do** keep voice short and plain: Danish first, English second, imperative.
- **Do** keep buttons, inputs and nav targets at 48px; chips 36px with a 48px hit area, 12px between rows.
- **Do** gate hover with `@media (hover: hover)` and style `:active` for all input methods.
- **Do** show relevance with the black seal and double frame.

### Don't:
- **Don't** use red for anything but the health level: not hover, selection or brand.
- **Don't** use colour as the only signal of a level.
- **Don't** add shadows, gradients or underlines on nav.
- **Don't** introduce a brand hue; ink is the only brand fill.
- **Don't** write font sizes as literals.
- **Don't** let the pack check read "no match" as safe on health, allergy, possible or unstated.
