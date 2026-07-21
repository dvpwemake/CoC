# Chronicle of Convergence v2 — Deployment & Operations Manual

**Document status:** Active  
**Last updated:** 2026-07-20  
**Staging path:** `Repo/CoC/v2/`  
**Production path:** `Repo/CoC/` (root) — **do not overwrite without principal cutover**

| Role | Name | Responsibility |
|------|------|----------------|
| Web & Site Engineering | Nora Kim | Code, assets, inject contracts |
| Release & Change | Marcus Hale | Go/no-go, cutover, isolation rule |
| QA & Verification | Dana Okonkwo | Pre-ship checklist (blocking) |
| DevOps & CI/CD | Ava Brooks | Workflows, Pages, schedules |
| Data & Backup | Leo Tran | `archive.json` / `editorial.json` backups |
| CTO | Dr. Amara Okonkwo | Final systems sign-off |

Related: `sops/qa-field-signals-checklist.md` · `COC-V2.md` · `README.md` · `../WORK_ACCIDENT_2026-07-20.md`

---

## 1. What this system is

CoC v2 is a **static site** (HTML/CSS/JS) plus:

- **Public index** — daily editorial (~300 words) + field-signal news cards  
- **Editor** — browser admin for news batches and editorial fields  
- **Data files** — `data/archive.json` (news history), `data/editorial.json` (draft/published)  
- **Node scripts** — RSS crawl, editorial draft (9pm ET), editorial publish (8am ET)

No app server is required for production. Local HTTP is required for editor preload (`file://` blocks `fetch`).

---

## 2. Directory map

```
v2/
├── index.html              # Public site
├── editor.html             # Admin (nofollow)
├── terms.html              # Terms of Use
├── privacy.html            # Privacy Policy
├── img/                    # Logos / marks
├── data/
│   ├── archive.json        # Full news history (source of truth)
│   ├── editorial.json      # published + drafts + history + usedHeroImages
│   └── fallback-news.json  # Slim offline fallback (optional tooling)
├── scripts/
│   ├── sources.json        # RSS sources by category
│   ├── crawler-lib.js      # Parse/strip/sanitize
│   ├── scan-crawler.js     # CLI crawl → archive
│   ├── editorial-lib.js    # Draft/publish logic (~300w)
│   ├── editorial-draft.js  # 9pm ET draft job
│   └── editorial-publish.js# 8am ET publish job
├── sops/
│   └── qa-field-signals-checklist.md
├── DEPLOYMENT_AND_OPERATIONS.md  # This manual
├── COC-V2.md
└── README.md
```

**Hard rule:** All v2 redesign work stays under `v2/` until principal says **replace live** / **cut over**. Never “fix” root `index.html` as a casual save.

---

## 3. Local development & preview

### 3.1 Serve over HTTP (required)

```bash
cd /Users/kingofthehill/Documents/Repo/CoC/v2
python3 -m http.server 8765
```

| Page | URL |
|------|-----|
| Public | http://127.0.0.1:8765/index.html |
| Editor | http://127.0.0.1:8765/editor.html |
| Terms | http://127.0.0.1:8765/terms.html |
| Privacy | http://127.0.0.1:8765/privacy.html |

### 3.2 Node jobs (optional local)

Requires network for RSS crawl.

```bash
cd /Users/kingofthehill/Documents/Repo/CoC/v2

# Crawl feeds → updates data/archive.json (and related)
node scripts/scan-crawler.js

# Force next-day editorial draft (~300 words)
node scripts/editorial-draft.js --force

# Force publish today's draft → data/editorial.json + slim inject into index
node scripts/editorial-publish.js --force
```

Without `--force`, scripts respect America/New_York windows (draft ~21:00, publish ~08:00).

### 3.3 Browser storage keys (editor)

| Key | Purpose |
|-----|---------|
| `coc_editor_batches` | Editor working batches |
| `coc_news_data` | Published news (public index prefers this when present, **merged** with archive) |
| `coc_editorial_store` | Editorial drafts/published in browser |
| `coc_editorial_pub` | Published editorial override for public index |

**Clear site data** only after export if you need a clean slate. Publish **merges** news; it does not wipe history by design.

