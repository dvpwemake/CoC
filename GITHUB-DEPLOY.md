# Chronicle of Convergence — GitHub Setup & Operations

Step-by-step guide to deploy **chronicleofconvergence.com** on GitHub Pages and run the automated news crawler. No API key required.

---

## What Gets Deployed

| File / folder | Purpose |
|---------------|---------|
| `index.html` | Public visitor frontend — timeline of live + archived news |
| `editor.html` | Editor backend — manual crawl, edit, export |
| `img/` | Site logos |
| `scripts/sources.json` | Feed sources per category |
| `scripts/crawler-lib.js` | Shared crawler logic |
| `scripts/scan-crawler.js` | CLI crawler — updates `index.html` |
| `.github/workflows/scan.yml` | Auto-crawl every 4 hours via GitHub Actions |

### News sources (crawler)

| Category | Primary | Fallbacks |
|----------|---------|-----------|
| AI | MIT Technology Review | ScienceDaily |
| Robotics | IEEE Spectrum | Robotics & Automation News, ScienceDaily |
| Biotech | STAT News | Fierce Biotech, Nature |
| Space | NASA | SpaceNews, ScienceDaily |
| Energy | Canary Media | ScienceDaily (solar + tech) |
| Neuroscience | Neuroscience News | ScienceDaily |

---

## Prerequisites

