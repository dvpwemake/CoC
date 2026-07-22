#!/usr/bin/env node
'use strict';
/**
 * Publish CoC data to GitHub main → GitHub Pages (live site).
 *
 * What this does:
 *  1. Optional: crawl news (RSS + X signals cache) → data/archive*.json + slim embed
 *  2. Optional: refresh editorial OUTLINE drafts (today + tomorrow ET)
 *  3. git add / commit / push origin main
 *
 * Does NOT invent final editorial prose. Public homepage still shows only
 * data/editorial.json → published (admin must Mark published + include that file).
 *
 * Usage:
 *   node scripts/publish-to-github.js
 *   node scripts/publish-to-github.js --skip-scan
 *   node scripts/publish-to-github.js --skip-draft
 *   node scripts/publish-to-github.js --message "why this deploy"
 *   node scripts/publish-to-github.js --dry-run
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipScan = args.has('--skip-scan');
const skipDraft = args.has('--skip-draft');
const msgIdx = process.argv.indexOf('--message');
const customMsg =
  msgIdx >= 0 && process.argv[msgIdx + 1] ? process.argv[msgIdx + 1] : null;

function sh(cmd, opts = {}) {
  console.log('›', cmd);
  if (dryRun && opts.mutate) {
    console.log('  (dry-run: skip)');
    return '';
  }
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts
  });
}

function runNode(script, scriptArgs = []) {
  const full = ['node', script, ...scriptArgs];
  console.log('›', full.join(' '));
  if (dryRun) {
    console.log('  (dry-run: skip)');
    return 0;
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (r.status !== 0) {
    throw new Error(script + ' failed with exit ' + r.status);
  }
  return r.status;
}

function main() {
  console.log('CoC publish → GitHub Pages');
  console.log('root:', ROOT);
  if (dryRun) console.log('mode: dry-run');

  // Ensure clean tracking of main
  sh('git fetch origin', { mutate: false });
  const branch = sh('git rev-parse --abbrev-ref HEAD', { silent: true, stdio: 'pipe' }).trim();
  if (branch !== 'main') {
    console.warn('Warning: not on main (on ' + branch + '). Continuing anyway.');
  }

  // Stay current with remote before generating (avoid clobber races)
  try {
    sh('git pull --rebase origin main', { mutate: true });
  } catch (e) {
    console.error('git pull --rebase failed. Resolve conflicts, then re-run.');
    process.exit(1);
  }

  if (!skipScan) {
    console.log('\n[1/3] News crawl…');
    runNode('scripts/scan-crawler.js');
  } else {
    console.log('\n[1/3] News crawl skipped');
  }

  if (!skipDraft) {
    console.log('\n[2/3] Editorial outline drafts (today + tomorrow ET)…');
    runNode('scripts/editorial-draft.js', ['--both']);
  } else {
    console.log('\n[2/3] Editorial outlines skipped');
  }

  console.log('\n[3/3] Commit + push…');
  const paths = [
    'data/archive.json',
    'data/archive_part0.json',
    'data/archive_part1.json',
    'data/archive_part2.json',
    'data/archive_part3.json',
    'data/editorial.json',
    'data/x-signals.json',
    'index.html',
    'editor.html',
    'scripts/',
    'robots.txt'
  ].filter((p) => fs.existsSync(path.join(ROOT, p)));

  sh('git add ' + paths.map((p) => JSON.stringify(p)).join(' '), { mutate: true });

  const status = sh('git status --porcelain', { silent: true, stdio: 'pipe', mutate: false });
  if (!String(status || '').trim()) {
    console.log('Nothing new to commit. Checking if push needed…');
    const ahead = sh('git rev-list --count origin/main..HEAD', {
      silent: true,
      stdio: 'pipe',
      mutate: false
    }).trim();
    if (ahead === '0') {
      console.log('Already up to date with origin/main. Live site should match GitHub.');
      return;
    }
  } else {
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const message =
      customMsg ||
      `Publish to GitHub: news + editorial outlines (${stamp})`;
    if (dryRun) {
      console.log('Would commit:', message);
    } else {
      sh('git commit -m ' + JSON.stringify(message), { mutate: true });
    }
  }

  sh('git push origin HEAD:main', { mutate: true });
  console.log('\nPushed to origin/main. Deploy Pages should run next → chronicleofconvergence.com');
  console.log('Note: public editorial only updates when data/editorial.json "published" has final prose.');
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
