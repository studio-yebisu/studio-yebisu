# Mobile web layout

The public site is static HTML, CSS and JavaScript in `src/`, copied as-is by `scripts/build.py`. There is no framework, build step for CSS/JS, web font, icon CDN or third-party request. Phones are the base layout; wider screens add to it.

## Files

| File | Role |
| --- | --- |
| `src/index.html`, `src/app.js` | Home: search, cases, fields, catalog, how-to |
| `src/case.html`, `src/case.js` | Case article (`?id=`) and catalog item guide (`?entry=`) |
| `src/ui.js` | Shared helpers loaded first on both pages (`window.SY`): element builder, `safeHref`, bottom bar, title-line joining, editing state |
| `src/styles.css` | One stylesheet for both pages |

Counts on the page (entries, fields, case articles) are always computed from `data/catalog.json` and `data/cases.json` at load time. Do not write them into HTML or copy. To check current numbers, run `python scripts/check.py` after a build; it prints them.

## URL contract

Home (`index.html`):

- `?q=<words>` — keyword search over name, summary, use case, tags, kind and field label.
- `?kind=skill` or `?kind=support` — kind filter.
- `?case=1` — only catalog items that a published case points to (`catalog_entry.id`, or a `guide_url` of `case.html?id=…`).
- `#<category id>` (for example `#agents`) — selects that field and scrolls to the catalog. Old links keep working.
- `#cases`, `#feature`, `#fields`, `#catalog`, `#howto`, `#top` — section anchors.
- Choosing a field from the field map or submitting the top search adds a history entry. Typing, the field select and the toggles replace the current entry. Any filter change returns the list to the first page.

Article (`case.html`):

- `?id=<case id>` — produced case from `data/cases.json` (falls back to `data/cases/<id>.json`).
- `?entry=<catalog id>` — catalog item. If a case points to it, the page leads to that case; a `source-reviewed` item is shown as a source guide only, never as an executed example.
- Unknown or malformed ids, and unreadable data, show a message with a next step (retry, catalog, case list).

## Layout contract

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`. Never add `maximum-scale` or `user-scalable=no`.
- Bands (masthead, sections, footer, article parts) use `max(gutter, env(safe-area-inset-left/right))`, so the inset is never added twice. The masthead adds `env(safe-area-inset-top)`.
- Below 900px a fixed bottom bar (`.tabbar`) holds up to four anchors. `body` reserves `--tabbar-h + env(safe-area-inset-bottom)`. The home bar is ホーム / 分野 / 作例 / 探す; `case.js` replaces it with links that exist for that page (for example 動画 / デモ / 依頼文, or 使い方 / 依頼文 / 原典). There is only ever one bottom row.
- While a text field has focus, `ui.js` sets `html.is-editing` and the bar is hidden, so it does not cover the software keyboard. No keyboard height is measured and no user agent is detected.
- The masthead is sticky; `html { scroll-padding-top }` keeps anchor targets visible below it. On short landscape screens the masthead is static.
- Side columns (catalog filters, article contents) are sticky only at 1100px+ wide and 760px+ tall.
- No `100vh`/`100vw` panels and no `overflow-x: hidden` on the root. Fix overflow with `min-width: 0`, grid tracks and wrapping instead.
- Article `title_lines` are inline phrase blocks on phones. Phrases that fit stay together; longer ones wrap inside the available width. This avoids splitting a short word such as 申請 across adjacent lines. Wide screens keep the authored line breaks.
- Primary controls and navigation targets are at least 44×44px; links within running text retain inline sizing. Body text 16px (17px on desktop), line height 1.7; form controls are at least 16px to avoid iOS focus zoom. Reading width is about 40em.
- Hover styles are inside `@media (hover: hover) and (pointer: fine)`. Motion is limited to a 150ms press scale on buttons and is removed under `prefers-reduced-motion`.

## Media

- Home case cards use the case `poster` image at 16:9 with `object-fit: contain`. The feature poster is in the HTML and loads first; the others use `loading="lazy"`. The home page loads no video.
- Article video: native `<video controls playsinline preload="none" poster>`, no autoplay or loop. The caption shows the case's own `video_note` (or `CASE_EXTRAS` in `case.js`) and always keeps direct links: 動画を大きく見る (the MP4 itself), MP4を保存, and the video source page when present. If playback fails, those links remain.

## Verification on 2026-10-16

`build.py`, `check.py` and JavaScript syntax checks passed. Windows IAB Chromium was used at 320, 375, 390, 430, 844 (landscape), 1280 and 1440px. All 16 existing article pages fitted 320px without page overflow. Native actions checked search, combined filters, pagination, history, prompt clipboard readback, real demo links, error recovery and a complete 28-second MP4 playback. Physical iPhone Safari, VoiceOver and hardware safe areas have not been tested. Automatic checks and agent visual inspection are not human aesthetic approval.

## Content safety

- All data is written with `textContent` or text nodes; no HTML from data is parsed.
- Links pass through `SY.safeHref`: `http(s)` URLs and same-site relative paths only. `javascript:`, `data:`, protocol-relative `//`, backslashes and control characters are refused.
- Copy buttons report success only after `navigator.clipboard.writeText` resolves (or the native copy command returns true). On failure the text is expanded and selected, with a note to long-press and copy.
- The home catalog has no preview dialog; each item opens its own page.

## Test checklist

Run after a build, in a real browser where available:

1. Widths 320, 375, 390 and 430 in portrait, a phone in landscape, and 1280 / 1440 desktop: no horizontal page scroll, the search field visible without scrolling on a phone, bottom bar not covering the last content.
2. Search, field, kind and case toggles, reset, さらに表示, empty result, and back/forward after each.
3. Old hash links (`#agents`, `#feature`, `#catalog`) and shared URLs with `?q=`.
4. Every `case.html?id=` from `data/cases.json` and a sample of `?entry=` items, including a `source-reviewed` one, an unknown id and a malformed id.
5. Video play, the direct MP4 link, demo links, prompt copy (secure and non-secure context), and focus while a text field is active.
6. Catalog or cases file unavailable: the page says so and offers a retry; no zero counts are shown.

References: WebKit, “Designing Websites for iPhone X” (viewport-fit and safe-area insets), https://webkit.org/blog/7929/designing-websites-for-iphone-x/ ; Apple, “Delivering Video Content for Safari”, https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari .
