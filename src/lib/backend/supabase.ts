/**
 * SUPABASE BACKEND — active when PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY
 * are set. Schema, row-level security and RPCs: supabase/migrations/0001_init.sql.
 *
 * The anon key is public by design; every table is protected by RLS:
 *  - profiles: owner read/write; public view exposes only safe columns
 *  - teens (13-17): never public until a parent confirms; real name/photo
 *    only for 18+ with consent
 *  - pitches/comments/inbox: insert own, read own; core team reads all
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Backend, Pitch, Comment, InboxItem, LeaderRow, ProfileInput, PublicPitchStatus } from './types';
import { getState, update, type LocalUser } from '../store';
import { DEFAULT_AVATAR } from '../bhabu';

let clientPromise: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.PUBLIC_SUPABASE_URL!, import.meta.env.PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    }),
  );
  return clientPromise;
}

type ProfileRow = {
  id: string; username: string; nickname: string; age_band: '13-17' | '18+'; parent_email: string | null;
  parent_confirmed_at: string | null; is_public: boolean; show_real_name: boolean; real_name: string | null;
  district: string | null; school_id: string | null; bio: string | null; avatar: LocalUser['avatar'] | null;
  role: 'member' | 'core' | 'mentor' | 'editor'; created_at: string;
};

function toLocal(row: ProfileRow, email: string, method: LocalUser['method']): LocalUser {
  return {
    id: row.id,
    email,
    username: row.username,
    nickname: row.nickname,
    ageBand: row.age_band,
    parentEmail: row.parent_email ?? undefined,
    parentConfirmed: row.age_band === '18+' || !!row.parent_confirmed_at,
    isPublic: row.is_public,
    showRealName: row.show_real_name,
    realName: row.real_name ?? undefined,
    district: row.district ?? undefined,
    schoolId: row.school_id ?? undefined,
    bio: row.bio ?? undefined,
    avatar: row.avatar ?? DEFAULT_AVATAR,
    method,
    createdAt: row.created_at,
    role: row.role === 'core' ? 'core' : 'member',
  };
}

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

export const supabaseBackend: Backend = {
  mode: 'supabase',

  async startGoogle() {
    const c = await sb();
    const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin()}/id` } });
    if (error) throw error;
    return {};
  },
  async sendMagicLink(email) {
    const c = await sb();
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin()}/id`, shouldCreateUser: true } });
    if (error) throw error;
    return {};
  },
  async getSession() {
    const c = await sb();
    const { data } = await c.auth.getSession();
    const s = data.session;
    if (!s) {
      update((st) => { st.user = null; });
      return null;
    }
    const { data: row } = await c.from('profiles').select('*').eq('id', s.user.id).maybeSingle<ProfileRow>();
    const method = s.user.app_metadata?.provider === 'google' ? 'google' : 'magic';
    if (!row) {
      // authenticated but no profile yet → onboarding step on /id
      update((st) => { st.flags.authEmail = s.user.email ?? ''; st.flags.authMethod = method; });
      return null;
    }
    const user = toLocal(row, s.user.email ?? '', method);
    update((st) => { st.user = user; st.guest = null; });
    return { user };
  },
  async usernameAvailable(username) {
    const c = await sb();
    const { data } = await c.rpc('username_available', { p_username: username });
    return !!data;
  },
  async confirmParent(token) {
    const c = await sb();
    const { data } = await c.rpc('confirm_parent', { p_token: token });
    return (data as string | null) ?? null;
  },
  async saveProfile(input: ProfileInput) {
    const c = await sb();
    const { data: auth } = await c.auth.getUser();
    if (!auth.user) throw new Error('not-signed-in');
    const teen = input.ageBand === '13-17';
    const row = {
      id: auth.user.id,
      username: input.username.toLowerCase(),
      nickname: input.nickname,
      age_band: input.ageBand,
      parent_email: teen ? input.parentEmail ?? null : null,
      is_public: teen ? false : input.isPublic,
      show_real_name: teen ? false : input.showRealName,
      real_name: teen ? null : input.realName ?? null,
      district: input.district ?? null,
      school_id: input.schoolId ?? null,
      bio: input.bio ?? null,
      avatar: input.avatar,
    };
    const { data, error } = await c.from('profiles').upsert(row).select('*').single<ProfileRow>();
    if (error) throw error;
    const method = auth.user.app_metadata?.provider === 'google' ? 'google' : 'magic';
    const user = toLocal(data, auth.user.email ?? '', method);
    update((st) => { st.user = user; delete st.flags.authEmail; });
    return user;
  },
  async signOut() {
    const c = await sb();
    await c.auth.signOut();
    update((st) => { st.user = null; });
  },
  async deleteMyData() {
    const c = await sb();
    const { error } = await c.rpc('delete_my_account');
    if (error) throw error;
    await c.auth.signOut();
  },

  async recordAttempt(a) {
    if (!getState().user) return; // guests (incl. under-13) keep scores on device only
    const c = await sb();
    await c.from('quiz_attempts').insert({ quiz_slug: a.quizSlug, score: a.score, total: a.total, points: a.points, duration_ms: a.durationMs });
  },
  async playCount(quizSlug) {
    const c = await sb();
    const { data } = await c.rpc('quiz_play_count', { p_slug: quizSlug });
    return Number(data ?? 0);
  },
  async leaderboard(scope, quizSlug) {
    const c = await sb();
    const { data } = await c.rpc('leaderboard', { p_scope: scope, p_quiz: quizSlug ?? null });
    const me = getState().user?.nickname;
    return ((data as { name: string; sub: string | null; score: number; plays: number }[]) ?? []).map((r, i): LeaderRow => ({
      rank: i + 1, name: r.name, sub: r.sub ?? undefined, score: r.score, plays: r.plays, me: scope === 'people' && r.name === me,
    }));
  },

  async submitPitch(p) {
    const c = await sb();
    const { data, error } = await c.from('pitches')
      .insert({ title: p.workingTitle, subject: p.subject, nickname: p.nickname, payload: p })
      .select('code').single<{ code: string }>();
    if (error) throw error;
    update((st) => { st.pitches = [data.code, ...st.pitches]; });
    return { code: data.code };
  },
  async pitchStatus(code) {
    const c = await sb();
    const { data } = await c.rpc('pitch_status', { p_code: code.trim().toUpperCase() });
    return (data as PublicPitchStatus | null) ?? null;
  },
  async myPitches() {
    const c = await sb();
    const { data } = await c.from('pitches').select('code,status,title,subject,nickname,created_at,updated_at,feedback,mentor_name,pitch_events(status,at,note)').order('created_at', { ascending: false });
    return (data ?? []).map(mapPitch);
  },

  async listComments(t) {
    const c = await sb();
    const { data } = await c.rpc('list_comments', { p_type: t.type, p_id: t.id });
    return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
      id: String(r.id), target: t, nickname: String(r.nickname), avatar: r.avatar as Comment['avatar'], body: String(r.body),
      status: r.status as Comment['status'], createdAt: String(r.created_at), mine: !!r.mine,
    }));
  },
  async postComment(t, body) {
    const c = await sb();
    const { data, error } = await c.from('comments').insert({ target_type: t.type, target_id: t.id, body }).select('id,created_at').single<{ id: string; created_at: string }>();
    if (error) throw error;
    const u = getState().user!;
    return { id: data.id, target: t, nickname: u.nickname, avatar: u.avatar, body, status: 'pending', createdAt: data.created_at, mine: true };
  },
  async submitInbox(kind, fields) {
    const c = await sb();
    const { error } = await c.from('inbox').insert({ kind, fields });
    if (error) throw error;
  },
  async setFollow(seriesSlug, on) {
    const c = await sb();
    if (!getState().user) return;
    if (on) await c.from('follows').upsert({ series_slug: seriesSlug });
    else await c.from('follows').delete().eq('series_slug', seriesSlug);
  },

  admin: {
    async pitches() {
      const c = await sb();
      const { data } = await c.from('pitches').select('code,status,title,subject,nickname,created_at,updated_at,feedback,mentor_name,payload,pitch_events(status,at,note)').order('created_at', { ascending: false });
      return (data ?? []).map(mapPitch);
    },
    async updatePitch(code, status, opts = {}) {
      const c = await sb();
      const { error } = await c.from('pitches').update({ status, feedback: opts.feedback ?? null, mentor_name: opts.mentorName ?? null }).eq('code', code);
      if (error) throw error;
    },
    async pendingComments() {
      const c = await sb();
      const { data } = await c.from('comments').select('id,target_type,target_id,body,status,created_at,profiles(nickname,avatar)').eq('status', 'pending');
      return (data ?? []).map((r: Record<string, any>) => ({
        id: r.id, target: { type: r.target_type, id: r.target_id }, nickname: r.profiles?.nickname ?? '—', avatar: r.profiles?.avatar,
        body: r.body, status: r.status, createdAt: r.created_at,
      }));
    },
    async moderate(id, status) {
      const c = await sb();
      await c.from('comments').update({ status }).eq('id', id);
    },
    async inbox(kind) {
      const c = await sb();
      let q = c.from('inbox').select('id,kind,created_at,status,fields').order('created_at', { ascending: false });
      if (kind) q = q.eq('kind', kind);
      const { data } = await q;
      return (data ?? []).map((r: Record<string, any>): InboxItem => ({ id: r.id, kind: r.kind, createdAt: r.created_at, status: r.status, fields: r.fields }));
    },
    async markInbox(id, status) {
      const c = await sb();
      await c.from('inbox').update({ status }).eq('id', id);
    },
  },
};

function mapPitch(r: Record<string, any>): Pitch {
  return {
    code: r.code, status: r.status, title: r.title, subject: r.subject, nickname: r.nickname,
    createdAt: r.created_at, updatedAt: r.updated_at, feedback: r.feedback ?? undefined, mentorName: r.mentor_name ?? undefined,
    history: (r.pitch_events ?? []).sort((a: any, b: any) => Date.parse(a.at) - Date.parse(b.at)),
    payload: r.payload, mine: true,
  };
}
