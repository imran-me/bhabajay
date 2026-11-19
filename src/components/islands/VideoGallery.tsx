/**
 * Video grid + player modal. Posters/durations/category chips in the grid; a tap
 * opens a 9:16-friendly player with sound (the tap is the user gesture), with
 * swipe, arrow buttons and ←/→ to move between videos. Files are in /media/video/.
 */
import { useEffect, useRef, useState } from 'react';
import { bn } from './bnfmt';

export interface Video { slug: string; title: string; category: 'cartoon' | 'reel' | 'rhyme'; src: string; poster: string; seconds: number }

const CAT = {
  cartoon: { bn: 'ভাবুর দুনিয়া', cls: 'bg-coral text-white' },
  reel: { bn: 'ফ্যাক্ট রিল', cls: 'bg-teal text-white' },
  rhyme: { bn: 'ভাবুর ছড়া', cls: 'bg-sun text-deep' },
} as const;
const dur = (s: number) => `${bn(Math.floor(s / 60))}:${bn(String(s % 60).padStart(2, '0'))}`;

export default function VideoGallery({ videos, limit, filters = true }: { videos: Video[]; limit?: number; filters?: boolean }) {
  const [cat, setCat] = useState<'all' | Video['category']>('all');
  const [open, setOpen] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const touch = useRef<number | null>(null);
  const list = videos.filter((v) => cat === 'all' || v.category === cat);
  const shown = limit ? list.slice(0, limit) : list;

  useEffect(() => {
    const m = location.hash.match(/^#v=([a-z0-9-]+)/);
    if (m) { const k = list.findIndex((v) => v.slug === m[1]); if (k >= 0) setOpen(k); }
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
    if (open !== null) {
      try { history.replaceState(null, '', `#v=${list[open].slug}`); } catch { /* ignore */ }
      const v = vid.current;
      if (v) { v.load(); const p = v.play(); if (p) p.catch(() => {}); }
    }
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open]);

  const step = (d: number) => setOpen((k) => (k === null ? k : Math.max(0, Math.min(list.length - 1, k + d))));
  const close = () => {
    vid.current?.pause();
    setOpen(null);
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  };
  const cur = open !== null ? list[open] : null;
  const arrow = 'grid h-12 w-12 shrink-0 place-items-center rounded-full text-3xl font-bold leading-none shadow-lg transition-transform active:scale-90 disabled:pointer-events-none disabled:opacity-0';

  return (
    <div>
      {filters && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="ধরন অনুযায়ী ছাঁকো">
          {(['all', 'cartoon', 'reel', 'rhyme'] as const).map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'সব' : CAT[c].bn}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" role="list">
        {shown.map((v, k) => (
          <li key={v.slug} className="card card-hover press overflow-hidden">
            <button type="button" className="block w-full text-left" onClick={() => setOpen(list.indexOf(v))} aria-label={`${v.title} — ভিডিও চালান`}>
              <span className="relative block aspect-[9/16] bg-deep">
                <img src={v.poster} width={540} height={960} alt="" loading={k < 4 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 pl-1 text-2xl text-coral shadow-lg">▶</span>
                </span>
                <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${CAT[v.category].cls}`}>{CAT[v.category].bn}</span>
                <span className="absolute bottom-2 right-2 rounded-md bg-deep/85 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">{dur(v.seconds)}</span>
              </span>
              <span className="line-clamp-2 min-h-[2.75em] px-3 pb-3 pt-2.5 font-bold leading-snug">{v.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dlg} onClose={close} aria-label={cur?.title ?? 'ভিডিও'}
        className="m-auto max-h-[100dvh] w-full max-w-[100vw] bg-transparent p-0 text-white backdrop:bg-deep/90 sm:w-auto">
        {cur && (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 px-2 py-3"
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touch.current === null) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              touch.current = null;
              if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
            }}>
            <div className="flex w-full max-w-[min(100vw,calc((100dvh-9rem)*9/16+8rem))] items-start gap-2">
              <p className="flex-1 text-lg font-bold leading-snug">{cur.title}</p>
              <button type="button" onClick={close} aria-label="বন্ধ করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-xl">✕</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={`${arrow} hidden bg-white text-teal sm:grid`} onClick={() => step(-1)} disabled={open === 0} aria-label="আগের ভিডিও">‹</button>
              <video ref={vid} key={cur.slug} src={cur.src} poster={cur.poster} controls playsInline autoPlay
                className="aspect-[9/16] max-h-[calc(100dvh-9rem)] w-[min(100vw-1rem,calc((100dvh-9rem)*9/16))] rounded-[18px] bg-black object-contain" />
              <button type="button" className={`${arrow} hidden bg-coral text-white sm:grid`} onClick={() => step(1)} disabled={open === list.length - 1} aria-label="পরের ভিডিও">›</button>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className={`${arrow} bg-white text-teal sm:hidden`} onClick={() => step(-1)} disabled={open === 0} aria-label="আগের ভিডিও">‹</button>
              <span className="min-w-[3.5rem] text-center text-sm font-bold tabular-nums">{bn((open ?? 0) + 1)}/{bn(list.length)}</span>
              <button type="button" className={`${arrow} bg-coral text-white sm:hidden`} onClick={() => step(1)} disabled={open === list.length - 1} aria-label="পরের ভিডিও">›</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
