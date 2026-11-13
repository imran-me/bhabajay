#!/usr/bin/env node
/**
 * Content engine — "post once on Facebook, live forever on the site".
 *
 * Nightly: read new Page posts via the official Graph API, archive the image
 * + caption into the repo as JSON drafts, then a human editor spends ~5 min
 * fixing the Bangla title, slug, alt text, series and Initiator credit before
 * merging into src/data/posts.json (the site keeps its own copy, so a deleted
 * or buried Facebook post never breaks the library).
 *
 *   FB_PAGE_ID=… FB_PAGE_TOKEN=… npm run import:facebook
 *   node scripts/import-facebook.mjs --since 2026-11-01 --dry-run
 *
 * Output: src/data/imported/YYYY-MM-DD.json  (+ images in public/cards/)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : [])).filter((x) => x.length));
const DRY = args.has('dry-run');
const SINCE = typeof args.get('since') === 'string' ? args.get('since') : new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10);
const { FB_PAGE_ID, FB_PAGE_TOKEN } = process.env;
const API = 'https://graph.facebook.com/v21.0';

// Topic + series guesses from hashtags used in captions (#ভাবা_যায় #মিথ …)
const SERIES_TAGS = {
  'রান্নাঘরের_বিজ্ঞান': 'rannagharer-biggan', 'মশার_জীবন': 'mosar-jibon', 'হাওরের_মাছ': 'haorer-mach',
  'তারার_গল্প': 'tarar-golpo', 'শরীরের_রহস্য': 'shorirer-rohossho', 'বাংলার_আবিষ্কার': 'banglar-abishkar',
};
const VERDICT_TAGS = { 'মিথ': 'myth', 'সত্য': 'true', 'আংশিক': 'partial' };

function latinSlug(s) {
  // Editors replace this with a readable Banglish slug (e.g. dudh-mach); we
  // just guarantee something unique and URL-safe.
  return 'fb-' + s;
}

function parseCaption(text = '') {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const tags = [...text.matchAll(/#([\p{L}\p{M}_0-9]+)/gu)].map((m) => m[1]);
  const sourceLine = lines.find((l) => /^সূত্র[:：]/.test(l));
  return {
    title: lines[0]?.replace(/#\S+/g, '').trim() ?? '',
    hook: lines[1] ?? '',
    body: lines.slice(2).filter((l) => l !== sourceLine && !l.startsWith('#')),
    sources: sourceLine ? sourceLine.replace(/^সূত্র[:：]\s*/, '').split(/[,،]/).map((label) => ({ label: label.trim(), url: '' })) : [],
    seriesSlug: tags.map((t) => SERIES_TAGS[t]).find(Boolean) ?? null,
    verdict: tags.map((t) => VERDICT_TAGS[t]).find(Boolean) ?? null,
    tags,
  };
}

async function graph(path) {
  const r = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}access_token=${FB_PAGE_TOKEN}`);
  if (!r.ok) throw new Error(`Graph API ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
    console.log('ℹ FB_PAGE_ID / FB_PAGE_TOKEN not set — nothing to import (this is expected in demo).');
    console.log('  Set them as build secrets (never PUBLIC_) to enable the nightly import.');
    return;
  }
  const since = Math.floor(Date.parse(SINCE + 'T00:00:00+06:00') / 1000);
  const data = await graph(`${FB_PAGE_ID}/posts?fields=id,message,created_time,permalink_url,full_picture,attachments{media_type,url}&since=${since}&limit=50`);
  const drafts = [];
  for (const p of data.data ?? []) {
    const c = parseCaption(p.message);
    if (!c.title) continue;
    const id = p.id.split('_').pop();
    const draft = {
      _status: 'needs-editor', // editor check: Bangla title, slug, alt text, series + Initiator credit
      _fb: { id: p.id, url: p.permalink_url, created: p.created_time },
      slug: latinSlug(id),
      seriesSlug: c.seriesSlug,
      format: p.attachments?.data?.[0]?.media_type === 'video' ? 'video' : 'card',
      title: c.title,
      hook: c.hook,
      body: c.body,
      sources: c.sources,
      verdict: c.verdict,
      publishedAt: p.created_time.slice(0, 10),
      fbUrl: p.permalink_url,
      image: null,
      imageAlt: '',
    };
    if (p.full_picture && !DRY) {
      const dir = join(ROOT, 'public', 'cards');
      mkdirSync(dir, { recursive: true });
      const img = await fetch(p.full_picture);
      if (img.ok) {
        const file = `${id}.jpg`;
        writeFileSync(join(dir, file), Buffer.from(await img.arrayBuffer()));
        draft.image = `/cards/${file}`;
      }
    }
    drafts.push(draft);
  }
  const outDir = join(ROOT, 'src', 'data', 'imported');
  const outFile = join(outDir, `${new Date().toISOString().slice(0, 10)}.json`);
  const prev = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : [];
  const merged = [...prev, ...drafts.filter((d) => !prev.some((x) => x._fb.id === d._fb.id))];
  console.log(`✓ ${drafts.length} post(s) since ${SINCE}; ${merged.length} draft(s) waiting for an editor`);
  if (DRY) {
    console.log(JSON.stringify(drafts.slice(0, 2), null, 2));
    return;
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`  → ${outFile}`);
  console.log('  Next: editor reviews, moves approved drafts into src/data/posts.json, runs `npm run validate:data`.');
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
