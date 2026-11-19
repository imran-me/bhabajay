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
  /** server: not opened by this visitor yet (content stripped) */
  locked?: boolean;
}

import { bn, shownDate } from './bnfmt';
import { TeaserCard, UpcomingStrip, useUpcoming } from './Teaser';
import { KeyRing, OutOfKeys, UnlockPanel, celebrate, fetchKeys, shareCard, unlockItem, type KeyState } from './unlock';

interface Mystery { seriesSlug: string; slug: string; title: string; image?: Img | null }

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
  const [keys, setKeys] = useState<Record<string, KeyState | null>>({});
  const [unlocking, setUnlocking] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [mystery, setMystery] = useState<Mystery | null>(null);

  const loadKeys = (s: string) => void fetchKeys(s).then((k) => setKeys((x) => ({ ...x, [s]: k })));
  useEffect(() => { if (series) loadKeys(series); }, [series]);
  useEffect(() => {
    if (!featured) return;
    fetch('/api/unlock.php?mystery=1', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((d) => setMystery(d?.mystery ?? null)).catch(() => {});
  }, [featured]);
  useEffect(() => { if (open?.locked && keys[open.seriesSlug] === undefined) loadKeys(open.seriesSlug); }, [open]);

  async function doUnlock(p: LivePost, from: HTMLElement) {
    setUnlocking(true);
    const r = await unlockItem<LivePost>(p.seriesSlug, p.slug);
    setUnlocking(false);
    if (r.state) setKeys((x) => ({ ...x, [p.seriesSlug]: { ...(x[p.seriesSlug] ?? r.state!), ...r.state! } }));
    if (!r.item) return;
    const full = { ...r.item, locked: false };
    setItems((xs) => (xs ?? []).map((x) => (x.slug === p.slug && x.seriesSlug === p.seriesSlug ? full : x)));
    setOpen(full);
    setFresh(p.slug);
    celebrate(r.points, r.mystery || null, from);
  }

  /** open the mystery card even if it is not in this list */
  async function openMystery(m: Mystery) {
    const hit = items?.find((x) => x.slug === m.slug && x.seriesSlug === m.seriesSlug);
    if (hit) return show(hit);
    try {
      const r = await fetch(`/api/posts.php?series=${m.seriesSlug}&slug=${m.slug}`, { credentials: 'same-origin' });
      if (r.ok) show((await r.json()) as LivePost);
    } catch { /* ignore */ }
  }

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
      {mystery && (
        <button type="button" onClick={() => void openMystery(mystery)} className="card card-hover press mb-4 flex w-full items-center gap-3 overflow-hidden p-3 text-left">
          {mystery.image ? <img src={mystery.image.src} alt="" width={64} height={80} className="h-20 w-16 shrink-0 rounded-xl object-cover blur-[3px]" /> : <span className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-tint text-3xl">❓</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-coral-dark dark:text-coral">আজকের রহস্য · দ্বিগুণ পয়েন্ট</span>
            <span className="line-clamp-2 font-bold leading-snug">{mystery.title}</span>
          </span>
          <span className="shrink-0 text-2xl" aria-hidden="true">🔑</span>
        </button>
      )}
      {series && keys[series] && (
        <div className="mb-4 grid gap-3">
          <KeyRing k={keys[series]!} done={items.filter((x) => !x.locked).length} total={total} />
          {keys[series]!.left <= 0 && items.some((x) => x.locked) && <OutOfKeys k={keys[series]!} current={series} />}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" role="list">
        {items.map((p) => {
          const img = p.images?.[0];
          const lockedCls = p.locked ? ' brightness-[.55] blur-[2px]' : '';
          return (
            <li key={p.seriesSlug + p.slug} className="card card-hover press overflow-hidden">
              <button type="button" onClick={() => show(p)} className="block w-full text-left focus-visible:outline-none">
                <span className="relative block">
                {img ? (
                  <img src={img.src} width={img.width} height={img.height} alt={img.alt} loading="lazy" decoding="async"
                    className={`aspect-[4/5] w-full bg-tint object-cover${lockedCls}`} />
                ) : (
                  <span className="grid aspect-[4/5] place-items-center bg-tint p-4 text-center text-lg font-bold text-ink">{p.title}</span>
                )}
                  {p.locked && <span className="absolute inset-0 grid place-items-center text-4xl" aria-label="লক করা — চাবি দিয়ে খোলো">🔒</span>}
                  {!p.locked && (p.images?.length ?? 0) > 1 && (
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
        {open && open.locked && (
          <article className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <h2 id="lp-title" className="flex-1 text-xl font-bold leading-snug sm:text-2xl">🔒 {open.title}</h2>
              <button type="button" className="btn-icon h-11 w-11 shrink-0" aria-label="বন্ধ করুন" onClick={() => show(null)}>✕</button>
            </div>
            {open.images?.[0] && <img src={open.images[0].src} alt="" width={open.images[0].width} height={open.images[0].height} className="mx-auto mt-4 max-h-64 w-auto rounded-[18px] blur-[3px] brightness-75" />}
            <UnlockPanel k={keys[open.seriesSlug] ?? null} guess={null} onGuess={() => {}} busy={unlocking} current={open.seriesSlug} onUnlock={(el) => void doUnlock(open, el)} />
          </article>
        )}
        {open && !open.locked && (
          <article className={`p-4 sm:p-6 ${fresh === open.slug ? 'bj-reveal' : ''}`}>
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
            <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => void shareCard(open.seriesSlug, open.slug, open.title, `${location.origin}/series/${open.seriesSlug}#p=${open.slug}`)}>শেয়ার করো</button>
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
