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
  const shareBody = encodeURIComponent(title + ' — Chronicle of Convergence\n\n' + url);
  const sh = {
    x: 'https://twitter.com/intent/tweet?text=' + shareText + '&url=' + shareUrl,
    li: 'https://www.linkedin.com/sharing/share-offsite/?url=' + shareUrl,
    fb: 'https://www.facebook.com/sharer/sharer.php?u=' + shareUrl,
    th: 'https://www.threads.net/intent/post?text=' + shareText + '%20' + shareUrl,
    rd: 'https://www.reddit.com/submit?url=' + shareUrl + '&title=' + shareText,
    wa: 'https://api.whatsapp.com/send?text=' + shareBody,
    em: 'mailto:?subject=' + shareText + '&body=' + shareBody
  };
  const ic = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>',
    li: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    th: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.313-8.184-3.83C2.309 18.1 1.5 15.12 1.5 11.99 1.5 5.94 5.83 1.5 12 1.5c6.17 0 10.5 4.44 10.5 10.49 0 3.13-.81 6.11-2.495 8.18-1.85 2.517-4.603 3.806-8.184 3.83h-.635z"/></svg>',
    rd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.463.33.33 0 00-.463 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.204-.094z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    em: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<title>${esc(title)} — Chronicle of Convergence</title>
