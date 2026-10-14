#!/usr/bin/env node
'use strict';
/**
 * CLI: publish today's (or --date) editorial draft to live via git.
 * - Rejects outline briefs
 * - Archives previous published editorial as Field signals card
 * - Injects EMBEDDED_EDITORIAL
 * - Commits + pushes to origin main
 *
 * Usage:
 *   node scripts/publish-editorial-live.js
 *   node scripts/publish-editorial-live.js --date 2026-07-22
 *   node scripts/publish-editorial-live.js --no-push
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const lib = require('./editorial-lib.js');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');
const di = args.indexOf('--date');
const dateStr =
  di >= 0 && args[di + 1]
    ? args[di + 1]
    : lib.nyParts().dateStr;

function sh(cmd) {
  console.log('›', cmd);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function onHead(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', 'HEAD:' + rel], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

const ed = lib.publishDate(dateStr);
if (!ed) {
  console.error('Publish failed for', dateStr);
  process.exit(1);
}

sh('git add data/editorial.json data/archive.json data/archive_part*.json index.html');
if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  const rel = 'e/' + dateStr + '.html';
  if (fs.existsSync(path.join(ROOT, rel)) && !onHead(rel)) {
    execFileSync('git', ['add', '--', rel], { cwd: ROOT, stdio: 'inherit' });
    console.log('Staged ' + rel);
  } else {
    console.log('Leaving ' + rel + ' unstaged.');
  }
}
const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
if (!status.trim()) {
  console.log('No file changes (already published?)');
  process.exit(0);
}
const msg = 'Editorial publish: ' + dateStr + ' — ' + String(ed.title || '').slice(0, 60);
sh('git commit -m ' + JSON.stringify(msg));
if (!noPush) {
  sh('git push origin HEAD:main');
  console.log('Pushed. Deploy Pages will update chronicleofconvergence.com');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    try {
      execFileSync('gh', [
        'workflow', 'run', 'linkedin-editorial.yml',
        '--ref', 'main',
        '-f', 'date=' + dateStr,
        '-f', 'delay_minutes=10'
      ], { cwd: ROOT, stdio: 'inherit' });
      console.log('LinkedIn queued for ' + dateStr + ' · 10 minutes after this publish');
    } catch (e) {
      console.warn('Editorial is on GitHub. LinkedIn was not queued.');
    }
  }
} else {
  console.log('Committed locally (--no-push). Run git push when ready.');
}
