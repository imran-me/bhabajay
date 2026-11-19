/**
 * ভাবুর চাবি — daily unlocks shared by LivePosts and LiveMyths.
 * The server (/api/unlock.php) decides keys, limits and points; this file only draws
 * the key ring, the unlock panel (guess → আনলক), the reveal stamp, the floating points
 * and the "keys are over" panel with suggestions and a countdown.
 */
import { useEffect, useState } from 'react';
import { getState, addPoints, touchActivity, awardBadge, toast } from '../../lib/store';
import { sound, confetti, prefersReducedMotion, vibrate } from '../../lib/fx';
import { bn } from './bnfmt';

export interface KeyState {
  series: string; limit: number; used: number; left: number; resetsAt: string; signedIn: boolean;
  unlocked?: string[]; free?: string[]; total?: number;
  points: { unlock: number; guessBonus: number; share: number; mysteryMultiplier: number };
}

let csrfCache = '';
async function call<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  if (body !== undefined && !csrfCache) {
    try { csrfCache = (await (await fetch('/api/auth.php', { credentials: 'same-origin' })).json()).csrf ?? ''; } catch { /* anonymous */ }
  }
  const r = await fetch(`/api/${path}`, body === undefined
    ? { credentials: 'same-origin', headers: { Accept: 'application/json' } }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfCache }, body: JSON.stringify(body) });
  if (r.status === 403) csrfCache = '';
  const data = (await r.json().catch(() => ({}))) as T;
  return { status: r.status, data };
}

export async function fetchKeys(series: string): Promise<KeyState | null> {
  try {
    const { status, data } = await call<KeyState>(`unlock.php?series=${encodeURIComponent(series)}`);
    return status === 200 ? data : null;
  } catch {
    return null;
  }
}

export interface UnlockResult<T> { item?: T; points: number; correct?: boolean | null; mystery?: boolean; error?: string; state?: KeyState }

export async function unlockItem<T>(series: string, item: string, guess?: 'myth' | 'true'): Promise<UnlockResult<T>> {
  try {
    const { status, data } = await call<KeyState & { item?: T; points?: number; correct?: boolean | null; mystery?: boolean; error?: string; total?: number }>('unlock.php', { action: 'unlock', series, item, guess });
    if (status === 200 && data.item) {
      const pts = data.points ?? 0;
      if (pts > 0) addPoints(pts);
      const { streak } = touchActivity();
      if (streak >= 3) awardBadge('streak-3');
      if (streak >= 7) awardBadge('streak-7');
      return { item: data.item, points: pts, correct: data.correct, mystery: data.mystery, state: data };
    }
    return { points: 0, error: data.error ?? (status === 429 ? 'no_keys' : 'server'), state: data.limit ? data : undefined };
  } catch {
    return { points: 0, error: 'network' };
  }
}

/** native share of an opened card; +share points once per day for signed-in users */
export async function shareCard(series: string, item: string, title: string, url: string) {
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast('লিংক কপি হয়েছে', { mood: 'happy' }); }
  } catch {
    return; // cancelled
  }
  const { data } = await call<{ points?: number }>('unlock.php', { action: 'share', series, item }).catch(() => ({ data: {} as { points?: number } }));
  if (data.points) {
    addPoints(data.points);
    toast(`শেয়ারের জন্য +${bn(data.points)} ভাবনা পয়েন্ট`, { mood: 'wow' });
  }
}

/** 🔑🔑 for today, spent keys dimmed */
export function KeyRing({ k, done, total }: { k: KeyState; done?: number; total?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-tint px-3 py-2 text-sm font-bold" aria-live="polite">
      <span className="flex gap-1" aria-label={`আজ বাকি ${bn(k.left)}টা চাবি`}>
        {Array.from({ length: k.limit }, (_, i) => (
          <span key={i} className={`text-xl ${i < k.left ? 'bj-key-glow' : 'opacity-30 grayscale'}`} aria-hidden="true">🔑</span>
        ))}
      </span>
      <span>আজ বাকি: {bn(k.left)}/{bn(k.limit)}</span>
      {total !== undefined && done !== undefined && total > 0 && <span className="ml-auto text-ink-soft">{bn(done)}/{bn(total)} খোলা</span>}
      {k.signedIn && k.total !== undefined && <span className="tag !py-0">🧠 {bn(getState().points)}</span>}
    </div>
  );
}

export function SignInNudge() {
  return getState().user ? null : (
    <p className="mt-2 text-sm text-ink-soft">চাবি খুলছে, কিন্তু পয়েন্ট জমছে না — <a href="/id" className="font-bold text-link">আইডি বানালে পয়েন্ট জমবে →</a></p>
  );
}

