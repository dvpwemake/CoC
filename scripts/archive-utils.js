'use strict';

const fs = require('fs');
const path = require('path');

function extractEmbeddedData(html) {
  const marker = 'const EMBEDDED_DATA = ';
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const sub = html.slice(start + marker.length);
  let depth = 0;
  for (let i = 0; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(sub.slice(0, i + 1));
    }
  }
  throw new Error('Could not parse EMBEDDED_DATA array');
}

function replaceEmbeddedData(html, data) {
  const marker = 'const EMBEDDED_DATA = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Could not find EMBEDDED_DATA in index.html');

  const sub = html.slice(start + marker.length);
  let depth = 0;
  let end = -1;
  for (let i = 0; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('Could not find end of EMBEDDED_DATA array');

  const replacement = marker + JSON.stringify(data, null, 2) + ';';
  return html.slice(0, start) + replacement + html.slice(start + marker.length + end + 1);
}

function loadArchiveParts(dataDir) {
  const merged = [];
  for (let i = 0; i < 4; i++) {
    const partPath = path.join(dataDir, `archive_part${i}.json`);
    if (!fs.existsSync(partPath)) continue;
    const raw = fs.readFileSync(partPath, 'utf8').trim();
    if (!raw.startsWith('[')) continue;
    try {
      const part = JSON.parse(raw);
      if (Array.isArray(part)) merged.push(...part);
    } catch (_) {
      /* skip invalid part */
    }
  }
  return merged;
}

function loadArchive(root) {
  const dataDir = path.join(root, 'data');
  const archivePath = path.join(dataDir, 'archive.json');
  const indexPath = path.join(root, 'index.html');

  if (fs.existsSync(archivePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
      if (Array.isArray(data) && data.length) return data;
    } catch (e) {
      console.warn('Could not parse archive.json:', e.message);
    }
  }

  const parts = loadArchiveParts(dataDir);
  if (parts.length) return dedupeBatches(parts);

  if (fs.existsSync(indexPath)) {
    try {
      const html = fs.readFileSync(indexPath, 'utf8');
      const embedded = extractEmbeddedData(html);
      if (Array.isArray(embedded) && embedded.length) return embedded;
    } catch (e) {
      console.warn('Could not parse EMBEDDED_DATA fallback:', e.message);
    }
  }

  return [];
}

function dayKey(scannedAt) {
  return String(scannedAt || '').slice(0, 10);
}

function dedupeBatches(batches) {
  const seen = new Set();
  return batches
    .slice()
    .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))
    .filter((b) => {
      const key = b.batchId || b.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Keep only the latest batch per calendar day (replaces earlier same-day scans). */
function dedupeSameDayBatches(batches) {
  const byDay = new Map();
  for (const batch of dedupeBatches(batches)) {
    const key = dayKey(batch.scannedAt);
    const prev = byDay.get(key);
    if (!prev || new Date(batch.scannedAt) > new Date(prev.scannedAt)) {
      byDay.set(key, batch);
    }
  }
  return [...byDay.values()].sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
}

function saveArchive(root, batches) {
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const normalized = dedupeSameDayBatches(batches);
  fs.writeFileSync(path.join(dataDir, 'archive.json'), JSON.stringify(normalized, null, 2));

  const chunkSize = Math.ceil(normalized.length / 4) || 1;
  for (let i = 0; i < 4; i++) {
    const chunk = normalized.slice(i * chunkSize, (i + 1) * chunkSize);
    fs.writeFileSync(path.join(dataDir, `archive_part${i}.json`), JSON.stringify(chunk, null, 2));
  }

  return normalized;
}

module.exports = {
  extractEmbeddedData,
  replaceEmbeddedData,
  loadArchive,
  loadArchiveParts,
  saveArchive,
  dedupeBatches,
  dedupeSameDayBatches,
  dayKey
};