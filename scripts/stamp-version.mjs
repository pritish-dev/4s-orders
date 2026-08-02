#!/usr/bin/env node
// ============================================================================
// stamp-version.mjs — automatic cache-busting version stamp
// ----------------------------------------------------------------------------
// Rewrites the app's version markers to a fresh release id so that EVERY merge
// to master forces installed clients to pull the new code. No human ever has to
// remember to bump a version again.
//
//   • mobile-app/www/version.json  "v"    → release id  (mobile OTA: the value
//                                                         installed apps poll for)
//   • mobile-app/www/index.html    RUNV   → release id  (mobile OTA: must equal
//                                                         version.json after deploy,
//                                                         otherwise the app would
//                                                         reload in a loop)
//   • sw.js                        CACHE  → 4s-orders-<id>  (PWA: a new cache name
//                                                            purges stale assets and
//                                                            reloads open tabs on the
//                                                            service worker's activate)
//
// The hard localStorage-reset gates (`var V = '…'` in both index.html files) are
// intentionally left ALONE. They wipe the client's cached items/orders and are a
// deliberate, manual tool for breaking data-format changes — not something we
// want firing on every routine deploy.
//
// Usage: node scripts/stamp-version.mjs <release-id>
//   (CI passes the 7-char commit SHA; any value that changes per release works.)
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';

const id = (process.argv[2] || '').trim();
if (!id) {
  console.error('Usage: node scripts/stamp-version.mjs <release-id>');
  process.exit(1);
}

function edit(file, replacer) {
  let before;
  try { before = readFileSync(file, 'utf8'); }
  catch (e) { console.error(`skip ${file}: ${e.message}`); return; }
  const after = replacer(before);
  if (after !== before) { writeFileSync(file, after); console.log(`stamped ${file}`); }
  else console.log(`unchanged ${file}`);
}

// Mobile OTA — version.json is what running apps poll; RUNV is what the freshly
// loaded page reports. They MUST end up equal, so stamp both to the same id.
edit('mobile-app/www/version.json', s =>
  s.replace(/("v"\s*:\s*")[^"]*(")/, `$1${id}$2`));
edit('mobile-app/www/index.html', s =>
  s.replace(/(var RUNV\s*=\s*')[^']*(')/, `$1${id}$2`));

// PWA — bumping the service-worker cache name purges stale shell/CDN assets on
// activate and triggers the reload of any open tab.
edit('sw.js', s =>
  s.replace(/(const CACHE\s*=\s*'4s-orders-)[^']*(')/, `$1${id}$2`));
