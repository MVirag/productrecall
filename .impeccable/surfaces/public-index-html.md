---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

# Surface brief: the whole Tilbagekald Alert app (feed, detail, settings, import)

Mode: Operate. Audience: one person and their household on an Android phone, in a kitchen or from a lock-screen push, deciding in seconds "do I have it, what do I do". Task: read the verdict, check the pack, act. Constraints (user pins): brand is neutral, never red; warnings stand out; system font stack; Danish first. Avoid: generic corporate gray, anything harder to scan than today, colour without a job.

## Direction contract

THESIS: Every recall is a food-inspection door sticker, the severity scale every Dane already reads at a glance. The category default (a white list with coloured status chips) is refused: the level lives in one object, a die-cut round badge holding its own shape, framed by a thick sticker border.

OWN-WORLD: mint-tinted off-white ground, white stickers with a 2px ink frame and 14px corners (a health sticker gets a heavy 5px red frame on a tinted ground; a personal one a 5px double frame), a deep graphite-green bar, ink as the only brand fill. One die-cut 56px round badge per level, ring in the frame colour, fill red (health), orange (allergy, possible), blue (not acute), gray-green (unfit), white (unstated), each with its shape. A health sticker carries a red frame. Relevance is a black seal. System fonts; verdict in sentence case at weight 800 (never an uppercase kicker), product 19px.

STORY: The reader sees the badge and verdict first, the product second, what to do third, store and date last. They check a pack in a sticker-framed "Har jeg den?" box and are never told "no match" means safe when it could hurt.

FIRST VIEWPORT: phone, 390 wide. Green bar with two slab nav items (current item a solid slab, no underline). Then stickers, each a 56px badge at left, verdict line, product, reason tags, action, footer; first card is the newest recall; primary action is tapping the sticker.

FORM: pick card, position 1 on my ordered list (food-inspection door sticker), seed:4b1920634f19c8e7. Signature move: the die-cut level badge. Controls stay standard: buttons are flat slabs with inset press, nav items are pills, chips and inputs unchanged in behaviour.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
