---
name: Tilbagekald Alert
description: Every food recall is a door sticker that opens with a full-width verdict band carrying its level's shape and words. Ink is the only brand fill; red belongs to the health level alone.
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
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: "1.75rem"
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
  sticker-hover:
    backgroundColor: "{colors.surface-sunken}"
  sticker-pressed:
    backgroundColor: "{colors.border}"
  sticker-health:
    backgroundColor: "{colors.health-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  sticker-health-hover:
    backgroundColor: "{colors.health-tint-hover}"
  sticker-health-pressed:
    backgroundColor: "{colors.health-tint-active}"
  band-health:
    backgroundColor: "{colors.health-fill}"
    textColor: "{colors.on-health}"
    typography: "{typography.verdict}"
    padding: "10px 16px"
  band-allergy:
    backgroundColor: "{colors.allergy-fill}"
    textColor: "{colors.on-allergy}"
    typography: "{typography.verdict}"
    padding: "10px 16px"
  band-notacute:
    backgroundColor: "{colors.notacute-tint}"
    textColor: "{colors.notacute}"
    typography: "{typography.verdict}"
    padding: "10px 16px"
  band-unfit:
    backgroundColor: "{colors.unfit-tint}"
    textColor: "{colors.unfit}"
    typography: "{typography.verdict}"
    padding: "10px 16px"
  band-unstated:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.verdict}"
    padding: "10px 16px"
  photo:
    backgroundColor: "{colors.photo-ground}"
    rounded: "{rounded.md}"
    size: "96px"
  photo-empty:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
  action-strip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
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
    rounded: "{rounded.xs}"
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

Every recall is a food-inspection door sticker, the severity scale a Dane already reads at a glance. The level lives in one object: a full-width verdict band across the top of a framed sticker, holding the level's own shape icon and its Danish words, filled by level. The sticker sits on a mint-tinted ground. A graphite-green bar holds two pill nav items, led by a ring-and-dot brand mark. Ink (`#10201a`) is the only brand fill; there is no brand hue to compete with a warning.

The reader is one household member on an Android phone, in a kitchen or from a lock-screen push, deciding in seconds whether they have the product. Reading order is verdict band, then product name beside a large photo, then a "what to do" strip, then store and date. The system is flat: depth comes from frames and tonal steps, never from shadows. Type is the system font stack only, with sentence-case verdicts and product names at weight 800.

**Key Characteristics:**
- One full-width verdict band per sticker: shape icon plus words, solid only for the levels that can hurt (health red, allergy and possible orange).
- 2px ink frame on every sticker; the health sticker takes a 3px red frame on a red tint ground.
- Product name (22px, 800) and a 96px photo come first under the band; a missing photo shows a package-icon tile.
- Ink is the only brand fill: primary button, selected chip, relevance seal.
- Flat slabs for controls with an ink edge; pressed sinks 1px.
- Light and dark both mint-tinted, never plain gray.

## Colors

A mint-tinted neutral ground, ink for every brand moment, and four level hues that each hold one job.

