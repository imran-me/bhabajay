/**
 * আমার ভাবা যায় — "your curiosity, on one page" (Plan p.13), plus settings:
 * privacy, notifications, avatar studio, export + one-tap "delete my data".
 */
import { useEffect, useMemo, useState } from 'react';
import { getBackend, PITCH_STEPS, type Backend, type Pitch } from '../../lib/backend';
import { getState, subscribe, update, currentStreak, computeTier, curiousProgress, freezeAvailable, setPref, toast, type State } from '../../lib/store';
import { BADGES, TIERS } from '../../lib/badges';
import { bn, bnMonthYear, bnAgo, TIER_LABEL } from '../../lib/bn';
import { doodleSvg } from '../../lib/doodles';
import { sound, confetti } from '../../lib/fx';
import type { AvatarConfig } from '../../data/types';
import AvatarStudio from './AvatarStudio';
import { Avatar, Bhabu, Flame, Icon, InterestPicker, Loader } from './ui';

interface Item { id: string; title: string; url: string }
interface Props {
  seriesList?: { slug: string; title: string }[];
  catalog: { post: Item[]; myth: Item[]; episode: Item[]; series: Item[] };
  quizTopics: Record<string, string>;
  schools: { id: string; name: string; district: string }[];
  districts: string[];
}

const BG = { teal: 'bg-teal', coral: 'bg-coral', sun: 'bg-sun', deep: 'bg-deep', mint: 'bg-mint' } as const;

