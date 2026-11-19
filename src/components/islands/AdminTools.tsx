/**
 * Core-team tools for the server (PHP + MySQL) mode: dashboard counts, comment and
 * pitch moderation (approve / hide / delete), inbox read state, users (search,
 * disable, admin role), quiz editor + publish toggle, post visibility, audit log.
 * Renders nothing in demo mode or for non-core accounts (AdminPanel shows the guard).
 */
import { useEffect, useState } from 'react';
import { getBackend } from '../../lib/backend';
import { getState, toast } from '../../lib/store';
import { bn, bnDate } from '../../lib/bn';
import { Loader } from './ui';

type Api = <T>(path: string, body?: unknown) => Promise<T>;
type Tab = 'comments' | 'pitches' | 'inbox' | 'users' | 'quizzes' | 'posts' | 'audit';
const TABS: [Tab, string][] = [['comments', 'মন্তব্য'], ['pitches', 'পিচ'], ['inbox', 'ইনবক্স'], ['users', 'ইউজার'], ['quizzes', 'কুইজ'], ['posts', 'পোস্ট'], ['audit', 'লগ']];

interface Stats { users: number; comments: number; commentsPending: number; pitches: number; pitchesWaiting: number; attempts: number; inbox: number; inboxUnread: number; unlocks?: number; unlocksToday?: number }

