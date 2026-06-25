#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  extractEmbeddedData,
  replaceEmbeddedData,
  saveArchive,
  dedupeBatches
} = require('./archive-utils.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const HISTORY_COMMIT = process.env.HISTORY_COMMIT || 'bdb4d16';

function loadHistoricalFromGit(commit) {
  const html = execSync(`git show ${commit}:index.html`, { cwd: ROOT, encoding: 'utf8' });
  return extractEmbeddedData(html);
}

function normalizeBatch(batch) {
  const out = { ...batch };
  out.batchId = out.batchId || out.id;
  delete out.id;
  return out;
}

function main() {
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'archive.json'), 'utf8'));
  let historical = [];
  try {
    historical = loadHistoricalFromGit(HISTORY_COMMIT).map(normalizeBatch);
    console.log(`Loaded ${historical.length} historical batches from ${HISTORY_COMMIT}`);
  } catch (e) {
    console.warn(`Historical load skipped: ${e.message}`);
  }

  const merged = dedupeBatches([...current, ...historical].map(normalizeBatch));
  const saved = saveArchive(ROOT, merged);
  const articles = saved.reduce((n, b) => n + (b.items || []).length, 0);
  console.log(`Archive restored — ${saved.length} batches, ${articles} articles`);

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  html = replaceEmbeddedData(html, [saved[0]]);
  fs.writeFileSync(INDEX_PATH, html);
  console.log('Updated EMBEDDED_DATA with latest batch');
}

main();