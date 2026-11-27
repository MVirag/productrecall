# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Built first for its author, who reads alerts on an Android phone (Chrome) when a Danish food recall is published and wants to know quickly whether it concerns their home. The author's household shares the same stores, watch words and allergies through a settings link. The author intends it eventually to serve other households, each bringing their own stores, words and allergies. Today the author is the only user.

## Product Purpose
Sends a push notification when Fødevarestyrelsen recalls a food or drink product, and presents each recall so the reader can decide in seconds whether they have it and what to do. Success is a household that is warned quickly about the recalls that matter to it, without having to check an official page.

## Positioning
Two things the official recall page and general news alerts do not do: it makes the recall relevant to this person (their stores, watch words and household allergies decide what is highlighted and what always sounds), and it lets them check their own pack by date or barcode ("Har jeg den?"). It also needs nothing from the user to run: a notification arrives on the phone, with no account or other app to keep open.

## Operating Context
Recalls come from Fødevarestyrelsen's RSS feed and recall pages, polled every 15 minutes by a Cloudflare Worker, and are pushed to Chrome on Android over Web Push. The reader is typically on a phone, at home or in a shop, holding or remembering a product. Recall notices are written in Danish and vary in layout; four page layouts have been seen since 2021.

## Capabilities and Constraints
Confirmed features: feed of recalls; recall detail with products, dates, EAN and lot numbers, product image and a link to the official notice; "Har jeg den?" check by date or barcode; store chains, notify-all or only-my-stores mode, watch words; household profile with the 14 EU allergens and a vulnerable-groups flag; sharing a recall and sharing settings by link; Danish and English UI with machine-translated recall text; risk level taken from the notice's own wording and shown with the quoted sentence.

Current technical facts: no user accounts; settings live on the device; the server stores only push subscriptions with their store, mode and word settings; hosted on Cloudflare's free plan.

Out of scope for now: Play Store or TWA app, iOS, non-food recalls, EU Safety Gate, barcode scanning, receipts. Ideas raised but not started: matching recalls against purchase history from store apps; return assistance.

No design constraints were declared binding; the facts above describe how the product works today, not rules the user has fixed.

## Evidence on Hand
Seventeen real recall pages saved in `test/fixtures/pages/` and a real RSS snapshot in `test/fixtures/rss.xml`. An end-to-end test on the author's Android phone (install, test push, tapping a push to open the recall) has worked. There are no other users, testimonials, usage numbers or press; none should be invented.

## Product Principles
1. What concerns this household is surfaced first, but every recall is still delivered unless the person chooses otherwise.
2. The reader should be able to answer "do I have it, and what do I do?" from the card or the detail screen without leaving the app.
3. The product asks nothing of the user to keep working: no account, no app to keep open, no setup beyond choosing stores, words and allergies.

## Accessibility & Inclusion
Target is WCAG 2.2 AA basics, as set at the start of the project.
