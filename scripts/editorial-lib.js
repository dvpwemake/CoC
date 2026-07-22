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
  const headlines = recentHeadlines(8);
  const result = CocEditorial.createDraftForDate(store, publishDate, headlines, { force: true });
  saveJson(EDITORIAL_PATH, result.store);
  const draft = result.draft;
  const n = (draft.headlines || []).length;
  console.log(
    `Outline draft for ${publishDate}: ${n} article(s), ~${draft.wordCount} words of brief — admin writes final prose`
  );
  return draft;
}

function publishDate(dateStr) {
  const store = ensureStore();
  if (!store.drafts[dateStr]) {
    console.warn('No draft for', dateStr, '— generating then publishing');
    createDraftForDate(dateStr, { force: true });
  }
  const ed = store.drafts[dateStr];
  ed.status = 'published';
  ed.publishedAt = new Date().toISOString();
  ed.updatedAt = ed.publishedAt;
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
  store.history = [ed, ...(store.history || [])].slice(0, 60);
  delete store.drafts[dateStr];
  if (ed.heroImage) {
    const used = new Set(store.usedHeroImages || []);
    used.add(ed.heroImage);
    store.usedHeroImages = [...used];
  }
  saveJson(EDITORIAL_PATH, store);
  injectIntoIndex(ed);
  console.log('Published editorial for', dateStr, 'paras=', ed.paragraphs.length, 'form=', ed.formId || '—');
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
  if (ny.hour !== 21 && process.env.FORCE_EDITORIAL !== '1') {
    console.log(`Skip draft: NY hour is ${ny.hour}, need 21 (or FORCE_EDITORIAL=1)`);
    return null;
  }
  return createDraftForDate(addDaysNy(ny.dateStr, 1));
}

function publishIfDue() {
  const ny = nyParts();
  if (ny.hour !== 8 && process.env.FORCE_EDITORIAL !== '1') {
    console.log(`Skip publish: NY hour is ${ny.hour}, need 8 (or FORCE_EDITORIAL=1)`);
    return null;
  }
  return publishDate(ny.dateStr);
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
  injectIntoIndex,
  ensureStore,
  EDITORIAL_PATH,
  wordCount
};
