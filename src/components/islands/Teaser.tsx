/**
 * "শীঘ্রই আসছে" teaser for a series whose posts are scheduled but not yet out.
 * Shows only the date and a blurred first card; the text stays unpublished.
 */
import { useEffect, useState } from 'react';
import { bn, bnDate } from './bnfmt';

export interface Upcoming {
  series: string;
  nextDate: string | null;
  upcoming?: number;
  preview?: { src: string | null; width: number | null; height: number | null } | null;
}

export function useUpcoming(series?: string, enabled = true) {
  const [data, setData] = useState<Upcoming | null>(null);
  useEffect(() => {
    if (!enabled || !series) return;
    let alive = true;
    fetch(`/api/upcoming.php?series=${encodeURIComponent(series)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.nextDate) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [series, enabled]);
  return data;
}

export function TeaserCard({ u, title, compact = false }: { u: Upcoming; title?: string; compact?: boolean }) {
  if (!u.nextDate) return null;
  const src = u.preview?.src;
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-deep text-white shadow-[var(--shadow-lift)] ${compact ? '' : 'sm:flex'}`}>
      <div className={`relative overflow-hidden bg-teal ${compact ? 'aspect-[4/5]' : 'aspect-[4/5] sm:w-64 sm:shrink-0'}`} aria-hidden="true">
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full scale-110 object-cover opacity-80 blur-[14px]" />}
        <span className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-deep shadow">🔒 {bnDate(u.nextDate)}</span>
        </span>
      </div>
      <div className="p-5">
        <p className="inline-block rounded-full bg-sun px-3 py-1 text-sm font-bold text-deep">শীঘ্রই আসছে</p>
        {title && <p className="mt-3 text-xl font-bold leading-snug">{title}</p>}
        <p className="mt-2 leading-relaxed text-white/85">
          প্রথম পোস্ট খুলবে <b className="text-sun">{bnDate(u.nextDate)}</b>, বিকেলে।
          {u.upcoming ? <> এই সিজনে আসছে মোট {bn(u.upcoming)}টি পোস্ট, প্রতি সপ্তাহে নতুন।</> : null}
        </p>
        <p className="mt-2 text-sm text-white/65">ছবিটা ঝাপসা রাখা হয়েছে, উত্তরটা যেন আগেভাগে ফাঁস না হয়।</p>
      </div>
    </div>
  );
}

/** Row of upcoming series (all series), used when nothing is published yet. */
export function UpcomingStrip({ titles = {}, heading }: { titles?: Record<string, string>; heading?: string }) {
  const [list, setList] = useState<Upcoming[] | null>(null);
  useEffect(() => {
    fetch('/api/upcoming.php', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d.filter((x: Upcoming) => x.nextDate) : []))
      .catch(() => setList([]));
  }, []);
  if (!list || !list.length) return null;
  return (
    <div>
      {heading && <h2 className="mb-1 text-2xl font-bold">{heading}</h2>}
      <p className="mb-4 text-ink-soft">নতুন সিজন শুরু হচ্ছে। কোন সিরিজের প্রথম পোস্ট কবে খুলবে, দেখে নিন।</p>
      <ul className="swipe" role="list">
        {list.map((u) => {
          const href = u.series === 'myth-na-sotti' ? '/myth' : `/series/${u.series}`;
          const name = u.series === 'myth-na-sotti' ? 'মিথ না সত্য?' : titles[u.series] ?? u.series;
          return (
            <li key={u.series} className="w-[11.5rem] shrink-0 sm:w-[13rem]">
              <a href={href} className="card press block overflow-hidden">
                <span className="relative block aspect-[4/5] overflow-hidden bg-teal" aria-hidden="true">
                  {u.preview?.src && <img src={u.preview.src} alt="" loading="lazy" decoding="async" className="h-full w-full scale-110 object-cover opacity-85 blur-[12px]" />}
                  <span className="absolute left-2 top-2 rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-deep">শীঘ্রই আসছে</span>
                </span>
                <span className="block px-3 pb-3 pt-2.5">
                  <span className="block font-bold leading-snug">{name}</span>
                  <span className="mt-0.5 block text-[.85rem] text-ink-soft">প্রথম পোস্ট {bnDate(u.nextDate!)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
