'use strict';

/**
 * CoC v2 daily editorial — professional prose, real paragraphs, PD heroes.
 * Target length: ~300 words (range 280–320).
 * Draft by 21:00 America/New_York for next calendar day.
 * Publish at 08:00 America/New_York.
 *
 * Style brief: newspaper editorial quality; CoC tone; no AI-sounding formula.
 * Body is always an array of paragraphs (joined with \n\n for storage).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_PATH = path.join(ROOT, 'data', 'archive.json');
const EDITORIAL_PATH = path.join(ROOT, 'data', 'editorial.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const THEMES = [
  {
    id: 'human_ai',
    label: 'Human judgment and machine intelligence',
    open: 'Machines can sort patterns at a scale no newsroom ever could. What they cannot do is decide what is worth caring about.'
  },
  {
    id: 'carbon_silicon',
    label: 'Living bodies and engineered systems',
    open: 'We still inhabit bodies that tire, hunger, and age. Beside us run systems that do not sleep. The friction between the two is the story of our century.'
  },
  {
    id: 'heritage_innovation',
    label: 'What we keep and what we invent',
    open: 'Every American city is an argument between memory and invention. The useful question is not which side wins, but what each is allowed to ask of the other.'
  },
  {
    id: 'art_technology',
    label: 'Making and measuring',
    open: 'Art teaches us how to look. Technology extends how far we can look. Confusing the two has never produced good culture—or good tools.'
  },
  {
    id: 'faith_secular',
    label: 'Sacred rooms and civic streets',
    open: 'Faith and public life share sidewalks. One offers silence and ritual; the other offers policy and trade. Both shape how a people spends its attention.'
  },
  {
    id: 'cultures',
    label: 'Many cultures, one shared street',
    open: 'Cultures do not “merge” on command. They meet—sometimes gladly, sometimes with friction—and the meeting place is where American life is actually made.'
  }
];

/** Prefer stable, widely cached public-domain / open government images (unique per editorial). */
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

function nyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  // two formatters — numeric date + display
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
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
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
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + days, 16, 0, 0);
  return nyParts(new Date(utc)).dateStr;
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

function hashPick(str, n) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h + str.charCodeAt(i) * (i + 3)) % 10007;
  return h % n;
}

function pickTheme(dateStr) {
  return THEMES[hashPick(dateStr + 't', THEMES.length)];
}

/** Collect hero URLs already used in published / history / drafts — never reuse. */
function usedHeroUrls(store) {
  const used = new Set(store.usedHeroImages || []);
  const blobs = [store.published, ...(store.history || []), ...Object.values(store.drafts || {})];
  for (const ed of blobs) {
    if (ed && ed.heroImage) used.add(ed.heroImage);
  }
  return used;
}

/**
 * Pick a hero not already used in editorial history.
 * Falls back to least-recently-conflicting hash pick only if bank is exhausted.
 */
function pickHero(dateStr, store) {
  const used = store ? usedHeroUrls(store) : new Set();
  const free = HEROES.filter((h) => !used.has(h.url));
  const pool = free.length ? free : HEROES;
  return pool[hashPick(dateStr + 'h', pool.length)];
}

function recentHeadlines(n = 5) {
  const archive = loadJson(ARCHIVE_PATH, []);
  const items = [];
  for (const b of archive) {
    for (const it of b.items || []) {
      items.push(it);
      if (items.length >= n) return items;
    }
  }
  return items;
}

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Build short CoC editorial paragraphs (~300 words).
 * Returns { title, dek, paragraphs: string[], body: string with \n\n }
 */
