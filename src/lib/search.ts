/**
 * Bangla-aware fuzzy search.
 *
 * People arrive with a sentence their uncle said, typed on a phone keyboard
 * with whatever spelling it produced. We normalise both the query and the
 * index so that common variants match:
 *   য় (precomposed) ≡ য + ় ; ড়/ঢ় likewise
 *   শ/ষ/স → স, ণ → ন, ী → ি, ূ → ু, ঙ/ং → ং, ঁ dropped, ৎ → ত
 *   hasanta (্) and ZWJ/ZWNJ dropped, Bangla digits → ASCII
 * Banglish aliases ("dudh mach") are indexed alongside.
 */
import { toAsciiDigits } from './bn';

const MAP: [RegExp, string][] = [
  [/য়/g, 'য'], // য়
  [/ড়/g, 'ড'], // ড়
  [/ঢ়/g, 'ঢ'], // ঢ়
  [/়/g, ''], // nukta
  [/[শষ]/g, 'স'],
  [/ণ/g, 'ন'],
  [/ী/g, 'ি'],
  [/ূ/g, 'ু'],
  [/ঈ/g, 'ই'],
  [/ঊ/g, 'উ'],
  [/ঙ/g, 'ং'],
  [/ঁ/g, ''],
  [/ৎ/g, 'ত'],
  [/[্‌‍]/g, ''], // hasanta, ZWNJ, ZWJ
  [/ৈ/g, 'ই'],
  [/ৌ/g, 'উ'],
  [/জ|য/g, 'জ'],
  [/[।,.!?;:'"“”‘’()\-–—]/g, ' '],
];

export function normalizeBn(input: string): string {
  let s = input.normalize('NFC').toLowerCase();
  s = toAsciiDigits(s);
  for (const [re, rep] of MAP) s = s.replace(re, rep);
  // romanised Banglish: collapse doubled letters + common vowel swaps
  s = s.replace(/([a-z])\1+/g, '$1').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/w/g, 'o');
  return s.replace(/\s+/g, ' ').trim();
}

// Particles that add noise ("কি", "কেন", "আর"...). Kept short on purpose.
const STOP = new Set(['কি', 'কেন', 'আর', 'এবং', 'যে', 'এর', 'তে', 'হয়', 'হজ', 'কো', 'ki', 'keno', 'ar', 'the', 'is', 'a']);

export function tokens(input: string): string[] {
  return normalizeBn(input)
    .split(' ')
    .filter((t) => t.length > 0 && !STOP.has(t));
}

export interface SearchDoc {
  id: string;
  type: 'myth' | 'post' | 'episode' | 'series' | 'quiz' | 'person' | 'kit' | 'ask' | 'page';
  title: string;
  url: string;
  text: string;
  extra?: string;
  meta?: Record<string, string>;
}

interface Indexed { doc: SearchDoc; title: string; body: string }

export function buildIndex(docs: SearchDoc[]): Indexed[] {
  return docs.map((doc) => ({
    doc,
    title: normalizeBn(doc.title + ' ' + (doc.extra ?? '')),
    body: normalizeBn(doc.text),
  }));
}

/** Score = token hits (title ×3) + prefix/fuzzy partial matches. */
export function search(index: Indexed[], query: string, limit = 30): SearchDoc[] {
  const qt = tokens(query);
  if (!qt.length) return [];
  const scored: { doc: SearchDoc; score: number }[] = [];
  for (const item of index) {
    let score = 0;
    let matched = 0;
    for (const t of qt) {
      let hit = 0;
      if (item.title.includes(t)) hit += 3;
      else if (item.body.includes(t)) hit += 1;
      else if (t.length >= 3) {
        // fuzzy: allow the token minus its last char (inflections: মাছে → মাছ)
        const stem = t.slice(0, Math.max(2, t.length - 1));
        if (item.title.includes(stem)) hit += 1.5;
        else if (item.body.includes(stem)) hit += 0.5;
      }
      if (hit > 0) matched++;
      score += hit;
    }
    if (matched === 0) continue;
    // reward documents that match more of the query
    score *= 0.5 + matched / qt.length;
    if (item.title.includes(normalizeBn(query))) score += 4;
    scored.push({ doc: item.doc, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.doc);
}
