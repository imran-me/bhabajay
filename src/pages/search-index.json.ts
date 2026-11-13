/**
 * Static search index (built once, fetched lazily by /search). Our own
 * Bangla normaliser (src/lib/search.ts) handles spelling variants and
 * Banglish, which generic static-search stemmers don't do for Bengali.
 */
import type { APIRoute } from 'astro';
import type { SearchDoc } from '../lib/search';
import { myths, posts, liveEpisodes, series, quizzes, wallPeople, kits, asks, getSeries, displayName } from '../lib/content';
import { TIER_LABEL } from '../lib/bn';

export const GET: APIRoute = () => {
  const docs: SearchDoc[] = [
    ...myths.map((m) => ({ id: `m-${m.slug}`, type: 'myth' as const, title: m.question, extra: `${m.claim} ${m.aliases.join(' ')}`, url: `/myth/${m.slug}`, text: `${m.short} ${m.body.join(' ')}`, meta: { verdict: m.verdict } })),
    ...posts.map((p) => ({ id: `p-${p.slug}`, type: 'post' as const, title: p.title, url: `/series/${p.seriesSlug}/${p.slug}`, text: `${p.hook} ${p.body.join(' ')}`, meta: { series: getSeries(p.seriesSlug)?.title ?? '' } })),
    ...liveEpisodes.map((e) => ({ id: `e-${e.slug}`, type: 'episode' as const, title: `পর্ব ${e.number}: ${e.title}`, url: `/bhabur-duniya/${e.slug}`, text: `${e.summary} ${e.facts.join(' ')}` })),
    ...series.map((s) => ({ id: `s-${s.slug}`, type: 'series' as const, title: s.title, extra: s.subject, url: s.kind === 'cartoon' ? '/bhabur-duniya' : `/series/${s.slug}`, text: `${s.tagline} ${s.description}` })),
    ...quizzes.filter((q) => q.kind !== 'secret' && q.kind !== 'episode').map((q) => ({ id: `q-${q.slug}`, type: 'quiz' as const, title: q.title, url: q.kind === 'weekly' ? `/quiz/${q.slug}` : `/quiz/${q.slug}`, text: q.blurb })),
    ...wallPeople.map((p) => ({ id: `u-${p.username}`, type: 'person' as const, title: displayName(p), extra: TIER_LABEL[p.tier].bn, url: `/u/${p.username}`, text: `${p.bio} ${p.originalQuestion ?? ''}` })),
    ...kits.map((k) => ({ id: `k-${k.slug}`, type: 'kit' as const, title: k.title, extra: k.grades, url: `/teachers/${k.slug}`, text: k.summary })),
    ...asks.map((a) => ({ id: `a-${a.id}`, type: 'ask' as const, title: a.q, url: '/ask', text: a.a })),
    { id: 'pg-initiator', type: 'page', title: 'ইনিশিয়েটর হও', extra: 'পিচ আইডিয়া সিরিজ initiator pitch', url: '/initiator', text: 'প্রশ্ন যার সিরিজ তার মেন্টর ক্রেডিট' },
    { id: 'pg-privacy', type: 'page', title: 'গোপনীয়তা ও অভিভাবক', extra: 'privacy', url: '/privacy', text: 'ডেটা মুছে দাও অভিভাবক কিশোর নিরাপত্তা' },
    { id: 'pg-id', type: 'page', title: 'ভাবা যায় আইডি', extra: 'login sign up লগ ইন', url: '/id', text: 'সাইন আপ অ্যাকাউন্ট' },
  ];
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
