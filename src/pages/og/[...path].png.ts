import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgPng, type OgSpec } from '../../lib/og';
import { myths, posts, liveEpisodes, series, people, getSeries, displayName } from '../../lib/content';
import { bn, TIER_LABEL } from '../../lib/bn';

export const getStaticPaths: GetStaticPaths = () => {
  const out: { params: { path: string }; props: OgSpec }[] = [
    { params: { path: 'default' }, props: { eyebrow: 'কৌতূহলী বাংলাদেশের ঘর', title: 'প্রশ্ন যার, সিরিজ তার। ভাবা যায়!', line: 'মজার বিজ্ঞান, মিথ না সত্য, কুইজ আর তোমার নিজের সিরিজ।', theme: 'teal', face: 'wow' } },
    ...myths.map((m) => ({ params: { path: `myth/${m.slug}` }, props: { eyebrow: 'মিথ না সত্য?', title: m.question, line: m.short, verdict: m.verdict } as OgSpec })),
    ...posts.map((p) => ({ params: { path: `post/${p.slug}` }, props: { eyebrow: getSeries(p.seriesSlug)?.title ?? 'সিরিজ', title: p.title, line: p.hook } as OgSpec })),
    ...liveEpisodes.map((e) => ({ params: { path: `episode/${e.slug}` }, props: { eyebrow: `ভাবুর দুনিয়া · পর্ব ${bn(e.number)}`, title: e.title, line: `${e.duration} মিনিট · দেখো, তারপর ৩ প্রশ্নের কুইজ`, theme: 'teal', face: 'wow' } as OgSpec })),
    ...series.map((s) => ({ params: { path: `series/${s.slug}` }, props: { eyebrow: `সিরিজ · ${s.subject}`, title: s.title, line: s.tagline, theme: s.kind === 'cartoon' ? 'teal' : 'warm', face: 'grin' } as OgSpec })),
    ...people.filter((p) => p.id !== 'core').map((p) => ({ params: { path: `person/${p.username}` }, props: { eyebrow: `ভাবা যায়! ${TIER_LABEL[p.tier].bn}`, title: displayName(p), line: p.originalQuestion ? `“${p.originalQuestion}”` : p.bio, theme: 'teal', face: 'happy' } as OgSpec })),
  ];
  return out;
};

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOgPng(props as OgSpec)), { headers: { 'Content-Type': 'image/png' } });
