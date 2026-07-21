#!/usr/bin/env node
'use strict';
/**
 * Publish today's daily editorial (target: 8am America/New_York).
 * Usage: node scripts/editorial-publish.js [--force]
 */
const lib = require('./editorial-lib.js');

if (process.argv.includes('--force')) process.env.FORCE_EDITORIAL = '1';

const ny = lib.nyParts();
console.log('America/New_York now:', ny.dateStr, 'hour=', ny.hour);

if (process.argv.includes('--force') || process.argv.includes('--today')) {
  lib.publishDate(ny.dateStr);
} else {
  lib.publishIfDue();
}
