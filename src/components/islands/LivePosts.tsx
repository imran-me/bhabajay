/**
 * Real ভাবা যায়! posts from the read API (/api/posts.php), loaded in the browser.
 * The static page stays the SEO shell; this island adds the live cards.
 * If the API is unreachable or empty it renders the `empty` text (or nothing).
 * A card opens a reader dialog; the URL hash (#p=<slug>) makes it shareable.
 */
import { useEffect, useRef, useState } from 'react';
import CardCarousel from './CardCarousel';

interface Img { src: string; width: number; height: number; alt: string }
interface LivePost {
  slug: string; seriesSlug: string; title: string; hook: string; body: string[];
  sources: { label: string; url: string }[]; images: Img[]; imageCredits?: string[] | null;
  readMinutes: number; publishedAt: string;
}

import { bn, shownDate } from './bnfmt';
import { TeaserCard, UpcomingStrip, useUpcoming } from './Teaser';

export default function LivePosts({ series, limit = 24, seriesTitles = {}, empty, heading, teaserTitle, featured = false }: {
  series?: string; limit?: number; seriesTitles?: Record<string, string>; empty?: string; heading?: string; teaserTitle?: string; featured?: boolean;
}) {
  const [items, setItems] = useState<LivePost[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<LivePost | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const upcoming = useUpcoming(series, items !== null && items.length === 0);

  const load = async (offset: number) => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (series) q.set('series', series);
      if (featured) q.set('featured', '1');
      const r = await fetch(`/api/posts.php?${q}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      if (!Array.isArray(data?.items)) throw new Error('shape');
      setItems((prev) => [...(offset ? prev ?? [] : []), ...data.items]);
      setTotal(Number(data.total) || 0);
    } catch {
      setFailed(true);
      setItems((prev) => prev ?? []);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(0); }, [series]);

  // open from #p=<slug>
  useEffect(() => {
    if (!items) return;
    const m = location.hash.match(/^#p=([a-z0-9-]+)/);
    if (m) {
      const p = items.find((x) => x.slug === m[1]);
      if (p) setOpen(p);
    }
  }, [items]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = (p: LivePost | null) => {
    setOpen(p);
    try { history.replaceState(null, '', p ? `#p=${p.slug}` : location.pathname + location.search); } catch { /* ignore */ }
  };

  if (items === null) {
    return (
      <div aria-busy="true" aria-label="পোস্ট লোড হচ্ছে" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[22px] bg-tint" />)}
      </div>
    );
  }
  if (!items.length) {
    if (upcoming) return <TeaserCard u={upcoming} title={teaserTitle} />;
    if (!series && !failed) return <UpcomingStrip titles={seriesTitles} heading={heading ? 'শীঘ্রই আসছে' : undefined} />;
    return empty ? <p className="rounded-[22px] border border-dashed border-line bg-surface p-6 text-center text-ink-soft">{failed ? 'এই মুহূর্তে পোস্টগুলো আনা যাচ্ছে না। একটু পরে আবার দেখুন।' : empty}</p> : null;
  }

  return (
    <div>
      {heading && <h2 className="mb-4 text-2xl font-bold">{heading}</h2>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" role="list">
        {items.map((p) => {
          const img = p.images?.[0];
          return (
            <li key={p.seriesSlug + p.slug} className="card card-hover press overflow-hidden">
              <button type="button" onClick={() => show(p)} className="block w-full text-left focus-visible:outline-none">
                <span className="relative block">
                {img ? (
                  <img src={img.src} width={img.width} height={img.height} alt={img.alt} loading="lazy" decoding="async"
                    className="aspect-[4/5] w-full bg-tint object-cover" />
                ) : (
                  <span className="grid aspect-[4/5] place-items-center bg-tint p-4 text-center text-lg font-bold text-ink">{p.title}</span>
                )}
                  {(p.images?.length ?? 0) > 1 && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-deep/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur" aria-label={`${bn(p.images.length)}টি কার্ড, সোয়াইপ করুন`}>
                      <span aria-hidden="true">⇆</span>{bn(p.images.length)}টি কার্ড
                    </span>
                  )}
                </span>
                <span className="block px-3 pb-3 pt-2.5">
                  <span className="line-clamp-2 min-h-[2.75em] font-bold leading-snug">{p.title}</span>
                  <span className="mt-1 block truncate text-[.82rem] text-ink-soft">
                    {[seriesTitles[p.seriesSlug], shownDate(p.publishedAt)].filter(Boolean).join(' · ') || `${bn(p.readMinutes)} মিনিটে পড়া`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {items.length < total && (
        <div className="mt-6 text-center">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => load(items.length)}>
            {busy ? 'আনছি…' : 'আরও দেখুন'}
          </button>
        </div>
      )}

      <dialog ref={dlg} onClose={() => show(null)} aria-labelledby="lp-title"
        className="m-auto w-[min(100vw-1.5rem,44rem)] max-h-[92vh] overflow-y-auto rounded-[26px] bg-surface p-0 text-ink shadow-2xl backdrop:bg-deep/70">
        {open && (
          <article className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <h2 id="lp-title" className="flex-1 text-xl font-bold leading-snug sm:text-2xl">{open.title}</h2>
              <button type="button" className="btn-icon h-10 w-10 shrink-0" aria-label="বন্ধ করুন" onClick={() => show(null)}>✕</button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{shownDate(open.publishedAt) && `${shownDate(open.publishedAt)} · `}{bn(open.readMinutes)} মিনিটে পড়া</p>
            {open.images?.length > 0 && (
              <div className="mt-4 sm:px-16"><CardCarousel key={open.slug} images={open.images} label={open.title} /></div>
            )}
            <p className="mt-5 text-lg font-semibold leading-relaxed">{open.hook}</p>
            {open.body.filter((b) => b !== open.hook).map((b, i) => (
              <p key={i} className="mt-3 whitespace-pre-line leading-relaxed">{b}</p>
            ))}
            {open.sources?.length > 0 && (
              <p className="mt-5 text-sm text-ink-soft">
                সূত্র:{' '}
                {open.sources.map((s, i) => (
                  <span key={s.label + i}>{i > 0 && ' · '}{s.url ? <a href={s.url} target="_blank" rel="noopener nofollow" className="font-semibold text-link underline-offset-2 hover:underline">{s.label}</a> : <b>{s.label}</b>}</span>
                ))}
              </p>
            )}
            {open.imageCredits && open.imageCredits.length > 0 && (
              <p className="mt-2 text-xs text-ink-soft">ছবি: {open.imageCredits.join(' · ').replace(/^- ?/, '')}</p>
            )}
          </article>
        )}
      </dialog>
    </div>
  );
}
