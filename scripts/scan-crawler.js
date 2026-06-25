#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const CocCrawler = require('./crawler-lib.js');

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

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const regex = /const\s+EMBEDDED_DATA\s*=\s*\[[\s\S]*\];/;
  const found = html.match(regex);
  if (!found) {
    console.error('Could not find EMBEDDED_DATA in index.html');
    process.exit(1);
  }

  let existing = [];
  try {
    const arrStr = found[0].replace(/^const\s+EMBEDDED_DATA\s*=\s*/, '').replace(/;$/, '');
    existing = JSON.parse(arrStr);
  } catch (e) {
    console.warn('Could not parse existing data, starting fresh:', e.message);
  }

  existing.unshift(batch);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  existing = existing.filter((b) => new Date(b.scannedAt).getTime() > cutoff);

  const replacement = 'const EMBEDDED_DATA = ' + JSON.stringify(existing, null, 2) + ';';
  html = html.replace(regex, () => replacement);
  fs.writeFileSync(INDEX_PATH, html);
  console.log(`Updated index.html — ${batch.items.length} new items, ${existing.length} total batches`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});