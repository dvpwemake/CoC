'use strict';

const UA = 'Mozilla/5.0 (compatible; ChronicleOfConvergence/2.0; +https://chronicleofconvergence.com)';
const BAD_IMG_RE = /unsplash\.com|placeholder|photo-xxx|picsum|loremflickr|logo-rss|favicon/i;

/** Normalize host for blacklist match (strip www., lowercase). */
function normalizeHost(host) {
  return String(host || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .trim();
}

function hostFromUrl(url) {
  try {
    return normalizeHost(new URL(String(url || ''), 'https://example.com').hostname);
  } catch (e) {
    return '';
  }
}

/**
 * Domain blacklist: sources that ban bots, break images, or poison the card grid.
 * Config keys: domainBlacklist, imageDomainBlacklist (arrays of hosts).
 */
function blacklistHosts(config, kind) {
  const primary = config && Array.isArray(config.domainBlacklist) ? config.domainBlacklist : [];
  const images =
    config && Array.isArray(config.imageDomainBlacklist) ? config.imageDomainBlacklist : primary;
  const list = kind === 'image' ? images : primary;
  return list.map(normalizeHost).filter(Boolean);
}

function isHostBlacklisted(urlOrHost, config, kind) {
  const host = urlOrHost && String(urlOrHost).includes('/')
    ? hostFromUrl(urlOrHost)
    : normalizeHost(urlOrHost);
  if (!host) return false;
  const list = blacklistHosts(config, kind || 'domain');
  return list.some((b) => host === b || host.endsWith('.' + b));
}

function isImageUrlAllowed(url, config) {
  if (!url) return false;
  if (BAD_IMG_RE.test(url)) return false;
  if (config && isHostBlacklisted(url, config, 'image')) return false;
  return true;
}

/** Stable title key for cross-day / within-crawl dedupe. */
function normalizeTitleKey(title) {
  return stripHtml(title)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable URL key (host + path, no query/hash, strip trailing slash + www). */
function normalizeUrlKey(url) {
  try {
    const u = new URL(String(url || ''), 'https://example.com');
    if (!u.hostname || u.hostname === 'example.com') {
      return String(url || '')
        .split(/[?#]/)[0]
        .toLowerCase()
        .replace(/\/+$/, '');
    }
    const host = normalizeHost(u.hostname);
    const path = (u.pathname || '/').replace(/\/+$/, '') || '';
    return (host + path).toLowerCase();
  } catch (e) {
    return String(url || '')
      .split(/[?#]/)[0]
      .toLowerCase()
      .replace(/\/+$/, '');
  }
}

/**
 * Titles + URLs already used in recent archive batches (last N calendar days by scannedAt).
 * Default window: 14 days (override via config.excludeRecentDays or options.excludeRecentDays).
 */
function collectRecentArchiveKeys(batches, days) {
  const windowDays = days == null || days < 0 ? 14 : days;
  const cutoff = Date.now() - windowDays * 86400000;
  const urls = new Set();
  const titles = new Set();
  if (!Array.isArray(batches)) return { urls, titles, count: 0 };
  let count = 0;
  for (const b of batches) {
    const scanned = Date.parse(b && b.scannedAt ? b.scannedAt : 0);
    // Keep items with missing scannedAt (treat as recent enough to exclude)
    if (scanned && !Number.isNaN(scanned) && scanned < cutoff) continue;
    for (const it of (b && b.items) || []) {
      const uk = normalizeUrlKey(it.sourceUrl || it.link || '');
      const tk = normalizeTitleKey(it.title || '');
      if (uk) urls.add(uk);
      if (tk) titles.add(tk);
      if (uk || tk) count += 1;
    }
  }
  return { urls, titles, count };
}

function isAlreadySelected(used, title, link) {
  if (!used) return false;
  const uk = normalizeUrlKey(link);
  const tk = normalizeTitleKey(title);
  if (uk && used.urls && used.urls.has(uk)) return true;
  if (tk && used.titles && used.titles.has(tk)) return true;
  // Legacy: plain Set of raw URLs
  if (used instanceof Set) {
    if (link && used.has(link)) return true;
    if (uk && used.has(uk)) return true;
  }
  return false;
}

function markSelected(used, title, link) {
  if (!used) return;
  if (used instanceof Set) {
    if (link) used.add(link);
    const uk = normalizeUrlKey(link);
    if (uk) used.add(uk);
    return;
  }
  if (!used.urls) used.urls = new Set();
  if (!used.titles) used.titles = new Set();
  const uk = normalizeUrlKey(link);
  const tk = normalizeTitleKey(title);
  if (uk) used.urls.add(uk);
  if (tk) used.titles.add(tk);
  if (link) used.urls.add(String(link).trim());
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c && c < 0x110000 ? String.fromCodePoint(c) : '';
    });
}

/**
 * Plain-text sanitizer for titles/summaries.
 * Decode entities FIRST, then strip tags (incl. AI <cite index="…">…</cite>),
 * then drop residual bracket artifacts. Safe for RSS HTML and pasted AI copy.
 */
function stripHtml(str) {
  let s = decodeEntities(String(str || ''));
  // Strip tags (raw). Repeat once in case of nested / leftover after partial decode.
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/<[^>]*>/g, ' ');
    if (next === s) break;
    s = next;
  }
  // AI / research citation leftovers that may appear as bare text
  s = s
    .replace(/\[(?:web|post|collection|connector):\d+\]/gi, ' ')
    .replace(/render_inline_citation\b/gi, ' ')
    .replace(/\bcite\s+index\s*=\s*["'][^"']*["']/gi, ' ');
  // Any remaining angle-bracket runs that look like markup
  s = s.replace(/<\/?[a-zA-Z][^<>]{0,200}>/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractLink(block) {
  let link = extractTag(block, 'link');
  if (link) return link.trim();
  const m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1].trim() : '';
}

function extractCategories(block) {
  const cats = [];
  const re = /<category[^>]*>([\s\S]*?)<\/category>/gi;
  let m;
  while ((m = re.exec(block))) cats.push(stripHtml(m[1]).toLowerCase());
  return cats;
}

function extractImage(block, config) {
  const patterns = [
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i,
    /<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i
  ];
  for (const p of patterns) {
    const m = block.match(p);
    if (m) {
      const u = m[1].replace(/&amp;/g, '&');
      if (isImageUrlAllowed(u, config)) return u;
    }
  }
  const desc = extractTag(block, 'description') || extractTag(block, 'content:encoded') || extractTag(block, 'summary');
  const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) {
    const u = img[1].replace(/&amp;/g, '&');
    if (isImageUrlAllowed(u, config)) return u;
  }
  return '';
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFeedItems(xml, config) {
  const items = [];
  const blocks = [...(xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []), ...(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [])];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractLink(block);
    if (config && isHostBlacklisted(link, config, 'domain')) continue;
    const pubDate = parseDate(
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'dc:date')
    );
    const description = stripHtml(
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content:encoded')
    );
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate,
      description,
      image: extractImage(block, config),
      categories: extractCategories(block)
    });
  }
  return items;
}

