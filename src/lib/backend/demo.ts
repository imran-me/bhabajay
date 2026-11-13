/**
 * DEMO BACKEND — used when PUBLIC_SUPABASE_URL / ANON_KEY are not set.
 *
 * Simulates the server tables in this browser's localStorage ("bj:v1:db")
 * with seeded sample rows, so every flow (sign-up, pitch → review → live,
 * moderation, leaderboards) can be clicked through end-to-end. Nothing
 * leaves the device. The UI shows a "ডেমো মোড" banner while this is active.
 */
import type { Backend, Pitch, PitchPayload, PitchStatus, Comment, CommentTarget, InboxItem, LeaderRow, ProfileInput } from './types';
import { PITCH_STEPS } from './types';
import { getState, update, resetAll, pushNotice, awardBadge, type LocalUser } from '../store';
import schools from '../../data/schools.json';

const DB_KEY = 'bj:v1:db';

interface Attempt { name: string; schoolId?: string; district?: string; quiz: string; score: number; points: number; me?: boolean }
interface DB {
  seq: number;
  pitches: Pitch[];
  comments: Comment[];
  inbox: InboxItem[];
  attempts: Attempt[];
  usernames: string[];
}

const iso = (d: string) => new Date(d).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): DB {
  const P = (code: string, title: string, subject: string, nickname: string, status: PitchStatus, created: string, extra: Partial<Pitch> = {}): Pitch => {
    const order: PitchStatus[] = ['sent', 'reviewing', 'mentor', 'live'];
    const upto = status === 'not_yet' ? ['sent', 'reviewing'] : order.slice(0, order.indexOf(status) + 1);
    const history = upto.map((s, i) => ({ status: s as PitchStatus, at: iso(new Date(Date.parse(created) + i * 3 * 86400_000).toISOString()) }));
    if (status === 'not_yet') history.push({ status: 'not_yet', at: iso(new Date(Date.parse(created) + 5 * 86400_000).toISOString()) });
    return { code, title, subject, nickname, status, createdAt: iso(created), updatedAt: history[history.length - 1].at, history, ...extra };
  };
  const names = ['সামিন', 'তাসফিয়া', 'আরিয়ান', 'নুসরাত', 'ইমন', 'রিয়া', 'তাহসিন', 'মেহের', 'জারিফ', 'প্রিয়ন্তী', 'শুভ', 'লামিয়া', 'আদনান', 'ঋতু', 'ফাহিম', 'অনন্যা', 'সাকিব', 'তৃষা', 'রাহাত', 'দীপ্ত'];
  const attempts: Attempt[] = names.map((name, i) => {
    const school = schools[i % schools.length];
    const score = 2 + ((i * 7) % 4);
    return { name, schoolId: school.id, district: school.district, quiz: 'weekly', score, points: 40 + ((i * 37) % 140) + score * 10 };
  });
  return {
    seq: 143,
    pitches: [
      P('BJ-P-0138', 'তারার গল্প', 'মহাকাশ', 'মিম', 'live', '2026-10-08', { mentorName: 'সাকিব হাসান' }),
      P('BJ-P-0139', 'পুকুরের পোকামাকড়', 'জীববিজ্ঞান', 'তাহসিন', 'mentor', '2026-11-02', { mentorName: 'ড. ফারহানা ইসলাম' }),
      P('BJ-P-0140', 'মোবাইলের ভেতরে কী আছে?', 'প্রযুক্তি', 'ইমন', 'sent', '2026-11-12'),
      P('BJ-P-0141', 'গ্রামের ওষুধি গাছ', 'উদ্ভিদবিজ্ঞান', 'রিয়া', 'not_yet', '2026-10-25', {
        feedback: 'দারুণ বিষয়! তবে স্বাস্থ্য-দাবিগুলো যাচাই করা কঠিন। ছোট করে শুরু করো: "গ্রামের ৫টা গাছ আর তাদের বৈজ্ঞানিক নাম" দিয়ে ৪টা কার্ড — তারপর আবার পিচ করো।',
      }),
      P('BJ-P-0142', 'বাংলার নদীর মাছ', 'প্রকৃতি', 'নাদিয়া', 'reviewing', '2026-11-09'),
    ],
    comments: [
      { id: 'c1', target: { type: 'myth', id: 'dudh-mach' }, nickname: 'শিরিন', body: 'আমার শাশুড়ি এটা সারাজীবন বিশ্বাস করে এসেছেন। কার্ডটা পারিবারিক গ্রুপে দিলাম, এবার যুক্তি আছে হাতে!', status: 'approved', createdAt: iso('2026-11-10T19:20:00+06:00') },
      { id: 'c2', target: { type: 'myth', id: 'dudh-mach' }, nickname: 'আরিয়ান', body: 'অটোইমিউন মানে কী, আরেকটু সহজ করে বলবে?', status: 'approved', createdAt: iso('2026-11-11T08:05:00+06:00') },
      { id: 'c3', target: { type: 'thought', id: 'today' }, nickname: 'তাসফিয়া', body: 'আমি ভেবেছিলাম ইলিশ অনেকক্ষণ বাঁচে! ভাবা যায়!', status: 'approved', createdAt: iso('2026-11-13T09:10:00+06:00') },
      { id: 'c4', target: { type: 'myth', id: 'thanda-pani-sordi' }, nickname: 'জারিফ', body: 'তাহলে আইসক্রিম খেতে আর মানা নেই? 😄', status: 'pending', createdAt: iso('2026-11-13T21:00:00+06:00') },
    ],
    inbox: [
      { id: 'i1', kind: 'myth_tip', createdAt: iso('2026-11-12T22:00:00+06:00'), status: 'new', fields: { text: 'দাদি বলেন, রাতে আয়না দেখলে চেহারা খারাপ হয়।', nickname: 'মেহের' } },
      { id: 'i2', kind: 'myth_tip', createdAt: iso('2026-11-11T18:30:00+06:00'), status: 'used', fields: { text: 'ঠান্ডা পানি খেলে সর্দি হয় — আম্মু সবসময় বলেন।', nickname: 'শুভ' } },
      { id: 'i3', kind: 'question', createdAt: iso('2026-11-13T16:45:00+06:00'), status: 'new', fields: { question: 'বিড়াল সবসময় পায়ের উপর পড়ে কেন?', nickname: 'ঋতু, ১৩' } },
      { id: 'i4', kind: 'mentor', createdAt: iso('2026-11-09T11:00:00+06:00'), status: 'new', fields: { name: 'ড. শাহনাজ পারভীন', field: 'আবহাওয়া বিজ্ঞান', help: 'গবেষণা, ক্যারিয়ার' } },
    ],
    attempts,
    usernames: ['nadia', 'rafi', 'tanvir', 'mim', 'sadia', 'faria', 'orko', 'joy', 'bhabajay', 'admin'],
  };
}

function readDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallthrough */
  }
  const db = seed();
  writeDB(db);
  return db;
}
function writeDB(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}
function tx<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const r = fn(db);
  writeDB(db);
  return r;
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export const demoBackend: Backend = {
  mode: 'demo',

  async startGoogle() {
    await wait(150);
    return { demo: true };
  },
  async sendMagicLink(email) {
    await wait(500);
    update((s) => {
      s.flags.pendingEmail = email;
    });
    return { demoLink: `/id?demo_magic=${encodeURIComponent(email)}` };
  },
  async completeDemoSignIn(email, method) {
    await wait(300);
    update((s) => {
      s.flags.authEmail = email;
      s.flags.authMethod = method;
      delete s.flags.pendingEmail;
    });
  },
  async getSession() {
    const u = getState().user;
    return u ? { user: u } : null;
  },
  async usernameAvailable(username) {
    await wait(120);
    const me = getState().user?.username;
    return username === me || !readDB().usernames.includes(username.toLowerCase());
  },
  async confirmParent() {
    await wait(400);
    const u = getState().user;
    if (!u || u.ageBand !== '13-17') return null;
    update((s) => {
      if (s.user) s.user.parentConfirmed = true;
    });
    return u.nickname;
  },
  async saveProfile(input: ProfileInput) {
    await wait(400);
    const st = getState();
    const prev = st.user;
    const email = prev?.email || st.flags.authEmail || 'demo@example.com';
    const user: LocalUser = {
      id: prev?.id || 'demo-' + uid(),
      email,
      method: (prev?.method || (st.flags.authMethod as 'google' | 'magic') || 'magic'),
      createdAt: prev?.createdAt || new Date().toISOString(),
      parentConfirmed: input.ageBand === '18+' ? true : prev?.parentConfirmed ?? false,
      role: prev?.role ?? 'member',
      ...input,
      // teen privacy: never public real name / school / district without parent OK
      showRealName: input.ageBand === '18+' ? input.showRealName : false,
      realName: input.ageBand === '18+' ? input.realName : undefined,
      isPublic: input.ageBand === '18+' ? input.isPublic : false,
      district: input.ageBand === '18+' || prev?.parentConfirmed ? input.district : undefined,
      schoolId: input.ageBand === '18+' || prev?.parentConfirmed ? input.schoolId : undefined,
    };
    tx((db) => {
      if (prev?.username) db.usernames = db.usernames.filter((u) => u !== prev.username);
      db.usernames.push(user.username.toLowerCase());
    });
    update((s) => {
      s.user = user;
      s.guest = null;
      delete s.flags.authEmail;
    });
    return user;
  },
  async signOut() {
    await wait(150);
    update((s) => {
      s.user = null;
    });
  },
  async deleteMyData() {
    await wait(400);
    const me = getState().user?.username;
    tx((db) => {
      db.usernames = db.usernames.filter((u) => u !== me);
      db.comments = db.comments.filter((c) => !c.mine);
      db.pitches = db.pitches.filter((p) => !p.mine);
      db.attempts = db.attempts.filter((a) => !a.me);
    });
    resetAll();
  },

  async recordAttempt(a) {
    const st = getState();
    const u = st.user;
    const school = u?.schoolId ? schools.find((s) => s.id === u.schoolId) : undefined;
    tx((db) => {
      db.attempts.push({
        name: u?.nickname || 'তুমি',
        schoolId: school?.id,
        district: school?.district || u?.district,
        quiz: a.quizSlug.startsWith('weekly') ? 'weekly' : a.quizSlug,
        score: a.score,
        points: a.points,
        me: true,
      });
    });
  },
  async playCount(quizSlug) {
    // DEMO estimate: seeded base + slow growth + this device's plays
    const base = 1700 + (hash(quizSlug) % 700);
    const mine = readDB().attempts.filter((x) => x.me && (x.quiz === quizSlug || (quizSlug.startsWith('weekly') && x.quiz === 'weekly'))).length;
    const minutes = Math.floor((Date.now() - Date.parse('2026-11-07T20:00:00+06:00')) / 60000);
    return base + Math.max(0, Math.min(900, Math.floor(minutes / 9))) + mine;
  },
  async leaderboard(scope) {
    const db = readDB();
    const rows = new Map<string, { name: string; sub?: string; score: number; plays: number; me?: boolean }>();
    for (const a of db.attempts) {
      let key: string | undefined;
      let name = a.name;
      let sub: string | undefined;
      if (scope === 'people') {
        key = a.me ? '__me' : a.name;
        sub = a.district;
      } else if (scope === 'schools') {
        if (!a.schoolId) continue;
        const sc = schools.find((s) => s.id === a.schoolId);
        key = a.schoolId;
        name = sc?.name ?? a.schoolId;
        sub = sc?.district;
      } else {
        if (!a.district) continue;
        key = a.district;
        name = a.district;
      }
      const r = rows.get(key) || { name, sub, score: 0, plays: 0, me: a.me };
      r.score += a.points;
      r.plays += 1;
      if (a.me) r.me = true;
      rows.set(key, r);
    }
    return [...rows.values()]
      .sort((x, y) => y.score - x.score)
      .map((r, i): LeaderRow => ({ rank: i + 1, ...r }));
  },

  async submitPitch(p: PitchPayload) {
    await wait(700);
    const code = tx((db) => {
      const c = `BJ-P-${String(db.seq++).padStart(4, '0')}`;
      const now = new Date().toISOString();
      db.pitches.unshift({
        code: c, status: 'sent', title: p.workingTitle, subject: p.subject, nickname: p.nickname,
        createdAt: now, updatedAt: now, history: [{ status: 'sent', at: now }], payload: p, mine: true,
      });
      return c;
    });
    update((s) => {
      s.pitches = [code, ...s.pitches];
    });
    pushNotice({ mood: 'wow', title: 'পিচ পৌঁছেছে!', body: `ট্র্যাকার নম্বর ${code}। ৭ দিনের মধ্যে জানাব।`, href: `/initiator/track?code=${code}` });
    awardBadge('pitch-sent');
    return { code };
  },
  async pitchStatus(code) {
    await wait(300);
    const p = readDB().pitches.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
    if (!p) return null;
    const { payload: _payload, mine: _mine, nickname: _n, subject: _s, ...pub } = p;
    return pub;
  },
  async myPitches() {
    const mine = new Set(getState().pitches);
    return readDB().pitches.filter((p) => mine.has(p.code));
  },

  async listComments(t: CommentTarget) {
    await wait(150);
    return readDB().comments
      .filter((c) => c.target.type === t.type && c.target.id === t.id && (c.status === 'approved' || c.mine))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  },
  async postComment(t, body) {
    await wait(350);
    const u = getState().user;
    if (!u) throw new Error('login');
    const c: Comment = { id: uid(), target: t, nickname: u.nickname, avatar: u.avatar, body: body.trim(), status: 'pending', createdAt: new Date().toISOString(), mine: true };
    tx((db) => db.comments.push(c));
    return c;
  },
  async submitInbox(kind, fields) {
    await wait(500);
    tx((db) => db.inbox.unshift({ id: uid(), kind, createdAt: new Date().toISOString(), status: 'new', fields }));
    if (kind === 'myth_tip') awardBadge('dadu');
  },
  async setFollow() {
    /* follows live in the local store in demo mode */
  },

  admin: {
    async pitches() {
      return readDB().pitches;
    },
    async updatePitch(code, status, opts = {}) {
      let wasMine = false;
      let title = '';
      tx((db) => {
        const p = db.pitches.find((x) => x.code === code);
        if (!p) return;
        p.status = status;
        p.updatedAt = new Date().toISOString();
        p.history.push({ status, at: p.updatedAt, note: opts.feedback });
        if (opts.feedback !== undefined) p.feedback = opts.feedback;
        if (opts.mentorName) p.mentorName = opts.mentorName;
        wasMine = !!p.mine;
        title = p.title;
      });
      if (wasMine) {
        const step = PITCH_STEPS.find((s) => s.id === status);
        const msg: Record<PitchStatus, string> = {
          sent: 'তোমার পিচ পাঠানো হয়েছে।',
          reviewing: `কোর টিম "${title}" দেখছে: বিষয়ের মিল, তথ্য, নিরাপত্তা।`,
          mentor: `অভিনন্দন! "${title}"-এর মেন্টর ঠিক হয়েছে${opts.mentorName ? `: ${opts.mentorName}` : ''}। ব্র্যান্ড কিট আর ফ্যাক্ট-চেক লেসন তোমার ইমেইলে।`,
          live: `"${title}" এখন লাইভ! প্রথম ৪টি পোস্টের পর তুমি ইনিশিয়েটর।`,
          not_yet: `"${title}" এখনো না — কিন্তু ছোট একটা প্রথম ধাপ সাজেস্ট করেছি। যেকোনো সময় আবার পিচ করো।`,
        };
        pushNotice({ mood: status === 'not_yet' ? 'think' : step?.mood ?? 'happy', title: step?.bn ?? 'এখনো না', body: msg[status], href: `/initiator/track?code=${code}` });
        if (status === 'mentor') awardBadge('explorer');
        if (status === 'live') awardBadge('initiator');
      }
    },
    async pendingComments() {
      return readDB().comments.filter((c) => c.status === 'pending');
    },
    async moderate(id, status) {
      tx((db) => {
        const c = db.comments.find((x) => x.id === id);
        if (c) c.status = status;
      });
    },
    async inbox(kind) {
      return readDB().inbox.filter((i) => !kind || i.kind === kind);
    },
    async markInbox(id, status) {
      tx((db) => {
        const i = db.inbox.find((x) => x.id === id);
        if (i) i.status = status;
      });
    },
  },
};