function useCountdown(to: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const p = (n: number) => bn(String(n).padStart(2, '0'));
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const WITTY = [
  'এই দরজার চাবি আজ শেষ! কিন্তু ভাবুর পকেটে আরও দরজার চাবি আছে।',
  'আজকের কৌতূহল কোটা পূর্ণ — মাথা একটু জিরিয়ে নিক!',
  'চাবি ঘুমাতে গেছে। মাঝরাতে জেগে উঠবে নতুন চাবি নিয়ে।',
];

interface SeriesLite { slug: string; title: string; cover?: string | null; posts?: number }

/** keys are over: witty ভাবু + 2–3 series that still have keys today + countdown */
export function OutOfKeys({ k, current }: { k: KeyState; current: string }) {
  const left = useCountdown(k.resetsAt);
  const [sugs, setSugs] = useState<SeriesLite[] | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const all = ((await (await fetch('/api/series.php')).json()) as SeriesLite[]).filter((s) => s.slug !== current && (s.posts ?? 0) > 2);
        const { data } = await call<{ left: Record<string, number> }>(`unlock.php?left=${all.map((s) => s.slug).join(',')}`);
        const likes = getState().user?.interests ?? [];
        const open = all.filter((s) => (data.left?.[s.slug] ?? 0) > 0);
        open.sort((a, b) => Number(likes.includes(b.slug)) - Number(likes.includes(a.slug)) || (b.posts ?? 0) - (a.posts ?? 0));
        setSugs(open.slice(0, 3));
      } catch {
        setSugs([]);
      }
    })();
  }, [current]);
  const line = WITTY[new Date().getDate() % WITTY.length];
  return (
    <div className="rounded-[22px] bg-deep p-4 text-white sm:p-5" role="status">
      <p className="text-lg font-bold">আজকের ২টা আনলক শেষ — কাল আবার</p>
      <p className="mt-1 text-white/85">{line}</p>
      <p className="mt-2 font-en text-2xl font-extrabold tracking-wider text-sun" aria-label="নতুন চাবি আসতে বাকি">{left}</p>
      {sugs && sugs.length > 0 && (
        <>
          <p className="mt-4 font-bold">পাশের দরজায় চাবি আছে!</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {sugs.map((s) => (
              <a key={s.slug} href={`/series/${s.slug}`} className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/10 p-2 hover:bg-white/15">
                {s.cover ? <img src={s.cover} alt="" width={56} height={70} loading="lazy" className="h-[70px] w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-[70px] w-14 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">🔑</span>}
                <span className="min-w-0"><span className="line-clamp-2 font-bold leading-snug">{s.title}</span><span className="text-sm text-sun">এটা খোলো →</span></span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** celebration after an unlock: sound, light confetti, floating points */
export function celebrate(points: number, right: boolean | null | undefined, from?: HTMLElement | null) {
  sound.pop();
  vibrate(15);
  if (right) sound.cheer();
  if (!prefersReducedMotion()) {
    const r = from?.getBoundingClientRect();
    confetti({ count: right ? 60 : 28, x: r ? r.left + r.width / 2 : undefined, y: r ? r.top : undefined });
  }
  if (points > 0) {
    const el = document.createElement('div');
    el.className = 'bj-float-points';
    el.textContent = `+${bn(points)} ভাবনা পয়েন্ট`;
    const r = from?.getBoundingClientRect();
    el.style.left = `${r ? r.left + r.width / 2 : innerWidth / 2}px`;
    el.style.top = `${r ? r.top : innerHeight / 2}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

/** the lock panel inside a reader dialog */
export function UnlockPanel({ k, guess, onGuess, busy, onUnlock, mythMode, current }: {
  k: KeyState | null; guess: 'myth' | 'true' | null; onGuess: (g: 'myth' | 'true') => void; busy: boolean; onUnlock: (e: HTMLElement) => void; mythMode?: boolean; current: string;
}) {
  if (!k) return <p className="mt-4 text-ink-soft">চাবির হিসাব আনছি…</p>;
  if (k.left <= 0) return <div className="mt-4"><OutOfKeys k={k} current={current} /></div>;
  return (
    <div className="mt-4 grid gap-3">
      <KeyRing k={k} />
      <p className="font-semibold">{mythMode ? 'আগে আন্দাজ করো — ঠিক হলে বোনাস!' : 'কী মনে হয়, কী আছে ভেতরে? এক চাবিতে খুলে দেখো।'}</p>
      {mythMode && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="তোমার আন্দাজ">
          {(['myth', 'true'] as const).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={guess === g} onClick={() => onGuess(g)}
              className={`min-h-12 rounded-2xl border-2 text-lg font-bold transition ${guess === g ? (g === 'myth' ? 'border-coral bg-coral text-white' : 'border-teal bg-teal text-white') : 'border-line bg-surface'}`}>
              {g === 'myth' ? 'মিথ?' : 'সত্য?'}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-lg" disabled={busy || (mythMode && !guess)} onClick={(e) => onUnlock(e.currentTarget)}>
        <span className={busy ? 'bj-key-turn inline-block' : 'inline-block'} aria-hidden="true">🔑</span> {busy ? 'খুলছি…' : `আনলক (+${bn(k.points.unlock)})`}
      </button>
      <p className="text-xs text-ink-soft">প্রতিটা সিরিজে দিনে {bn(k.limit)}টা চাবি · প্রতিটা আনলকে +{bn(k.points.unlock)}{mythMode ? `, ঠিক আন্দাজে আরও +${bn(k.points.guessBonus)}` : ''} · মাঝরাতে (ঢাকা) নতুন চাবি</p>
      <SignInNudge />
    </div>
  );
}
