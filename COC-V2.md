# CoC Website v2

**Staging only** — production root is `../index.html`. Do not cut over without principal OK.

## Identity
Digital multimedia chronicle exploring how culture, society, technology, and faith intersect in American life. Convergence lens. Human voice and human touch only; host as quiet facilitator.

## UI (2026-07-20 polish)
- Light matte paper palette (`#f3efe6` / `#faf7f1`), gold accents, Libre Baskerville + Source Sans 3
- Drop-cap editorial prose, newspaper credit line under hero

## Performance (2026-07-20)
- `index.html` carries only a **slim offline fallback** (latest batch + slim editorial).
- Full history loads from `data/archive.json` (merged with production cards).
- First paint: **12 cards** + “Load more”; images use **direct URL first**, proxy on error.
- Fonts load async; no `background-attachment: fixed`.

## News preservation
- `data/archive.json` is the source of truth across deploys.
- Production batches are **merged in**, never replaced, on v2 staging updates.
- Editor **Publish** merges into `coc_news_data` instead of wiping prior batches.

## Why thumbnails were missing (root cause)
Many publisher CDNs block hotlinking / require referrers. v2 loads thumbs **direct first**, then **images.weserv.nl proxy** on error, then category placeholder.

## Hero uniqueness
- Editorial heroes tracked in `usedHeroImages`; drafts must not reuse published hero URL.
- Page reserves editorial hero URL so news cards do not show the same image.
- Visible grid dedupes by image URL (second card gets category fallback).

## Why editorial had no paragraphs / weak hero
1. Generator stored body as a **single flat string** (no `\\n\\n`), so the page rendered one `<p>`.
2. Hero `onerror` **hid the whole hero block** instead of falling back.
Fixed: body is **paragraph array + `\\n\\n` storage**; hero uses proxy + credit bar always; prose is rewritten for print-quality CoC tone (less formulaic).

## Features
1. **News crawl** — AI, Robotics, Biotech, Space, Energy, Neuroscience, **Art**
2. **Daily editorial** (~**300 words**, band 280–320; convergence themes; PD hero + credit)
   - Draft **9:00 p.m. ET** · Publish **8:00 a.m. ET**
3. **Editor** — news + editorial body / hero URL
4. **Brand** — text wordmark + `img/logo-mark.png`

## CLI
```bash
cd v2
node scripts/scan-crawler.js
node scripts/editorial-draft.js --force
node scripts/editorial-publish.js --force
open index.html
```
