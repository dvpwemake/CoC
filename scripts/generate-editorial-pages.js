#!/usr/bin/env node
'use strict';
/**
 * Generate static editorial permalinks e/YYYY-MM-DD.html + refresh sitemap.
 * $0 — pure static HTML for SEO, OG previews, and social share.
 *
 * Usage: node scripts/generate-editorial-pages.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EDITORIAL_PATH = path.join(ROOT, 'data', 'editorial.json');
const OUT_DIR = path.join(ROOT, 'e');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://chronicleofconvergence.com';

function loadJson(p, fb) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fb;
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plain(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphs(ed) {
  if (ed.paragraphs && ed.paragraphs.length) return ed.paragraphs.map(plain).filter(Boolean);
  return String(ed.body || '')
    .split(/\n\n+/)
    .map((p) => plain(p))
    .filter(Boolean);
}

function wordCount(ed) {
  const t = paragraphs(ed).join(' ');
  return t.split(/\s+/).filter(Boolean).length;
}

function isOutline(ed) {
  if (!ed) return true;
  if (ed.draftKind === 'outline' || ed.formId === 'outline_brief') return true;
  const blob = String(ed.title || '') + '\n' + String(ed.body || '');
  return /EDITORIAL BRIEF\s*\(outline only/i.test(blob) || /^Editorial brief\s*[—–-]/.test(String(ed.title || '').trim());
}

function richer(a, b) {
  if (!a) return b;
  if (!b) return a;
  const pa = paragraphs(a).length;
  const pb = paragraphs(b).length;
  if (pb !== pa) return pb > pa ? b : a;
  const ta = a.updatedAt || a.publishedAt || '';
  const tb = b.updatedAt || b.publishedAt || '';
  return tb >= ta ? b : a;
}

function collectEditorials(store) {
  const map = {};
  function put(ed) {
    if (!ed || isOutline(ed)) return;
    const d = String(ed.publishDate || (ed.publishedAt || '').slice(0, 10) || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!paragraphs(ed).length && !String(ed.body || '').trim()) return;
    map[d] = richer(map[d], ed);
  }
  put(store.published);
  (store.history || []).forEach(put);
  return map;
}

function renderPage(ed, date) {
  const title = plain(ed.title) || 'Daily editorial';
  const dek = plain(ed.dek) || '';
  const author = plain(ed.authorName || 'Dr. Wallace Lynch');
  const authorTitle = plain(ed.authorTitle || 'Editor in Chief');
  const paras = paragraphs(ed);
  const wc = ed.wordCount || wordCount(ed);
  const hero = plain(ed.heroImage || '');
  const heroCredit = plain(ed.heroCredit || ed.heroSource || '');
  const url = SITE + '/e/' + date + '.html';
  const ogImage = hero || SITE + '/img/logo-mark.png';
  const desc = dek || paras[0] || 'Chronicle of Convergence daily editorial';
  const prose = paras.map((p) => '<p>' + esc(p) + '</p>').join('\n');
  const shareText = encodeURIComponent(title + ' — Chronicle of Convergence');
  const shareUrl = encodeURIComponent(url);
  const tw =
    'https://twitter.com/intent/tweet?text=' + shareText + '&url=' + shareUrl;
  const li =
    'https://www.linkedin.com/sharing/share-offsite/?url=' + shareUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<title>${esc(title)} — Chronicle of Convergence</title>
<meta name="description" content="${esc(desc).slice(0, 300)}">
<meta name="author" content="${esc(author)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="../img/logo-mark.png" type="image/png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Chronicle of Convergence">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc).slice(0, 300)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="article:published_time" content="${esc(ed.publishedAt || date)}">
<meta property="article:author" content="${esc(author)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc).slice(0, 200)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: title,
  description: desc.slice(0, 300),
  datePublished: ed.publishedAt || date,
  dateModified: ed.updatedAt || ed.publishedAt || date,
  author: { '@type': 'Person', name: author, jobTitle: authorTitle },
  publisher: {
    '@type': 'NewsMediaOrganization',
    name: 'Chronicle of Convergence',
    url: SITE + '/',
    logo: SITE + '/img/logo-mark.png'
  },
  mainEntityOfPage: url,
  image: ogImage
})}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3efe6;--paper:#faf7f1;--ink:#1a1714;--muted:#6a635a;--line:#d9d1c3;--gold:#8f7340;--gold-deep:#6e582e;--serif:'Libre Baskerville',Georgia,serif;--sans:'Source Sans 3',system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55}
.wrap{max-width:720px;margin:0 auto;padding:1.25rem 1.1rem 3rem}
header{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--line)}
header img{width:44px;height:44px;border-radius:6px}
header a{color:var(--gold-deep);text-decoration:none;font-weight:600;font-size:.85rem}
.kicker{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin:0 0 .5rem}
h1{font-family:var(--serif);font-size:1.65rem;line-height:1.3;font-weight:600;margin:0 0 .5rem}
.dek{font-family:var(--serif);font-style:italic;color:var(--muted);margin:0 0 1rem;font-size:1.05rem}
.byline{font-size:.85rem;color:var(--muted);margin:0 0 .35rem}
.meta{font-size:.75rem;color:var(--muted);margin:0 0 1.25rem}
.hero{width:100%;max-height:380px;object-fit:cover;border-radius:8px;margin:0 0 .4rem;background:#ddd}
.credit{font-size:.7rem;color:var(--muted);margin:0 0 1.25rem}
.prose{font-family:var(--serif);font-size:1.05rem;line-height:1.75}
.prose p{margin:0 0 1.05em}
.share{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.75rem 0;padding:1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.share a,.share button{appearance:none;border:1px solid var(--line);background:var(--paper);color:var(--gold-deep);font:600 .75rem var(--sans);letter-spacing:.04em;text-transform:uppercase;padding:.55rem .85rem;border-radius:4px;cursor:pointer;text-decoration:none}
.share a:hover,.share button:hover{border-color:var(--gold)}
.nav{margin-top:1.5rem;font-size:.9rem}
.nav a{color:var(--gold-deep)}
</style>
<script src="../scripts/analytics.js" defer></script>
</head>
<body>
<div class="wrap">
  <header>
    <a href="../index.html"><img src="../img/logo-mark.png" alt="CoC" width="44" height="44"></a>
    <div>
      <a href="../index.html">Chronicle of Convergence</a>
      <div style="font-size:.75rem;color:var(--muted)">Daily editorial</div>
    </div>
  </header>
  <p class="kicker">Daily editorial · ${esc(date)}</p>
  <article>
    ${hero ? `<img class="hero" src="${esc(hero)}" alt="" width="1040" height="585" referrerpolicy="no-referrer">` : ''}
    ${heroCredit ? `<p class="credit">Photo: ${esc(heroCredit)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${dek ? `<p class="dek">${esc(dek)}</p>` : ''}
    <p class="byline">By ${esc(author)}${authorTitle ? ' · ' + esc(authorTitle) : ''}</p>
    <p class="meta">About ${wc} words · <a href="../go.html" style="color:var(--gold-deep)">CoC links</a></p>
    <div class="prose">
${prose}
    </div>
  </article>
  <div class="share" aria-label="Share">
    <a href="${esc(tw)}" target="_blank" rel="noopener">Share on X</a>
    <a href="${esc(li)}" target="_blank" rel="noopener">Share on LinkedIn</a>
    <button type="button" id="copyBtn">Copy link</button>
    <button type="button" id="nativeShare" hidden>Share…</button>
  </div>
  <p class="nav"><a href="../index.html#editorial">← Today’s desk</a> · <a href="../index.html">Field signals</a> · <a href="../go.html">Link hub</a></p>
</div>
<script>
(function(){
  var url=${JSON.stringify(url)};
  var btn=document.getElementById('copyBtn');
  if(btn) btn.onclick=function(){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){btn.textContent='Copied'; setTimeout(function(){btn.textContent='Copy link'},1500)});
    } else {
      prompt('Copy link', url);
    }
  };
  var ns=document.getElementById('nativeShare');
  if(ns && navigator.share){
    ns.hidden=false;
    ns.onclick=function(){ navigator.share({title:document.title,url:url}).catch(function(){}); };
  }
})();
</script>
</body>
</html>
`;
}

function writeSitemap(dates) {
  const staticUrls = [
    { loc: SITE + '/', changefreq: 'hourly', priority: '1.0' },
    { loc: SITE + '/go.html', changefreq: 'weekly', priority: '0.9' },
    { loc: SITE + '/cafe.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/museum.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/church.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/terms.html', changefreq: 'monthly', priority: '0.3' },
    { loc: SITE + '/privacy.html', changefreq: 'monthly', priority: '0.3' },
    { loc: SITE + '/llms.txt', changefreq: 'monthly', priority: '0.3' }
  ];
  const edUrls = dates
    .slice()
    .sort()
    .reverse()
    .map((d) => ({
      loc: SITE + '/e/' + d + '.html',
      changefreq: 'monthly',
      priority: '0.8'
    }));
  const all = staticUrls.concat(edUrls);
  const body = all
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, xml);
}

function generateAll() {
  const store = loadJson(EDITORIAL_PATH, { published: null, history: [] });
  const map = collectEditorials(store);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dates = Object.keys(map).sort();
  let n = 0;
  for (const d of dates) {
    const html = renderPage(map[d], d);
    fs.writeFileSync(path.join(OUT_DIR, d + '.html'), html);
    n++;
  }
  // index redirect helper
  const latest = store.published && store.published.publishDate;
  if (latest && map[latest]) {
    fs.writeFileSync(
      path.join(OUT_DIR, 'index.html'),
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=${latest}.html">
<link rel="canonical" href="${SITE}/e/${latest}.html"><title>Editorials — CoC</title>
<script>location.replace(${JSON.stringify(latest + '.html')})</script></head>
<body><p><a href="${latest}.html">Latest editorial</a></p></body></html>`
    );
  }
  writeSitemap(dates);
  console.log('Generated', n, 'editorial page(s) in e/ + sitemap.xml');
  return { n, dates };
}

if (require.main === module) {
  generateAll();
}

module.exports = {
  generateAll,
  renderPage,
  collectEditorials,
  SITE
};
