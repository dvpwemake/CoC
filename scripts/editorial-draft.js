#!/usr/bin/env node
'use strict';
/**
 * Create daily editorial draft (target: 9pm America/New_York for next day).
 * Usage:
 *   node scripts/editorial-draft.js              # hour-gated next day
 *   node scripts/editorial-draft.js --force      # next day only
 *   node scripts/editorial-draft.js --today      # today only
 *   node scripts/editorial-draft.js --force --both  # today + tomorrow (admin backfill)
 */
const lib = require('./editorial-lib.js');

if (process.argv.includes('--force') || process.argv.includes('--today') || process.argv.includes('--both')) {
  process.env.FORCE_EDITORIAL = '1';
}

const ny = lib.nyParts();
console.log('America/New_York now:', ny.dateStr, 'hour=', ny.hour);

const force = process.argv.includes('--force') || process.argv.includes('--today') || process.argv.includes('--both');
const both = process.argv.includes('--both') || (process.argv.includes('--force') && process.argv.includes('--today'));

if (both || process.argv.includes('--both')) {
  lib.createDraftForDate(ny.dateStr, { force: true });
  lib.createDraftForDate(lib.addDaysNy(ny.dateStr, 1), { force: true });
} else if (process.argv.includes('--today')) {
  lib.createDraftForDate(ny.dateStr, { force: true });
} else if (process.argv.includes('--force')) {
  lib.createDraftForDate(lib.addDaysNy(ny.dateStr, 1), { force: true });
} else {
  lib.draftIfDue();
}
