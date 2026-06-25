#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const CocCrawler = require('./crawler-lib.js');
const {
  loadArchive,
  replaceEmbeddedData,
  saveArchive
} = require('./archive-utils.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SOURCES_PATH = path.join(__dirname, 'sources.json');

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--json');
  const config = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));

  console.log('Crawling reputable science feeds…');
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
    items: items.map((it, i) => ({
      id: `${batchId}_${i + 1}`,
      rank: it.rank,
      title: it.title,
      category: it.category,
      summary: it.summary,
      image: it.image,
      source: it.source,
      sourceUrl: it.sourceUrl
    }))
  };

  let existing = loadArchive(ROOT);
  existing.unshift(batch);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  existing = existing.filter((b) => new Date(b.scannedAt).getTime() > cutoff);

  const saved = saveArchive(ROOT, existing);

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  html = replaceEmbeddedData(html, [saved[0]]);
  fs.writeFileSync(INDEX_PATH, html);

  console.log(`Updated archive — ${batch.items.length} new items, ${saved.length} total batches`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});