export default function AdminTools() {
  const [api, setApi] = useState<Api | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('comments');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void getBackend().then(async (b) => {
      if (b.mode !== 'php') return setOk(false);
      await b.getSession();
      if (getState().user?.role !== 'core') return setOk(false);
      const m = await import('../../lib/backend/php');
      setApi(() => m.api as Api);
      setOk(true);
    });
  }, []);

  const loadStats = () => api?.<Stats>('admin.php?list=stats').then(setStats).catch(() => {});
  useEffect(() => { void loadStats(); }, [api]);

  if (ok === null) return null;
  if (!ok || !api) return null;

  const act = async (body: Record<string, unknown>, msg: string) => {
    try {
      await api('admin.php', body);
      toast(msg, { mood: 'happy' });
      void loadStats();
      return true;
    } catch (e) {
      toast(`হলো না (${(e as { code?: string }).code ?? 'error'})`, { kind: 'error', mood: 'think' });
      return false;
    }
  };

  const tiles: [string, number | undefined, string?][] = [
    ['ইউজার', stats?.users], ['মন্তব্য', stats?.comments, stats ? `${bn(stats.commentsPending)} অপেক্ষায়` : ''],
    ['পিচ', stats?.pitches, stats ? `${bn(stats.pitchesWaiting)} রিভিউতে` : ''], ['কুইজ খেলা', stats?.attempts],
    ['ইনবক্স', stats?.inbox, stats ? `${bn(stats.inboxUnread)} না-পড়া` : ''],
    ['আনলক', stats?.unlocks, stats?.unlocksToday !== undefined ? `আজ ${bn(stats.unlocksToday)}` : ''],
  ];

  return (
    <section className="mt-10 grid gap-4" aria-labelledby="tools-h">
      <h2 id="tools-h" className="section-title">ড্যাশবোর্ড ও টুলস</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, n, sub]) => (
          <div key={l} className="card p-3 text-center">
            <p className="font-display text-2xl text-link">{n === undefined ? '…' : bn(n)}</p>
            <p className="text-xs font-semibold">{l}</p>
            {sub && <p className="text-xs text-ink-soft">{sub}</p>}
          </div>
        ))}
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl bg-tint p-1" aria-label="টুলস">
        {TABS.map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`min-h-11 shrink-0 rounded-xl px-4 font-bold ${tab === id ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}>{l}</button>
        ))}
      </div>
      {tab === 'comments' && <Comments api={api} act={act} />}
      {tab === 'pitches' && <Pitches api={api} act={act} />}
      {tab === 'inbox' && <Inbox api={api} act={act} />}
      {tab === 'users' && <Users api={api} act={act} />}
      {tab === 'quizzes' && <Quizzes api={api} act={act} />}
      {tab === 'posts' && <Posts api={api} act={act} />}
      {tab === 'audit' && <Audit api={api} />}
    </section>
  );
}

type Act = (body: Record<string, unknown>, msg: string) => Promise<boolean>;
const Empty = ({ t }: { t: string }) => <p className="card p-5 text-ink-soft">{t}</p>;
const SmallBtn = ({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
  <button type="button" className={`btn btn-sm ${danger ? 'btn-ghost text-coral-dark' : 'btn-ghost'}`} onClick={onClick}>{children}</button>
);
const confirmDel = (what: string) => window.confirm(`${what} একদম মুছে ফেলবে? ফেরানো যাবে না।`);

function useList<T>(api: Api, path: string, key: string): [T[] | null, () => void] {
  const [rows, setRows] = useState<T[] | null>(null);
  const load = () => { setRows(null); api<Record<string, T[]>>(path).then((r) => setRows(r[key] ?? [])).catch(() => setRows([])); };
  useEffect(load, [path]);
  return [rows, load];
}

interface AComment { id: string; target: { type: string; id: string }; nickname: string; body: string; status: string; createdAt: string }
function Comments({ api, act }: { api: Api; act: Act }) {
  const [status, setStatus] = useState('pending');
  const [rows, reload] = useList<AComment>(api, `admin.php?list=comments&status=${status}`, 'comments');
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {[['pending', 'অপেক্ষায়'], ['approved', 'দেখানো'], ['rejected', 'লুকানো'], ['all', 'সব']].map(([s, l]) => (
          <button key={s} type="button" aria-pressed={status === s} className={`chip min-h-11 ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)}>{l}</button>
        ))}
      </div>
      {rows === null ? <Loader /> : rows.length === 0 ? <Empty t="কিছু নেই ✓" /> : (
        <ul className="grid gap-2">
          {rows.map((c) => (
            <li key={c.id} className="card p-4">
              <p className="text-sm text-ink-soft"><b className="text-ink">{c.nickname}</b> · {c.target.type}/{c.target.id} · {bnDate(c.createdAt)} · <span className="tag !py-0 text-xs">{c.status}</span></p>
              <p className="mt-1 whitespace-pre-line">{c.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.status !== 'approved' && <SmallBtn onClick={() => act({ action: 'comment', id: c.id, status: 'approved' }, 'মন্তব্য দেখানো হলো').then(reload)}>দেখাও</SmallBtn>}
                {c.status !== 'rejected' && <SmallBtn onClick={() => act({ action: 'comment', id: c.id, status: 'rejected' }, 'মন্তব্য লুকানো হলো').then(reload)}>লুকাও</SmallBtn>}
                <SmallBtn danger onClick={() => confirmDel('মন্তব্যটা') && act({ action: 'comment_delete', id: c.id }, 'মুছে ফেলা হলো').then(reload)}>মুছে ফেলো</SmallBtn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface APitch { code: string; title: string; nickname: string; status: string; hidden?: boolean; createdAt: string }
function Pitches({ api, act }: { api: Api; act: Act }) {
  const [rows, reload] = useList<APitch>(api, 'admin.php?list=pitches', 'pitches');
  return rows === null ? <Loader /> : rows.length === 0 ? <Empty t="এখনো কোনো পিচ নেই" /> : (
    <ul className="grid gap-2">
      <p className="hint">স্ট্যাটাস বদলাতে আর ফিডব্যাক দিতে ওপরের “পিচ” ট্যাব ব্যবহার করো।</p>
      {rows.map((p) => (
        <li key={p.code} className="card flex flex-wrap items-center gap-2 p-4">
          <span className="font-en text-sm font-bold text-ink-soft">{p.code}</span>
          <span className="min-w-0 flex-1 font-bold">“{p.title}” <span className="font-normal text-ink-soft">· {p.nickname} · {p.status}</span></span>
          {p.hidden && <span className="tag tag-coral">লুকানো</span>}
          <SmallBtn onClick={() => act({ action: 'pitch_hidden', code: p.code, hidden: !p.hidden }, p.hidden ? 'আবার দেখা যাবে' : 'লুকানো হলো').then(reload)}>{p.hidden ? 'দেখাও' : 'লুকাও'}</SmallBtn>
          <SmallBtn danger onClick={() => confirmDel(`পিচ ${p.code}`) && act({ action: 'pitch_delete', code: p.code }, 'মুছে ফেলা হলো').then(reload)}>মুছে ফেলো</SmallBtn>
        </li>
      ))}
    </ul>
  );
}

interface AInbox { id: string; kind: string; fields: Record<string, string>; status: string; read: boolean; createdAt: string }
const KIND_BN: Record<string, string> = { myth_tip: 'গুজবের খবর', question: 'প্রশ্ন', mentor: 'মেন্টর', contact: 'যোগাযোগ' };
function Inbox({ api, act }: { api: Api; act: Act }) {
  const [rows, reload] = useList<AInbox>(api, 'admin.php?list=inbox', 'inbox');
  return rows === null ? <Loader /> : rows.length === 0 ? <Empty t="ইনবক্স ফাঁকা" /> : (
    <ul className="grid gap-2">
      {rows.map((m) => (
        <li key={m.id} className={`card p-4 ${m.read ? 'opacity-75' : 'ring-2 ring-teal'}`}>
          <p className="text-sm text-ink-soft"><b className="text-ink">{KIND_BN[m.kind] ?? m.kind}</b> · {bnDate(m.createdAt)}{!m.read && <span className="tag ml-2 !py-0 text-xs">নতুন</span>}</p>
          <dl className="mt-1 grid gap-1 text-sm">
            {Object.entries(m.fields).filter(([, v]) => v).map(([k, v]) => <div key={k} className="min-w-0"><dt className="inline font-semibold">{k}: </dt><dd className="inline break-words">{v}</dd></div>)}
          </dl>
          <div className="mt-2"><SmallBtn onClick={() => act({ action: 'inbox_read', id: m.id, read: !m.read }, m.read ? 'না-পড়া করা হলো' : 'পড়া হয়েছে').then(reload)}>{m.read ? 'না-পড়া করো' : 'পড়া হয়েছে'}</SmallBtn></div>
        </li>
      ))}
    </ul>
  );
}

interface AUser { id: number; email: string; username: string | null; nickname: string | null; ageBand: string | null; role: string; disabled: boolean; createdAt: string; lastLogin: string | null }
function Users({ api, act }: { api: Api; act: Act }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [rows, reload] = useList<AUser>(api, `admin.php?list=users&q=${encodeURIComponent(search)}`, 'users');
  const me = getState().user?.id;
  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <label htmlFor="u-q" className="sr-only">ইউজার খোঁজো</label>
        <input id="u-q" className="field flex-1" placeholder="ইমেইল, ইউজারনেম বা ডাকনাম" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn-secondary">খোঁজো</button>
      </form>
      {rows === null ? <Loader /> : rows.length === 0 ? <Empty t="কাউকে পাওয়া গেল না" /> : (
        <ul className="grid gap-2">
          {rows.map((u) => {
            const self = me === `u${u.id}`;
            return (
              <li key={u.id} className="card flex flex-wrap items-center gap-2 p-4">
                <span className="min-w-0 flex-1">
                  <b>{u.nickname ?? '—'}</b> {u.username && <a className="font-en text-sm text-link" href={`/u/?h=${u.username}`}>@{u.username}</a>}
                  <span className="block break-all text-sm text-ink-soft">{u.email} · {u.ageBand ?? 'প্রোফাইল নেই'} · {bnDate(u.createdAt)}</span>
                </span>
                {u.role === 'core' && <span className="tag">অ্যাডমিন</span>}
                {u.disabled && <span className="tag tag-coral">বন্ধ</span>}
                {!self && <SmallBtn onClick={() => act({ action: 'user_role', id: u.id, role: u.role === 'core' ? 'member' : 'core' }, u.role === 'core' ? 'অ্যাডমিন সরানো হলো' : 'অ্যাডমিন করা হলো').then(reload)}>{u.role === 'core' ? 'অ্যাডমিন সরাও' : 'অ্যাডমিন করো'}</SmallBtn>}
                {!self && <SmallBtn danger={!u.disabled} onClick={() => act({ action: 'user_disabled', id: u.id, disabled: !u.disabled }, u.disabled ? 'আবার চালু' : 'আইডি বন্ধ করা হলো').then(reload)}>{u.disabled ? 'চালু করো' : 'বন্ধ করো'}</SmallBtn>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface AQuizRow { slug: string; kind: string; title: string; published: boolean; questions: number }
interface AQuestion { q: string; options: [string, string, string, string]; answer: number; fact: string; image?: string | null; imageAlt?: string | null; credit?: string | null }
interface AQuiz { slug: string; kind: string; title: string; blurb: string; secondsPerQuestion: number; published: boolean; opensAt?: string | null; questions: AQuestion[] }
const blankQ = (): AQuestion => ({ q: '', options: ['', '', '', ''], answer: 0, fact: '' });

function Quizzes({ api, act }: { api: Api; act: Act }) {
  const [rows, reload] = useList<AQuizRow>(api, 'admin.php?list=quizzes', 'quizzes');
  const [edit, setEdit] = useState<AQuiz | null>(null);
  if (edit) return <QuizEditor quiz={edit} act={act} onClose={() => { setEdit(null); reload(); }} />;
  return (
    <div className="grid gap-3">
      <button type="button" className="btn btn-primary justify-self-start" onClick={() => setEdit({ slug: '', kind: 'season', title: '', blurb: '', secondsPerQuestion: 20, published: false, questions: [blankQ()] })}>+ নতুন কুইজ</button>
      <p className="hint">সাইটের তৈরি-করা কুইজ (quizzes.json) আবার সিড হলে তার প্রশ্ন ফাইলের মতো হয়ে যায়; নতুন স্লাগের কুইজ থাকে /quiz/play/?q=স্লাগ ঠিকানায়।</p>
      {rows === null ? <Loader /> : (
        <ul className="grid gap-2">
          {rows.map((z) => (
            <li key={z.slug} className="card flex flex-wrap items-center gap-2 p-4">
              <span className="min-w-0 flex-1"><b>{z.title}</b><span className="block font-en text-sm text-ink-soft">{z.slug} · {z.kind} · {bn(z.questions)} প্রশ্ন</span></span>
              <span className={`tag ${z.published ? '' : 'tag-coral'}`}>{z.published ? 'প্রকাশিত' : 'খসড়া'}</span>
              <SmallBtn onClick={() => act({ action: 'quiz_publish', slug: z.slug, published: !z.published }, z.published ? 'খসড়া করা হলো' : 'প্রকাশ হলো').then(reload)}>{z.published ? 'লুকাও' : 'প্রকাশ করো'}</SmallBtn>
              <SmallBtn onClick={() => api<AQuiz>(`admin.php?list=quiz&slug=${z.slug}`).then(setEdit)}>এডিট</SmallBtn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizEditor({ quiz, act, onClose }: { quiz: AQuiz; act: Act; onClose: () => void }) {
  const [z, setZ] = useState<AQuiz>(quiz);
  const [busy, setBusy] = useState(false);
  const isNew = !quiz.slug;
  const setQ = (i: number, patch: Partial<AQuestion>) => setZ((x) => ({ ...x, questions: x.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) }));
  return (
    <form className="card grid gap-4 p-4 sm:p-6" onSubmit={async (e) => {
      e.preventDefault();
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(z.slug)) return toast('স্লাগ: ইংরেজি ছোট হাতের অক্ষর, সংখ্যা আর -', { kind: 'error' });
      setBusy(true);
      const ok = await act({ action: 'quiz_save', quiz: z }, 'কুইজ সেভ হয়েছে');
      setBusy(false);
      if (ok) onClose();
    }}>
      <div className="flex items-center gap-2"><h3 className="flex-1 text-lg font-bold">{isNew ? 'নতুন কুইজ' : `এডিট: ${quiz.title}`}</h3><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>বাতিল</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="qz-slug">স্লাগ (ঠিকানা)</label><input id="qz-slug" className="field font-en" value={z.slug} disabled={!isNew} onChange={(e) => setZ({ ...z, slug: e.target.value.toLowerCase().trim() })} placeholder="bhabu-quiz-s2" /></div>
        <div><label className="label" htmlFor="qz-title">শিরোনাম</label><input id="qz-title" className="field" value={z.title} onChange={(e) => setZ({ ...z, title: e.target.value })} required /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="qz-blurb">এক লাইনের পরিচয়</label><input id="qz-blurb" className="field" value={z.blurb} onChange={(e) => setZ({ ...z, blurb: e.target.value })} /></div>
        <div><label className="label" htmlFor="qz-secs">প্রতি প্রশ্নে সেকেন্ড</label><input id="qz-secs" type="number" min={5} max={120} className="field" value={z.secondsPerQuestion} onChange={(e) => setZ({ ...z, secondsPerQuestion: +e.target.value })} /></div>
        <label className="flex min-h-11 items-center gap-3 self-end"><input type="checkbox" className="h-5 w-5 accent-teal" checked={z.published} onChange={(e) => setZ({ ...z, published: e.target.checked })} />প্রকাশিত</label>
      </div>
      {z.questions.map((q, i) => (
        <fieldset key={i} className="grid gap-2 rounded-2xl bg-tint p-3">
          <legend className="font-bold">প্রশ্ন {bn(i + 1)}</legend>
          <label className="sr-only" htmlFor={`qq-${i}`}>প্রশ্ন</label>
          <textarea id={`qq-${i}`} className="field" rows={2} value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder="প্রশ্নটা লেখো" required />
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`ans-${i}`} aria-label={`সঠিক উত্তর ${'কখগঘ'[k]}`} className="h-6 w-6 shrink-0 accent-teal" checked={q.answer === k} onChange={() => setQ(i, { answer: k })} />
              <input className="field flex-1" value={o} aria-label={`অপশন ${'কখগঘ'[k]}`} placeholder={`অপশন ${'কখগঘ'[k]}`} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) as AQuestion['options'] })} required />
            </div>
          ))}
          <textarea className="field" rows={2} aria-label="ব্যাখ্যা" value={q.fact} onChange={(e) => setQ(i, { fact: e.target.value })} placeholder="উত্তরের পর ভাবুর ব্যাখ্যা" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field font-en" aria-label="ছবি" value={q.image ?? ''} onChange={(e) => setQ(i, { image: e.target.value || null })} placeholder="/media/quiz/…webp (ঐচ্ছিক)" />
            <input className="field" aria-label="ছবির ক্রেডিট" value={q.credit ?? ''} onChange={(e) => setQ(i, { credit: e.target.value || null })} placeholder="ছবির ক্রেডিট" />
          </div>
          {z.questions.length > 1 && <SmallBtn danger onClick={() => setZ({ ...z, questions: z.questions.filter((_, k) => k !== i) })}>প্রশ্নটা বাদ দাও</SmallBtn>}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setZ({ ...z, questions: [...z.questions, blankQ()] })}>+ প্রশ্ন যোগ করো</button>
        <button type="submit" className="btn btn-primary ml-auto" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : 'সেভ করো'}</button>
      </div>
    </form>
  );
}

interface APost { series: string; slug: string; title: string; publishedAt: string; hidden: boolean }
function Posts({ api, act }: { api: Api; act: Act }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [rows, reload] = useList<APost>(api, `admin.php?list=posts&q=${encodeURIComponent(search)}`, 'posts');
  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <label htmlFor="p-q" className="sr-only">পোস্ট খোঁজো</label>
        <input id="p-q" className="field flex-1" placeholder="শিরোনাম বা সিরিজ" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn-secondary">খোঁজো</button>
      </form>
      <p className="hint">লুকানো পোস্ট API আর লাইভ তালিকা থেকে সরে যায়; সাইটের স্থায়ী পাতা পরের বিল্ডে।</p>
      {rows === null ? <Loader /> : rows.length === 0 ? <Empty t="কোনো পোস্ট নেই" /> : (
        <ul className="grid gap-2">
          {rows.map((p) => (
            <li key={p.series + p.slug} className="card flex flex-wrap items-center gap-2 p-4">
              <span className="min-w-0 flex-1"><b className="line-clamp-2">{p.title}</b><span className="block font-en text-sm text-ink-soft">{p.series}/{p.slug} · {p.publishedAt}</span></span>
              {p.hidden && <span className="tag tag-coral">লুকানো</span>}
              <SmallBtn onClick={() => act({ action: 'post_hidden', series: p.series, slug: p.slug, hidden: !p.hidden }, p.hidden ? 'পোস্ট দেখানো হলো' : 'পোস্ট লুকানো হলো').then(reload)}>{p.hidden ? 'দেখাও' : 'লুকাও'}</SmallBtn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AAudit { at: string; by: string; action: string; target: string; detail: Record<string, unknown> | null }
function Audit({ api }: { api: Api }) {
  const [rows] = useList<AAudit>(api, 'admin.php?list=audit', 'audit');
  return rows === null ? <Loader /> : rows.length === 0 ? <Empty t="এখনো কোনো কাজের লগ নেই" /> : (
    <ul className="card divide-y divide-line">
      {rows.map((r, i) => (
        <li key={i} className="p-3 text-sm">
          <span className="font-en font-bold">{r.action}</span> <span className="font-en">{r.target}</span>
          {r.detail && <span className="font-en text-ink-soft"> {JSON.stringify(r.detail)}</span>}
          <span className="block break-all text-ink-soft">{r.by} · {bnDate(r.at)}</span>
        </li>
      ))}
    </ul>
  );
}
