# Tilbagekald Alert

A small installable web app (PWA) that sends a push notification to your
Android phone when Fødevarestyrelsen recalls a food or drink product, so you
can check whether you have it at home.

- **Feed** of recalls, newest first. Each card shows *store · product · size ·
  best-before · reason · action*. Recalls from your stores are highlighted.
- **Recall detail** with all products, dates, EAN and lot numbers, the product
  image, a **"Har jeg den?"** check (type the date or barcode from your pack),
  and a link to the official notice.
- **Settings**: your store chains, notify about *all recalls* (default) or
  *only my stores*, optional watch words ("mælk" also finds "letmælk"), Danish
  or English.
- **Risk category** on every recall, taken from Fødevarestyrelsen's own
  wording and shown with the quoted sentence (see below). Every recall makes
  a sound by default; you can choose categories to receive silently.
- **Household profile**: allergies (the 14 EU allergens) and "pregnant, small
  children or weak immune system". An allergen recall for your household
  always sounds and notifies even in "only my stores" mode.
- **Sharing**: share a recall to WhatsApp/SMS etc., and share your settings
  as a link a partner can open to get the same stores, words and household.
- **Barcode scan**: scan the barcode of a product at home and see whether it
  is in a recent recall, then go straight to the date check. Nothing is saved.
- **English**: each recall's full text is machine-translated (Cloudflare
  Workers AI) when the app is in English, with the Danish original one tap away.
- **Push notifications** with the same short text as the card. Tapping one
  opens the recall.

There are no user accounts. Your settings live on your phone; the server only
stores each push subscription with its store/mode/word settings.

## How it works

```
Fødevarestyrelsen RSS ──every 15 min──▶ Cloudflare Worker (cron)
                                           │  fetch new recall pages, parse
                                           ▼
                                     Workers KV  (recalls, seen ids, subscriptions)
                                           │
                       Web Push (VAPID) ───┴──▶ Chrome on Android ──▶ app
```

- Data source: `https://www.foedevarestyrelsen.dk/handlers/DynamicRss.ashx?id=8c2cdc12-6a58-43d1-8b4e-97aa96dedd0c`
  (verified live 27 Nov 2026). The RSS only carries title, link, date and a
  truncated summary, so the Worker also fetches each recall's page.
- One Cloudflare Worker serves the app (`public/`) and the API (`/api/*`) and
  runs the cron job. Free plan: 15-minute cron, KV storage, HTTPS.
- **First run does not flood you**: everything already in the feed is marked
  as seen; only later recalls trigger notifications.

