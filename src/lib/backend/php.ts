/**
 * Server backend for Hostinger (PHP + MySQL under /api): Bhaba Jay ID accounts
 * (email + password, server session), scores, pitches, comments, inbox and core-team
 * moderation. Badges, streaks and notices stay in the browser store. If a community
 * request fails, it falls back to the browser-local demo so nothing is ever lost.
 */
import type { Backend, Comment, InboxItem, LeaderRow, Pitch, PublicPitchStatus } from './types';
import { demoBackend } from './demo';
import { getState, update, resetAll, pushNotice, awardBadge, type LocalUser } from '../store';

let csrf = '';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  if (body !== undefined && !csrf && path !== 'auth.php') {
    try { csrf = (await api<Me>('auth.php')).csrf; } catch { /* anonymous POST still works */ }
  }
  const res = await fetch(`/api/${path}`, body === undefined
    ? { headers: { Accept: 'application/json' }, credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
  if (res.status === 404 && path.startsWith('pitches.php?')) return null as T;
  if (!res.ok) {
    let code = 'server';
    try { code = (await res.json())?.error ?? code; } catch { /* not json */ }
    throw new ApiError(res.status, code);
  }
  return res.json() as Promise<T>;
}

type Me = { user: LocalUser | null; email: string | null; csrf: string };

/** Mirror the server session into the browser store (keeps a demo-only local user untouched). */
function applyMe(me: Me): void {
  csrf = me.csrf;
  update((s) => {
    if (me.user) {
      s.user = { ...me.user, avatar: me.user.avatar ?? s.user?.avatar } as LocalUser;
      s.guest = null;
      delete s.flags.authEmail;
    } else {
      if (s.user && !s.user.id.startsWith('demo-')) s.user = null;
      if (me.email) s.flags.authEmail = me.email;
      else if (!s.user) delete s.flags.authEmail;
    }
  });
}

async function refreshMe(): Promise<Me> {
  const me = await api<Me>('auth.php');
  applyMe(me);
  return me;
}

/** true when /api/health.php answers {ok:true} (i.e. PHP + MySQL are live) */
export async function apiAvailable(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch('/api/health.php', { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return false;
    return (await res.json())?.ok === true;
  } catch {
    return false;
  }
}

export const phpBackend: Backend = {
  ...demoBackend,
  mode: 'php',

  /* ───────── Bhaba Jay ID ───────── */
  async startGoogle() {
    throw new ApiError(501, 'google'); // not connected yet: the UI offers email + password
  },
  async passwordSignIn(email, password, mode) {
    const me = await api<Me>('auth.php', { action: mode, email, password });
    applyMe(me);
    return { hasProfile: !!me.user };
  },
  async getSession() {
    try {
      const me = await refreshMe();
      const u = getState().user;
      return me.user ? { user: me.user } : u ? { user: u } : null;
    } catch {
      return demoBackend.getSession();
    }
  },
  async saveProfile(input) {
    if (!csrf) await refreshMe();
    if (!getState().flags.authEmail && !getState().user?.id.startsWith('u')) return demoBackend.saveProfile(input);
    const st = getState();
    const me = await api<Me>('auth.php', { action: 'profile', profile: { ...input, badges: Object.keys(st.badges), points: st.points } });
    applyMe(me);
    return getState().user!;
  },
  async usernameAvailable(username) {
    try {
      return (await api<{ available: boolean }>(`auth.php?username=${encodeURIComponent(username)}`)).available;
    } catch {
      return demoBackend.usernameAvailable(username);
    }
  },
  async signOut() {
    try {
      if (csrf) await api('auth.php', { action: 'logout' });
    } catch { /* already signed out */ }
    csrf = '';
    await demoBackend.signOut();
  },
  async deleteMyData() {
    try {
      if (csrf && getState().user?.id.startsWith('u')) await api('auth.php', { action: 'delete' });
    } finally {
      await demoBackend.deleteMyData();
      resetAll();
    }
  },
  async myPitches() {
    try {
      const { pitches } = await api<{ pitches: Pitch[] }>('pitches.php?mine=1');
      const local = await demoBackend.myPitches();
      const seen = new Set(pitches.map((p) => p.code));
      return [...pitches, ...local.filter((p) => !seen.has(p.code))];
    } catch {
      return demoBackend.myPitches();
    }
  },

  admin: {
    async pitches() {
      return (await api<{ pitches: Pitch[] }>('admin.php?list=pitches')).pitches;
    },
    async updatePitch(code, status, opts = {}) {
      await api('admin.php', { action: 'pitch', code, status, ...opts });
    },
    async hidePitch(code: string, hidden: boolean) {
      await api('admin.php', { action: 'pitch_hidden', code, hidden });
    },
    async pendingComments() {
      return (await api<{ comments: Comment[] }>('admin.php?list=comments')).comments.map((c) => ({ ...c, avatar: c.avatar ?? undefined }));
    },
    async moderate(id, status) {
      await api('admin.php', { action: 'comment', id, status });
    },
    async inbox(kind) {
      return (await api<{ inbox: InboxItem[] }>(`admin.php?list=inbox${kind ? `&kind=${kind}` : ''}`)).inbox;
    },
    async markInbox(id, status) {
      await api('admin.php', { action: 'inbox', id, status });
    },
  },

  async recordAttempt(a) {
    await demoBackend.recordAttempt(a); // local history + badges stay on this device
    const u = getState().user;
    api('scores.php', { ...a, nickname: u?.nickname, schoolId: u?.schoolId, district: u?.district }).catch(() => {});
    if (u?.id.startsWith('u')) {
      const st = getState();
      api('auth.php', { action: 'stats', badges: Object.keys(st.badges), points: st.points }).catch(() => {});
    }
  },
  async playCount(slug) {
    try {
      return (await api<{ count: number }>(`scores.php?count=${encodeURIComponent(slug)}`)).count;
    } catch {
      return demoBackend.playCount(slug);
    }
  },
  async leaderboard(scope, quizSlug) {
    try {
      const q = quizSlug ? `&quiz=${encodeURIComponent(quizSlug)}` : '';
      const { rows } = await api<{ rows: LeaderRow[] }>(`scores.php?board=${scope}${q}`);
      const me = getState().user?.nickname;
      return rows.map((r) => ({ ...r, sub: r.sub ?? undefined, me: scope === 'people' && !!me && r.name === me }));
    } catch {
      return demoBackend.leaderboard(scope, quizSlug);
    }
  },

  async submitPitch(p) {
    let code: string;
    try {
      code = (await api<{ code: string }>('pitches.php', p)).code;
    } catch {
      return demoBackend.submitPitch(p);
    }
    update((s) => {
      s.pitches = [code, ...s.pitches];
    });
    pushNotice({ mood: 'wow', title: 'পিচ পৌঁছেছে!', body: `ট্র্যাকার নম্বর ${code}। ৭ দিনের মধ্যে জানাব।`, href: `/initiator/track?code=${code}` });
    awardBadge('pitch-sent');
    return { code };
  },
  async pitchStatus(code) {
    try {
      const r = await api<PublicPitchStatus | null>(`pitches.php?code=${encodeURIComponent(code.trim())}`);
      return r ?? (await demoBackend.pitchStatus(code));
    } catch {
      return demoBackend.pitchStatus(code);
    }
  },

  async listComments(t) {
    const local = (await demoBackend.listComments(t)).filter((c) => c.mine);
    try {
      const { comments } = await api<{ comments: Comment[] }>(`comments.php?type=${t.type}&id=${encodeURIComponent(t.id)}`);
      const seen = new Set(comments.map((c) => c.nickname + '|' + c.body));
      return [...comments.map((c) => ({ ...c, avatar: c.avatar ?? undefined })), ...local.filter((c) => !seen.has(c.nickname + '|' + c.body))].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    } catch {
      return demoBackend.listComments(t);
    }
  },
  async postComment(t, body) {
    const u = getState().user;
    if (!u) throw new Error('login');
    try {
      await api<Comment>('comments.php', { type: t.type, id: t.id, body, nickname: u.nickname, avatar: u.avatar });
    } catch {
      /* fall through: keep it locally so the writer still sees it */
    }
    return demoBackend.postComment(t, body);
  },
  async submitInbox(kind, fields) {
    try {
      await api('inbox.php', { kind, fields });
      if (kind === 'myth_tip') awardBadge('dadu');
    } catch {
      await demoBackend.submitInbox(kind, fields);
    }
  },
};
