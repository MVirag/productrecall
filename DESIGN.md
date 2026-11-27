# Design system

Calm gray everywhere, loud only when the risk is. Tokens live in `public/styles.css` (`:root`, light and dark); icons in `public/icons.js`.

## Color
- Structure: `--bg`, `--surface`, `--surface-sunken`, `--border`, `--border-control` (edges of inputs, secondary buttons, unselected chips).
- Text: `--ink`, `--ink-muted` (never lighter).
- Brand is neutral slate: `--bar`/`--on-bar` for the app bar, `--brand`/`--on-brand` for the primary button and selected chip. Never a signal hue.
- Red (`--sev-acute*`) means the `health` level and nothing else. Orange = `allergy` and `possible`, violet = `notacute`, gray = `unfit`, neutral = `unstated`. Teal (`--mine*`) means "this concerns you". `--ok` = a pack check came back clear.

## Severity (levels come from `public/shared/severity.js`)
Every level has its own shape icon, words and color; color is never the only signal.

| Level | Shape | Style |
| --- | --- | --- |
| health | octagon + ! | solid red strip/banner |
| allergy | triangle + ! | orange tint |
| possible | hexagon + ! | orange tint |
| notacute | diamond + clock | violet tint |
| unfit | circle + dash | gray tint |
| unstated | square + ? | neutral |

Reason tags (`.tag`) take the recall's level color. An allergen in the household profile is a filled tag (`.tag-solid`) with the target icon. Relevance (your store, watch word, household) is a teal `.badge-mine` and a teal card edge (`.card-mine`); it never changes the severity color.

## Card, top to bottom
Severity strip, photo (72px, only when `recall.image` exists; no placeholder) beside product, reason tags and dates, action, badges, footer with stores and date.

## Rules
- System font stack; sizes 24/19/18/17/15px; `font-variant-numeric: tabular-nums` for dates.
- Spacing 4/8/12/16/24/32px; radius 8/12px, pills for chips and badges; no shadows.
- Buttons, inputs and nav are 48px tall. Chips are 36px with a 48px hit area (12px between rows).
- Text >= 4.5:1, control edges and focus rings >= 3:1 in both themes. Icons are Lucide-style outline (ISC), 24px grid, 2px stroke.
- Voice: short, plain Danish first, English second; say what to do.