function parseOgImage(html, config) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const u = match[1].replace(/&amp;/g, '&').trim();
      if (isImageUrlAllowed(u, config)) return u;
    }
  }
  return '';
}

function parseOgDescription(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return '';
}

function shouldSkip(item, config) {
  const title = item.title.toLowerCase();
  const patterns = (config.skipTitlePatterns || []).map((p) => p.toLowerCase());
  if (patterns.some((p) => title.includes(p))) return true;
  if (item.categories.some((c) => patterns.some((p) => c.includes(p)))) return true;
  return false;
}

function summarize(text, max = 220) {
  const clean = stripHtml(text);
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const last = cut.lastIndexOf(' ');
  return (last > max * 0.6 ? cut.slice(0, last) : cut).trim() + '…';
}

async function fetchText(url, fetchFn, timeoutMs = 15000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, {
      signal: controller?.signal,
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, text/html, */*' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchArticleMeta(url, fetchFn, config) {
  if (config && isHostBlacklisted(url, config, 'domain')) {
    return { image: '', description: '' };
  }
  try {
    const html = await fetchText(url, fetchFn, 12000);
    return {
      image: parseOgImage(html, config),
      description: parseOgDescription(html)
    };
  } catch (e) {
    return { image: '', description: '' };
  }
}

async function fetchFeed(feed, fetchFn, config) {
  if (config && isHostBlacklisted(feed.url, config, 'domain')) {
    return [];
  }
  const xml = await fetchText(feed.url, fetchFn, 15000);
  return parseFeedItems(xml, config);
}

/**
 * Normalize X MCP / x-signals cache items into crawler feed-item shape.
 * Expected cache: { items: [{ category, title, summary, source, sourceUrl, image, pubDate }] }
 * or a flat array of the same.
 */
function normalizeXItems(xSignals, category) {
  if (!xSignals) return [];
  const raw = Array.isArray(xSignals) ? xSignals : xSignals.items || [];
  return raw
    .filter((it) => it && (!category || it.category === category))
    .map((it) => {
      const link = it.sourceUrl || it.link || it.url || '';
      const title = stripHtml(it.title || '').slice(0, 150);
      if (!title || !link) return null;
      let pubDate = null;
      if (it.pubDate) {
        const d = it.pubDate instanceof Date ? it.pubDate : new Date(it.pubDate);
        if (!Number.isNaN(d.getTime())) pubDate = d;
      }
      const sourceName = it.source || (it.username ? 'X · @' + String(it.username).replace(/^@/, '') : 'X');
      return {
        title,
        link,
        pubDate,
        description: stripHtml(it.summary || it.description || it.text || ''),
        image: it.image || '',
        categories: [category || it.category || ''].filter(Boolean),
        source: sourceName,
        fromX: true
      };
    })
    .filter(Boolean);
}

async function pickForCategory(category, catConfig, config, fetchFn, used, options = {}) {
  const maxAgeMs = (config.maxAgeHours || 336) * 3600000;
  const cutoff = Date.now() - maxAgeMs;
  const candidates = [];

  // RSS / Atom feeds
  for (const feed of catConfig.feeds || []) {
    if (isHostBlacklisted(feed.url, config, 'domain')) continue;
    let items;
    try {
      items = await fetchFeed(feed, fetchFn, config);
    } catch (e) {
      continue;
    }
    for (const it of items) {
      if (shouldSkip(it, config)) continue;
      if (isHostBlacklisted(it.link, config, 'domain')) continue;
      if (isAlreadySelected(used, it.title, it.link)) continue;
      // Drop images from banned hosts even if the article host is allowed
      if (it.image && !isImageUrlAllowed(it.image, config)) it.image = '';
      candidates.push({ ...it, category, source: feed.name, fromX: false });
    }
  }

  // X MCP signals (per-category queries live in sources.json; cache in data/x-signals.json)
  const xCfg = catConfig.x || {};
  const xEnabled = xCfg.enabled !== false && (config.xMcp ? config.xMcp.enabled !== false : true);
  if (xEnabled) {
    let xItems = [];
    if (typeof options.xSearch === 'function') {
      try {
        const live = await options.xSearch({ category, x: xCfg, config });
        xItems = normalizeXItems(live, category);
      } catch (e) {
        /* optional live provider */
      }
    }
    if (!xItems.length && options.xSignals) {
      xItems = normalizeXItems(options.xSignals, category);
    }
    for (const it of xItems) {
      if (shouldSkip(it, config)) continue;
      if (isHostBlacklisted(it.link, config, 'domain')) continue;
      if (isAlreadySelected(used, it.title, it.link)) continue;
      if (it.image && !isImageUrlAllowed(it.image, config)) it.image = '';
      candidates.push({ ...it, category });
    }
  }

  // Next freshest not already selected (within crawl + recent archive)
  const open = candidates.filter((it) => !isAlreadySelected(used, it.title, it.link));
  const fresh = open
    .filter((it) => it.pubDate && it.pubDate.getTime() >= cutoff)
    .sort((a, b) => b.pubDate - a.pubDate);
  if (fresh.length) return fresh[0];

  // Fallback: any age, newest first
  const any = open.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
  return any[0] || null;
}

async function enrichItem(item, fetchFn, config) {
  let image = item.image || '';
  let summary = summarize(item.description);

  if (image && !isImageUrlAllowed(image, config)) image = '';

  if (!image || BAD_IMG_RE.test(image)) {
    const meta = await fetchArticleMeta(item.link, fetchFn, config);
    if (meta.image && isImageUrlAllowed(meta.image, config)) image = meta.image;
    if (!summary && meta.description) summary = summarize(meta.description);
  }

  if (!summary) summary = summarize(item.title, 160);
  if (image && !isImageUrlAllowed(image, config)) image = '';

  return {
    title: item.title.slice(0, 150),
    category: item.category,
    summary,
    image: image || '',
    source: item.source,
    sourceUrl: item.link,
    pubDate: item.pubDate,
    fromX: !!item.fromX
  };
}

async function crawl(config, options = {}) {
  const fetchFn = options.fetch || globalThis.fetch;
  const excludeDays =
    options.excludeRecentDays != null
      ? options.excludeRecentDays
      : config.excludeRecentDays != null
        ? config.excludeRecentDays
        : 14;

  // Seed with recent archive so the same title/URL is not re-picked for N days
  const archive = options.archive || options.batches || null;
  const recent = collectRecentArchiveKeys(archive, excludeDays);
  const used = {
    urls: new Set(recent.urls),
    titles: new Set(recent.titles)
  };
  if (typeof options.onExcludeInfo === 'function') {
    options.onExcludeInfo({
      excludeRecentDays: excludeDays,
      excludedTitles: recent.titles.size,
      excludedUrls: recent.urls.size,
      excludedItemRefs: recent.count
    });
  }

  const picks = [];

  for (const [category, catConfig] of Object.entries(config.categories || {})) {
    const pick = await pickForCategory(category, catConfig, config, fetchFn, used, options);
    if (pick) {
      markSelected(used, pick.title, pick.link);
      picks.push(pick);
    }
  }

  picks.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
  // Prefer diversity: keep up to pickCount, but try to retain one X hit if present among picks
  const pickCount = config.pickCount || 5;
  let top = picks.slice(0, pickCount);
  const hasX = top.some((p) => p.fromX);
  if (!hasX) {
    const xPick = picks.find((p) => p.fromX && !top.includes(p));
    if (xPick && top.length) {
      top = top.slice(0, Math.max(0, pickCount - 1)).concat([xPick]);
    } else if (xPick) {
      top = [xPick];
    }
  }

  const enriched = await Promise.all(top.map((item) => enrichItem(item, fetchFn, config)));

  return enriched.map((it, i) => ({
    rank: i + 1,
    title: it.title,
    category: it.category,
    summary: it.summary,
    image: it.image,
    source: it.source,
    sourceUrl: it.sourceUrl,
    fromX: !!it.fromX
  }));
}

const CocCrawler = {
  crawl,
  parseFeedItems,
  parseOgImage,
  stripHtml,
  normalizeXItems,
  normalizeTitleKey,
  normalizeUrlKey,
  collectRecentArchiveKeys,
  isAlreadySelected,
  markSelected,
  isHostBlacklisted,
  isImageUrlAllowed,
  hostFromUrl,
  BAD_IMG_RE
};

if (typeof module !== 'undefined' && module.exports) module.exports = CocCrawler;
if (typeof window !== 'undefined') window.CocCrawler = CocCrawler;