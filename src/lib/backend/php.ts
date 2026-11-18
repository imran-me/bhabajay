/**
 * Server backend for Hostinger (PHP + MySQL under /api). It keeps the demo
 * backend for everything that still lives in the browser (ID, badges, admin)
 * and sends scores, pitches, comments and inbox items to /api. If a request
 * fails, it falls back to the browser-local demo so nothing is ever lost.
 */
import type { Backend, Comment, LeaderRow, PublicPitchStatus } from './types';
import { demoBackend } from './demo';
import { getState, update, pushNotice, awardBadge } from '../store';

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, body === undefined
    ? { headers: { Accept: 'application/json' } }
    : { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 404 && path.startsWith('pitches.php?')) return null as T;
  if (!res.ok) throw new Error(`api ${res.status}`);
  return res.json() as Promise<T>;
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

  async recordAttempt(a) {
    await demoBackend.recordAttempt(a); // local history + badges stay on this device
    const u = getState().user;
    api('scores.php', { ...a, nickname: u?.nickname, schoolId: u?.schoolId, district: u?.district }).catch(() => {});
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
