'use strict';

const UA = 'Mozilla/5.0 (compatible; ChronicleOfConvergence/2.0; +https://chronicleofconvergence.com)';
const BAD_IMG_RE = /unsplash\.com|placeholder|photo-xxx|picsum|loremflickr|logo-rss|favicon/i;

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

function extractImage(block) {
  const patterns = [
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i,
    /<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i
  ];
  for (const p of patterns) {
    const m = block.match(p);
    if (m && !BAD_IMG_RE.test(m[1])) return m[1].replace(/&amp;/g, '&');
  }
  const desc = extractTag(block, 'description') || extractTag(block, 'content:encoded') || extractTag(block, 'summary');
  const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img && !BAD_IMG_RE.test(img[1])) return img[1].replace(/&amp;/g, '&');
  return '';
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFeedItems(xml) {
  const items = [];
  const blocks = [...(xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []), ...(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [])];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractLink(block);
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
      image: extractImage(block),
      categories: extractCategories(block)
    });
  }
  return items;
}

function parseOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && !BAD_IMG_RE.test(match[1])) return match[1].replace(/&amp;/g, '&').trim();
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

async function fetchArticleMeta(url, fetchFn) {
  try {
    const html = await fetchText(url, fetchFn, 12000);
    return {
      image: parseOgImage(html),
      description: parseOgDescription(html)
    };
  } catch (e) {
    return { image: '', description: '' };
  }
}

async function fetchFeed(feed, fetchFn) {
  const xml = await fetchText(feed.url, fetchFn, 15000);
  return parseFeedItems(xml);
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

async function pickForCategory(category, catConfig, config, fetchFn, usedUrls, options = {}) {
  const maxAgeMs = (config.maxAgeHours || 336) * 3600000;
  const cutoff = Date.now() - maxAgeMs;
  const candidates = [];

  // RSS / Atom feeds
  for (const feed of catConfig.feeds || []) {
    let items;
    try {
      items = await fetchFeed(feed, fetchFn);
    } catch (e) {
      continue;
    }
    for (const it of items) {
      if (shouldSkip(it, config)) continue;
      if (usedUrls.has(it.link)) continue;
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
      if (usedUrls.has(it.link)) continue;
      candidates.push({ ...it, category });
    }
  }

  const fresh = candidates
    .filter((it) => it.pubDate && it.pubDate.getTime() >= cutoff)
    .sort((a, b) => b.pubDate - a.pubDate);
  if (fresh.length) return fresh[0];

  // Fallback: any age, newest first
  const any = candidates
    .filter((it) => !usedUrls.has(it.link))
    .sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
  return any[0] || null;
}

async function enrichItem(item, fetchFn) {
  let image = item.image || '';
  let summary = summarize(item.description);

  if (!image || BAD_IMG_RE.test(image)) {
    const meta = await fetchArticleMeta(item.link, fetchFn);
    if (meta.image) image = meta.image;
    if (!summary && meta.description) summary = summarize(meta.description);
  }

  if (!summary) summary = summarize(item.title, 160);

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
  const usedUrls = new Set();
  const picks = [];

  for (const [category, catConfig] of Object.entries(config.categories)) {
    const pick = await pickForCategory(category, catConfig, config, fetchFn, usedUrls, options);
    if (pick) {
      usedUrls.add(pick.link);
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

  const enriched = await Promise.all(top.map((item) => enrichItem(item, fetchFn)));

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
  BAD_IMG_RE
};

if (typeof module !== 'undefined' && module.exports) module.exports = CocCrawler;
if (typeof window !== 'undefined') window.CocCrawler = CocCrawler;