### Primary
- **Ink** (`--ink` / `--brand`, #10201a): body text, sticker frames, primary button, selected chip, the relevance seal. In dark it inverts to #e9f1ec.

### Secondary
- **Graphite-Green Bar** (`--bar`, #103a2e): the app bar only. Text `--on-bar` #f2f8f4; hover #2a6352; pressed #3a735f. Dark: bar #14382c, hover #2c624f, pressed #3d7863.

### Level colours (each has text colour, band or tag fill, glyph on the fill, tint)
- **Health red** (text #b01a2c, fill #d7263d, on-fill #ffffff, tint #fde7ea; hover tint #fad7dc, pressed tint #f6ccd2): the `health` level and its states only.
- **Allergy orange** (text #8a4300, fill #e8870e, on-fill #10201a, tint #ffefd9): `allergy` and `possible`.
- **Not-acute blue** (text #1d4aa0, fill #2f5fb3, on-fill #ffffff, tint #e3ebfa): `notacute`.
- **Unfit gray-green** (text #3f4a44, fill #5f6b65, on-fill #ffffff, tint #e1e8e4): `unfit`.
- **Unstated**: no hue of its own; ink text, tint `--surface-sunken`.
- **Pack-check clear** (`--ok` #1b6b43, tint #dff1e6): a pack check that came back clear. Dark #7fd99a / #12301c.

### Neutral
- **Mint Ground** (`--bg`, #e6eee9; dark #0e1411): page.
- **Sticker White** (`--surface`, #ffffff; dark #17201b): stickers, panels, inputs.
- **Sunken Mint** (`--surface-sunken`, #d9e4de; dark #212c26): hover ground, notices, authority quote, action strip, photo placeholder.
- **Hairline** (`--border`, #c3d1c9; dark #2f3d35): dividers, photo edge and passive edges.
- **Control Edge** (`--border-control`, #5b6b62; dark #8fa399): input, quiet button, unselected chip. At least 3:1.
- **Muted Ink** (`--ink-muted`, #46564d; dark #a9bab0): secondary text, never lighter.
- **Frame** (`--frame`, #10201a; dark #9fb5a9): sticker border; `--frame-w` 2px.
- **Focus Blue** (`--focus`, #1a5fb4; dark #8ab4ff; on the bar #ffffff, dark #8ab4ff): the one focus ring.

### Level mapping

| Level | Shape (icon) | Band fill | Band text and icon | Tag text | Tint |
| --- | --- | --- | --- | --- | --- |
| health | octagon + ! | health-fill (solid) | on-health | health | health-tint |
| allergy | triangle + ! | allergy-fill (solid) | on-allergy | allergy | allergy-tint |
| possible | hexagon + ! | allergy-fill (shares allergy) | on-allergy | allergy | allergy-tint |
| notacute | diamond + clock | notacute-tint | notacute | notacute | notacute-tint |
| unfit | circle + dash | unfit-tint | unfit | unfit | unfit-tint |
| unstated | rounded square + ? | surface-sunken | ink | ink | surface-sunken |

The level class (`.sev-*`) sets `--sev`, `--fill`, `--on-fill`, `--tint`, `--band`, `--on-band`; components read those, never the level tokens directly.

### Named Rules
**The Red Is Health Rule.** Red appears only for the `health` level: its band, frame, tint, and the "bad" pack-check result. It is never brand, hover, selection, or decoration.
**The Ink Is The Brand Rule.** The only brand fill is ink. Primary button, selected chip and relevance seal are ink; there is no brand hue.
**The Shape Beside The Words Rule.** Every level has its own shape icon and its own Danish verdict in the band; colour is never the only signal.
**The Solid Only When It Can Hurt Rule.** A band is a solid fill only for health, allergy and possible; the calmer levels use a tint with a level-coloured glyph and text.
**The Relevance Is Black Rule.** "This concerns you" is a black ink seal (`.badge-mine`); it never recolours the severity.

## Typography

**Display / Body / Label Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). One family; no webfonts.

**Character:** plain and sturdy. Hierarchy comes from size and weight (400, 600, 700, 800), not from a second face.

### Hierarchy
- **Title** (700, 1.5rem, 1.875rem line): h1 page and detail title (detail h1 at 800).
- **Product** (800, 1.375rem, 1.75rem): product name on the card (`--fs-product`).
- **Heading** (700, 1.125rem, 1.5rem): h2.
- **Body** (400, 1.0625rem, 1.5625rem): default text.
- **Verdict** (800, 1.0625rem, 1.375rem): the level's words in the band, sentence case; also h3 product-block names.
- **Meta** (400, 0.9375rem, 1.3125rem): facts line, reasons, tags, footer, dates, sticker note (600).

### Named Rules
**The Tokens Only Rule.** Font sizes come from `--fs-*` / `--lh-*` in rem; no literal sizes. Dates and `dd` use tabular numerals.
**The Sentence-Case Verdict Rule.** The verdict is sentence case at weight 800; there are no uppercase kickers or eyebrows.

## Layout

A single column, `main` max 42rem, 16px gutters, 4rem bottom padding. The bar's padding aligns to the same column. Spacing scale 4/8/12/16/24/32px (`--space-1..6`). Feed stickers are separated by 12px. Touch target 48px; chip 36px with a 48px hit area.

A feed sticker is the band (with the relevance seal at its right end when the recall is from the reader's store), then a body with 12px gaps: a two-column top (name, facts line, reason tags at left; 96px photo at right), the full-width action strip, and a footer row with store at left and date at right. Below 480px the brand name is visually hidden (the mark remains) and nav pills tighten to 12px padding. Below 380px the photo shrinks to 80px (`--photo-size`).

Detail screen order: share and back row; verdict sticker (band, plus one note when vulnerable groups are named); product title (with seal and published date) beside a 112px photo; authority quote (three lines then a read-more toggle); translation note; facts list (what to do, why, where sold); "Appen er usikker på…" note; "Har jeg den?" check; products; for levels that can hurt the full advice text; one "Læs hele meddelelsen" disclosure; official link; original text.

## Elevation & Depth

Flat. There are no shadows. Depth is a frame (2px ink, or 3px red for health), a tonal step (white sticker on mint ground, sunken mint on hover), and a 1px sink on pressed buttons. Hover is gated by `@media (hover: hover)`; `:active` applies to all input methods.

### Named Rules
**The Flat Slab Rule.** Controls are flat slabs with an ink edge. Hover tints, pressed sinks, focus is the blue ring. No shadows, no gradients.

## Shapes

Radii: 6px (`--radius-xs`, tags, checkboxes), 8px (`--radius-sm`, preformatted text), 12px (`--radius-md`, buttons, inputs, notices, photo tile, action strip, quote), 14px (`--radius-lg`, stickers, panels, facts, checker), 999px (pills: nav, chips, relevance seal, back link). The sticker clips its band to the 14px corner. Level shapes (octagon, triangle, hexagon, diamond, circle, rounded square) live as 24px icons inside the band at stroke 2.2. Icons are Lucide-style outline, drawn inline in `public/icons.js`, 24px grid, 2px round stroke; the action strip uses an icon for the action itself (trash can to discard, exchange arrows to return, info mark to read the notice), the footer a map pin, the missing-photo tile a 40px package. The brand mark in the bar is a 28px ring (3px stroke) with an 8px dot.

## Components

### Sticker (feed card and detail sticker)
- **Anatomy (feed):** verdict band; body with product name and 96px photo, reason tags, action strip with the action's icon, footer (pin and store left, `dd.mm.yyyy` date right).
- **Rest:** white ground, 2px `--frame` border, 14px radius, overflow clipped.
- **Health:** 3px `--health-fill` frame, `--health-tint` ground. Tags and the action strip sit on white.
- **Hover:** `--surface-sunken` (health: `--health-tint-hover`). **Pressed:** `--border` (health: `--health-tint-active`).
- **Detail sticker:** the band alone, plus an optional `.sticker-note` (users icon, weight 600) for vulnerable groups; same frame logic.

### Verdict band
Full-width strip, 10px by 16px padding, 24px level icon and verdict words at 800. Solid red for health, solid orange for allergy and possible; tint with a level-coloured glyph and text for notacute and unfit; sunken for unstated.

### Photo
96px square (80px under 380px, 112px on detail), white ground, 1px hairline edge, 12px radius, image contained. Missing or failing image becomes a sunken tile with a muted package icon. On detail the photo links to the full image.

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
- **Relevance seal:** black ink pill with the target icon, on-brand text, weight 700. For a recall from the reader's store it sits at the right end of the verdict band (`.seal`): the words "Din butik" show when the verdict is short (18 characters or fewer, or the card is 480px wide or more), otherwise the seal is the icon alone and the words stay for screen readers. A watch-word hit stays a `.badge-mine` in the body. There is no scope badge.

### Checker ("Har jeg den?")
A sticker: surface ground, 2px frame, 14px radius. Results: `bad` in `--health`, `ok` in `--ok`, both weight 700. A "no match" is never read as safe on a level that can hurt; "Jeg kan ikke læse datoen" tells the reader to assume it applies when name and size match.

### Facts list and Panels
Facts: white list, hairline border, 14px radius, rows with a 24px muted icon and a bold title, dividers between rows, min height 60px. Authority quote: sunken, 12px radius, italic. Panels (settings): white, hairline border, 14px radius, 16px padding. Products: 12px radius, hairline border.

### Inputs
48px tall, 2px `--border-control` edge, 12px radius, surface ground, ink caret. Check and radio controls are 24px custom boxes (6px radius, circular for radios), filled ink when checked. Focus is the 3px blue ring with a 2px offset.

### Forced colours
Windows high contrast keeps edges: tags and badges take a 2px `CanvasText` border; cards, stickers and the checker border in `CanvasText`; the band gets a 2px `CanvasText` bottom rule; selected chips use `Highlight`; the current nav pill gets a 2px `Highlight` outline; photos opt out of forced colours; checked controls use `Highlight` / `HighlightText`.

## Do's and Don'ts

### Do:
- **Do** open every sticker with a verdict band that pairs the level's own shape with its Danish words, in sentence case.
- **Do** keep text at 4.5:1 and control edges, focus rings and band glyphs at 3:1 in both themes; `test/contrast.test.js` reads the tokens from `styles.css`. Add a pair there when you add a colour token.
- **Do** keep voice short and plain: Danish first, English second, imperative.
- **Do** keep buttons, inputs and nav targets at 48px; chips 36px with a 48px hit area, 12px between rows.
- **Do** gate hover with `@media (hover: hover)` and style `:active` for all input methods.
- **Do** show relevance with the black seal.
- **Do** give a recall without a usable photo the package-icon tile, never an empty gap.

### Don't:
- **Don't** use red for anything but the health level: not hover, selection or brand.
- **Don't** use colour as the only signal of a level.
- **Don't** add shadows, gradients or underlines on nav.
- **Don't** introduce a brand hue; ink is the only brand fill.
- **Don't** write font sizes as literals.
- **Don't** let the pack check read "no match" as safe on health, allergy, possible or unstated.
