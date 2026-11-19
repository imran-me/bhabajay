/**
 * ভাবা যায় আইডি — sign up in 30 seconds, safe for teens (Plan p.12).
 *  under 13 → guest only: scores stay on the device; no account/profile/comments
 *  13–17   → parent email confirms; profile private by default; nickname + avatar only
 *  18+     → choose public or private; Initiators may show real name
 * Auth: Google + email magic link (MVP); phone OTP shown as v2.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { getBackend, type Backend } from '../../lib/backend';
import { getState, subscribe, update, toast, type AgeBand } from '../../lib/store';
import { DEFAULT_AVATAR, FACE_OPTIONS, GROUND_OPTIONS } from '../../lib/bhabu';
import { sound, confetti } from '../../lib/fx';
import type { AvatarConfig } from '../../data/types';
import { Avatar, Bhabu, Field, Icon, Loader, isEmail } from './ui';

interface Props { schools: { id: string; name: string; district: string }[]; districts: string[] }
type Step = 'start' | 'google-demo' | 'magic-sent' | 'profile' | 'guest' | 'done';

const AGE: { id: AgeBand; bn: string }[] = [
  { id: 'under13', bn: '১৩ এর নিচে' },
  { id: '13-17', bn: '১৩–১৭' },
  { id: '18+', bn: '১৮+' },
];

export default function IdPanel({ schools, districts }: Props) {
  const [b, setB] = useState<Backend | null>(null);
  const [st, setSt] = useState(getState);
  const [step, setStep] = useState<Step>('start');
  const [age, setAge] = useState<AgeBand | null>(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(false);

  useEffect(() => subscribe(setSt), []);
  useEffect(() => {
    void (async () => {
      const be = await getBackend();
      setB(be);
      // demo magic link arrival: /id?demo_magic=email
      const params = new URLSearchParams(location.search);
      const dm = params.get('demo_magic');
      if (dm && be.completeDemoSignIn) {
        await be.completeDemoSignIn(dm, 'magic');
        history.replaceState(null, '', '/id');
      }
      await be.getSession();
      const s = getState();
      if (s.flags.authEmail && !s.user) {
        const a = (s.flags.pendingAge as AgeBand) || null;
        setAge(a === 'under13' ? null : a);
        setStep('profile');
      }
      setChecking(false);
    })();
  }, []);

  if (checking || !b) return <Loader label="আইডি খুঁজছি…" />;

  /* already signed in */
  if (st.user && step !== 'done') {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <Avatar avatar={st.user.avatar} className="h-24 w-24" />
        <p className="mt-3 text-2xl font-bold">স্বাগতম, {st.user.nickname}!</p>
        <p className="text-ink-soft">তুমি লগ ইন করা আছ ({st.user.email})।</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href="/me" className="btn btn-primary">আমার ভাবা যায়</a>
          <button type="button" className="btn btn-ghost" onClick={async () => { await b.signOut(); toast('লগ আউট হয়েছে। আবার দেখা হবে!', { mood: 'wink' }); }}>
            <Icon name="logout" className="h-4 w-4" />লগ আউট
          </button>
        </div>
      </div>
    );
  }

  function chooseAge(a: AgeBand) {
    setAge(a);
    setErr(null);
    update((s) => { s.flags.pendingAge = a; });
    sound.pop();
  }
  function needAge() {
    if (!age) { setErr('আগে তোমার বয়স বেছে নাও'); return true; }
    if (age === 'under13') { enterGuest(); return true; }
    return false;
  }
  function enterGuest() {
    update((s) => { s.guest = { ageBand: 'under13' }; s.user = null; });
    setStep('guest');
  }
  async function google() {
    if (needAge() || !b) return;
    setBusy(true);
    try {
      const r = await b.startGoogle();
      if (r.demo) setStep('google-demo');
    } catch {
      setErr('উফ! Google এখন সাড়া দিচ্ছে না। ইমেইল দিয়ে চেষ্টা করো।');
    } finally {
      setBusy(false);
    }
  }
  async function magic(e?: FormEvent) {
    e?.preventDefault();
    if (needAge() || !b) return;
    if (!isEmail(email)) return setErr('উফ! ইমেইলটা ঠিক মনে হচ্ছে না');
    setBusy(true);
    try {
      const r = await b.sendMagicLink(email.trim());
      setDemoLink(r.demoLink ?? null);
      setStep('magic-sent');
    } catch {
      setErr('উফ! লিংক পাঠানো গেল না। একটু পরে আবার চেষ্টা করো।');
    } finally {
      setBusy(false);
    }
  }

  async function passwordAuth(e: FormEvent) {
    e.preventDefault();
    if (needAge() || !b?.passwordSignIn) return;
    if (!isEmail(email)) return setErr('উফ! ইমেইলটা ঠিক মনে হচ্ছে না');
    if (password.length < 8) return setErr('পাসওয়ার্ড অন্তত ৮ অক্ষরের হোক');
    setBusy(true);
    setErr(null);
    try {
      const r = await b.passwordSignIn(email.trim(), password, isNew ? 'register' : 'login');
      setPassword('');
      if (r.hasProfile) {
        toast('আবার স্বাগতম!', { mood: 'happy' });
      } else {
        setStep('profile');
      }
    } catch (x) {
      const code = (x as { code?: string }).code;
      setErr(
        code === 'credentials' ? 'ইমেইল বা পাসওয়ার্ড মিলছে না। নতুন হলে “নতুন আইডি” বেছে নাও।'
        : code === 'exists' ? 'এই ইমেইলে আগেই আইডি আছে — “লগ ইন” বেছে নাও।'
        : code === 'rate' ? 'অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করো।'
        : 'উফ! এখন ঢোকা গেল না। একটু পরে আবার চেষ্টা করো।',
      );
    } finally {
      setBusy(false);
    }
  }

  /* ───────── guest (under 13) ───────── */
  if (step === 'guest') {
    return (
      <div className="card p-6 text-center sm:p-8">
        <Bhabu face="happy" body="teal" dot="coral" animateSparks className="mx-auto w-16" />
        <h2 className="mt-3 text-2xl font-bold">অতিথি হিসেবে খেলো!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">১৩ বছরের নিচে বলে আমরা কোনো অ্যাকাউন্ট খুলি না। তোমার স্কোর, স্ট্রিক আর ব্যাজ শুধু এই ফোনেই থাকবে — আমাদের কাছে কিছু যায় না। পাবলিক প্রোফাইল বা মন্তব্য নেই।</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href="/quiz/weekly" className="btn btn-primary">কুইজ খেলি</a>
          <a href="/bhabur-duniya" className="btn btn-ghost">কার্টুন দেখি</a>
        </div>
        <p className="mt-4 text-xs text-ink-soft">মা-বাবার জন্য: <a href="/privacy#parents" className="underline">গোপনীয়তা ও অভিভাবক</a></p>
      </div>
    );
  }

  /* ───────── demo: Google chooser stand-in ───────── */
  if (step === 'google-demo') {
    return (
      <form className="card p-6 sm:p-8" onSubmit={async (e) => {
        e.preventDefault();
        if (!isEmail(email)) return setErr('উফ! ইমেইলটা ঠিক মনে হচ্ছে না');
        setBusy(true);
        await b.completeDemoSignIn!(email.trim(), 'google');
        setBusy(false);
        setStep('profile');
      }}>
        <div className="flex items-center gap-2"><Icon name="google" className="h-6 w-6" /><p className="text-lg font-bold">Google দিয়ে চালিয়ে যাও</p></div>
        <p className="mt-2 rounded-xl bg-sun-soft p-3 text-sm"><b>ডেমো মোড:</b> আসল Google লগ ইন যুক্ত হয়নি। এখানে যেকোনো ইমেইল দিলে Google অ্যাকাউন্টের মতো ধরে নেব।</p>
        <div className="mt-4">
          <Field label="Google ইমেইল" error={err} htmlFor="g-email">
            <input id="g-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tumi@gmail.com" autoComplete="email" autoFocus />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>চালিয়ে যাও</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep('start')}>ফিরে যাও</button>
        </div>
      </form>
    );
  }

  /* ───────── magic link sent ───────── */
  if (step === 'magic-sent') {
    return (
      <div className="card p-6 text-center sm:p-8">
        <Bhabu face="wink" body="teal" dot="coral" className="mx-auto w-14" />
        <h2 className="mt-3 text-2xl font-bold">ইনবক্স দেখো!</h2>
        <p className="mt-1 text-ink-soft"><b>{email}</b> ঠিকানায় একটা ম্যাজিক লিংক পাঠিয়েছি। লিংকে চাপলেই ঢুকে যাবে — পাসওয়ার্ড লাগবে না।</p>
        {demoLink && (
          <div className="mt-4 rounded-2xl bg-sun-soft p-4 text-left text-sm">
            <p><b>ডেমো মোড:</b> সত্যিকারের ইমেইল যায়নি। ইমেইলে যে লিংক যেত, সেটা এখানে:</p>
            <a href={demoLink} className="btn btn-secondary btn-sm mt-2">ম্যাজিক লিংক খোলো</a>
          </div>
        )}
        <button type="button" className="mt-4 text-sm font-bold text-link underline" onClick={() => setStep('start')}>ভুল ইমেইল? আবার দাও</button>
      </div>
    );
  }

  /* ───────── profile / onboarding ───────── */
  if (step === 'profile') {
    return <ProfileStep b={b} initialAge={age === '13-17' || age === '18+' ? age : null} schools={schools} districts={districts} onDone={() => setStep('done')} />;
  }

  if (step === 'done') {
    const teen = st.user?.ageBand === '13-17' && !st.user?.parentConfirmed;
    return (
      <div className="card p-6 text-center sm:p-8">
        {st.user && <Avatar avatar={st.user.avatar} tier="curious" className="mx-auto h-24 w-24" />}
        <h2 className="mt-3 text-2xl font-bold">তোমার ভাবা যায় আইডি তৈরি! 🎉</h2>
        {teen ? (
          <div className="mx-auto mt-3 max-w-md rounded-2xl bg-sun-soft p-4 text-left text-sm">
            <p>তোমার অভিভাবকের ইমেইলে (<b>{st.user?.parentEmail}</b>) একটা নিশ্চিতকরণ লিংক গেছে। তিনি নিশ্চিত করলে পিচ পাঠানো আর স্কুল/জেলা দেখানো যাবে। ততক্ষণ প্রোফাইল ব্যক্তিগত থাকবে।</p>
            {b.mode === 'demo' && (
              <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => {
                update((s) => { if (s.user) s.user.parentConfirmed = true; });
                toast('অভিভাবক নিশ্চিত করেছেন ✓', { mood: 'happy' });
              }}>ডেমো: অভিভাবক হিসেবে নিশ্চিত করো</button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-ink-soft">এখন থেকে স্কোর, ব্যাজ আর স্ট্রিক হারাবে না।</p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href="/me" className="btn btn-primary">আমার পেজ দেখি</a>
          <a href="/quiz/weekly" className="btn btn-ghost">কুইজ খেলি</a>
        </div>
      </div>
    );
  }

  /* ───────── start ───────── */
  return (
    <div className="card overflow-hidden">
      <div className="p-6 text-center sm:p-8">
        <Bhabu face="wow" body="teal" dot="coral" animateSparks className="mx-auto w-14" />
        <h1 className="mt-3 text-[1.7rem] font-bold">তোমার ভাবা যায় আইডি</h1>
        <p className="text-ink-soft">স্কোর, ব্যাজ আর সিরিজ, সব এক জায়গায়</p>

        <fieldset className="mt-6 text-left">
          <legend className="label">তোমার বয়স?</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {AGE.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={age === a.id} onClick={() => chooseAge(a.id)}
                className={`min-h-14 rounded-2xl border-2 px-2 font-bold transition ${age === a.id ? (a.id === '13-17' ? 'border-coral bg-coral-soft text-coral-dark' : 'border-teal bg-tint text-link') : 'border-line bg-surface hover:border-teal'}`}>
                {a.bn}
              </button>
            ))}
          </div>
          {age === '13-17' && <p className="hint mt-2">অভিভাবকের ইমেইল লাগবে — তিনি নিশ্চিত করবেন। প্রোফাইল ব্যক্তিগত থাকবে।</p>}
          {age === 'under13' && <p className="hint mt-2">অ্যাকাউন্ট লাগবে না — অতিথি হিসেবে খেলবে, স্কোর থাকবে এই ফোনে।</p>}
        </fieldset>

        {age !== 'under13' ? (
          <div className="mt-5 grid gap-2.5 text-left">
            {b.passwordSignIn ? (
              <form onSubmit={passwordAuth} className="grid gap-2" noValidate>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-tint p-1" role="tablist" aria-label="লগ ইন না নতুন আইডি">
                  {([[false, 'লগ ইন'], [true, 'নতুন আইডি']] as const).map(([v, l]) => (
                    <button key={l} type="button" role="tab" aria-selected={isNew === v} onClick={() => { setIsNew(v); setErr(null); }}
                      className={`min-h-11 rounded-xl font-bold ${isNew === v ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}>{l}</button>
                  ))}
                </div>
                <label htmlFor="pw-email" className="label !mb-0">ইমেইল</label>
                <input id="pw-email" type="email" inputMode="email" autoComplete="email" className="field" placeholder="তোমার ইমেইল" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label htmlFor="pw-pass" className="label !mb-0">পাসওয়ার্ড</label>
                <input id="pw-pass" type="password" autoComplete={isNew ? 'new-password' : 'current-password'} minLength={8} className="field" placeholder={isNew ? 'অন্তত ৮ অক্ষর' : ''} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="submit" className="btn btn-primary mt-1" disabled={busy}>{busy ? 'একটু দাঁড়াও…' : isNew ? 'আইডি বানাও' : 'ঢুকে পড়ো'}</button>
              </form>
            ) : (
              <>
                <button type="button" className="option justify-center" onClick={google} disabled={busy}><Icon name="google" className="h-5 w-5" />Google দিয়ে চালিয়ে যাও</button>
                <form onSubmit={magic} className="grid gap-2">
                  <label htmlFor="ml-email" className="sr-only">ইমেইল</label>
                  <div className="flex gap-2">
                    <input id="ml-email" type="email" inputMode="email" autoComplete="email" className="field flex-1" placeholder="তোমার ইমেইল" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err && !!email} />
                    <button type="submit" className="btn btn-secondary shrink-0" disabled={busy} aria-label="ম্যাজিক লিংক পাঠাও"><Icon name="mail" className="h-5 w-5" /><span className="hidden sm:inline">ম্যাজিক লিংক</span></button>
                  </div>
                </form>
              </>
            )}
            <button type="button" className="option justify-center opacity-60" disabled title="এসএমএস খরচ আছে, তাই পরের ধাপে"><Icon name="phone" className="h-5 w-5" />ফোন নম্বরে OTP <span className="tag !py-0 text-xs">v2</span></button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={enterGuest}>শুরু করি!</button>
        )}
        {err && <p className="error-text mt-3" role="alert">{err}</p>}
      </div>
      <div className="border-t border-line bg-tint px-6 py-4 text-left text-sm text-ink-soft">
        <p>🔒 {b.passwordSignIn ? 'পাসওয়ার্ড এনক্রিপ্ট করে রাখা হয়, আমরাও দেখতে পাই না।' : 'পাসওয়ার্ড নেই, তাই ভোলারও ভয় নেই।'} ইউজারনেম হবে ডাকনাম — আসল নাম নয়। ব্যবহারকারীদের মধ্যে সরাসরি মেসেজ নেই। এক চাপে “আমার ডেটা মুছে দাও”। <a href="/privacy" className="font-bold text-link">গোপনীয়তা নীতি</a></p>
      </div>
    </div>
  );
}

/* ───────────────────── onboarding form ───────────────────── */
function ProfileStep({ b, initialAge, schools, districts, onDone }: { b: Backend; initialAge: '13-17' | '18+' | null; schools: Props['schools']; districts: string[]; onDone: () => void }) {
  const st = getState();
  const [ageBand, setAgeBand] = useState<'13-17' | '18+'>(initialAge ?? '18+');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [uOk, setUOk] = useState<boolean | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showRealName, setShowRealName] = useState(false);
  const [realName, setRealName] = useState('');
  const [district, setDistrict] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const teen = ageBand === '13-17';

  useEffect(() => {
    if (!username) return setUOk(null);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return setUOk(false);
    const t = setTimeout(() => void b.usernameAvailable(username).then(setUOk), 300);
    return () => clearTimeout(t);
  }, [username]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (nickname.trim().length < 2) er.nickname = 'অন্তত ২ অক্ষরের একটা ডাকনাম দাও';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) er.username = 'ইংরেজি ছোট হাতের অক্ষর, সংখ্যা বা _ — ৩ থেকে ২০ অক্ষর';
    else if (uOk === false) er.username = 'এই ইউজারনেম কেউ নিয়ে নিয়েছে';
    if (teen && !isEmail(parentEmail)) er.parentEmail = 'অভিভাবকের সঠিক ইমেইল দাও';
    if (teen && parentEmail.trim().toLowerCase() === (st.flags.authEmail || '').toLowerCase()) er.parentEmail = 'অভিভাবকের ইমেইল তোমার নিজের ইমেইল হতে পারবে না';
    if (!teen && showRealName && realName.trim().length < 3) er.realName = 'আসল নাম লেখো, বা অপশনটা বন্ধ করো';
    if (!agree) er.agree = 'আচরণবিধিতে রাজি হতে হবে';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await b.saveProfile({
        nickname: nickname.trim(), username, ageBand, parentEmail: teen ? parentEmail.trim() : undefined,
        isPublic: teen ? false : isPublic, showRealName: teen ? false : showRealName, realName: teen ? undefined : realName.trim() || undefined,
        district: district || undefined, schoolId: schoolId || undefined, avatar,
      });
      sound.badge();
      confetti();
      onDone();
    } catch {
      setErrors({ form: 'উফ! সেভ করা গেল না। আবার চেষ্টা করো।' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card grid gap-5 p-6 sm:p-8" onSubmit={save} noValidate>
      <div className="flex items-center gap-4">
        <Avatar avatar={avatar} className="h-20 w-20" />
        <div>
          <h1 className="text-2xl font-bold">প্রায় হয়ে গেছে!</h1>
          <p className="text-ink-soft">{st.flags.authEmail} দিয়ে ঢুকেছ। এবার নিজেকে সাজাও।</p>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="label !mb-0">তোমার ভাবু</p>
        <div className="flex flex-wrap gap-2">
          {FACE_OPTIONS.map((f) => (
            <button key={f.id} type="button" onClick={() => setAvatar((a) => ({ ...a, face: f.id }))} aria-pressed={avatar.face === f.id} aria-label={f.bn}
              className={`rounded-full p-0.5 ring-2 ${avatar.face === f.id ? 'ring-coral' : 'ring-transparent'}`}>
              <Avatar avatar={{ ...avatar, face: f.id }} className="h-12 w-12" />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {GROUND_OPTIONS.slice(0, 4).map((g) => (
            <button key={g.id} type="button" onClick={() => setAvatar((a) => ({ ...a, ground: g.id }))} aria-pressed={avatar.ground === g.id}
              className={`chip !min-h-9 ${avatar.ground === g.id ? 'is-active' : ''}`}>{g.bn}</button>
          ))}
        </div>
        <p className="hint">টুপি, যন্ত্রপাতি আর ফ্রেম পরে <b>অবতার স্টুডিওতে</b> — ব্যাজ জিতলে খুলবে।</p>
      </div>

      <Field label="ডাকনাম (সবাই এটাই দেখবে)" hint="আসল নাম দিও না — যেমন ‘ভাবুক রাফি’" error={errors.nickname} htmlFor="p-nick">
        <input id="p-nick" className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} aria-invalid={!!errors.nickname} />
      </Field>
      <Field label="ইউজারনেম (প্রোফাইল লিংকের জন্য)" hint={uOk === true ? `✓ bhabajay.com/u/${username} খালি আছে` : uOk === false && username ? 'এটা পাওয়া যাচ্ছে না বা নিয়ম মানছে না' : 'ইংরেজি ছোট হাতের অক্ষর, সংখ্যা বা _'} error={errors.username} htmlFor="p-user">
        <input id="p-user" className="field font-en" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={20} autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.username} />
      </Field>

      <fieldset>
        <legend className="label">বয়স</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['13-17', '18+'] as const).map((a) => (
            <button key={a} type="button" aria-pressed={ageBand === a} onClick={() => setAgeBand(a)} className={`min-h-12 rounded-2xl border-2 font-bold ${ageBand === a ? 'border-teal bg-tint text-link' : 'border-line'}`}>{a === '13-17' ? '১৩–১৭' : '১৮+'}</button>
          ))}
        </div>
      </fieldset>

      {teen ? (
        <div className="grid gap-3 rounded-2xl bg-sun-soft p-4">
          <Field label="অভিভাবকের ইমেইল" hint="তিনি একটা লিংক পাবেন। নিশ্চিত না করা পর্যন্ত প্রোফাইল ব্যক্তিগত।" error={errors.parentEmail} htmlFor="p-parent">
            <input id="p-parent" type="email" className="field" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} aria-invalid={!!errors.parentEmail} />
          </Field>
          <p className="text-sm">১৩–১৭ বয়সে: পাবলিক নাম = ডাকনাম + অবতার। ছবি, স্কুলের নাম বা জেলা কখনো অভিভাবকের অনুমতি ছাড়া দেখানো হবে না।</p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-2xl bg-tint p-4">
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 h-5 w-5 accent-teal" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /><span><b>পাবলিক প্রোফাইল</b><span className="block text-sm text-ink-soft">অন্যরা তোমার ব্যাজ আর সিরিজ দেখতে পাবে। বন্ধ রাখলে শুধু তুমি দেখবে।</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 h-5 w-5 accent-teal" checked={showRealName} onChange={(e) => setShowRealName(e.target.checked)} /><span><b>ওয়াল অফ ফেমে আসল নাম দেখাও</b><span className="block text-sm text-ink-soft">ইনিশিয়েটর হলে সিভি-তে কাজে লাগে। পরে বদলানো যাবে।</span></span></label>
          {showRealName && (
            <Field label="আসল নাম" error={errors.realName} htmlFor="p-real">
              <input id="p-real" className="field" value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={60} />
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="জেলা (ঐচ্ছিক)" hint={teen ? 'অভিভাবক নিশ্চিত করলে লিডারবোর্ডে যোগ হবে' : undefined} htmlFor="p-dist">
          <select id="p-dist" className="field" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">বলতে চাই না</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="স্কুল / ক্লাব (ঐচ্ছিক)" hint="স্কুল বনাম স্কুল লিডারবোর্ডের জন্য" htmlFor="p-school">
          <select id="p-school" className="field" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">বলতে চাই না</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}, {s.district}</option>)}
          </select>
        </Field>
      </div>

      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1.5 h-5 w-5 accent-teal" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={!!errors.agree} />
        <span>আমি <a href="/code-of-conduct" target="_blank" className="font-bold text-link underline">আচরণবিধি</a> মানব: ভদ্র থাকব, তথ্য যাচাই করব, কারো ব্যক্তিগত তথ্য চাইব না।{errors.agree && <span className="error-text block">{errors.agree}</span>}</span>
      </label>
      {errors.form && <p className="error-text" role="alert">{errors.form}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'সাজাচ্ছি…' : 'শুরু করি!'}</button>
    </form>
  );
}
