/**
 * One-card-at-a-time swipe carousel for multi-card posts.
 * Native scroll-snap gives touch momentum + snap; arrows, dots, ←/→ keys and a
 * "২/৪" counter drive the same scroller. The next arrow nudges until the first move.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bn } from './bnfmt';

export interface CarouselImg { src: string; width: number; height: number; alt: string }

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CardCarousel({ images, label = 'কার্ড', keys = true }: { images: CarouselImg[]; label?: string; keys?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [moved, setMoved] = useState(false);
  const n = images.length;

  const go = useCallback((k: number) => {
    const t = track.current;
    if (!t) return;
    const to = Math.max(0, Math.min(n - 1, k));
    t.scrollTo({ left: to * t.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
    setMoved(true);
  }, [n]);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const k = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
        setI(k);
        if (k > 0) setMoved(true);
      });
    };
    t.addEventListener('scroll', on, { passive: true });
    return () => { t.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (!keys || n < 2) return;
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [keys, n, i, go]);

  if (!n) return null;
  const arrow = 'bj-arrow absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-3xl font-bold leading-none shadow-lg transition-[opacity,transform] duration-200 active:scale-90 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-0';

  return (
    <div className="relative mx-auto w-full max-w-[520px]" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={track} tabIndex={0}
        className="bj-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[18px] bg-tint outline-none focus-visible:ring-4 focus-visible:ring-sun"
        aria-live="polite">
        {images.map((im, k) => (
          <figure key={im.src} className="w-full shrink-0 snap-center snap-always" aria-label={`${bn(k + 1)}/${bn(n)}`} aria-hidden={k !== i}>
            <img src={im.src} width={im.width} height={im.height} alt={im.alt} loading={k < 2 ? 'eager' : 'lazy'} decoding="async"
              draggable={false} className="block h-auto w-full select-none" />
          </figure>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="আগের কার্ড"
            className={`${arrow} -left-3 bg-white/85 text-teal backdrop-blur sm:-left-16 sm:bg-white`}>‹</button>
          <button type="button" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="পরের কার্ড"
            className={`${arrow} -right-3 bg-coral/90 text-white backdrop-blur sm:-right-16 sm:bg-coral ${moved ? '' : 'bj-nudge'}`}>›</button>

          <div className="mt-2 flex items-center justify-center gap-1">
            {images.map((_, k) => (
              <button key={k} type="button" onClick={() => go(k)} aria-label={`কার্ড ${bn(k + 1)}`} aria-current={k === i ? 'true' : undefined}
                className="grid h-11 w-8 place-items-center">
                <span className={`block h-2.5 rounded-full transition-all duration-300 ${k === i ? 'w-6 bg-coral' : 'w-2.5 bg-line'}`} />
              </button>
            ))}
            <span className="ml-2 min-w-[3rem] text-sm font-bold tabular-nums text-ink-soft">{bn(i + 1)}/{bn(n)}</span>
          </div>
        </>
      )}
    </div>
  );
}
