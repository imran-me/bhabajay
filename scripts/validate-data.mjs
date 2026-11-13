#!/usr/bin/env node
/**
 * Validates src/data/*.json against the contract in src/data/types.ts.
 * Run: npm run validate:data
 * Exits 1 on any error so CI / the import script can block a bad publish.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const errors = [];
const warn = [];

const TOPICS = ['food', 'health', 'nature', 'space', 'chemistry', 'biology', 'physics', 'body', 'history', 'tech'];
const DOODLES = ['atom', 'bulb', 'butterfly', 'dna', 'drop', 'eye', 'fish', 'leaf', 'moon', 'paw', 'planet', 'sparkle', 'mosquito', 'flask', 'heart', 'bolt', 'frog', 'pot', 'telescope', 'book'];
const BGS = ['teal', 'coral', 'sun', 'mint', 'deep'];

function load(name, optional = false) {
  const p = join(root, name);
  if (!existsSync(p)) {
    if (!optional) errors.push(`${name}: missing`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${name}: invalid JSON — ${e.message}`);
    return null;
  }
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isDate = (v) => isStr(v) && !Number.isNaN(Date.parse(v));
function need(cond, msg) { if (!cond) errors.push(msg); }
function sources(where, arr) {
  need(Array.isArray(arr) && arr.length > 0, `${where}: needs ≥1 source`);
  (arr || []).forEach((s, i) => {
    need(isStr(s?.label), `${where}.sources[${i}].label`);
    need(isStr(s?.url) && /^https:\/\//.test(s.url), `${where}.sources[${i}].url must be https`);
  });
}
function uniq(where, list, key) {
  const seen = new Set();
  for (const item of list) {
    const k = item?.[key];
    if (seen.has(k)) errors.push(`${where}: duplicate ${key} "${k}"`);
    seen.add(k);
  }
}

/* series / people first so references can be checked */
const series = load('series.json') || [];
const people = load('people.json') || [];
const mentors = load('mentors.json') || [];
const seriesSlugs = new Set(series.map((s) => s.slug));
const personIds = new Set(people.map((p) => p.id));
const mentorIds = new Set(mentors.map((m) => m.id));

uniq('series.json', series, 'slug');
series.forEach((s) => {
  const w = `series:${s.slug}`;
  ['slug', 'title', 'tagline', 'subject', 'ownerId', 'description'].forEach((k) => need(isStr(s[k]), `${w}.${k}`));
  need(TOPICS.includes(s.topic), `${w}.topic`);
  need(DOODLES.includes(s.doodle), `${w}.doodle`);
  need(personIds.has(s.ownerId), `${w}.ownerId "${s.ownerId}" not in people.json`);
  (s.team || []).forEach((t) => need(personIds.has(t), `${w}.team "${t}" unknown`));
  if (s.mentorId) need(mentorIds.has(s.mentorId), `${w}.mentorId unknown`);
});

uniq('people.json', people, 'id');
uniq('people.json', people, 'username');
people.forEach((p) => {
  const w = `person:${p.id}`;
  need(['curious', 'explorer', 'initiator', 'legend'].includes(p.tier), `${w}.tier`);
  need(['teen', 'adult'].includes(p.ageBand), `${w}.ageBand`);
  if (p.ageBand === 'teen') {
    need(!p.realName, `${w}: teens must not expose realName`);
    need(!p.district, `${w}: teens must not expose district`);
  }
  if (p.seriesSlug) need(seriesSlugs.has(p.seriesSlug), `${w}.seriesSlug unknown`);
});

/* myths */
const myths = load('myths.json') || [];
uniq('myths.json', myths, 'id');
uniq('myths.json', myths, 'slug');
myths.forEach((m) => {
  const w = `myth:${m.slug}`;
  need(Number.isInteger(m.id), `${w}.id integer`);
  need(/^[a-z0-9-]+$/.test(m.slug || ''), `${w}.slug latin-kebab`);
  ['claim', 'question', 'short'].forEach((k) => need(isStr(m[k]), `${w}.${k}`));
  need(['true', 'myth', 'partial'].includes(m.verdict), `${w}.verdict`);
  need(['food', 'health', 'nature', 'space'].includes(m.topic), `${w}.topic`);
  need(Array.isArray(m.body) && m.body.length >= 2, `${w}.body ≥2 paragraphs`);
  need(Array.isArray(m.faq) && m.faq.length >= 2, `${w}.faq ≥2`);
  need(Array.isArray(m.aliases) && m.aliases.length >= 1, `${w}.aliases`);
  if (m.fridayDate) need(new Date(m.fridayDate + 'T12:00:00Z').getUTCDay() === 5, `${w}.fridayDate must be a Friday`);
  if ((m.short || '').length > 110) warn.push(`${w}.short is long (${m.short.length})`);
  sources(w, m.sources);
});

