/**
 * মিথ না সত্য? season cards from /api/myths.php. Static myth library stays as the fallback below.
 * Before the first myth is out it shows the "শীঘ্রই আসছে" teaser. #m=<slug> opens a myth directly.
 */
import { useEffect, useRef, useState } from 'react';
import CardCarousel from './CardCarousel';
import { bn, shownDate, thumbProps } from './bnfmt';
import { TeaserCard, useUpcoming } from './Teaser';
import { KeyRing, OutOfKeys, UnlockPanel, celebrate, fetchKeys, shareCard, unlockItem, type KeyState } from './unlock';

interface Img { src: string; width: number; height: number; alt: string }
interface LiveMyth {
  id?: number; slug: string; claim: string; question: string; verdict: 'true' | 'myth' | 'partial';
  short: string; body: string[]; sources: { label: string; url: string }[]; images: Img[]; publishedAt: string;
  /** server: not opened by this visitor yet (content stripped) */
  locked?: boolean;
}

const SERIES = 'myth-na-sotti';

const VERDICT = {
  myth: { bn: 'মিথ', cls: 'bg-coral text-white' },
  true: { bn: 'সত্য', cls: 'bg-teal text-white' },
  partial: { bn: 'আংশিক', cls: 'bg-sun text-deep' },
} as const;

