'use strict';
/**
 * Editorial draft helpers — OUTLINE ONLY (no creative prose).
 * Compiles article titles + key points from the day’s selected stories
 * so admin can write the final editorial by hand.
 * Used by editor.html and editorial-lib.js (Node).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.CocEditorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** PD heroes only — decorative placeholder until admin sets hero. */
  const HEROES = [
    {
      url: 'https://images-assets.nasa.gov/image/PIA18033/PIA18033~medium.jpg',
      credit: 'Earth as seen by Cassini',
      source: 'NASA / JPL-Caltech / Space Science Institute (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA18033'
    },
    {
      url: 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg',
      credit: 'Spiral galaxy M81',
      source: 'NASA / JPL-Caltech / ESA (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA04921'
    },
    {
      url: 'https://images-assets.nasa.gov/image/PIA15416/PIA15416~medium.jpg',
      credit: 'Galaxy cluster',
      source: 'NASA / JPL-Caltech (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA15416'
    },
    {
      url: 'https://images-assets.nasa.gov/image/PIA16884/PIA16884~medium.jpg',
      credit: 'Earth and Moon from spacecraft',
      source: 'NASA (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA16884'
    },
    {
      url: 'https://images-assets.nasa.gov/image/as11-40-5874/as11-40-5874~medium.jpg',
      credit: 'Buzz Aldrin on the Moon',
      source: 'NASA (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5874'
    },
    {
      url: 'https://images-assets.nasa.gov/image/PIA00122/PIA00122~medium.jpg',
      credit: 'Venus — Magellan radar',
      source: 'NASA / JPL (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA00122'
    },
    {
      url: 'https://images-assets.nasa.gov/image/PIA01492/PIA01492~medium.jpg',
      credit: 'Jupiter with Io',
      source: 'NASA / JPL / University of Arizona (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/PIA01492'
    },
    {
      url: 'https://images-assets.nasa.gov/image/sts061-98-050/sts061-98-050~medium.jpg',
      credit: 'Earth from orbit during STS-61',
      source: 'NASA (public domain)',
      sourceUrl: 'https://images.nasa.gov/details/sts061-98-050'
    }
  ];

  const CAT_LABEL = {
    ai: 'AI',
    art: 'Art',
    robotics: 'Robotics',
    biotech: 'Biotech',
    space: 'Space',
    energy: 'Energy',
    neuroscience: 'Neuroscience'
  };

  function nyParts(date) {
    date = date || new Date();
    const num = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    });
    const parts = Object.fromEntries(num.formatToParts(date).map((p) => [p.type, p.value]));
    const hour = parseInt(parts.hour, 10) % 24;
    const dateStr = parts.year + '-' + parts.month + '-' + parts.day;
    const display = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
    return { dateStr, hour, display, year: parts.year, month: parts.month, day: parts.day };
  }

  function addDaysNy(dateStr, days) {
    const bits = dateStr.split('-').map(Number);
    const utc = Date.UTC(bits[0], bits[1] - 1, bits[2] + days, 16, 0, 0);
    return nyParts(new Date(utc)).dateStr;
  }

  function hashPick(str, n) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h + String(str).charCodeAt(i) * (i + 3)) % 10007;
    return n > 0 ? h % n : 0;
  }

  function wordCount(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function plain(str) {
    return String(str || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function storeBlobs(store) {
    if (!store) return [];
    return [store.published, ...(store.history || []), ...Object.values(store.drafts || {})].filter(Boolean);
  }

  function usedHeroUrls(store) {
    const used = new Set((store && store.usedHeroImages) || []);
    for (const ed of storeBlobs(store)) {
      if (ed && ed.heroImage) used.add(ed.heroImage);
    }
    return used;
  }

  function pickHero(dateStr, store) {
    const used = store ? usedHeroUrls(store) : new Set();
    const free = HEROES.filter((h) => !used.has(h.url));
    const pool = free.length ? free : HEROES;
    return pool[hashPick(dateStr + 'h', pool.length)];
  }

  /**
   * Prefer a head image from selected day articles (first unused URL).
   * Falls back to NASA PD pool only when no article images exist.
   */
  function pickHeroFromHeadlines(headlines, store, dateStr) {
    const used = store ? usedHeroUrls(store) : new Set();
    const withImg = (headlines || [])
      .map((h) => ({
        url: String((h && (h.image || h.heroImage)) || '').trim(),
        title: plain(h && h.title),
        source: plain(h && h.source),
        sourceUrl: (h && (h.sourceUrl || h.link)) || ''
      }))
      .filter((h) => h.url);
    if (withImg.length) {
      const free = withImg.filter((h) => !used.has(h.url));
      const pick = (free.length ? free : withImg)[0];
      return {
        url: pick.url,
        credit: pick.title || pick.source || 'Field signal',
        source: pick.source || 'Selected article',
        sourceUrl: pick.sourceUrl || pick.url
      };
    }
    return pickHero(dateStr, store);
  }

  /**
   * Unique article head images for admin hero picker (thumbnails).
   */
  function heroCandidatesFromHeadlines(headlines) {
    const out = [];
    const seen = new Set();
    for (const h of headlines || []) {
      const url = String((h && (h.image || h.heroImage)) || '').trim();
      if (!url) continue;
      const key = url.split('?')[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        image: url,
        title: plain(h.title),
        source: plain(h.source),
        category: h.category || '',
        sourceUrl: h.sourceUrl || h.link || ''
      });
    }
    return out;
  }

  /**
   * Prefer the most recent scan calendar day (field-signal day), then older days.
   * Within each day: one story per category when possible, then fill.
   * Avoids sticky first-seen category winners from weeks-old archive history.
   */
  function headlinesFromArchive(archive, n) {
    n = n || 12;
    const list = Array.isArray(archive) ? archive.slice() : [];
    list.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));

    function dayKey(s) {
      return String(s || '').slice(0, 10);
    }

    // Collect unique items per calendar day (newest days first)
    const dayOrder = [];
    const byDay = {};
    const globalSeen = new Set();
    for (const b of list) {
      const day = dayKey(b.scannedAt) || 'unknown';
      if (!byDay[day]) {
        byDay[day] = [];
        dayOrder.push(day);
      }
      for (const it of b.items || []) {
        const title = plain(it.title);
        const key = title.toLowerCase();
        if (!title || globalSeen.has(key)) continue;
        globalSeen.add(key);
        byDay[day].push({
          title,
          source: plain(it.source),
          category: it.category || 'ai',
          sourceUrl: it.sourceUrl || it.link || '',
          summary: plain(it.summary || it.description || ''),
          image: String(it.image || '').trim()
        });
      }
    }

    const picks = [];
    const pickedKeys = new Set();
    function takeFromDay(rows) {
      if (!rows || !rows.length) return;
      const byCat = {};
      const rest = [];
      for (const row of rows) {
        const key = row.title.toLowerCase();
        if (pickedKeys.has(key)) continue;
        const cat = row.category || 'ai';
        if (!byCat[cat]) byCat[cat] = row;
        else rest.push(row);
      }
      const catPicks = Object.keys(byCat)
        .sort()
        .map((c) => byCat[c]);
      for (const row of catPicks.concat(rest)) {
        if (picks.length >= n) return;
        const key = row.title.toLowerCase();
        if (pickedKeys.has(key)) continue;
        pickedKeys.add(key);
        picks.push(row);
      }
    }

    for (const day of dayOrder) {
      if (picks.length >= n) break;
      takeFromDay(byDay[day]);
    }
    return picks.slice(0, n);
  }

  function headlinesFromBatches(batches, n) {
    return headlinesFromArchive(batches, n);
  }

  const SKIP_POINT_RE =
    /sign up|newsletter|subscribe|this story originally appeared|read more|click here|follow us|advertisement|cookie|privacy policy|all rights reserved/i;

  /**
   * Extract factual key points from a summary (sentence split only — no creative rewrite).
   */
  function keyPointsFromSummary(summary, maxPoints) {
    maxPoints = maxPoints || 4;
    const text = plain(summary);
    if (!text) return [];
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && !SKIP_POINT_RE.test(s));
    if (sentences.length) return sentences.slice(0, maxPoints);
    // Fallback: chunk long single blob (still skip pure CTA)
    if (SKIP_POINT_RE.test(text) && text.length < 120) return [];
    if (text.length <= 160) return SKIP_POINT_RE.test(text) ? [] : [text];
    const chunks = [];
    let rest = text;
    while (rest.length && chunks.length < maxPoints) {
      let cut = rest.slice(0, 140);
      const sp = cut.lastIndexOf(' ');
      if (sp > 60) cut = cut.slice(0, sp);
      const piece = cut.trim() + (rest.length > cut.length ? '…' : '');
      if (!SKIP_POINT_RE.test(piece)) chunks.push(piece);
      rest = rest.slice(cut.length).trim();
    }
    return chunks;
  }

  function catLabel(c) {
    return CAT_LABEL[c] || (c ? String(c) : 'General');
  }

  /**
   * Build outline-only brief from selected articles. No editorial prose.
   */
  function buildOutline(publishDate, headlines) {
    const items = (headlines || [])
      .map((h) => ({
        title: plain(h.title),
        source: plain(h.source),
        category: h.category || '',
        sourceUrl: h.sourceUrl || h.link || '',
        summary: plain(h.summary || h.description || ''),
        image: String(h.image || h.heroImage || '').trim(),
        keyPoints: keyPointsFromSummary(h.summary || h.description || '', 4)
      }))
      .filter((h) => h.title);

    const lines = [];
    lines.push('EDITORIAL BRIEF (outline only — not for publication as-is)');
    lines.push('Publish date: ' + publishDate);
    lines.push('Instruction: Use the titles and key points below to write the final ~300-word CoC editorial. Replace this entire brief with your finished prose before publishing.');
    lines.push('');
    lines.push('— Selected articles of the day (' + items.length + ') —');
    lines.push('');

    if (!items.length) {
      lines.push('(No articles available. Run Crawl first, then re-run Editorial Draft.)');
    }

    items.forEach((it, i) => {
      const n = i + 1;
      lines.push(n + '. [' + catLabel(it.category) + '] ' + it.title);
      if (it.source) lines.push('   Source: ' + it.source);
      if (it.sourceUrl) lines.push('   URL: ' + it.sourceUrl);
      lines.push('   Key points:');
      if (it.keyPoints.length) {
        it.keyPoints.forEach((kp) => lines.push('   • ' + kp));
      } else {
        lines.push('   • (No summary on file — open URL and note 2–3 facts before writing.)');
      }
      lines.push('');
    });

    const cats = [];
    items.forEach((it) => {
      const lb = catLabel(it.category);
      if (cats.indexOf(lb) === -1) cats.push(lb);
    });
    if (cats.length) {
      lines.push('— Categories present —');
      lines.push(cats.join(' · '));
      lines.push('');
    }

    lines.push('— Admin checklist —');
    lines.push('• Draft original title + dek');
    lines.push('• Write body (~280–320 words) in CoC voice');
    lines.push('• Select hero from selected-article head image thumbnails (or paste URL)');
    lines.push('• Mark published when ready');

    const body = lines.join('\n');
    const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

    return {
      title: 'Editorial brief — ' + publishDate,
      dek: 'Outline of selected article titles and key points for admin to write the final editorial.',
      body,
      paragraphs,
      wordCount: wordCount(body),
      outlineItems: items,
      statusHint: 'outline'
    };
  }

  /** @deprecated name kept for callers; returns outline only. */
  function buildEssay(publishDate, _theme, headlines) {
    return buildOutline(publishDate, headlines);
  }

  /**
   * Create outline draft for publishDate (mutates store).
   */
  function createDraftForDate(store, publishDate, headlines, opts) {
    opts = opts || {};
    const force = !!opts.force;
    if (!store.drafts) store.drafts = {};
    if (!store.history) store.history = [];
    if (store.drafts[publishDate] && !force && store.drafts[publishDate].status === 'draft') {
      return { draft: store.drafts[publishDate], created: false, store };
    }

    const outline = buildOutline(publishDate, headlines || []);
    const hero = pickHeroFromHeadlines(headlines || outline.outlineItems || [], store, publishDate);
    const now = new Date().toISOString();
    const draft = {
      id: 'ed_' + publishDate,
      publishDate,
      status: 'draft',
      draftKind: 'outline',
      createdAt: (store.drafts[publishDate] && store.drafts[publishDate].createdAt) || now,
      updatedAt: now,
      title: outline.title,
      dek: outline.dek,
      body: outline.body,
      paragraphs: outline.paragraphs,
      wordCount: outline.wordCount,
      themeId: 'outline',
      themeLabel: 'Admin outline (titles + key points)',
      formId: 'outline_brief',
      formLabel: 'outline brief',
      authorName: store.defaultAuthorName || 'Dr. Wallace Lynch',
      authorTitle: store.defaultAuthorTitle || 'Editor in Chief',
      heroImage: hero.url,
      heroCredit: hero.credit,
      heroSource: hero.source,
      heroSourceUrl: hero.sourceUrl,
      headlines: (outline.outlineItems || []).map((h) => ({
        title: h.title,
        source: h.source,
        category: h.category,
        sourceUrl: h.sourceUrl,
        summary: h.summary,
        image: h.image || '',
        keyPoints: h.keyPoints
      }))
    };
    store.drafts[publishDate] = draft;
    const used = usedHeroUrls(store);
    used.add(hero.url);
    store.usedHeroImages = Array.from(used);
    return { draft, created: true, store };
  }

  function nextPublishDate(date) {
    const ny = nyParts(date || new Date());
    return addDaysNy(ny.dateStr, 1);
  }

  return {
    HEROES,
    THEMES: [],
    FORMS: [],
    nyParts,
    addDaysNy,
    nextPublishDate,
    pickHero,
    pickHeroFromHeadlines,
    heroCandidatesFromHeadlines,
    pickTheme: function () {
      return { id: 'outline', label: 'Admin outline (titles + key points)' };
    },
    pickForm: function () {
      return { id: 'outline_brief', titleHints: [], dekHints: [] };
    },
    buildEssay,
    buildOutline,
    keyPointsFromSummary,
    wordCount,
    headlinesFromArchive,
    headlinesFromBatches,
    createDraftForDate
  };
});
