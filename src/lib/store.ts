/**
 * Local-first state for the visitor: points, streaks, badges, saves, follows,
 * quiz history, prefs and (in demo mode) the Bhaba Jay ID session itself.
 *
 * Framework-agnostic: Astro <script>s and React islands both import this.
 * Changes broadcast a `bj:store` event (same tab) and sync via `storage`
 * events (other tabs). When Supabase is configured, backend/supabase.ts
 * mirrors the relevant writes to Postgres.
 */
import type { AvatarConfig, Tier } from '../data/types';
import { dhakaDay, addDays, weekKey, daysBetween } from './time';
import { BADGE_MAP } from './badges';

export type AgeBand = 'under13' | '13-17' | '18+';

export interface LocalUser {
  id: string;
  email: string;
  username: string;
  nickname: string;
  ageBand: Exclude<AgeBand, 'under13'>;
  parentEmail?: string;
  parentConfirmed: boolean;
  isPublic: boolean;
  showRealName: boolean;
  realName?: string;
  district?: string;
  schoolId?: string;
  bio?: string;
  interests?: string[];
  avatar: AvatarConfig;
  method: 'google' | 'magic';
  createdAt: string;
  role?: 'member' | 'core';
}

export interface Notice {
  id: string;
  at: string;
  mood: 'wow' | 'happy' | 'think' | 'wink' | 'grin';
  title: string;
  body: string;
  href?: string;
  read?: boolean;
}

export interface QuizRecord {
  best: number;
  total: number;
  last: number;
  points: number;
  plays: number;
  at: string;
}

export interface State {
  v: 1;
  user: LocalUser | null;
  guest: { ageBand: 'under13' } | null;
  points: number;
  streak: { count: number; best: number; lastDay: string | null; freezeWeek: string | null; frozen: string[] };
  days: string[];
  quizzes: Record<string, QuizRecord>;
  quizPlays: number;
  badges: Record<string, string>;
  saves: { type: 'myth' | 'post' | 'episode'; id: string; at: string }[];
  follows: string[];
  likes: string[];
  mythsRead: string[];
  episodesWatched: string[];
  thoughtDays: string[];
  shares: number;
  pitches: string[];
  notices: Notice[];
  prefs: { sound: boolean; theme: 'system' | 'light' | 'dark'; lang: 'bn' | 'en'; notifyEmail: boolean; notifyPush: boolean };
  flags: Record<string, string>;
  tierOverride?: Tier;
}

const KEY = 'bj:v1';

export function emptyState(): State {
  return {
    v: 1,
    user: null,
    guest: null,
    points: 0,
    streak: { count: 0, best: 0, lastDay: null, freezeWeek: null, frozen: [] },
    days: [],
    quizzes: {},
    quizPlays: 0,
    badges: {},
    saves: [],
    follows: [],
    likes: [],
    mythsRead: [],
    episodesWatched: [],
    thoughtDays: [],
    shares: 0,
    pitches: [],
    notices: [],
    prefs: { sound: true, theme: 'system', lang: 'bn', notifyEmail: true, notifyPush: false },
    flags: {},
  };
}

const isBrowser = typeof window !== 'undefined';
let cache: State | null = null;

function safeRead(): State {
  if (!isBrowser) return emptyState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const st = { ...emptyState(), ...parsed, prefs: { ...emptyState().prefs, ...(parsed.prefs || {}) }, streak: { ...emptyState().streak, ...(parsed.streak || {}) } };
    // sound is on by default; only a visitor's own choice (flags.soundChosen) keeps it off
    if (st.flags?.soundChosen !== '1') st.prefs.sound = true;
    return st;
  } catch {
    return emptyState();
  }
}

function safeWrite(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — state stays in memory for this page */
  }
}

export function getState(): State {
  if (!cache) cache = safeRead();
  return cache;
}

export function update(mutator: (s: State) => void): State {
  const s = structuredClone(getState());
  mutator(s);
  cache = s;
  safeWrite(s);
  if (isBrowser) window.dispatchEvent(new CustomEvent('bj:store', { detail: s }));
  return s;
}

