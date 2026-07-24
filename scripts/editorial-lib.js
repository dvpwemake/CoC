'use strict';

/**
 * CoC v2 daily editorial — Node I/O + schedule gates.
 * Drafts are OUTLINE ONLY (article titles + key points) for admin to write final prose.
 * Draft by 21:00 America/New_York for next calendar day.
 * Publish at 08:00 America/New_York.
 */

const fs = require('fs');
const path = require('path');
const CocEditorial = require('./editorial-client.js');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_PATH = path.join(ROOT, 'data', 'archive.json');
const EDITORIAL_PATH = path.join(ROOT, 'data', 'editorial.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const THEMES = CocEditorial.THEMES;
const HEROES = CocEditorial.HEROES;
const FORMS = CocEditorial.FORMS;

function nyParts(date) {
  return CocEditorial.nyParts(date);
}

function addDaysNy(dateStr, days) {
  return CocEditorial.addDaysNy(dateStr, days);
}

function loadJson(p, fallback) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(p, e.message);
  }
  return fallback;
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function wordCount(text) {
  return CocEditorial.wordCount(text);
}

function recentHeadlines(n = 6) {
  const archive = loadJson(ARCHIVE_PATH, []);
  return CocEditorial.headlinesFromArchive(archive, n);
}

function ensureStore() {
  const store = loadJson(EDITORIAL_PATH, { published: null, drafts: {}, history: [] });
  if (!store.drafts) store.drafts = {};
  if (!store.history) store.history = [];
  return store;
}

/**
 * Create outline draft for date (titles + key points from day’s articles).
 * Writes data/editorial.json. Admin replaces outline with final prose before publish.
 */
function createDraftForDate(publishDate, { force = false } = {}) {
  const store = ensureStore();
  if (store.drafts[publishDate] && !force && store.drafts[publishDate].status === 'draft') {
    console.log('Draft already exists for', publishDate);
    return store.drafts[publishDate];
  }
  const headlines = recentHeadlines(12);
  const result = CocEditorial.createDraftForDate(store, publishDate, headlines, { force: true });
  saveJson(EDITORIAL_PATH, result.store);
  const draft = result.draft;
  const n = (draft.headlines || []).length;
  console.log(
    `Outline draft for ${publishDate}: ${n} article(s), ~${draft.wordCount} words of brief — admin writes final prose`
  );
  return draft;
}

function isOutlineBrief(ed) {
  if (!ed) return false;
  if (ed.draftKind === 'outline' || ed.formId === 'outline_brief' || ed.themeId === 'outline') return true;
  const blob = String(ed.title || '') + '\n' + String(ed.body || '');
  return (
    /EDITORIAL BRIEF\s*\(outline only/i.test(blob) ||
    /^Editorial brief\s*[—–-]/i.test(String(ed.title || '').trim())
  );
}

/** Previous published editorial → field-signal card for the news timeline. */
function previousEditorialAsNewsItem(ed) {
  if (!ed || !ed.title) return null;
  const paras =
    ed.paragraphs && ed.paragraphs.length
      ? ed.paragraphs
      : String(ed.body || '')
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean);
  let summary = String(ed.dek || paras[0] || '').replace(/\s+/g, ' ').trim();
  if (summary.length > 220) {
    const cut = summary.slice(0, 220);
    const sp = cut.lastIndexOf(' ');
    summary = (sp > 120 ? cut.slice(0, sp) : cut).trim() + '…';
  }
  const date = ed.publishDate || (ed.publishedAt || '').slice(0, 10) || 'unknown';
  // Deep-link to THIS day's archive view — never bare #editorial (that is always today's live piece)
  const sourceUrl =
    date && date !== 'unknown'
      ? 'https://chronicleofconvergence.com/#editorial-' + date
      : 'https://chronicleofconvergence.com/#editorial';
  return {
    id: 'editorial_' + date,
    rank: 0,
    title: ed.title,
    category: 'editorial',
    summary,
    image: ed.heroImage || '',
    source: 'Chronicle of Convergence · Editorial',
    sourceUrl,
    isEditorialArchive: true,
    publishDate: date,
    authorName: ed.authorName || 'Dr. Wallace Lynch'
  };
}

/**
 * Append previous live editorial into data/archive.json as a timeline card batch.
 */
function archivePreviousEditorialAsNews(prevEd) {
  const item = previousEditorialAsNewsItem(prevEd);
  if (!item) return null;
  const {
    loadArchive,
    saveArchive,
    replaceEmbeddedData,
    dayKey
  } = require('./archive-utils.js');
  let existing = loadArchive(ROOT);
  const batchId = 'editorial_' + (item.publishDate || dayKey(new Date().toISOString()));
  // Replace same-day editorial archive card if republishing
  existing = existing.filter((b) => String(b.batchId || '') !== batchId);
  const batch = {
    batchId,
    scannedAt: (prevEd.publishedAt || prevEd.updatedAt || new Date().toISOString()),
    kind: 'editorial_archive',
    items: [item]
  };
  existing.unshift(batch);
  const saved = saveArchive(ROOT, existing);
  // Keep slim embed as newest non-editorial scan when possible
  const head =
    saved.find((b) => String(b.batchId || '').startsWith('auto_')) || saved[0];
  if (fs.existsSync(INDEX_PATH) && head) {
    let html = fs.readFileSync(INDEX_PATH, 'utf8');
    try {
      html = replaceEmbeddedData(html, [head]);
      fs.writeFileSync(INDEX_PATH, html);
    } catch (e) {
      console.warn('archive embed update:', e.message);
    }
  }
  console.log('Archived previous editorial as news card:', item.title);
  return item;
}