---

## 4. Daily operations

### 4.1 Editorial cadence (ET)

| Time (America/New_York) | Action | Owner |
|-------------------------|--------|--------|
| By 21:00 | Draft next day’s editorial (~300 words) | Editorial desk + `editorial-draft.js` |
| 08:00 | Publish today’s editorial | `editorial-publish.js` or Editor “Mark published” |
| Ongoing | Spot-check live index after publish | Dana (QA) |

**Length standard:** **~300 words** (acceptable band **280–320**). Generator enforces band; hand edits should too.

**Hero rule:** Do not reuse a `heroImage` URL already in `usedHeroImages` / published / drafts. Prefer NASA public-domain assets.

### 4.2 News / field signals

1. **Crawl** (CLI or Editor “Scan”)  
2. **Review** titles, categories, images, summaries in Editor  
3. **Sanitize** is automatic (`plainText` / `stripHtml`) — still **spot-check** for angle brackets  
4. **Publish** from Editor (merges into public feed)  
5. **Deploy** updated `data/archive.json` with the site when shipping files

Categories: AI · Art · Robotics · Biotech · Space · Energy · Neuroscience.

### 4.3 QA gate (blocking — every ship)

See `sops/qa-field-signals-checklist.md`. Minimum:

1. No raw HTML / `<cite>` / `[web:N]` on any card  
2. Archive unique title count ≥ prior  
3. One editorial hero; no duplicate hero/thumb on first paint  
4. Footer: Terms · Privacy · Contact · **E** only  
5. Index first paint is responsive; Load more works  

**Sign-off:** Dana Okonkwo → Marcus Hale go/no-go.

---

## 5. Deployment

### 5.1 What to deploy (staging or production package)

Ship a **consistent set**:

```
index.html
editor.html          # optional on public host; protect or omit if desired
terms.html
privacy.html
img/**
data/archive.json
data/editorial.json
```

Scripts and `.github/` need not be public on the CDN if crawl runs elsewhere; keep them in the repo for ops.

### 5.2 Staging deploy (default)

1. Confirm all changes are only under `v2/`  
2. Backup current `data/archive.json` and `data/editorial.json` (Leo / Time Machine / copy)  
3. Run QA checklist on http://127.0.0.1:8765 (or staging host)  
4. Upload/sync `v2/` tree to **staging** host or Pages **preview** branch  
5. Marcus: staging go  

### 5.3 Production cutover (principal required)

**Forbidden without explicit principal language:** “replace live”, “cut over”, “promote v2 to production”.

When authorized:

1. **Ticket** (Systems Analyst acceptance criteria)  
2. **Backup production root** (`Repo/CoC/index.html`, `data/`, assets)  
3. **Merge news:** ensure production’s latest cards are inside `v2/data/archive.json` (never drop titles)  
4. **QA** on staging package (Dana)  
5. **Release go** (Marcus) + **CTO** if systems risk  
6. **Promote:** copy approved v2 public files to production root (or flip host root to v2 build)  
7. **Smoke test** live URL: editorial, 12 cards, Load more, Terms, Privacy, no markup on cards  
8. **Postmortem note** in IT worklog if anything failed  

### 5.4 Rollback

1. Restore previous production backup (root files + `data/`)  
2. Do **not** delete `v2/` staging — keep working tree  
3. Incident owner: Jordan Reeves (SRE) + Marcus (Release)  
4. Dana re-verifies live after rollback  

---

## 6. Data integrity

### 6.1 News archive

- **Source of truth:** `data/archive.json`  
- **Preserve:** merge new batches; never replace whole file with a single batch  
- **Dedupe:** by title (case-insensitive) when building public lists  
- **Sanitizer:** titles/summaries/sources must be plain text before publish  

### 6.2 Editorial store

- **Source of truth:** `data/editorial.json`  
  - `published` — live piece  
  - `drafts` — by date `YYYY-MM-DD`  
  - `history` — prior publishes  
  - `usedHeroImages` — uniqueness ledger  
- Public index loads `published` via `fetch('data/editorial.json')`, with slim `EMBEDDED_EDITORIAL` offline fallback  