- A [GitHub](https://github.com) account
- Git installed locally
- This project folder on your machine

---

## Part 1 — Initial GitHub Deployment

### Step 1: Create the repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** e.g. `chronicle-of-convergence` (or `CoC`)
3. **Visibility:** Public (required for free GitHub Pages on a personal account)
4. Do **not** add README, .gitignore, or license — you already have files locally
5. Click **Create repository**

### Step 2: Push the project

Open Terminal and run (replace `YOUR_USERNAME` and `YOUR_REPO`):

```bash
cd /path/to/CoC

git init
git add index.html editor.html img/ scripts/ .github/
git commit -m "Initial deploy: Chronicle of Convergence"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

**Required file structure:**

```
CoC/
├── index.html
├── editor.html
├── img/
│   ├── CoC_logo_Blk.png
│   └── CoC_logo_wh.png
├── scripts/
│   ├── sources.json
│   ├── crawler-lib.js
│   └── scan-crawler.js
└── .github/
    └── workflows/
        └── scan.yml
```

### Step 3: Enable GitHub Pages

1. Open your repo on GitHub
2. Go to **Settings** → **Pages**
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Click **Save**
5. Wait 1–3 minutes

Your site will be live at:

```
https://YOUR_USERNAME.github.io/YOUR_REPO/
```

Test these URLs:

- `https://YOUR_USERNAME.github.io/YOUR_REPO/index.html`
- `https://YOUR_USERNAME.github.io/YOUR_REPO/editor.html`

### Step 4: Enable the auto-crawl workflow

The crawler runs in GitHub Actions and updates `index.html` every 4 hours.

#### 4a. Allow the workflow to push commits

1. Repo → **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**

#### 4b. Enable Actions (if prompted)

1. Go to the **Actions** tab
2. If you see “Workflows aren’t being run”, click **I understand my workflows, go ahead and enable them**

#### 4c. Run the first crawl manually

1. **Actions** → **Auto-Scan News**
2. Click **Run workflow** → **Run workflow**
3. Wait ~1–2 minutes
4. Confirm a new commit appears: `Auto-scan: YYYY-MM-DD HH:MM UTC`

No GitHub secrets are needed. The crawler does not use the Anthropic API.

### Step 5: Custom domain (optional)

For `chronicleofconvergence.com`:

#### 5a. GitHub Pages

1. **Settings** → **Pages** → **Custom domain**
2. Enter: `chronicleofconvergence.com`
3. Click **Save**
4. After DNS propagates, enable **Enforce HTTPS**

GitHub may add a `CNAME` file to the repo — pull that change locally:

```bash
git pull
```

#### 5b. DNS at your registrar

| Type | Name | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `dvpwemake.github.io` |

> **Important:** The `www` CNAME must point to `dvpwemake.github.io`, **not** to your apex domain. Pointing `www` at the apex (e.g. `chronicleofconvergence.com`) prevents GitHub from issuing HTTPS certificates and blocks **Enforce HTTPS**.

DNS propagation: typically 5–30 minutes (up to 48 hours). After DNS is correct, remove and re-add the custom domain in **Settings → Pages** if **Enforce HTTPS** stays unavailable for up to an hour.

---

## Part 2 — Daily Operations

### Option A: Fully automated (recommended)

Once Part 1 is complete, no daily action is required.

Every 4 hours, GitHub Actions:

1. Crawls reputable science feeds
2. Picks the top 5 stories (newest per category)
3. Fetches article images and summaries
4. Updates `EMBEDDED_DATA` in `index.html`
5. Commits and pushes to `main`

GitHub Pages redeploys automatically after each push.

**Manual trigger:** Actions → Auto-Scan News → Run workflow

### Option B: Crawl locally, then push

```bash
cd /path/to/CoC
node scripts/scan-crawler.js          # update index.html
node scripts/scan-crawler.js --dry-run  # preview JSON only, no file change

git add index.html
git commit -m "Manual crawl update"
git push
```

### Option C: Editor in the browser

1. Serve the folder locally (required for `scripts/` to load):

   ```bash
   cd /path/to/CoC
   python3 -m http.server 8000
   ```

2. Open `http://localhost:8000/editor.html`
3. Click **⚡ Crawl & Publish** to fetch feeds and publish to localStorage
4. Review entries in the sidebar — click to edit headline, summary, image, source
5. For static deploy, export and embed:
   - Click **⤓ Export** → **Copy**
   - Paste into `index.html` → replace the `EMBEDDED_DATA` array
   - Commit and push

**Editor shortcuts:**

| Action | Button |
|--------|--------|
| Crawl feeds | ⚡ Crawl & Publish |
| Publish to same-domain visitors | ↑ Publish Now |
| Export for GitHub | ⤓ Export |
| Import backup | ⤒ Import |
| Preview site | ◎ Preview |
| Pull image from article | ↻ From article |
| Auto-crawl every 4h (browser tab must stay open) | Auto-crawl toggle |

> **Note:** **Publish Now** only updates `localStorage` in the visitor’s browser on the same domain. For all visitors to see changes on GitHub Pages, use **Export → embed in index.html → git push**, or rely on GitHub Actions.

---

## Part 3 — Maintenance Menu

Quick reference for common tasks.

### Update news content

| Method | Steps |
|--------|-------|
| Automatic | Wait for 4h schedule, or Actions → Run workflow |
| CLI | `node scripts/scan-crawler.js` → `git push` |
| Editor | Crawl & Publish → Export → paste into `index.html` → `git push` |
| Manual entry | Editor → ＋ Manual Entry → fill form → Save → Export → push |

### Edit a single story

1. Open `editor.html` (local server or live site)
2. Click the entry in the sidebar
3. Edit fields → **Save**
4. Export → update `index.html` → commit & push (or use GitHub Actions on next crawl)

### Change news sources

Edit `scripts/sources.json`, then commit and push:

```bash
git add scripts/sources.json
git commit -m "Update crawler sources"
git push
```

### View crawl history

- **GitHub:** Repo → **Commits** — look for `Auto-scan:` messages
- **Editor:** Click **Log** in the crawler panel

### Roll back a bad batch

```bash
git log --oneline index.html    # find commit before bad scan
git checkout <commit-hash> -- index.html
git commit -m "Revert bad crawl batch"
git push
```

---

## Part 4 — Optional Configuration

### Hide the editor from the public

`editor.html` already has `noindex,nofollow`. To go further:

- Keep `editor.html` only in a private repo or locally
- Or add `robots.txt`:

  ```
  User-agent: *
  Disallow: /editor.html
  ```

### Change crawl frequency

Edit `.github/workflows/scan.yml`:

```yaml
schedule:
  - cron: '0 */4 * * *'   # every 4 hours (UTC)
```

Cron examples:

| Schedule | Cron |
|----------|------|
| Every 6 hours | `0 */6 * * *` |
| Daily at 8:00 UTC | `0 8 * * *` |
| Twice daily | `0 8,20 * * *` |

Commit and push after editing.

### Change how many stories per batch

Edit `scripts/sources.json`:

```json
"pickCount": 5
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Site shows 404 | Confirm Pages: branch `main`, folder `/ (root)` |
| Broken logos / images | Ensure `img/` was pushed; paths are relative (`img/CoC_logo_wh.png`) |
| Workflow fails to push | Settings → Actions → Workflow permissions → **Read and write** |
| Scheduled workflows don’t run | GitHub only runs schedules on repos active in the last 60 days |
| Editor crawl fails | Open via local server; confirm `scripts/` is deployed |
| Old news in browser | Clear `localStorage` key `coc_news_data`, or hard-refresh |
| No articles found | Check Actions log; a feed may be temporarily down — crawler uses fallbacks |
| Card images missing | Crawler fetches `og:image` from article pages; check source URL in editor |

---

## Deployment Checklist

- [ ] Repo created and code pushed
- [ ] GitHub Pages enabled (`main` / root)
- [ ] Workflow permissions: Read and write
- [ ] First manual workflow run succeeded
- [ ] Site loads at `*.github.io` URL
- [ ] (Optional) Custom domain configured
- [ ] (Optional) HTTPS enforced

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions (every 4h)                  │
│  scan.yml → scan-crawler.js → crawler-lib.js            │
│           → sources.json (feeds)                        │
│           → updates index.html → git push               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub Pages (static host)                 │
│  index.html  ← visitors see EMBEDDED_DATA               │
│  editor.html ← optional manual crawl / edit / export    │
└─────────────────────────────────────────────────────────┘

Local / editor path:
  editor.html → Crawl → localStorage OR Export JSON
             → paste into index.html → git push
```

---

*Chronicle of Convergence · a WeMake, Corp. Company · chronicleofconvergence.com*