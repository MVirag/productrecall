# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tilbagekald Alert: an installable PWA that sends a Web Push notification when Fødevarestyrelsen recalls a Danish food product. One Cloudflare Worker serves everything. README.md covers deployment, env vars, the API table and the privacy/telemetry design; PRODUCT.md and DESIGN.md hold product and design rules (the Impeccable design skill and hook are set up in `.claude/`).

## Commands

- `npm test` runs every test with Node's built-in runner (no extra dependencies). One file: `node --test test/ean.test.js`. One test: `node --test --test-name-pattern="substring" test/poll.test.js`.
- There is no build step and no linter. `public/` is served as-is (plain ES modules, no bundler), and `src/` is bundled by wrangler.
- `npm run fixtures` re-downloads real recall pages into `test/fixtures/`. Tests assert values read off those real pages, so never hand-edit fixtures; add a new real page when you add a parser rule.
- Local run: `npx wrangler dev --test-scheduled`. The `AI` binding always runs remotely and needs a Cloudflare login. Without one, run `wrangler dev -c <copy of wrangler.jsonc without "ai">`; translation is then skipped. `node scripts/seed-local.mjs` loads the fixtures as recalls (see README "Local setup").
- Deploy: merging to `main` deploys through Cloudflare's GitHub integration (Worker `productrecall`). PR branches get `wrangler preview` builds, which fail without the `previews` block in `wrangler.jsonc`; keep it there (previews deliberately have no KV).
- Develop on branch `claude/eloquent-hypatia-wbyus3`; pull requests target `main`.

## Architecture

One Worker (`src/worker.js`) does three jobs: static files from `public/`, the JSON API under `/api/*`, and a 15-minute cron that runs `src/poll.js`.

Data flow: RSS head (40 items) → ids not yet seen → fetch each recall page → `parseDetail` (`src/parse.js`; four page layouts since 2021, helpers in `src/html.js`, no DOM) → recalls (newest 60) and `state` (seen ids, pending jobs) in KV → `notifyAll` decides per subscription with `decide`/`notificationFor` → Web Push (`src/push.js`, WebCrypto VAPID; keys are generated into KV on first use unless secrets pin them) → the service worker shows it; a tap opens `#/recall/<id>?via=push`. The first run seeds everything as already seen, so nobody is flooded.

`public/shared/*` (chains, words, severity, summary, ean, detail) are pure modules imported by both the Worker and the browser app. Keep them free of DOM and browser APIs. One change there alters card text and notification text together.

KV keys: `recalls`, `state`, `sub:<hash>` (push subscription + settings), `vapid`, `stats:YYYY-MM-DD`. The poll job fits the Workers free plan (about 10 ms CPU and 50 subrequests per run), which is why `poll.js` caps detail pages and translations per run and `stats.js` caps writes per day.

Frontend: `public/app.js` is a hash-router SPA (feed, recall, settings, import, scan). DOM is built with the `h()` helper and `textContent` only, because recall text is untrusted; never put recall data into `innerHTML`. `public/i18n.js` has Danish and English, and the keys must match in both. In `public/sw.js`, bump `VERSION` and update `SHELL_FILES` whenever a shell file is added or changed. ZXing (`public/vendor/`) is loaded and cached lazily by the scanner.

Translation (`src/translate.js`): Workers AI, one field at a time, each result checked (English, numbers kept, no invented stores) or the Danish text is kept. Bumping `TRANSLATE_VERSION` hides every stored translation; the API serves only the current version.

Owner dashboard: `public/admin.html` + `admin.js` at `/admin`, fed by `GET /api/admin/stats` (needs `ADMIN_TOKEN`). It must stay unlinked from the app and out of the service worker's cache; the public `/api/status` carries no counters or error text. Theme (Auto/Light/Dark) is a device-only setting applied via `data-theme` on `<html>` before first paint; the two dark token blocks in `styles.css` must stay identical (`test/theme.test.js`).

Anonymous counters (`src/stats.js`): fixed allow-lists of event names, one record per UTC day, 35-day expiry. Usage events come from requests the app already makes, marked with `?via=scan` or `?via=push`, never from a separate beacon.

## Decisions not to undo without asking the user

- Risk categories come only from Fødevarestyrelsen's own wording (`RULES` in `public/shared/severity.js`), and the sentence that decided it is shown as a quote. The app never invents a risk rating. Every recall sounds by default; silence is only the user's own quiet setting, and never for the household's allergens.
- "No match" (barcode scan, pack check) must never read as safe: only some notices print barcodes, so the UI uses the "risk not stated" sticker.
- No client-side tracking: no beacons, cookies, device or user IDs, click, scroll, session or location tracking. Keep the README "Privacy and telemetry" section and the privacy dialog (Settings and footer) accurate when stored data changes. Allergies and the vulnerable-household switch are stored server-side next to the push address, which needs consent and a privacy notice before other households use the app.
- Design: DESIGN.md rules apply (tokens only, red only for the health level, every level has its own shape). `test/contrast.test.js` reads the colour tokens from `public/styles.css`.
