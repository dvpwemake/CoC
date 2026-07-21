#!/usr/bin/env node
'use strict';
/**
 * Create next-day daily editorial draft (target: 9pm America/New_York).
 * Usage: node scripts/editorial-draft.js [--force]
 */
const lib = require('./editorial-lib.js');

if (process.argv.includes('--force')) process.env.FORCE_EDITORIAL = '1';

const ny = lib.nyParts();
console.log('America/New_York now:', ny.dateStr, 'hour=', ny.hour);

if (process.argv.includes('--force') || process.argv.includes('--today')) {
  const date = process.argv.includes('--today') ? ny.dateStr : lib.addDaysNy(ny.dateStr, 1);
  lib.createDraftForDate(date, { force: true });
} else {
  lib.draftIfDue();
}