export default function MeDashboard({ catalog, quizTopics, schools, districts, seriesList = [] }: Props) {
  const [st, setSt] = useState<State>(getState);
  const [b, setB] = useState<Backend | null>(null);
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => subscribe(setSt), []);
  useEffect(() => {
    void getBackend().then(async (be) => {
      setB(be);
      await be.getSession();
      setPitches(await be.myPitches());
    });
    // reading the page marks notices read
    const t = setTimeout(() => update((s) => { s.notices = s.notices.map((n) => ({ ...n, read: true })); }), 2500);
    return () => clearTimeout(t);
  }, []);

  const u = st.user;
  const tier = computeTier(st);
  const streak = currentStreak(st);
  const badgeCount = Object.keys(st.badges).length;
  const lookup = useMemo(() => {
    const m = new Map<string, Item>();
    (['post', 'myth', 'episode'] as const).forEach((t) => catalog[t].forEach((i) => m.set(`${t}:${i.id}`, i)));
    return m;
  }, [catalog]);
  const seriesMap = useMemo(() => new Map(catalog.series.map((s) => [s.id, s])), [catalog]);
  const quizStats = useMemo(() => {
    const qs = Object.entries(st.quizzes);
    if (!qs.length) return null;
    const avg = Math.round((qs.reduce((a, [, q]) => a + q.best / q.total, 0) / qs.length) * 100);
    const byTopic: Record<string, number[]> = {};
    qs.forEach(([slug, q]) => { const t = quizTopics[slug]; if (t) (byTopic[t] ??= []).push(q.best / q.total); });
    const best = Object.entries(byTopic).sort((x, y) => avg2(y[1]) - avg2(x[1]))[0]?.[0];
    return { avg, best, played: st.quizPlays };
  }, [st.quizzes, st.quizPlays]);
  const prog = curiousProgress(st);

  async function saveAvatar(a: AvatarConfig) {
    if (!b) return;
    if (u) await b.saveProfile({ ...u, avatar: a });
    else update((s) => { s.flags.guestAvatar = JSON.stringify(a); });
    sound.badge();
    confetti({ count: 60 });
    toast('নতুন ভাবু সেভ হয়েছে!', { mood: 'wow' });
  }

  async function saveSettings(patch: Partial<NonNullable<State['user']>>) {
    if (!b || !u) return;
    await b.saveProfile({ ...u, ...patch });
    toast('সেটিংস সেভ হয়েছে', { mood: 'happy' });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bhabajay-amar-data.json';
    a.click();
  }

  const guestAvatar: AvatarConfig | null = st.flags.guestAvatar ? JSON.parse(st.flags.guestAvatar) : null;
  const avatar = u?.avatar ?? guestAvatar ?? { face: 'wow', hat: 'none', prop: 'none', ground: 'sun', body: 'teal' };
  const name = u?.nickname ?? (st.guest ? 'অতিথি' : 'তুমি');

  return (
    <div className="grid gap-6">
      {/* ───────── header ───────── */}
      <section className="overflow-hidden rounded-[28px] bg-tint">
        <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-center sm:p-8 sm:text-left">
          <Avatar avatar={avatar} tier={tier ?? 'none'} className="h-32 w-32 sm:h-36 sm:w-36" title={name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-4xl leading-none">{name}</h1>
              {tier && <span className="tag tag-sun">⭐ {TIER_LABEL[tier].bn}</span>}
              {u && !u.isPublic && <span className="tag"><Icon name="lock" className="h-3.5 w-3.5" />ব্যক্তিগত</span>}
            </div>
            <p className="mt-1 text-ink-soft">
              {u ? <>{u.bio ? `“${u.bio}” · ` : ''}যোগ দিয়েছে {bnMonthYear(u.createdAt)} · <span className="font-en">@{u.username}</span></> : st.guest ? '১৩ বছরের নিচে — সব কিছু শুধু এই ফোনে' : 'আইডি ছাড়া খেলছ — স্কোর শুধু এই ব্রাউজারে'}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 font-bold sm:justify-start">
              <span className="inline-flex items-center gap-1.5"><Flame streak={streak} className="h-6 w-6" />{bn(streak)} দিনের স্ট্রিক</span>
              <span className="inline-flex items-center gap-1.5">🧠 {bn(st.points)} পয়েন্ট</span>
              <span className="inline-flex items-center gap-1.5">🏅 {bn(badgeCount)} ব্যাজ</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{freezeAvailable(st) ? '🧊 এই সপ্তাহের ফ্রিজ জমা আছে — একদিন মিস হলেও স্ট্রিক বাঁচবে' : '🧊 এই সপ্তাহের ফ্রিজ ব্যবহার হয়ে গেছে'} · সেরা স্ট্রিক {bn(st.streak.best)}</p>
          </div>
          {!u && !st.guest && <a href="/id" className="btn btn-primary sm:ml-auto">আইডি বানাও</a>}
        </div>
      </section>

      {u && u.ageBand === '13-17' && !u.parentConfirmed && (
        <div className="flex items-start gap-3 rounded-2xl bg-sun-soft p-4">
          <Icon name="mail" className="mt-0.5 h-5 w-5 text-mustard dark:text-sun" />
          <p className="text-sm">অভিভাবকের নিশ্চিতকরণের অপেক্ষায় (<b>{u.parentEmail}</b>)। ততক্ষণ প্রোফাইল ব্যক্তিগত, আর পিচ পাঠানো বন্ধ।
            {b?.mode === 'demo' && <button type="button" className="ml-2 font-bold text-link underline" onClick={() => update((s) => { if (s.user) s.user.parentConfirmed = true; })}>ডেমো: নিশ্চিত করো</button>}
          </p>
        </div>
      )}

      {/* notifications */}
      {st.notices.length > 0 && (
        <section id="notices" className="card scroll-mt-24 p-5" aria-labelledby="nt-h">
          <h2 id="nt-h" className="text-xl font-bold">ভাবুর খবর</h2>
          <ul className="mt-3 grid gap-2">
            {st.notices.slice(0, 5).map((n) => (
              <li key={n.id}>
                <a href={n.href ?? '#'} className={`flex items-start gap-3 rounded-2xl p-3 ${n.read ? 'hover:bg-tint' : 'bg-sun-soft'}`}>
                  <Bhabu face={n.mood} body="teal" dot="coral" sparks={n.mood === 'wow'} className="w-8" />
                  <span className="min-w-0"><span className="block font-bold">{n.title}</span><span className="text-sm text-ink-soft">{n.body}</span><span className="block text-xs text-ink-soft">{bnAgo(n.at)}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* my series + follows */}
        <section className="card p-5" aria-labelledby="ms-h">
          <h2 id="ms-h" className="text-xl font-bold">আমার সিরিজ</h2>
          {pitches === null ? <Loader /> : pitches.some((p) => p.status === 'live') ? (
            pitches.filter((p) => p.status === 'live').map((p) => (
              <div key={p.code} className="mt-3 flex items-center gap-3">
                <span className="h-14 w-14 rounded-2xl bg-coral" />
                <div><p className="text-lg font-bold">{p.title}</p><span className="tag">লাইভ ✓</span></div>
              </div>
            ))
          ) : (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-coral/60 p-4">
              <p className="font-semibold">এখনো নিজের সিরিজ নেই।</p>
              <p className="text-sm text-ink-soft">তোমাকে রাতে ঘুমাতে দেয় না এমন একটা প্রশ্ন আছে? সেটাই সিরিজ হতে পারে।</p>
              <a href="/initiator/pitch" className="btn btn-primary btn-sm mt-3">আইডিয়া পাঠাও</a>
            </div>
          )}
          <p className="mt-4 text-sm"><b>ফলো করি:</b> {st.follows.length ? st.follows.map((f, i) => <span key={f}>{i > 0 && ' · '}<a className="link" href={seriesMap.get(f)?.url ?? '#'}>{seriesMap.get(f)?.title ?? f}</a></span>) : <span className="text-ink-soft">কাউকে না — <a href="/series" className="link">সিরিজ দেখো</a></span>}</p>
        </section>

        {/* badges */}
        <section id="badges" className="card scroll-mt-24 p-5" aria-labelledby="bd-h">
          <h2 id="bd-h" className="text-xl font-bold">ব্যাজ <span className="text-base font-semibold text-ink-soft">{bn(badgeCount)}/{bn(BADGES.length)}</span></h2>
          <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6">
            {BADGES.map((bd) => {
              const got = !!st.badges[bd.id];
              return (
                <li key={bd.id} className="flex flex-col items-center gap-1 text-center" title={got ? bd.bn : `${bd.bn} — ${bd.how}`}>
                  <span className={`grid h-14 w-14 place-items-center rounded-full ${got ? `${BG[bd.bg]} ring-4 ring-white/70 shadow-[0_3px_0_rgb(0_0_0/.12)]` : 'bg-line'}`}>
                    {got ? (bd.text ? <span className={`font-stamp text-lg ${bd.bg === 'sun' || bd.bg === 'mint' ? 'text-deep' : 'text-white'}`}>{bd.text}</span> : <span className="h-8 w-8" dangerouslySetInnerHTML={{ __html: doodleSvg(bd.doodle!, { className: 'w-full h-full' }) }} />) : <span className="font-display text-xl text-ink-soft">?</span>}
                  </span>
                  <span className={`text-[.7rem] font-semibold leading-tight ${got ? '' : 'text-ink-soft'}`}>{got ? bd.bn : bd.how === '???' ? '???' : bd.bn}</span>
                </li>
              );
            })}
          </ul>
          {quizStats && <p className="mt-4 text-sm"><b>কুইজ:</b> গড় {bn(quizStats.avg)}%{quizStats.best ? ` · সেরা: ${quizStats.best}` : ''} · {bn(quizStats.played)} বার খেলা</p>}
        </section>

        {/* saved */}
        <section id="saved" className="card scroll-mt-24 p-5" aria-labelledby="sv-h">
          <h2 id="sv-h" className="text-xl font-bold">সেভ করা</h2>
          {st.saves.length === 0 ? (
            <p className="mt-2 text-ink-soft">কার্ড, মিথ বা পর্বে 🔖 চাপলে এখানে জমা হবে।</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {st.saves.slice(0, 8).map((s) => {
                const it = lookup.get(`${s.type}:${s.id}`);
                return it ? (
                  <li key={`${s.type}:${s.id}`}><a href={it.url} className="flex items-center gap-3 rounded-xl p-2 hover:bg-tint"><span className="tag !py-0 text-xs">{s.type === 'myth' ? 'মিথ' : s.type === 'episode' ? 'পর্ব' : 'কার্ড'}</span><span className="font-semibold">{it.title}</span></a></li>
                ) : null;
              })}
            </ul>
          )}
        </section>

        {/* pitch status */}
        <section className="card p-5" aria-labelledby="ps-h">
          <h2 id="ps-h" className="text-xl font-bold">পিচ স্ট্যাটাস</h2>
          {pitches === null ? <Loader /> : pitches.length === 0 ? (
            <p className="mt-2 text-ink-soft">কোনো পিচ নেই। <a href="/initiator" className="link">কীভাবে কাজ করে দেখো →</a></p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {pitches.map((p) => {
                const step = PITCH_STEPS.findIndex((s) => s.id === p.status);
                return (
                  <li key={p.code} className="rounded-2xl bg-tint p-3">
                    <a href={`/initiator/track?code=${p.code}`} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">“{p.title}”</span>
                      <span className={`tag ${p.status === 'not_yet' ? 'tag-coral' : 'tag-sun'}`}>{p.status === 'not_yet' ? 'এখনো না' : PITCH_STEPS[step]?.bn}</span>
                      <span className="ml-auto font-en text-xs text-ink-soft">{p.code}</span>
                    </a>
                    {p.mentorName && <p className="mt-1 text-sm text-ink-soft">মেন্টর: {p.mentorName}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* tier ladder */}
      <section className="card p-5" aria-labelledby="tr-h">
        <h2 id="tr-h" className="text-xl font-bold">ওয়াল অফ ফেমের সিঁড়ি</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {TIERS.map((t, i) => {
            const reached = tier && TIERS.findIndex((x) => x.id === tier) >= i;
            return (
              <li key={t.id} className={`rounded-2xl p-4 ${reached ? 'bg-deep text-white' : 'bg-tint'}`}>
                <p className="font-display text-2xl">{bn(i + 1)}</p>
                <p className="font-bold">{t.bn} {reached && '✓'}</p>
                <p className={`mt-1 text-xs ${reached ? 'text-white/75' : 'text-ink-soft'}`}>{t.need}</p>
              </li>
            );
          })}
        </ol>
        {!tier && (
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <Prog label="কুইজ খেলা" v={prog.quizzes} max={3} />
            <Prog label="পোস্ট সেভ" v={prog.saves} max={5} />
            <Prog label="সেরা স্ট্রিক" v={prog.streak} max={7} />
            <p className="text-ink-soft sm:col-span-3">যেকোনো একটা পূরণ হলেই তুমি <b>কৌতূহলী</b>{!u && ' (আইডি লাগবে)'} — অবতার স্টুডিওর রিং খুলে যাবে।</p>
          </div>
        )}
      </section>

      {/* avatar studio */}
      <section id="avatar" className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="av-h">
        <h2 id="av-h" className="mb-4 text-xl font-bold">অবতার স্টুডিও: তোমার ভাবু বানাও</h2>
        <AvatarStudio value={avatar} tier={tier} badges={st.badges} onSave={saveAvatar} />
      </section>

      {/* settings */}
      <section id="settings" className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="st-h">
        <h2 id="st-h" className="text-xl font-bold">সেটিংস ও গোপনীয়তা</h2>
        {u ? <><ProfileSettings u={u} schools={schools} districts={districts} seriesList={seriesList} onSave={saveSettings} />{b?.mode === 'php' && <a href={`/u/?h=${u.username}`} className="btn btn-ghost btn-sm mt-3">আমার পাবলিক প্রোফাইল দেখো →</a>}</> : <p className="mt-2 text-ink-soft">প্রোফাইল সেটিংস আইডি বানালে পাবে।</p>}

        <div className="mt-6 grid gap-3 border-t border-line pt-5">
          <h3 className="font-bold">নোটিফিকেশন</h3>
          <Toggle label="ইমেইলে খবর (ফলো করা সিরিজের নতুন পোস্ট, পিচের অগ্রগতি)" on={st.prefs.notifyEmail} onChange={(v) => setPref('notifyEmail', v)} />
          <Toggle label="ব্রাউজার নোটিফিকেশন (ওয়েব-পুশ, ঐচ্ছিক)" on={st.prefs.notifyPush} onChange={async (v) => {
            if (v && 'Notification' in window) {
              const p = await Notification.requestPermission();
              if (p !== 'granted') return toast('ব্রাউজার অনুমতি দেয়নি', { mood: 'think' });
            }
            setPref('notifyPush', v);
          }} />
          <Toggle label="শব্দ (ছোট্ট পপ আর ব্যাজের সুর)" on={st.prefs.sound} onChange={(v) => setPref('sound', v)} />
        </div>

        <div className="mt-6 grid gap-3 border-t border-line pt-5">
          <h3 className="font-bold">আমার ডেটা</h3>
          <p className="text-sm text-ink-soft">আমরা যতটা সম্ভব কম তথ্য রাখি। চাইলে সব নামিয়ে নাও বা এক চাপে মুছে দাও।</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportData}><Icon name="download" className="h-4 w-4" />ডেটা নামাও (JSON)</button>
            {u && <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await b?.signOut(); toast('লগ আউট হয়েছে', { mood: 'wink' }); }}><Icon name="logout" className="h-4 w-4" />লগ আউট</button>}
            {!confirmDelete ? (
              <button type="button" className="btn btn-sm !bg-coral-soft !text-coral-dark !shadow-none" onClick={() => setConfirmDelete(true)}><Icon name="trash" className="h-4 w-4" />আমার ডেটা মুছে দাও</button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 rounded-2xl bg-coral-soft p-2 pl-3 text-sm font-semibold">
                নিশ্চিত? স্কোর, ব্যাজ, সেভ, পিচ — সব মুছে যাবে।
                <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await b?.deleteMyData(); setConfirmDelete(false); toast('সব মুছে দেওয়া হয়েছে। ভালো থেকো!', { mood: 'think' }); setTimeout(() => (location.href = '/'), 900); }}>হ্যাঁ, মুছে দাও</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>না</button>
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function avg2(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

function Prog({ label, v, max }: { label: string; v: number; max: number }) {
  return (
    <div className="rounded-2xl bg-tint p-3">
      <p className="flex justify-between font-semibold"><span>{label}</span><span>{bn(v)}/{bn(max)}</span></p>
      <div className="mt-1.5 h-2 rounded-full bg-surface"><div className="h-full rounded-full bg-sun" style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="grid min-h-11 w-12 shrink-0 place-items-center">
        <span className={`relative block h-7 w-12 rounded-full transition ${on ? 'bg-teal' : 'bg-line'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
        </span>
      </button>
      <span>{label}</span>
    </label>
  );
}

function ProfileSettings({ u, schools, districts, seriesList, onSave }: { u: NonNullable<State['user']>; schools: Props['schools']; districts: string[]; seriesList: { slug: string; title: string }[]; onSave: (p: Partial<NonNullable<State['user']>>) => void }) {
  const [nickname, setNickname] = useState(u.nickname);
  const [bio, setBio] = useState(u.bio ?? '');
  const [isPublic, setIsPublic] = useState(u.isPublic);
  const [showDistrict, setShowDistrict] = useState(!!u.showDistrict);
  const [showRealName, setShowRealName] = useState(u.showRealName);
  const [realName, setRealName] = useState(u.realName ?? '');
  const [district, setDistrict] = useState(u.district ?? '');
  const [schoolId, setSchoolId] = useState(u.schoolId ?? '');
  const [interests, setInterests] = useState<string[]>(u.interests ?? []);
  const teen = u.ageBand === '13-17';
  const canPlace = !teen || u.parentConfirmed;
  return (
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave({ nickname: nickname.trim() || u.nickname, bio: bio.trim(), isPublic, showRealName, realName: realName.trim() || undefined, district: district || undefined, schoolId: schoolId || undefined, interests, showDistrict }); }}>
      <div><label className="label" htmlFor="s-nick">ডাকনাম</label><input id="s-nick" className="field" value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} /></div>
      <div><label className="label" htmlFor="s-bio">এক লাইনে তুমি</label><input id="s-bio" className="field" value={bio} maxLength={60} placeholder="যেমন: রান্নাঘরেই ল্যাব!" onChange={(e) => setBio(e.target.value)} /></div>
      <div><label className="label" htmlFor="s-dist">জেলা</label>
        <select id="s-dist" className="field" value={district} disabled={!canPlace} onChange={(e) => setDistrict(e.target.value)}><option value="">বলতে চাই না</option>{districts.map((d) => <option key={d}>{d}</option>)}</select>
      </div>
      <div><label className="label" htmlFor="s-school">স্কুল / ক্লাব</label>
        <select id="s-school" className="field" value={schoolId} disabled={!canPlace} onChange={(e) => setSchoolId(e.target.value)}><option value="">বলতে চাই না</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}, {s.district}</option>)}</select>
      </div>
      {seriesList.length > 0 && <div className="sm:col-span-2"><InterestPicker options={seriesList} value={interests} onChange={setInterests} /></div>}
      {!canPlace && <p className="hint sm:col-span-2">জেলা আর স্কুল যোগ করতে অভিভাবকের নিশ্চিতকরণ লাগবে।</p>}
      {teen ? (
        <p className="rounded-2xl bg-tint p-3 text-sm sm:col-span-2">১৩–১৭ বয়সে প্রোফাইল ব্যক্তিগত থাকে; পাবলিক নাম শুধু ডাকনাম + অবতার। ১৮ হলে পাবলিক করার অপশন খুলবে।</p>
      ) : (
        <div className="grid gap-3 sm:col-span-2">
          <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-teal" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />পাবলিক প্রোফাইল</label>
          <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-teal" checked={showDistrict} onChange={(e) => setShowDistrict(e.target.checked)} />লিডারবোর্ডে আমার জেলা দেখাও</label>
          <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-teal" checked={showRealName} onChange={(e) => setShowRealName(e.target.checked)} />ওয়াল অফ ফেমে আসল নাম দেখাও</label>
          {showRealName && <input className="field" value={realName} placeholder="আসল নাম" onChange={(e) => setRealName(e.target.value)} />}
        </div>
      )}
      <div className="sm:col-span-2"><button type="submit" className="btn btn-secondary">সেভ করো</button></div>
    </form>
  );
}