| Path | What it is |
|---|---|
| `src/parse.js` | RSS + recall page parser (4 page layouts seen since 2021) |
| `src/poll.js` | The scheduled job |
| `src/push.js` | Web Push sending (WebCrypto VAPID, `@block65/webcrypto-web-push`) |
| `src/translate.js` | Danish → English translation with Workers AI |
| `src/worker.js` | API routes + cron entry point |
| `public/shared/` | Store matching, watch words, severity, card/notification text (used by Worker and app) |
| `public/` | The PWA: `index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, icons |
| `test/` | Tests; `test/fixtures/` holds real pages from the site |

## What the parser extracts

Per recall: title, published date, lead text, update note, product image,
products (name, brand, size, best-before / use-by dates, EAN, lot, per-product
"sold at"), stores (named chains, chain groups such as Coop/Salling/Dagrofa,
or "nationwide"), reason (category + allergen), action (return/discard,
allergy-only), recaller, the raw section text and a list of fields the parser
is unsure about (`uncertain`).

Coverage across the 17 saved pages (2021–2026, 71 products):

| Field | Recalls | Notes |
|---|---|---|
| Title, date, official link, reason, action | 17/17 | Reason category assigned on all 17 |
| Product name | 17/17 | Multi-product recalls split into 71 products |
| Best-before / use-by / "all dates" | 17/17 | 71/71 products have dates |
| Size | 15/17 | 65/71 products; missing when the page doesn't state it |
| Stores (named chain, group or nationwide) | 16/17 | The miss is a list of individual bazaar shops |
| Product image | 10/17 | Hosted on `cdn2.gopublic.dk` |
| EAN | 9/17 | 30/71 products; often not published |
| Brand (labelled on the page) | 3/17 | Otherwise guessed from the product name and marked uncertain |

## Local setup

Requires Node 20+.

```bash
npm install
```

```bash
npm test
```

Run the Worker locally (first create local push keys):

```bash
npm run vapid > .dev.vars
```

```bash
npx wrangler dev --test-scheduled
```

`wrangler dev` needs a Cloudflare login for the Workers AI binding (it always
runs remotely). Without one, copy `wrangler.jsonc`, delete the `"ai"` line and
start with `npx wrangler dev -c <that copy>`; translation is then skipped.

Open http://localhost:8787. To run the cron job once:

```bash
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
```

No network in your dev environment? Load the saved fixtures into the local KV
instead:

```bash
node scripts/seed-local.mjs && npx wrangler kv key put --binding KV --local recalls --path .wrangler/seed-recalls.json
```

Other scripts: `npm run fixtures` downloads fresh fixtures from the live
site, `npm run icons` re-renders the PNG icons (needs Playwright + Chromium).

## Deployment (Cloudflare, free plan)

**From GitHub (no command line):**

1. In the Cloudflare dashboard: **Workers & Pages → Create → Import a
   repository**, pick this repository.
2. Keep the defaults: build command empty, deploy command `npx wrangler deploy`,
   production branch `main`.
3. Deploy. Wrangler creates the KV namespace automatically, and the app
   generates its own push (VAPID) keys on first use and stores them in KV.
4. The first recall check runs within 15 minutes. Every push to `main`
   redeploys.

**From the command line:** `npx wrangler login`, then `npm run deploy`.

Optional settings (Worker → Settings → Variables and Secrets):
`ADMIN_TOKEN` enables an immediate poll:

```bash
curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" https://productrecall.YOUR-SUBDOMAIN.workers.dev/api/admin/poll
```

**On the phone:** open the Worker URL in Chrome → *Install app* (or ⋮ →
*Install app*) → open the app → *Indstillinger* → *Slå notifikationer til* →
*Send testnotifikation*. To test a real recall end to end, open any recall and
tap *Send denne som testnotifikation*; tapping the notification opens that
recall.

## Environment variables

| Name | Kind | Purpose |
|---|---|---|
| `VAPID_PUBLIC_KEY` | optional secret | Pin the Web Push public key (otherwise generated and kept in KV) |
| `VAPID_PRIVATE_KEY` | optional secret | Pin the Web Push private key (base64url `d`) |
| `VAPID_SUBJECT` | var | Contact URL sent to push services (your Worker URL) |
| `ADMIN_TOKEN` | optional secret | Enables `POST /api/admin/poll` and `GET /api/admin/stats` |
| `KV` | binding | Workers KV namespace (created automatically on first deploy) |
| `AI` | binding | Workers AI, for English translations (optional: without it the app shows Danish) |

Changing the VAPID keys (or deleting the `vapid` KV entry) invalidates existing
subscriptions: turn notifications off and on again in the app.

## API

| Method & path | Purpose |
|---|---|
| `GET /api/config` | VAPID public key, default chains |
| `GET /api/status` | Last poll time and last new recall only (no counters, no error text) |
| `GET /api/recalls` | Stored recalls (newest 60, without raw text) |
| `GET /api/recalls/:id` | One recall incl. raw text |
| `POST /api/subscribe` | `{subscription, settings}` – create/update |
| `POST /api/unsubscribe` | `{endpoint}` |
| `POST /api/test` | `{endpoint}` – test notification to that device |
| `POST /api/replay` | `{endpoint, id}` – send a past recall to that device |
| `POST /api/admin/poll` | Run the poll now (`Authorization: Bearer ADMIN_TOKEN`) |
| `GET /api/admin/stats` | Feed status incl. last error, 7-day reliability counters, anonymous daily counters (30 days) and totals over stored settings (`Authorization: Bearer ADMIN_TOKEN`) |

## Risk categories (from Fødevarestyrelsen's own wording)

The app does not rate risk itself. It looks for the sentence in the notice
where Fødevarestyrelsen states the risk, files the recall under that
statement, and shows the sentence as a quote on the detail page.

| Category | When the notice says… | Example wording |
|---|---|---|
| ● Kan gøre dig syg | infection, symptoms, illness or injury | *"risiko for smitte med Salmonella"*, *"sygdomsfremkaldende prioner"* |
| ▲ Farlig ved allergi | risk of an allergic reaction | *"risiko for … en allergisk reaktion"* |
| ◆ Sundhedsrisiko kan ikke udelukkes | that phrase, and nothing on acuteness | *"kan en sundhedsmæssig risiko ikke udelukkes"* |
| ◆ Ikke akut | no acute effect or symptoms | *"ikke tale om en akut sundhedsmæssig påvirkning"* |
| ○ Uegnet som fødevare | the product is unfit as food | *"gør produktet uegnet som fødevare"* |
| ■ Risiko ikke angivet | none of the above | – |

- Rules are checked in that order against the reason section first, then the
  lead and advice. Stock sentences found on many notices ("Hvis du oplever
  symptomer…") are ignored.
- All 17 saved notices are classified by a sentence; the tests pin each one.
- **Every recall notifies with sound by default.** Users can choose
  categories to receive silently (Settings → *Stille notifikationer*). A recall
  with one of the household's allergens always makes a sound.
- "Opslaget nævner gravide eller andre særligt udsatte" is shown only when the
  notice itself mentions them.
- Unusual wording falls back to "Risiko ikke angivet", which is never silent
  unless the user mutes it explicitly.

## Translation

When the app is in English, recalls are shown machine-translated by
Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). On
27 Nov 2026 the model returned Danish unchanged for some recalls and, once,
an invented recall (a SuperBrugsen chicken product) for a REMA 1000 peas
recall. So translation is treated as untrusted:

- Title, lead, stores, reason and advice are translated **one field at a
  time** with a plain prompt (no JSON mode).
- **Every field is checked** before it's used: it must be English (not
  Danish), keep every number from the original (EAN, dates, sizes), and
  name no store or chain that isn't in the original. A field that fails
  keeps Fødevarestyrelsen's Danish text.
- Translations carry a version. The API only serves translations made and
  checked by the current version, so bumping `TRANSLATE_VERSION` hides all
  older ones immediately and they are redone.
- Up to 2 recalls are translated per run, after notifications are sent. A
  recall where no field passed is retried after 6 hours.
- The product table, store chips, dates and the quoted risk sentence are
  never machine-translated.

## Barcode scan

*Scan stregkode* on the feed opens the camera. A barcode is read in the
browser; nothing is uploaded or stored. The code is compared with the
barcodes (EAN/GTIN) printed in the stored recalls and the result is one of:

- **Match**: the recall card and the matched product are shown. Opening the
  recall puts the barcode into the "Har jeg den?" check, so only the date is
  left to type.
- **Approximate match**: the notice prints a number that is not a valid
  barcode (seen once in the 30 barcodes of the saved notices: 14 digits, bad
  check digit). Its first 12 digits are compared and the screen says it is
  approximate and to check name and size.
- **No match**: shown with the "risk not stated" question-mark sticker and
  the wording *"Ingen match, men det er ikke en garanti"*, with the number
  of recent recalls that print barcodes at all. It is never worded or shown
  as an all-clear.
- **Invalid number** (check digit fails): reported as such; no match attempted.

Ways to give a barcode: the live camera, *Tag et billede* (a photo, for when
live focus fails), or typing the number under the barcode.

How it works:

- Reader: the browser's own `BarcodeDetector` where it exists (Chrome on
  Android), otherwise ZXing (`public/vendor/zxing-library.min.js`, Apache-2.0,
  v0.23.0, with its licence file), loaded only when the scan screen opens and
  then cached for offline use.
- A code is accepted only when its check digit is valid and the same code was
  read twice in a row, so a misread never reaches the matcher.
- `public/shared/ean.js` matches codes as 14-digit GTINs, so EAN-13, UPC-A
  and EAN-8 forms of one product agree. `test/ean.test.js` checks it against
  the barcodes in the 17 real notices.
- Verified in headless Chromium with a fake camera filming a generated EAN-13
  of a real notice's barcode (ZXing path), a photo upload, typed numbers, a
  denied camera, a wrong check digit and the English screens. The native
  `BarcodeDetector` path was tested only with a stand-in detector; real
  focus, light and the camera permission prompt on a phone are not covered.

## Owner dashboard and theme

- `/admin` is a small dashboard for the owner: feed health (running / late / failing), reliability and usage tables for today, 7 and 30 days, and the settings overview. It is not linked from the app, is marked `noindex`, and is never cached by the service worker. It needs the `ADMIN_TOKEN` secret: without that secret the Worker answers 403 to every request. The token is sent only as an `Authorization` header and kept in the browser's session storage (or local storage if "Remember on this device" is ticked).
- Settings → Appearance switches Auto / Light / Dark. The choice is saved on the phone only and is not sent to the server or included in the share link.
- The privacy text opens in a dialog from Settings and from the footer; the data disclaimer sits in the footer.

## Privacy and telemetry

**What is stored**

- *On the phone:* settings (stores, watch words, language, allergies, household switch, quiet categories). Barcodes and camera images are processed on the phone only; no request contains a scanned barcode.
- *On the server (Cloudflare KV), only while notifications are on:* the device's push address and the same settings, so notifications can be tailored. Turning notifications off in the app deletes that record (`POST /api/unsubscribe`); a device the push service reports as gone is deleted automatically.
- *Anonymous counters,* below.

**Anonymous counters (`src/stats.js`)**

A counter is an event name and a number for one UTC day. There is no user, device, IP address, user agent or time finer than the day. Only names on a fixed allow-list are counted. Records expire after 35 days (KV expiry). At most 400 counts per day are written, to protect the free plan's KV write limit; counts are not atomic and can be slightly off.

- *Reliability, counted by the server while it works:* `poll_failed`, `detail_failed`, `recalls_new`, `parse_unsure`, `risk_unstated`, `push_sent`, `push_rejected`, `push_gone`, `translate_ok`, `translate_failed`. They are visible only to the owner, on `/admin`.
- *Usage, counted from requests the app has to make anyway,* so no extra information is read from or sent by the phone for statistics: `feed_loads`, `scan_checks` (the list request made to check a scanned barcode, marked `?via=scan`), `recall_views`, `recall_views_push` (a recall opened by tapping a notification: the notification's link carries `?via=push`), `notifications_on`, `notifications_off`, `settings_synced`. These are visible only through `GET /api/admin/stats` (needs `ADMIN_TOKEN`), which is what `/admin` shows, together with totals over the stored settings. Allergens and the household switch appear there only when 5 or more devices exist; watch words and typed store names are never listed.

**Deliberately not collected:** clicks, scrolling, session length, location (not requested; no geolocation), device or user identifiers, cookies, fingerprints, third-party analytics, or any beacon sent by the phone for statistics.

**Logs:** the Worker writes its own log lines (one summary per check, errors). Cloudflare's automatic per-request invocation logs are switched off (`observability.logs.invocation_logs: false`) so that request details such as IP addresses are not kept in logs. Cloudflare still sees request data such as IP addresses to serve the app, as the hosting provider.

**Third parties:** Cloudflare (hosting, storage, translation), Google's push service (delivers notifications; content is encrypted), and Fødevarestyrelsen's image server (product photos load directly from the phone).

**Before other households use the app.** This is a description of the design, not legal advice. As long as only the author's household uses it, the data is the author's own. For other people:

- Allergies and the "pregnant, small children or weak immune system" switch are stored next to a device identifier. They are arguably health data (GDPR art. 9) and need explicit consent plus a privacy notice. The alternative is to keep them on the phone only, which would change how "only my stores" mode can decide to notify.
- A privacy notice (who is responsible, what is processed, why, how long, rights, contact) and Cloudflare's data processing terms should be in place.
- Anything that stores or reads information on the phone for statistics (cookies, local IDs, scripts, beacons) generally needs consent under the ePrivacy rules; none is used.

## Non-food recalls (checked 27 Nov 2026)

- **Sikkerhedsstyrelsen (sik.dk):** no usable recall data. Its only RSS feed
  holds internal newsletter tests; the "Farlige produkter" news category has
  three warnings (2017–2019).
- **Erhvervsstyrelsen (erst.dk):** blocks all automated requests with a
  bot challenge (HTTP 403), so it can't be used.
- **EU Safety Gate:** not checked yet; the likely source if non-food is added.

## Known limitations

- **Barcode scan only matches what the notice prints.** 9 of the 17 saved
  notices (30 of 71 products) list barcodes. A recalled product from a notice
  without barcodes, or one older than the stored recalls (the newest 60), is
  not found.

- **Not yet verified:** that Fødevarestyrelsen accepts requests from
  Cloudflare's network, and real push delivery to an Android phone.
- Free plan: 10 ms CPU per run. Parsing takes under 1 ms per page and each run
  fetches at most 6 pages; a burst of many recalls is spread over a few runs.
- Recent recalls are re-fetched (every 6 h for 7 days) to pick up "Opdateret"
  edits such as extra stores; updates don't send a second notification.
- Brand is usually guessed (first word of the product name) and marked
  uncertain.
- Lists of individual small shops (e.g. bazaars) are shown as text, not
  matched to chains. Chains you add yourself are matched as plain text.
- Watch words: words of 4+ letters also match inside unrelated compounds
  ("laks" matches "laksefarvet"); 3-letter words only match at the start or
  end of a word; 2-letter words ("æg") match only whole words, inflections and
  clear compounds.
- "Har jeg den?" compares exact dates and EANs; it can't compare lot numbers.
- Translations are machine-made. The checks catch Danish, missing numbers and
  invented stores, but not every wrong wording; "Show original" shows the
  Danish text, which is always the reference. Workers AI has a free daily allowance that this
  volume (~10 recalls a month) stays far below, but this wasn't measured.
- Risk categories rely on matching Fødevarestyrelsen's wording; unusual
  wording lands in "Risiko ikke angivet" rather than a wrong category.
- Android Chrome only. Out of scope: iOS, Play Store/TWA, non-food recalls,
  EU Safety Gate, barcode scanning, receipts.
- The app's interpretation can be wrong; the official notice applies.
