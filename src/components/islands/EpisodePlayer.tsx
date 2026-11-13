/**
 * ভাবুর দুনিয়া player.
 *  - With a YouTube ID: lite facade → nocookie iframe on tap; listens for the
 *    "ended" state via the IFrame postMessage protocol (no API script needed).
 *  - Without one (DEMO): plays an animatic of the script beats with subtitles.
 * On end: unlocks the post-episode quiz (bj:episode-ended), then the next
 * episode autoplays after a 5 s ভাবু countdown that can be cancelled.
 */
import { useEffect, useRef, useState } from 'react';
import type { CastId, DoodleName } from '../../data/types';
import { castSvg, CAST } from '../../lib/cast';
import { markEpisodeWatched } from '../../lib/store';
import { sound } from '../../lib/fx';
import { bn } from '../../lib/bn';
import { Bhabu, Doodle, Icon } from './ui';

interface Beat { who: CastId | 'narrator'; line: string }
interface Props {
  slug: string;
  number: number;
  title: string;
  youtubeId: string | null;
  doodle: DoodleName;
  beats: Beat[];
  next?: { slug: string; title: string } | null;
}

const beatMs = (line: string) => Math.min(6500, Math.max(3200, 1800 + line.length * 55));

export default function EpisodePlayer({ slug, number, title, youtubeId, doodle, beats, next }: Props) {
  const [state, setState] = useState<'idle' | 'playing' | 'paused' | 'ended'>('idle');
  const [beat, setBeat] = useState(-1); // -1 = title card
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const durations = [2400, ...beats.map((b) => beatMs(b.line))];
  const total = durations.reduce((a, b) => a + b, 0);
  const startOf = (k: number) => durations.slice(0, k + 1).reduce((a, b) => a + b, 0);

  // autoplay when arriving from the previous episode's countdown
  useEffect(() => {
    if (new URLSearchParams(location.search).get('autoplay') === '1') play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // demo animatic clock
  useEffect(() => {
    if (youtubeId || state !== 'playing') return;
    const t0 = performance.now() - elapsed;
    const tick = () => {
      const e = performance.now() - t0;
      setElapsed(e);
      let k = -1;
      while (k + 1 < durations.length && e >= startOf(k)) k++;
      const nb = k - 1;
      setBeat((prev) => {
        if (prev !== nb && nb >= 0) sound.tick();
        return nb;
      });
      if (e >= total) {
        end();
        return;
      }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timer.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, youtubeId]);

  // YouTube: listen for "ended"
  useEffect(() => {
    if (!youtubeId || state !== 'playing') return;
    const onMsg = (e: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.event === 'onStateChange' && d.info === 0) end();
        if (d?.event === 'infoDelivery' && d.info?.playerState === 0) end();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMsg);
    const ping = window.setInterval(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: slug }), '*'), 1500);
    return () => {
      window.removeEventListener('message', onMsg);
      clearInterval(ping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, state]);

  // next-episode countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (next) location.href = `/bhabur-duniya/${next.slug}?autoplay=1`;
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, next]);

  function play() {
    if (state === 'ended') {
      setElapsed(0);
      setBeat(-1);
    }
    setState('playing');
    sound.pop();
  }
  function end() {
    setState('ended');
    markEpisodeWatched(slug);
    window.dispatchEvent(new CustomEvent('bj:episode-ended', { detail: { slug } }));
    sound.cheer();
    if (next) setCountdown(5);
  }
  const cancelCountdown = () => setCountdown(null);

  const b = beat >= 0 ? beats[beat] : null;
  const pct = youtubeId ? (state === 'ended' ? 100 : 0) : Math.min(100, (elapsed / total) * 100);

  return (
    <div className="overflow-hidden rounded-[24px] bg-deep text-white shadow-[var(--shadow-lift)]">
      <div className="pattern-deep relative aspect-video">
        {youtubeId && (state === 'playing' || state === 'ended') ? (
          <iframe
            ref={iframeRef}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&enablejsapi=1&cc_lang_pref=bn&origin=${encodeURIComponent(location.origin)}`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {/* scene */}
            <Doodle name={doodle} className={`absolute right-[8%] top-[10%] h-16 w-16 sm:h-24 sm:w-24 ${state === 'playing' ? 'animate-float' : ''}`} />
            {state !== 'idle' && b && (
              <div key={beat} className="absolute inset-x-0 top-[8%] flex justify-center reveal-up">
                {b.who === 'bhabu' ? (
                  <Bhabu face={/ভাবা যায়|ঠিক|একদম/.test(b.line) ? 'happy' : /\?/.test(b.line) ? 'think' : 'wow'} body="coral" dot="sun" brows="light" animateSparks className="w-[18%] max-w-28" />
                ) : b.who === 'narrator' ? (
                  <span className="mt-6 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-sun sm:text-sm">বর্ণনা</span>
                ) : (
                  <span className="block w-[22%] max-w-32" dangerouslySetInnerHTML={{ __html: castSvg(b.who) }} />
                )}
              </div>
            )}
            {state !== 'idle' && beat === -1 && (
              <div className="absolute inset-0 grid place-items-center text-center reveal-up">
                <div>
                  <p className="font-display text-xl text-sun sm:text-3xl">ভাবুর দুনিয়া</p>
                  <p className="mt-1 text-lg font-bold sm:text-2xl">পর্ব {bn(number)} · {title}</p>
                </div>
              </div>
            )}
            {b && state !== 'idle' && (
              <p key={`s${beat}`} className="absolute inset-x-3 bottom-4 mx-auto max-w-2xl rounded-xl bg-black/55 px-3 py-2 text-center text-[.95rem] font-semibold leading-snug sm:bottom-6 sm:text-lg reveal-up">
                {b.who !== 'narrator' && <span className="text-sun">{CAST[b.who].bn}: </span>}
                {b.line}
              </p>
            )}
            {state === 'idle' && (
              <button type="button" onClick={play} className="group absolute inset-0 grid place-items-center" aria-label={`পর্ব চালাও: ${title}`}>
                <span className="grid justify-items-center gap-3">
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-coral shadow-[0_5px_0_#D94A3B] transition-transform group-hover:scale-110"><Icon name="play" className="ml-1.5 h-9 w-9" /></span>
                  {!youtubeId && <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold">ডেমো অ্যানিমেটিক · আসল ভিডিও যুক্ত হলে এখানে চলবে</span>}
                </span>
              </button>
            )}
            {state === 'paused' && (
              <button type="button" onClick={play} className="absolute inset-0 grid place-items-center bg-black/30" aria-label="আবার চালাও">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-coral"><Icon name="play" className="ml-1 h-8 w-8" /></span>
              </button>
            )}
          </>
        )}

        {state === 'ended' && (
          <div className="absolute inset-0 grid place-items-center bg-deep/90 p-4 text-center reveal-up">
            <div className="grid justify-items-center gap-2">
              <Bhabu face="happy" body="coral" dot="sun" brows="light" animateSparks className="w-14 sm:w-20" />
              <p className="text-lg font-bold sm:text-2xl">দেখা শেষ! এবার তোমার পালা</p>
              <div className="flex flex-wrap justify-center gap-2">
                <a href="#episode-quiz" onClick={cancelCountdown} className="btn btn-pill btn-sm">কুইজ খেলি 🎲</a>
                <button type="button" className="btn btn-sm border-2 border-white/40 !shadow-none" onClick={() => { cancelCountdown(); play(); }}>আবার দেখি</button>
              </div>
              {next && countdown !== null && (
                <p className="mt-1 text-sm text-white/85" aria-live="polite">
                  পরের পর্ব “{next.title}” — {bn(countdown)} সেকেন্ডে…{' '}
                  <button type="button" className="font-bold text-sun underline underline-offset-2" onClick={cancelCountdown}>থামো</button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* controls + brand-yellow progress line */}
      <div className="h-1.5 bg-white/10"><div className="h-full bg-sun transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
      {!youtubeId && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <button type="button" className="btn-icon text-white hover:!bg-white/10" onClick={() => (state === 'playing' ? setState('paused') : play())} aria-label={state === 'playing' ? 'থামাও' : 'চালাও'}>
            {state === 'playing' ? <span className="text-lg font-bold">❚❚</span> : <Icon name="play" />}
          </button>
          <span className="tabular-nums text-white/80">{bn(Math.max(0, beat + 1))}/{bn(beats.length)} দৃশ্য</span>
          <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">বাংলা সাবটাইটেল</span>
          {state === 'playing' && <button type="button" className="text-xs font-bold text-sun underline underline-offset-2" onClick={() => { setElapsed(total); end(); }}>শেষে যাও</button>}
        </div>
      )}
    </div>
  );
}
