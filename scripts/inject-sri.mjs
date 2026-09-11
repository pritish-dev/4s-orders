#!/usr/bin/env node
// ============================================================================
// inject-sri.mjs — add Subresource Integrity to trusted-CDN <script> tags
// ----------------------------------------------------------------------------
// Runs at DEPLOY time (in CI) against the assembled _site copies, never the
// committed source. For each <script src="https://cdnjs…|unpkg…"> tag it fetches
// the exact pinned file, computes its sha384, and injects integrity="…". The
// browser then refuses to run the script if a CDN ever serves altered bytes —
// the main way a token in localStorage could otherwise be stolen.
//
// Correct-by-construction: the hash is computed from the same bytes the CDN
// serves, so it can never be a wrong static hash. NON-FATAL: if a CDN can't be
// reached, that tag is left unchanged (no integrity) and the deploy proceeds —
// the app keeps working exactly as before.
//
// Usage: node scripts/inject-sri.mjs <file> [<file> …]
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: inject-sri.mjs <file...>'); process.exit(1); }

// Only these trusted hosts (which send CORS headers) get SRI.
const CDN_RE =
  /<script\b([^>]*?)\bsrc="(https:\/\/(?:cdnjs\.cloudflare\.com|unpkg\.com)\/[^"]+)"([^>]*)><\/script>/g;

const cache = new Map();
async function sriFor(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = 'sha384-' + createHash('sha384').update(buf).digest('base64');
  cache.set(url, hash);
  return hash;
}

for (const f of files) {
  let s;
  try { s = readFileSync(f, 'utf8'); } catch (e) { console.log(`skip ${f}: ${e.message}`); continue; }

  const matches = [...s.matchAll(CDN_RE)];
  let changed = false;
  for (const m of matches) {
    const full = m[0];
    const url  = m[2];
    if (/\bintegrity=/.test(full)) continue;                       // already has SRI
    let hash;
    try { hash = await sriFor(url); }
    catch (e) { console.log(`::warning::SRI skipped for ${url}: ${e.message}`); continue; }
    const cross   = /\bcrossorigin\b/.test(full) ? '' : ' crossorigin="anonymous"';
    const injected = full.replace('></script>', ` integrity="${hash}"${cross}></script>`);
    s = s.split(full).join(injected);
    changed = true;
    console.log(`SRI ${f}: ${url.split('/').pop()} -> ${hash.slice(0, 24)}…`);
  }
  if (changed) writeFileSync(f, s);
  else console.log(`no SRI changes in ${f}`);
}
