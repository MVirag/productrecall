---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

# Surface brief: the whole Tilbagekald Alert app (feed, detail, settings, import)

Mode: Operate. Audience: one person and their household on an Android phone, in a kitchen or from a lock-screen push, deciding in seconds "what product is this, do I have it, what do I do". Task: read the verdict, check the pack, act. Constraints (user pins): brand is neutral, never red; warnings stand out; system font stack; Danish first. Avoid: generic corporate gray, anything harder to scan than today, colour without a job. User revision (from a hand sketch): the verdict is a top band, not a round badge; the product name and picture come first; no "sold nationwide" tag; no double frame.

## Direction contract

THESIS: Every recall is a food-inspection door sticker, the severity scale every Dane already reads at a glance. The category default (a white list with coloured status chips) is refused: the level lives in one object, a full-width verdict band with the level's own shape, on a framed sticker.

OWN-WORLD: mint-tinted off-white ground, white stickers with a 2px ink frame and 14px corners, a deep graphite-green bar, ink as the only brand fill. A verdict band across the top of each sticker: solid red (health), solid orange (allergy, possible), blue tint (not acute), gray-green tint (unfit), each with its shape. A health sticker carries a 3px red frame on a pink tint. Relevance is a black seal. System fonts; verdict at weight 800 in sentence case (never an uppercase kicker), product name 22px/800.

STORY: The reader sees the verdict band, then immediately what product it is (large name and photo, placeholder when there is none), then what to do (a strip), then store and date. They check a pack in a sticker-framed "Har jeg den?" box and are never told "no match" means safe when it could hurt.

FIRST VIEWPORT: phone, 390 wide. Green bar with the ring-and-dot mark and two slab nav items (current item a solid slab, no underline). Then stickers: verdict band, product name left and a 96px photo right, reason tags, "what to do" strip, footer with pin + store and the date. Primary action is tapping the sticker.

FORM: pick card, position 1 on my ordered list (food-inspection door sticker), seed:4b1920634f19c8e7. Signature move: the verdict band. Controls stay standard: buttons are flat slabs that sink on press, nav items are pills, chips and inputs unchanged in behaviour.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