export function subscribe(cb: (s: State) => void): () => void {
  if (!isBrowser) return () => {};
  const onLocal = (e: Event) => cb((e as CustomEvent<State>).detail);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = safeRead();
      cb(cache);
    }
  };
  window.addEventListener('bj:store', onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('bj:store', onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

/* ───────────── UI events (toasts, celebrations) ───────────── */
export function toast(message: string, opts: { mood?: Notice['mood']; kind?: 'info' | 'success' | 'badge' | 'error'; href?: string } = {}) {
  if (isBrowser) window.dispatchEvent(new CustomEvent('bj:toast', { detail: { message, ...opts } }));
}

/* ───────────── Streaks: grows at 3/7/30, one free freeze a week ───────────── */
export function touchActivity(today = dhakaDay()): { streak: number; increased: boolean; usedFreeze: boolean } {
  let increased = false;
  let usedFreeze = false;
  const s = update((st) => {
    if (!st.days.includes(today)) st.days = [...st.days, today].slice(-90);
    const last = st.streak.lastDay;
    if (last === today) return;
    if (!last) {
      st.streak.count = 1;
    } else {
      const gap = daysBetween(last, today);
      if (gap === 1) {
        st.streak.count += 1;
      } else if (gap === 2 && st.streak.freezeWeek !== weekKey()) {
        // one free "freeze" a week, so a sick day doesn't break a teen's heart
        st.streak.count += 1;
        st.streak.freezeWeek = weekKey();
        st.streak.frozen = [...st.streak.frozen, addDays(last, 1)].slice(-10);
        usedFreeze = true;
      } else if (gap > 1) {
        st.streak.count = 1;
      }
    }
    st.streak.lastDay = today;
    st.streak.best = Math.max(st.streak.best, st.streak.count);
    increased = true;
  });
  if (usedFreeze) toast('গতকাল মিস হয়েছিল, কিন্তু সাপ্তাহিক ফ্রিজ তোমার স্ট্রিক বাঁচিয়েছে! 🧊', { mood: 'wink' });
  const c = s.streak.count;
  if (increased) {
    if (c >= 3) awardBadge('streak-3');
    if (c >= 7) awardBadge('streak-7');
    if (c >= 30) awardBadge('streak-30');
  }
  return { streak: c, increased, usedFreeze };
}

export function freezeAvailable(s = getState()): boolean {
  return s.streak.freezeWeek !== weekKey();
}

export function currentStreak(s = getState()): number {
  const last = s.streak.lastDay;
  if (!last) return 0;
  const gap = daysBetween(last, dhakaDay());
  if (gap <= 1) return s.streak.count;
  if (gap === 2 && freezeAvailable(s)) return s.streak.count;
  return 0;
}

/* ───────────── Points & badges ───────────── */
export function addPoints(n: number) {
  update((s) => {
    s.points += n;
  });
}

export function awardBadge(id: string): boolean {
  if (getState().badges[id] || !BADGE_MAP[id]) return false;
  update((s) => {
    s.badges[id] = new Date().toISOString();
  });
  const b = BADGE_MAP[id];
  toast(`নতুন ব্যাজ: ${b.bn}!`, { kind: 'badge', mood: 'wow', href: '/me#badges' });
  if (isBrowser) window.dispatchEvent(new CustomEvent('bj:badge', { detail: b }));
  return true;
}

/* ───────────── Quizzes ───────────── */
export function recordQuiz(slug: string, score: number, total: number, points: number) {
  update((s) => {
    const prev = s.quizzes[slug];
    s.quizzes[slug] = {
      best: Math.max(prev?.best ?? 0, score),
      total,
      last: score,
      points: (prev?.points ?? 0) + points,
      plays: (prev?.plays ?? 0) + 1,
      at: new Date().toISOString(),
    };
    s.quizPlays += 1;
  });
  awardBadge('first-quiz');
  if (total === 5 && score === 5) awardBadge('perfect-5');
}

/* ───────────── Saves, follows, likes ───────────── */
export function isSaved(type: string, id: string) {
  return getState().saves.some((x) => x.type === type && x.id === id);
}
export function toggleSave(type: 'myth' | 'post' | 'episode', id: string): boolean {
  const on = !isSaved(type, id);
  const s = update((st) => {
    st.saves = on ? [{ type, id, at: new Date().toISOString() }, ...st.saves] : st.saves.filter((x) => !(x.type === type && x.id === id));
  });
  if (on && s.saves.length >= 5) awardBadge('saver');
  return on;
}
export function toggleFollow(slug: string): boolean {
  const on = !getState().follows.includes(slug);
  update((st) => {
    st.follows = on ? [...st.follows, slug] : st.follows.filter((x) => x !== slug);
  });
  return on;
}
export function toggleLike(id: string): boolean {
  const on = !getState().likes.includes(id);
  update((st) => {
    st.likes = on ? [...st.likes, id] : st.likes.filter((x) => x !== id);
  });
  return on;
}
export function countShare() {
  const s = update((st) => {
    st.shares += 1;
  });
  if (s.shares >= 3) awardBadge('sharer');
}

/* ───────────── Reading / watching ───────────── */
export function markMythRead(slug: string) {
  if (getState().mythsRead.includes(slug)) return;
  const s = update((st) => {
    st.mythsRead = [...st.mythsRead, slug];
    st.points += 3;
  });
  touchActivity();
  if (s.mythsRead.length >= 5) awardBadge('myth-buster');
}
export function markEpisodeWatched(slug: string) {
  if (getState().episodesWatched.includes(slug)) return;
  update((st) => {
    st.episodesWatched = [...st.episodesWatched, slug];
    st.points += 5;
  });
  touchActivity();
}
export function markThoughtSeen() {
  const today = dhakaDay();
  if (getState().thoughtDays.includes(today)) return false;
  update((st) => {
    st.thoughtDays = [...st.thoughtDays, today].slice(-60);
    st.points += 5;
  });
  touchActivity();
  return true;
}

/* ───────────── Notifications (on-site; email goes via backend) ───────────── */
export function pushNotice(n: Omit<Notice, 'id' | 'at'>) {
  update((s) => {
    s.notices = [{ ...n, id: Math.random().toString(36).slice(2), at: new Date().toISOString() }, ...s.notices].slice(0, 40);
  });
}

/* ───────────── Tier ladder (Curious → Explorer → Initiator → Legend) ───────────── */
export function computeTier(s = getState()): Tier | null {
  if (s.tierOverride) return s.tierOverride;
  if (!s.user) return null;
  if (s.badges['legend']) return 'legend';
  if (s.badges['initiator']) return 'initiator';
  if (s.badges['explorer']) return 'explorer';
  const savedEnough = s.saves.length >= 5;
  const quizzedEnough = s.quizPlays >= 3;
  const streakEnough = s.streak.best >= 7;
  if (savedEnough || quizzedEnough || streakEnough) return 'curious';
  return null;
}

/** Progress toward Curious, for the "next step" nudges */
export function curiousProgress(s = getState()) {
  return {
    quizzes: Math.min(3, s.quizPlays),
    saves: Math.min(5, s.saves.length),
    streak: Math.min(7, s.streak.best),
  };
}

export function setPref<K extends keyof State['prefs']>(k: K, v: State['prefs'][K]) {
  update((s) => {
    s.prefs[k] = v;
    if (k === 'sound') s.flags = { ...s.flags, soundChosen: '1' };
  });
}

export function setFlag(k: string, v: string) {
  update((s) => {
    s.flags[k] = v;
  });
}

export function resetAll() {
  cache = emptyState();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem('bj:v1:db');
    localStorage.removeItem('bj:pitch-draft');
  } catch {
    /* ignore */
  }
  if (isBrowser) window.dispatchEvent(new CustomEvent('bj:store', { detail: cache }));
}