/* quizzes */
const quizzes = load('quizzes.json') || [];
uniq('quizzes.json', quizzes, 'slug');
const allQ = [];
quizzes.forEach((z) => {
  const w = `quiz:${z.slug}`;
  need(['weekly', 'episode', 'initiator', 'pool', 'secret'].includes(z.kind), `${w}.kind`);
  need(isStr(z.title) && isStr(z.blurb), `${w}.title/blurb`);
  need(Number.isInteger(z.secondsPerQuestion) && z.secondsPerQuestion >= 5, `${w}.secondsPerQuestion`);
  if (z.kind === 'weekly') {
    need(isDate(z.opensAt) && /\+06:00$/.test(z.opensAt), `${w}.opensAt ISO +06:00`);
    if (isDate(z.opensAt)) {
      const d = new Date(z.opensAt);
      const dhaka = new Date(d.getTime() + 6 * 3600e3);
      need(dhaka.getUTCDay() === 6 && dhaka.getUTCHours() === 20, `${w}.opensAt must be Saturday 20:00 Dhaka`);
    }
    need(z.questions?.length === 5, `${w}: weekly quiz needs 5 questions`);
  }
  if (z.kind === 'episode') need(z.questions?.length === 3, `${w}: episode quiz needs 3 questions`);
  if (z.kind === 'pool') need(z.questions?.length >= 25, `${w}: pool needs ≥25 questions`);
  if (z.seriesSlug) need(seriesSlugs.has(z.seriesSlug), `${w}.seriesSlug unknown`);
  (z.questions || []).forEach((q, i) => {
    const qw = `${w}.q[${i}]`;
    need(isStr(q.id), `${qw}.id`);
    allQ.push(q.id);
    need(isStr(q.q), `${qw}.q`);
    need(Array.isArray(q.options) && q.options.length === 4 && q.options.every(isStr), `${qw}.options x4`);
    need([0, 1, 2, 3].includes(q.answer), `${qw}.answer 0-3`);
    need(isStr(q.fact), `${qw}.fact`);
    if (q.options && new Set(q.options).size !== 4) errors.push(`${qw}: duplicate options`);
  });
});
{
  const seen = new Set();
  allQ.forEach((id) => { if (seen.has(id)) errors.push(`quizzes: duplicate question id ${id}`); seen.add(id); });
}
const quizSlugs = new Set(quizzes.map((q) => q.slug));

/* thoughts / facts */
const thoughts = load('thoughts.json') || [];
uniq('thoughts.json', thoughts, 'id');
thoughts.forEach((t) => {
  need(isStr(t.q) && isStr(t.a), `thought:${t.id} q/a`);
  need(TOPICS.includes(t.topic), `thought:${t.id}.topic`);
});
const facts = load('facts.json') || [];
uniq('facts.json', facts, 'id');
facts.forEach((f) => {
  need(isStr(f.text), `fact:${f.id}.text`);
  need(TOPICS.includes(f.topic), `fact:${f.id}.topic`);
});

/* posts */
const posts = load('posts.json') || [];
uniq('posts.json', posts, 'slug');
posts.forEach((p) => {
  const w = `post:${p.slug}`;
  need(/^[a-z0-9-]+$/.test(p.slug || ''), `${w}.slug latin-kebab`);
  need(seriesSlugs.has(p.seriesSlug), `${w}.seriesSlug "${p.seriesSlug}" unknown`);
  need(['card', 'video', 'blog'].includes(p.format), `${w}.format`);
  need(isStr(p.title) && isStr(p.hook), `${w}.title/hook`);
  need(Array.isArray(p.body) && p.body.length >= 1, `${w}.body`);
  need(isDate(p.publishedAt), `${w}.publishedAt`);
  need(TOPICS.includes(p.topic), `${w}.topic`);
  need(DOODLES.includes(p.art?.doodle) && BGS.includes(p.art?.bg), `${w}.art`);
  sources(w, p.sources);
});

/* episodes */
const episodes = load('episodes.json') || [];
uniq('episodes.json', episodes, 'slug');
episodes.forEach((e) => {
  const w = `episode:${e.slug}`;
  need(Array.isArray(e.facts) && e.facts.length === 3, `${w}.facts x3`);
  if (!e.comingSoon) {
    need(quizSlugs.has(e.quizSlug), `${w}.quizSlug "${e.quizSlug}" not in quizzes.json`);
    need(Array.isArray(e.beats) && e.beats.length >= 6, `${w}.beats ≥6`);
  }
});

/* ask, kits, schools */
const ask = load('ask.json') || [];
uniq('ask.json', ask, 'id');
ask.forEach((a) => need(isStr(a.q) && isStr(a.a), `ask:${a.id}`));
const kits = load('kits.json') || [];
uniq('kits.json', kits, 'slug');
kits.forEach((k) => {
  if (k.quizSlug) need(quizSlugs.has(k.quizSlug), `kit:${k.slug}.quizSlug unknown`);
});
load('schools.json');

if (warn.length) console.warn(`⚠ ${warn.length} warning(s):\n  ` + warn.join('\n  '));
if (errors.length) {
  console.error(`✗ ${errors.length} error(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ data ok — ${myths.length} myths, ${quizzes.length} quizzes (${allQ.length} questions), ${posts.length} posts, ${episodes.length} episodes, ${thoughts.length} thoughts, ${facts.length} facts, ${ask.length} ask, ${kits.length} kits`);