/**
 * Publish final prose for dateStr.
 * - Rejects outline briefs
 * - Moves current published → history + field-signal archive card
 * - Sets new published + injects index embed
 */
function publishDate(dateStr, { allowOutline = false } = {}) {
  const store = ensureStore();
  let ed = store.drafts[dateStr];
  if (!ed && store.published && store.published.publishDate === dateStr) {
    ed = store.published;
  }
  if (!ed) {
    console.warn('No draft for', dateStr, '— cannot publish empty day');
    return null;
  }
  if (!allowOutline && isOutlineBrief(ed)) {
    console.warn('Refuse to auto-publish outline brief for', dateStr);
    return null;
  }
  const wc = CocEditorial.wordCount(ed.body || (ed.paragraphs || []).join(' '));
  if (wc < 120 && !allowOutline) {
    console.warn('Refuse to publish short body for', dateStr, 'words=', wc);
    return null;
  }

  const prev = store.published;
  if (prev && prev.publishDate && prev.publishDate !== dateStr && !isOutlineBrief(prev)) {
    try {
      archivePreviousEditorialAsNews(prev);
    } catch (e) {
      console.warn('Could not archive previous editorial to news timeline:', e.message);
    }
  }

  ed.status = 'published';
  ed.publishedAt = new Date().toISOString();
  ed.updatedAt = ed.publishedAt;
  delete ed.draftKind;
  if (ed.themeId === 'outline') delete ed.themeId;
  if (ed.formId === 'outline_brief') delete ed.formId;
  if (!ed.paragraphs || !ed.paragraphs.length) {
    ed.paragraphs = String(ed.body || '')
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (ed.paragraphs.length <= 1 && ed.body) {
    const sentences = ed.body.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [ed.body];
    const chunks = [];
    let buf = '';
    for (const s of sentences) {
      buf += s.trim() + ' ';
      if (buf.split(/\s+/).length > 70) {
        chunks.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    ed.paragraphs = chunks;
    ed.body = chunks.join('\n\n');
  }
  store.published = ed;
  store.history = [ed, ...(store.history || []).filter((h) => h && h.id !== ed.id)].slice(0, 60);
  if (store.drafts) delete store.drafts[dateStr];
  if (ed.heroImage) {
    const used = new Set(store.usedHeroImages || []);
    used.add(ed.heroImage);
    store.usedHeroImages = [...used];
  }
  saveJson(EDITORIAL_PATH, store);
  injectIntoIndex(ed);
  console.log('Published editorial for', dateStr, 'paras=', ed.paragraphs.length);
  return ed;
}

function slimForEmbed(ed) {
  const out = { ...ed };
  delete out.headlines;
  if (out.paragraphs && out.paragraphs.length) {
    delete out.body;
  }
  return out;
}

function injectIntoIndex(ed) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.warn('index.html missing; skip inject');
    return;
  }
  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const payload = 'const EMBEDDED_EDITORIAL = ' + JSON.stringify(slimForEmbed(ed), null, 2) + ';';
  const re = /const\s+EMBEDDED_EDITORIAL\s*=\s*\{[\s\S]*?\n\};/m;
  if (re.test(html)) {
    html = html.replace(re, () => payload);
  } else if (/const\s+EMBEDDED_DATA\s*=/.test(html)) {
    html = html.replace(/const\s+EMBEDDED_DATA\s*=/, payload + '\n\nconst EMBEDDED_DATA =');
  } else {
    console.warn('Could not inject EMBEDDED_EDITORIAL');
    return;
  }
  fs.writeFileSync(INDEX_PATH, html);
  console.log('Injected EMBEDDED_EDITORIAL into index.html');
}

function draftIfDue() {
  const ny = nyParts();
  // After news exists, always allow next-day outline in a wide evening window
  // (GitHub Actions is often 1–3h late; exact hour===21 was the skip bug).
  if (process.env.FORCE_EDITORIAL !== '1') {
    if (ny.hour < 20 || ny.hour > 23) {
      console.log(`Skip draft: NY hour is ${ny.hour}, need 20–23 ET (or FORCE_EDITORIAL=1)`);
      return null;
    }
  }
  // Next calendar day outline for admin (9pm pipeline)
  return createDraftForDate(addDaysNy(ny.dateStr, 1), { force: false });
}

function publishIfDue() {
  const ny = nyParts();
  // Wide morning window: 7–10 ET (Actions delay)
  if (process.env.FORCE_EDITORIAL !== '1') {
    if (ny.hour < 7 || ny.hour > 10) {
      console.log(`Skip publish: NY hour is ${ny.hour}, need 7–10 ET (or FORCE_EDITORIAL=1)`);
      return null;
    }
  }
  return publishDate(ny.dateStr);
}

/** After a news crawl: force outline for today from latest archive headlines. */
function outlineAfterCrawl() {
  const ny = nyParts();
  return createDraftForDate(ny.dateStr, { force: true });
}

module.exports = {
  THEMES,
  HEROES,
  FORMS,
  nyParts,
  addDaysNy,
  createDraftForDate,
  publishDate,
  draftIfDue,
  publishIfDue,
  outlineAfterCrawl,
  injectIntoIndex,
  ensureStore,
  EDITORIAL_PATH,
  isOutlineBrief,
  previousEditorialAsNewsItem,
  archivePreviousEditorialAsNews,
  wordCount
};