function buildEssay(publishDate, theme, headlines) {
  const displayDate = (() => {
    try {
      const [y, m, d] = publishDate.split('-').map(Number);
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    } catch (e) {
      return publishDate;
    }
  })();

  const h0 = headlines[0];
  const h1 = headlines[1];
  const h2 = headlines[2];
  const paras = [];

  paras.push(theme.open);

  paras.push(
    `Chronicle of Convergence is not a digest of destinations or a ranking of trends. It is a daily attempt to read American life where culture, society, technology, and faith already share the same rooms. On ${displayDate}, we hold that reading to one pressure point: ${theme.label.toLowerCase()}.`
  );

  if (h0) {
    paras.push(
      `The news offers a concrete case. ${h0.source || 'A major outlet'} reports on “${h0.title}.” Advances rarely stay inside their original field. They migrate into manners, markets, worship, and work.`
    );
  } else {
    paras.push(
      `Even when the wires are quiet, the same migration is underway. Tools reshape habits; habits reshape institutions; institutions reshape what a people believes it can ask of itself.`
    );
  }

  if (h1) {
    paras.push(
      `A second dispatch complicates the first. “${h1.title}” (${h1.source || 'report'}) does not cancel the earlier signal; it shows the braid. Technical claims arrive with aesthetic moods, commercial incentives, and moral hesitation. An editorial that picks only one strand is advertising, not judgment.`
    );
  }

  if (h2) {
    paras.push(
      `Between laboratory and gallery, congregation and city hall, the same question returns: what should be kept, and what should be risked. Coverage such as “${h2.title}” (${h2.source || 'the day’s press'}) keeps the braid public. Instruments change how we see; seeing changes which instruments we fund.`
    );
  } else {
    paras.push(
      `Between laboratory and gallery, congregation and city hall, the same question returns: what should be kept, and what should be risked. Instruments change how we see; seeing changes which instruments we fund. A culture that celebrates only the tool forgets the hand.`
    );
  }

  paras.push(
    `Heritage, practiced as skill rather than costume, still teaches judgment. Innovation, practiced as care rather than novelty for its own sake, still expands what is possible. Silicon can accelerate pattern recognition. Carbon still carries cost, fatigue, and consequence. Pretending otherwise is not optimism. It is negligence.`
  );

  paras.push(
    `What should a reader do with a day like this? Neither panic at machine scale nor invent a pure past that never existed. Name the forces in the room. Ask what each can give. Ask what each must not be allowed to take. Then look again tomorrow. Proportion, not panic, is the discipline. The headlines remain their publishers’. The synthesis is ours.`
  );

  let body = paras.join('\n\n');
  let wc = wordCount(body);

  // Target ~300 words (280–320). Pad only if short; hard-trim if long.
  const pad = [
    `A republic that cannot tell a useful instrument from a substitute for judgment will eventually have neither good tools nor free citizens.`
  ];
  let pi = 0;
  while (wc < 280 && pi < pad.length) {
    paras.splice(paras.length - 1, 0, pad[pi]);
    body = paras.join('\n\n');
    wc = wordCount(body);
    pi++;
  }

  if (wc > 320) {
    const words = body.split(/\s+/);
    body = words.slice(0, 300).join(' ');
    // keep paragraph breaks where possible
    const keep = [];
    let count = 0;
    for (const p of paras) {
      const pw = p.split(/\s+/).filter(Boolean).length;
      if (count + pw > 300 && keep.length) break;
      keep.push(p);
      count += pw;
    }
    if (keep.length) {
      body = keep.join('\n\n');
      const extra = 300 - wordCount(body);
      if (extra > 20 && paras[keep.length]) {
        body += '\n\n' + paras[keep.length].split(/\s+/).slice(0, extra).join(' ');
      }
    }
    wc = wordCount(body);
  }

  const title = theme.label.charAt(0).toUpperCase() + theme.label.slice(1);
  const dek = `A short editorial on ${theme.label.toLowerCase()}—attention under pressure.`;

  return {
    title,
    dek,
    paragraphs: body.split(/\n\n+/).filter(Boolean),
    body,
    wordCount: wordCount(body),
    theme
  };
}

function ensureStore() {
  const store = loadJson(EDITORIAL_PATH, { published: null, drafts: {}, history: [] });
  if (!store.drafts) store.drafts = {};
  if (!store.history) store.history = [];
  return store;
}

function createDraftForDate(publishDate, { force = false } = {}) {
  const store = ensureStore();
  if (store.drafts[publishDate] && !force && store.drafts[publishDate].status === 'draft') {
    console.log('Draft already exists for', publishDate);
    return store.drafts[publishDate];
  }
  const theme = pickTheme(publishDate);
  const hero = pickHero(publishDate, store);
  const headlines = recentHeadlines(6);
  const essay = buildEssay(publishDate, theme, headlines);
  const draft = {
    id: `ed_${publishDate}`,
    publishDate,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: essay.title,
    dek: essay.dek,
    body: essay.body,
    paragraphs: essay.paragraphs,
    wordCount: essay.wordCount,
    themeId: theme.id,
    themeLabel: theme.label,
    authorName: (store.defaultAuthorName || 'Dr. Wallace Lynch'),
    authorTitle: (store.defaultAuthorTitle || 'Editor in Chief'),
    heroImage: hero.url,
    heroCredit: hero.credit,
    heroSource: hero.source,
    heroSourceUrl: hero.sourceUrl,
    headlines: headlines.map((h) => ({
      title: h.title,
      source: h.source,
      category: h.category,
      sourceUrl: h.sourceUrl
    }))
  };
  store.drafts[publishDate] = draft;
  // Track used heroes so drafts/publish never share the same image
  const used = usedHeroUrls(store);
  used.add(hero.url);
  store.usedHeroImages = [...used];
  saveJson(EDITORIAL_PATH, store);
  console.log(`Draft created for ${publishDate} (~${draft.wordCount} words) theme=${theme.id} paras=${draft.paragraphs.length}`);
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
  // normalize paragraphs
  if (!ed.paragraphs || !ed.paragraphs.length) {
    ed.paragraphs = String(ed.body || '')
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (ed.paragraphs.length <= 1 && ed.body) {
    // emergency split on sentence groups if flat
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
    const used = usedHeroUrls(store);
    used.add(ed.heroImage);
    store.usedHeroImages = [...used];
  }
  saveJson(EDITORIAL_PATH, store);
  injectIntoIndex(ed);
  console.log('Published editorial for', dateStr, 'paras=', ed.paragraphs.length);
  return ed;
}

function slimForEmbed(ed) {
  // Keep HTML small: paragraphs + meta; omit bulky headlines; body optional short
  const out = { ...ed };
  delete out.headlines;
  if (out.paragraphs && out.paragraphs.length) {
    // body not required for render; omit full duplicate to save bytes
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