<meta name="description" content="${esc(desc).slice(0, 300)}">
<meta name="author" content="${esc(author)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="keywords" content="Chronicle of Convergence, daily editorial, culture, society, technology, faith, American life, field signals, AI, neuroscience, space, energy">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="../img/logo-mark.png" type="image/png">
<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}/llms.txt">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Chronicle of Convergence">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc).slice(0, 300)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="article:published_time" content="${esc(ed.publishedAt || date)}">
<meta property="article:modified_time" content="${esc(ed.updatedAt || ed.publishedAt || date)}">
<meta property="article:author" content="${esc(author)}">
<meta property="article:section" content="Editorial">
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
    logo: { '@type': 'ImageObject', url: SITE + '/img/logo-mark.png' }
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  image: [ogImage],
  isAccessibleForFree: true,
  inLanguage: 'en-US'
})}
</script>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Editorials', item: SITE + '/e/' },
    { '@type': 'ListItem', position: 3, name: title, item: url }
  ]
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
.card{background:var(--paper);border:1px solid var(--line);border-radius:10px;box-shadow:0 1px 2px rgba(26,23,20,.04),0 12px 36px rgba(26,23,20,.06);overflow:hidden;padding:0 0 1.25rem}
.kicker{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin:0 0 .85rem}
.pad{padding:0 1.35rem}
@media(min-width:640px){.pad{padding:0 2rem}}
h1{font-family:var(--serif);font-size:clamp(1.5rem,3.2vw,1.85rem);line-height:1.25;font-weight:700;margin:1.15rem 0 .5rem;letter-spacing:-.02em}
.dek{font-family:var(--serif);font-style:italic;color:var(--muted);margin:0 0 1rem;font-size:1.05rem;line-height:1.5}
.byline-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.35rem 1rem;margin:0 0 1.2rem;padding-bottom:1rem;border-bottom:1px solid var(--line)}
.byline{font-family:var(--serif);font-style:italic;font-size:.95rem;color:var(--ink);margin:0}
.meta{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0}
.hero{width:100%;max-height:380px;object-fit:cover;display:block;background:#ddd}
.credit{font-size:.7rem;color:var(--muted);margin:0;padding:.5rem 1.35rem;background:linear-gradient(180deg,#ebe6db,#f0ebe1);border-bottom:1px solid var(--line)}
.prose{font-family:var(--serif);font-size:1.06rem;line-height:1.82;color:#2a2520}
.prose p{margin:0 0 1.15em}
.prose p:first-of-type::first-letter{font-size:2.75rem;float:left;line-height:.88;padding:.06rem .3rem 0 0;font-weight:700;color:var(--gold-deep)}
.share-wrap{margin:1.75rem 0 0;padding-top:1.15rem;border-top:1px solid var(--line)}
.share-label{display:block;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 .7rem}
.share{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.share a,.share button{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:2.45rem;height:2.45rem;padding:0;border-radius:999px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-decoration:none;transition:background .15s,border-color .15s,color .15s,transform .12s}
.share a:hover,.share button:hover{border-color:var(--gold-deep);color:var(--gold-deep);background:var(--paper);transform:translateY(-1px)}
.share svg{width:1.05rem;height:1.05rem;fill:currentColor;display:block}
.share button.is-copied{border-color:var(--gold-deep);color:var(--gold-deep)}
.nav{margin-top:1.35rem;font-size:.9rem;display:flex;flex-wrap:wrap;gap:.75rem 1.1rem}
.nav a{color:var(--gold-deep);text-decoration:none;font-weight:500}
.nav a:hover{text-decoration:underline;text-underline-offset:2px}
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
  <article class="card">
    ${hero ? `<img class="hero" src="${esc(hero)}" alt="" width="1040" height="585" referrerpolicy="no-referrer">` : ''}
    ${heroCredit ? `<p class="credit">Photo: ${esc(heroCredit)}</p>` : ''}
    <div class="pad">
      <h1>${esc(title)}</h1>
      ${dek ? `<p class="dek">${esc(dek)}</p>` : ''}
      <div class="byline-row">
        <p class="byline">By ${esc(author)}${authorTitle ? ' · ' + esc(authorTitle) : ''}</p>
        <p class="meta">About ${wc} words</p>
      </div>
      <div class="prose">
${prose}
      </div>
      <div class="share-wrap">
        <span class="share-label">Share</span>
        <div class="share" role="group" aria-label="Share this editorial">
          <a href="${esc(sh.x)}" target="_blank" rel="noopener noreferrer" aria-label="Share on X" title="X">${ic.x}</a>
          <a href="${esc(sh.li)}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" title="LinkedIn">${ic.li}</a>
          <a href="${esc(sh.fb)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" title="Facebook">${ic.fb}</a>
          <a href="${esc(sh.th)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Threads" title="Threads">${ic.th}</a>
          <a href="${esc(sh.rd)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Reddit" title="Reddit">${ic.rd}</a>
          <a href="${esc(sh.wa)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="WhatsApp">${ic.wa}</a>
          <a href="${esc(sh.em)}" aria-label="Share by email" title="Email">${ic.em}</a>
          <button type="button" id="copyBtn" aria-label="Copy link" title="Copy link">${ic.copy}</button>
          <button type="button" id="nativeShare" hidden aria-label="System share">Share</button>
        </div>
      </div>
    </div>
  </article>
  <p class="nav"><a href="../index.html#editorial">← Today’s desk</a><a href="../index.html">Field signals</a><a href="../go.html">Link hub</a><a href="./">All editorials</a></p>
</div>
<script>
(function(){
  var url=${JSON.stringify(url)};
  var title=${JSON.stringify(title)};
  var btn=document.getElementById('copyBtn');
  if(btn) btn.onclick=function(){
    function done(){
      btn.classList.add('is-copied');
      btn.setAttribute('title','Copied');
      btn.setAttribute('aria-label','Link copied');
      setTimeout(function(){
        btn.classList.remove('is-copied');
        btn.setAttribute('title','Copy link');
        btn.setAttribute('aria-label','Copy link');
      },1600);
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(done).catch(function(){prompt('Copy link', url);});
    } else {
      prompt('Copy link', url);
    }
  };
  var ns=document.getElementById('nativeShare');
  if(ns && navigator.share){
    ns.hidden=false;
    ns.onclick=function(){ navigator.share({title:title,text:title+' — Chronicle of Convergence',url:url}).catch(function(){}); };
  }
})();
</script>
</body>
</html>
`;
}

function writeIfChanged(filePath, text) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === text) return false;
  fs.writeFileSync(filePath, text);
  return true;
}

function writeSitemap(dates) {
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = [
    { loc: SITE + '/', changefreq: 'hourly', priority: '1.0', lastmod: today },
    { loc: SITE + '/e/', changefreq: 'daily', priority: '0.85', lastmod: today },
    { loc: SITE + '/go.html', changefreq: 'weekly', priority: '0.9', lastmod: today },
    { loc: SITE + '/cafe.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/museum.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/church.html', changefreq: 'monthly', priority: '0.5' },
    { loc: SITE + '/terms.html', changefreq: 'monthly', priority: '0.3' },
    { loc: SITE + '/privacy.html', changefreq: 'monthly', priority: '0.3' },
    { loc: SITE + '/llms.txt', changefreq: 'weekly', priority: '0.55', lastmod: today },
    { loc: SITE + '/robots.txt', changefreq: 'monthly', priority: '0.2' },
    { loc: SITE + '/data/archive.json', changefreq: 'hourly', priority: '0.4', lastmod: today }
  ];
  const edUrls = dates
    .slice()
    .sort()
    .reverse()
    .map((d) => ({
      loc: SITE + '/e/' + d + '.html',
      changefreq: 'monthly',
      priority: d === dates[dates.length - 1] ? '0.9' : '0.8',
      lastmod: d
    }));
  const all = staticUrls.concat(edUrls);
  const body = all
    .map((u) => {
      let block = `  <url>\n    <loc>${u.loc}</loc>`;
      if (u.lastmod) block += `\n    <lastmod>${u.lastmod}</lastmod>`;
      block += `\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
      return block;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  writeIfChanged(SITEMAP_PATH, xml);
}

function generateAll() {
  const store = loadJson(EDITORIAL_PATH, { published: null, history: [] });
  const map = collectEditorials(store);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dates = Object.keys(map).sort();
  let n = 0;
  for (const d of dates) {
    const html = renderPage(map[d], d);
    if (writeIfChanged(path.join(OUT_DIR, d + '.html'), html)) n++;
  }
  // index redirect helper
  const latest = store.published && store.published.publishDate;
  if (latest && map[latest]) {
    writeIfChanged(
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
