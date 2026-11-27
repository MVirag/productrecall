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
| `src/worker.js` | API routes + cron entry point |
| `public/shared/` | Store matching, watch words, card/notification text (used by Worker and app) |
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
| `ADMIN_TOKEN` | optional secret | Enables `POST /api/admin/poll` |
| `KV` | binding | Workers KV namespace (created automatically on first deploy) |

Changing the VAPID keys (or deleting the `vapid` KV entry) invalidates existing
subscriptions: turn notifications off and on again in the app.

## API

| Method & path | Purpose |
|---|---|
| `GET /api/config` | VAPID public key, default chains |
| `GET /api/status` | Last poll time, last error |
| `GET /api/recalls` | Stored recalls (newest 60, without raw text) |
| `GET /api/recalls/:id` | One recall incl. raw text |
| `POST /api/subscribe` | `{subscription, settings}` – create/update |
| `POST /api/unsubscribe` | `{endpoint}` |
| `POST /api/test` | `{endpoint}` – test notification to that device |
| `POST /api/replay` | `{endpoint, id}` – send a past recall to that device |
| `POST /api/admin/poll` | Run the poll now (`Authorization: Bearer ADMIN_TOKEN`) |

## Known limitations

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
- Android Chrome only. Out of scope: iOS, Play Store/TWA, non-food recalls,
  EU Safety Gate, barcode scanning, receipts.
- The app's interpretation can be wrong; the official notice applies.
