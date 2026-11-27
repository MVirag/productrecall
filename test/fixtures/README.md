# Fixtures

Real pages from Fødevarestyrelsen, downloaded 27 Nov 2026 with `npm run fixtures`.

- `rss.xml` – the full recall RSS feed (527 items, June 2021 – Nov 2026).
- `pages/*.html` – 17 recall detail pages, named by recall id. They cover the
  four layouts seen on the site:
  - `<h2>` section headings (most 2023–2026 pages)
  - `<h1>` section headings (some Nov 2026 pages)
  - `<strong>Label:</strong>` paragraphs (2021)
  - bold `<span>` labels in `<div>`s (2022, migrated SharePoint content)

Do not edit these files by hand; the tests assert values read off the real pages.
