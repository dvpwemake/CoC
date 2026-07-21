# CoC Website v2 — staging only

**Owners (IT Team):**  
- **Web & Site Engineering:** Nora Kim  
- **Release & Change Manager:** Marcus Hale  
- **QA:** Dana Okonkwo  
- **DevOps:** Ava Brooks  

**Production site remains at repository root** (`../index.html`).  
This folder is the only place v2 work may live until principal says **cut over / replace live**.

## Full manual

**→ [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md)** — deploy, daily ops, backup, incidents, RACI.

## Open

| Path | Purpose |
|------|---------|
| `index.html` | CoC v2 public site (editorial + news + Art) |
| `editor.html` | Admin: news + daily editorial fields |
| `terms.html` / `privacy.html` | Legal |
| `data/editorial.json` | Draft / published editorial store |
| `data/archive.json` | News archive (preserve on deploy) |
| `scripts/` | Crawl + editorial draft/publish |
| `sops/qa-field-signals-checklist.md` | Blocking QA gate |
| `img/logo-mark.png` | Marble mark |

## Features
1. News crawl + **Art** category  
2. Daily editorial **~300 words** (280–320; PD hero + credit)  
3. Draft **9pm ET** / publish **8am ET** (script-gated)  
4. Editor can edit body + hero image URL  
5. Text wordmark + real mark logo  

## Local preview (required)

`file://` blocks `fetch`. Serve over HTTP:

```bash
cd /Users/kingofthehill/Documents/Repo/CoC/v2
python3 -m http.server 8765
# http://127.0.0.1:8765/index.html
# http://127.0.0.1:8765/editor.html
```

```bash
node scripts/scan-crawler.js
node scripts/editorial-draft.js --force
node scripts/editorial-publish.js --force
```

## Cutover (requires principal)
See **DEPLOYMENT_AND_OPERATIONS.md** §5.3. Short form: ticket → backup → QA → Release go → principal “replace live” → promote → smoke test.

See also: `../WORK_ACCIDENT_2026-07-20.md`

