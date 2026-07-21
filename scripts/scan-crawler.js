#!/usr/bin/env node
'use strict';

/**
 * Auto-scan: crawl feeds → merge into data/archive.json (preserve full history)
 * → update slim EMBEDDED_DATA fallback in index.html.
 * Does NOT wipe old news. Same calendar day: replace that day's scan batch only.
 */

const fs = require('fs');
const path = require('path');
const CocCrawler = require('./crawler-lib.js');
const {
  loadArchive,
  replaceEmbeddedData,
  saveArchive,
  dayKey
} = require('./archive-utils.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SOURCES_PATH = path.join(__dirname, 'sources.json');

function scrubItem(it) {
  const strip = CocCrawler.stripHtml || ((s) => String(s || ''));
  return {
    ...it,
    title: strip(it.title || '').slice(0, 150),
    summary: strip(it.summary || ''),
    source: strip(it.source || '')
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--json');
  const config = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));

  console.log('Crawling science + art feeds…');
  const items = await CocCrawler.crawl(config, { fetch: globalThis.fetch });

  if (!items.length) {
    console.error('No articles found from any feed.');
    process.exit(1);
  }

  items.forEach((it) => console.log(`  #${it.rank} [${it.category}] ${it.source}: ${it.title}`));

  if (dryRun) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  const now = new Date();
  const batchId = 'auto_' + now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const batch = {
    batchId,
    scannedAt: now.toISOString(),
    items: items.map((it, i) =>
      scrubItem({
        id: `${batchId}_${i + 1}`,
        rank: it.rank,
        title: it.title,
        category: it.category,
        summary: it.summary,
        image: it.image,
        source: it.source,
        sourceUrl: it.sourceUrl
      })
    )
  };

  let existing = loadArchive(ROOT);
  // Replace only today's auto_* scan batch; keep every older batch (full history)
  const today = dayKey(batch.scannedAt);
  existing = existing.filter(
    (b) => !(dayKey(b.scannedAt) === today && String(b.batchId || '').startsWith('auto_'))
  );
  existing.unshift(batch);

  // NO 30-day cutoff — preserve full archive
  const saved = saveArchive(ROOT, existing);

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  // Slim fallback only — full history lives in data/archive.json
  html = replaceEmbeddedData(html, [saved[0]]);
  fs.writeFileSync(INDEX_PATH, html);

  console.log(
    `Updated archive — ${batch.items.length} new items, ${saved.length} total batches, ${saved.reduce((n, b) => n + (b.items || []).length, 0)} titles`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