### 6.3 Backup policy (minimum)

| Asset | Frequency | Where |
|-------|-----------|--------|
| `data/archive.json` | Before every deploy + weekly | Local copy + remote/git |
| `data/editorial.json` | Before every publish/deploy | Same |
| Production root snapshot | Before cutover | Named dated folder |

---

## 7. Performance ops

| Practice | Detail |
|----------|--------|
| Slim index | Do not re-embed full archive into `index.html` |
| Pagination | First paint 12 cards; Load more for archive |
| Images | Direct URL first; weserv proxy on `onerror` |
| Fonts | Async Google Fonts; system stack still readable |
| Cache | After deploy, hard-refresh or purge CDN if used |

Target: public `index.html` stays small (~30KB class); heavy data stays in `data/archive.json`.

---

## 8. Security & access

- **Editor** is a static page with `rel="nofollow"` — not a full auth system. Do not advertise `/editor.html` publicly if the host is fully open; prefer password-protect or omit from production deploy.  
- **Secrets:** never commit API keys, mail passwords, or Workspace tokens to this tree.  
- **Outbound mail / automations:** IT status words only — `plan | connected | authorized | sent | scratched`. No “armed” without Email Lead proof.  
- **Legal:** Terms and Privacy must ship with the public site footer links.

---

## 9. Incident playbooks (short)

### 9.1 Markup / “code” on news cards

1. Confirm with View Source / inspect summary text  
2. Index auto-scrubs and heals `coc_news_data` on load — hard refresh  
3. Fix polluted batch in Editor → re-publish (merge)  
4. Ensure crawler-lib `stripHtml` still decode-then-strip  
5. Dana logs; if shipped live, Marcus opens change ticket  

### 9.2 Missing editorial

1. Check `data/editorial.json` → `published`  
2. Check browser `coc_editorial_pub` not overriding with empty  
3. Re-run `node scripts/editorial-publish.js --force` or Editor mark published  
4. Confirm hero URL HTTP 200  

### 9.3 Lost news history after deploy

1. Restore last good `archive.json` backup  
2. Merge production-only titles if any  
3. Never “fix” archive with a single new crawl batch without merge  

### 9.4 Slow page

1. Confirm index is not re-bloated with full EMBEDDED_DATA  
2. Confirm Load more pagination still 12  
3. Check image proxy storms (prefer direct-first path)  
4. Check server/CDN, not only HTML  

---

## 10. Ownership matrix (RACI-lite)

| Activity | Nora (Web) | Dana (QA) | Marcus (Release) | Ava (DevOps) | Leo (Backup) |
|----------|------------|-----------|------------------|--------------|--------------|
| Code change in v2 | R | C | I | C | I |
| Pre-ship QA | C | R | A | I | I |
| Staging deploy | C | C | A | R | C |
| Production cutover | C | C | A | R | R (backup) |
| Crawl/editorial jobs | C | C | A (arm) | R | I |
| Cite-markup gate | R (fix) | **A (block)** | A (go) | I | I |

R = responsible · A = accountable · C = consulted · I = informed  

---

## 11. Quick command card

```bash
# Preview
cd /Users/kingofthehill/Documents/Repo/CoC/v2 && python3 -m http.server 8765

# Crawl news
node scripts/scan-crawler.js

# Editorial (~300 words)
node scripts/editorial-draft.js --force
node scripts/editorial-publish.js --force

# QA mindset
# open index → 12 cards → Load more → editorial word count ~300
# no <cite> in summaries → Terms/Privacy 200 → footer E only
```

---

## 12. Change log (ops-relevant)

| Date | Change |
|------|--------|
| 2026-07-20 | v2 isolation after root overwrite accident |
| 2026-07-20 | Cite-markup sanitizer permanent QA gate (Dana) |
| 2026-07-20 | Archive merge for news preservation; slim index; hero uniqueness |
| 2026-07-20 | Editorial length standard **~300 words** |
| 2026-07-20 | This deployment & operations manual |

---

*When in doubt: stage in `v2/`, QA with Dana’s checklist, Release go from Marcus, principal language before production root changes.*