export default function LiveMyths() {
  const [items, setItems] = useState<LiveMyth[] | null>(null);
  const [open, setOpen] = useState<LiveMyth | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const upcoming = useUpcoming('myth-na-sotti', items !== null && items.length === 0);
  const [keys, setKeys] = useState<KeyState | null>(null);
  const [guess, setGuess] = useState<'myth' | 'true' | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ slug: string; right: boolean | null | undefined } | null>(null);

  useEffect(() => { void fetchKeys(SERIES).then(setKeys); }, []);

  async function doUnlock(m: LiveMyth, from: HTMLElement) {
    setBusy(true);
    const r = await unlockItem<LiveMyth>(SERIES, m.slug, guess ?? undefined);
    setBusy(false);
    if (r.state) setKeys((k) => ({ ...(k ?? r.state!), ...r.state! }));
    if (!r.item) return;
    const full = { ...r.item, locked: false };
    setItems((xs) => (xs ?? []).map((x) => (x.slug === m.slug ? full : x)));
    setOpen(full);
    setFresh({ slug: m.slug, right: r.correct });
    setGuess(null);
    celebrate(r.points, r.correct, from);
  }

  useEffect(() => {
    fetch('/api/myths.php', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!items) return;
    const m = location.hash.match(/^#m=([a-z0-9-]+)/);
    const hit = m && items.find((x) => x.slug === m[1]);
    if (hit) setOpen(hit);
  }, [items]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = (m: LiveMyth | null) => {
    setOpen(m);
    try { history.replaceState(null, '', m ? `#m=${m.slug}` : location.pathname + location.search); } catch { /* ignore */ }
  };

  if (items === null) {
    return (
      <div aria-busy="true" aria-label="মিথ লোড হচ্ছে" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[22px] bg-tint" />)}
      </div>
    );
  }
  if (!items.length) return upcoming ? <TeaserCard u={upcoming} title="মিথ না সত্য? সিজন ১: সপ্তাহে দুটো দাবি, ছবিসহ যাচাই" /> : null;

  return (
    <div>
      {keys && (
        <div className="mb-4 grid gap-3">
          <KeyRing k={keys} done={items.filter((x) => !x.locked).length} total={items.length} />
          {keys.left <= 0 && items.some((x) => x.locked) && <OutOfKeys k={keys} current={SERIES} />}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" role="list">
        {items.map((m) => {
          const v = m.locked ? null : VERDICT[m.verdict];
          const img = m.locked ? undefined : m.images?.[0];
          return (
            <li key={m.slug} className="card card-hover press overflow-hidden">
              <button type="button" className="block w-full text-left" onClick={() => show(m)}>
                <span className="relative block">
                  {img ? <img src={img.src} {...thumbProps(img.src)} width={img.width} height={img.height} alt={img.alt} loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-tint object-cover" />
                    : <span className={`grid aspect-[4/5] place-items-center p-4 text-center text-lg font-bold ${m.locked ? 'pattern-teal text-white' : 'bg-tint'}`}>“{m.claim}”</span>}
                  {v ? <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${v.cls}`}>{v.bn}</span>
                    : <span className="absolute left-2 top-2 rounded-full bg-deep/85 px-2.5 py-0.5 text-xs font-bold text-white">🔒 মিথ? / সত্য?</span>}
                  {!m.locked && (m.images?.length ?? 0) > 1 && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-deep/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur" aria-label={`${bn(m.images.length)}টি কার্ড, সোয়াইপ করুন`}>
                      <span aria-hidden="true">⇆</span>{bn(m.images.length)}টি কার্ড
                    </span>
                  )}
                </span>
                <span className="block px-3 pb-3 pt-2.5">
                  <span className="line-clamp-2 min-h-[2.75em] font-bold leading-snug">“{m.claim}”</span>
                  <span className="mt-1 block text-[.82rem] text-ink-soft">{shownDate(m.publishedAt) || 'মিথ না সত্য?'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <dialog ref={dlg} onClose={() => show(null)} aria-labelledby="lm-title"
        className="m-auto w-[min(100vw-1.5rem,44rem)] max-h-[92dvh] overflow-y-auto rounded-[26px] bg-surface p-0 text-ink shadow-2xl backdrop:bg-deep/70">
        {open && open.locked && (
          <article className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <span className="inline-block rounded-full bg-deep px-3 py-1 text-sm font-bold text-white">🔒 মিথ না সত্য?</span>
                <h2 id="lm-title" className="mt-2 text-xl font-bold leading-snug sm:text-2xl">“{open.claim}”</h2>
              </div>
              <button type="button" className="btn-icon h-11 w-11 shrink-0" aria-label="বন্ধ করুন" onClick={() => show(null)}>✕</button>
            </div>
            {open.question && open.question !== open.claim && <p className="mt-2 text-ink-soft">{open.question}</p>}
            <UnlockPanel k={keys} guess={guess} onGuess={setGuess} busy={busy} mythMode current={SERIES} onUnlock={(el) => void doUnlock(open, el)} />
          </article>
        )}
        {open && !open.locked && (
          <article className={`p-4 sm:p-6 ${fresh?.slug === open.slug ? 'bj-reveal' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${VERDICT[open.verdict].cls} ${fresh?.slug === open.slug ? 'bj-stamp' : ''}`}>রায়: {VERDICT[open.verdict].bn}</span>
                {fresh?.slug === open.slug && fresh.right !== null && fresh.right !== undefined && (
                  <span className={`bj-stamp ml-2 rounded-xl border-2 px-2 py-0.5 text-sm font-extrabold ${fresh.right ? 'border-teal text-link' : 'border-coral text-coral-dark'}`}>{fresh.right ? 'ভাবা যায়! ঠিক আন্দাজ' : 'আন্দাজ মেলেনি'}</span>
                )}
                <h2 id="lm-title" className="mt-2 text-xl font-bold leading-snug sm:text-2xl">“{open.claim}”</h2>
              </div>
              <button type="button" className="btn-icon h-11 w-11 shrink-0" aria-label="বন্ধ করুন" onClick={() => show(null)}>✕</button>
            </div>
            <p className="mt-3 text-lg font-semibold leading-relaxed">{open.short}</p>
            {open.images?.length > 0 && (
              <div className="mt-4 sm:px-16"><CardCarousel key={open.slug} images={open.images} label={open.claim} /></div>
            )}
            {open.body.slice(1).map((b, i) => <p key={i} className="mt-3 whitespace-pre-line leading-relaxed">{b}</p>)}
            <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => void shareCard(SERIES, open.slug, open.claim, `${location.origin}/myth/#m=${open.slug}`)}>শেয়ার করো</button>
            {open.sources?.length > 0 && (
              <p className="mt-5 text-sm text-ink-soft">সূত্র:{' '}
                {open.sources.map((s, i) => (
                  <span key={s.label + i}>{i > 0 && ' · '}{s.url
                    ? <a href={s.url} target="_blank" rel="noopener nofollow" className="font-semibold text-link hover:underline">{s.label}</a>
                    : <b>{s.label}</b>}</span>
                ))}
              </p>
            )}
          </article>
        )}
      </dialog>
    </div>
  );
}
