/**
 * আইডিয়া পাঠাও — a form that feels like a conversation (Plan p.17).
 * 5 steps · auto-save (no lost drafts on bad networks) · Bangla validation ·
 * parent consent for 13–17 · submit = ভাবু "wow" + paper plane + tracker no.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getBackend, type PitchPayload } from '../../lib/backend';
import { getState, subscribe, toast } from '../../lib/store';
import { bn } from '../../lib/bn';
import { sound, confetti, prefersReducedMotion } from '../../lib/fx';
import { Bhabu, Icon, Loader, isEmail } from './ui';

export const SUBJECTS = [
  'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'গণিত', 'মহাকাশ', 'পরিবেশ ও জলবায়ু', 'স্বাস্থ্য ও চিকিৎসা', 'খাদ্য ও পুষ্টি', 'কৃষি', 'প্রযুক্তি ও কম্পিউটার',
  'প্রকৌশল', 'ভূগোল ও প্রকৃতি', 'প্রাণী ও পাখি', 'মনোবিজ্ঞান', 'ইতিহাস ও আবিষ্কার', 'অর্থনীতি', 'সাহিত্য ও ভাষা', 'শিল্প ও ডিজাইন', 'সমাজ ও সংস্কৃতি', 'খেলাধুলার বিজ্ঞান',
];
const SDGS = ['দারিদ্র্য বিলোপ', 'ক্ষুধামুক্তি', 'সুস্বাস্থ্য ও কল্যাণ', 'মানসম্মত শিক্ষা', 'লিঙ্গ সমতা', 'বিশুদ্ধ পানি ও পয়ঃনিষ্কাশন', 'নবায়নযোগ্য জ্বালানি', 'শোভন কাজ ও প্রবৃদ্ধি', 'শিল্প, উদ্ভাবন ও অবকাঠামো', 'অসমতা হ্রাস', 'টেকসই শহর ও জনপদ', 'পরিমিত ভোগ ও উৎপাদন', 'জলবায়ু কার্যক্রম', 'জলজ জীবন', 'স্থলজ জীবন', 'শান্তি ও ন্যায়বিচার', 'অংশীদারত্ব'];
const FORMATS = ['ফটো কার্ড', 'ভিডিও', 'ব্লগ', 'গবেষণা নোট', 'কুইজ'];
const FREQ = ['সপ্তাহে ১', 'মাসে ২', 'মাসে ১'];
const FOUND = ['ফেসবুক', 'ইউটিউব', 'বন্ধু', 'স্কুল/শিক্ষক', 'গুগল', 'অন্যভাবে'];
const DRAFT = 'bj:pitch-draft';

type Draft = Omit<PitchPayload, 'ageBand' | 'pledges' | 'episodes'> & { episodes: string[]; pledges: PitchPayload['pledges'] };

const empty = (nickname = '', email = ''): Draft => ({
  nickname, district: '', affiliation: '', foundUs: '', spark: '', workingTitle: '', subject: '', formats: [], frequency: '',
  episodes: ['', '', ''], audience: '', sdg: '', sampleLink: '', skillsHave: '', skillsWant: '', friends: '', mentorIn: '',
  contactEmail: email, parentEmail: '', pledges: { factCheck: false, conduct: false, parent: false, credit: false },
});

const STEPS = [
  { title: 'তুমি', ask: 'হ্যালো! আগে একটু তোমাকে চিনি।' },
  { title: 'ফুলকি', ask: 'কোন প্রশ্নটা তোমাকে রাতে ঘুমাতে দেয় না? 🤔' },
  { title: 'পরিকল্পনা', ask: 'দারুণ! এবার বলো, কীভাবে সাজাবে?' },
  { title: 'প্রমাণ ও দল', ask: 'কিছু দেখানোর মতো আছে? আর কারা সাথে থাকবে?' },
  { title: 'প্রতিশ্রুতি', ask: 'শেষ ধাপ! কয়েকটা কথা দিতে হবে।' },
];

export default function PitchForm({ districts }: { districts: string[] }) {
  const [st, setSt] = useState(getState);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(setSt), []);
  useEffect(() => {
    const u = getState().user;
    let draft = empty(u?.nickname ?? '', u?.email ?? '');
    try {
      const raw = localStorage.getItem(DRAFT);
      if (raw) {
        const parsed = JSON.parse(raw);
        draft = { ...draft, ...parsed.d };
        setStep(parsed.step ?? 0);
      }
    } catch { /* ignore */ }
    setD(draft);
    setReady(true);
  }, []);
  // auto-save every change
  useEffect(() => {
    if (!ready || code) return;
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ d, step }));
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1500);
      return () => clearTimeout(t);
    } catch { /* ignore */ }
  }, [d, step, ready]);

  const u = st.user;
  const teen = u?.ageBand === '13-17';
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  if (!ready) return <Loader />;

  /* needs an ID (age band comes from it) */
  if (!u) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <Bhabu face="wink" body="teal" dot="coral" className="mx-auto w-14" />
        <h2 className="mt-3 text-2xl font-bold">পিচ করতে আগে আইডি লাগবে</h2>
        <p className="mx-auto mt-1 max-w-md text-ink-soft">তাহলেই তোমার পিচের অগ্রগতি (পাঠানো → দেখা হচ্ছে → মেন্টর ঠিক → লাইভ) তোমার পেজে দেখাতে পারব, আর ক্রেডিট যাবে তোমার নামে। ৩০ সেকেন্ড লাগবে।</p>
        {st.guest ? (
          <p className="mx-auto mt-4 max-w-md rounded-2xl bg-sun-soft p-3 text-sm">১৩ বছর হলে নিজে পিচ করতে পারবে। এখন তোমার প্রশ্নটা <a href="/ask" className="font-bold text-link">ভাবুকে পাঠাও</a> — হয়তো সেটা দিয়েই পর্ব হবে!</p>
        ) : (
          <a href="/id" className="btn btn-primary mt-5">আইডি বানাও</a>
        )}
        <p className="mt-3 text-xs text-ink-soft">তোমার খসড়া এই ফোনে সেভ থাকবে।</p>
      </div>
    );
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    const need = (k: string, v: string, min = 2, msg = 'এটা লিখতে হবে') => { if ((v ?? '').trim().length < min) e[k] = msg; };
    if (s === 0) { need('nickname', d.nickname); }
    if (s === 1) {
      need('spark', d.spark, 15, 'প্রশ্নটা আরেকটু খুলে বলো (অন্তত এক লাইন)');
      need('workingTitle', d.workingTitle, 3, 'সিরিজের একটা কাজ-চালানো নাম দাও');
      if (!d.subject) e.subject = 'একটা বিষয় বেছে নাও';
    }
    if (s === 2) {
      if (!d.formats.length) e.formats = 'অন্তত একটা ফরম্যাট বেছে নাও';
      if (!d.frequency) e.frequency = 'কত ঘন ঘন পোস্ট করবে?';
      d.episodes.forEach((x, i) => { if (x.trim().length < 4) e[`ep${i}`] = 'একটা ছোট আইডিয়া লেখো'; });
      need('audience', d.audience, 3, 'কাদের জন্য বানাচ্ছ?');
    }
    if (s === 3) {
      need('skillsHave', d.skillsHave, 3, 'কী কী পারো, লেখো — ছোট হলেও চলবে');
      if (d.sampleLink && !/^https?:\/\/\S+\.\S+/.test(d.sampleLink)) e.sampleLink = 'লিংকটা https:// দিয়ে শুরু হওয়া উচিত';
    }
    if (s === 4) {
      if (!isEmail(d.contactEmail)) e.contactEmail = 'উফ! ইমেইলটা ঠিক মনে হচ্ছে না';
      if (!d.pledges.factCheck) e.factCheck = 'তথ্য যাচাইয়ের প্রতিশ্রুতি দরকার';
      if (!d.pledges.conduct) e.conduct = 'আচরণবিধিতে রাজি হতে হবে';
      if (teen && !d.pledges.parent) e.parent = '১৩–১৭ হলে অভিভাবকের সম্মতি লাগবে';
      if (!d.pledges.credit) e.credit = 'ক্রেডিটসহ প্রকাশে সম্মতি দরকার';
    }
    setErrors(e);
    if (Object.keys(e).length) {
      sound.think();
      setTimeout(() => top.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 50);
    }
    return Object.keys(e).length === 0;
  }

  function go(n: number) {
    if (n > step && !validate(step)) return;
    setStep(n);
    setErrors({});
    sound.pop();
    top.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  async function submit() {
    if (!validate(4)) return;
    if (teen && !u!.parentConfirmed) {
      toast('অভিভাবক এখনো আইডি নিশ্চিত করেননি — খসড়া সেভ আছে, নিশ্চিত হলেই পাঠাতে পারবে।', { mood: 'think' });
      return;
    }
    setBusy(true);
    try {
      const b = await getBackend();
      const payload: PitchPayload = { ...d, ageBand: u!.ageBand, episodes: [d.episodes[0], d.episodes[1], d.episodes[2]], parentEmail: teen ? u!.parentEmail : undefined };
      const r = await b.submitPitch(payload);
      setFlying(true);
      sound.whoosh();
      setTimeout(() => {
        setCode(r.code);
        sound.badge();
        confetti({ count: 140 });
        try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
      }, prefersReducedMotion() ? 50 : 1100);
    } catch {
      toast('উফ! পাঠানো গেল না — খসড়া সেভ আছে, নেটওয়ার্ক পেলে আবার চাপো।', { kind: 'error', mood: 'think' });
    } finally {
      setBusy(false);
    }
  }

  /* ───────── submitted ───────── */
  if (code) {
    return (
      <div className="card overflow-hidden text-center">
        <div className="pattern-teal p-8 text-white">
          <div className="mx-auto max-w-md rounded-3xl bg-deep/85 p-6">
            <Bhabu face="wow" body="coral" dot="sun" brows="light" animateSparks className="mx-auto w-20" />
            <p className="mt-3 text-2xl font-bold">পিচ উড়ে গেছে! ✈️</p>
            <p className="mt-1 text-white/85">তোমার ট্র্যাকার নম্বর</p>
            <p className="mt-1 font-en text-3xl font-extrabold tracking-wider text-sun">{code}</p>
            <p className="mt-2 font-semibold">৭ দিনের মধ্যে জানাব।</p>
          </div>
        </div>
        <div className="grid gap-3 p-6">
          <p className="text-ink-soft">প্রতিটা ধাপে ইমেইল আর সাইটে নোটিফিকেশন পাবে। কেউ চুপচাপ অপেক্ষা করে না।</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href={`/initiator/track?code=${code}`} className="btn btn-secondary">ট্র্যাক করো</a>
            <a href="/me" className="btn btn-ghost">আমার পেজ</a>
          </div>
          <p className="text-xs text-ink-soft">“এখনো না” হলেও মন খারাপ নয় — সাথে থাকবে একটা ছোট প্রথম ধাপের পরামর্শ, যেকোনো সময় আবার পিচ করা যাবে।</p>
        </div>
      </div>
    );
  }

  const pct = ((step + 1) / STEPS.length) * 100;
  const chip = (on: boolean) => `chip ${on ? '!bg-coral-soft !text-coral-dark !border-coral' : ''}`;

  return (
    <div ref={top} className={`card scroll-mt-24 overflow-hidden ${flying ? 'pointer-events-none' : ''}`} style={flying ? { animation: 'bj-plane 1.1s cubic-bezier(.5,0,.75,0) forwards' } : undefined}>
      <div className="flex items-center gap-3 px-5 pt-4">
        <p className="font-bold">ধাপ {bn(step + 1)} / {bn(STEPS.length)} · {STEPS[step].title}</p>
        <p className={`ml-auto text-sm font-semibold text-link transition-opacity ${saved ? 'opacity-100' : 'opacity-60'}`} aria-live="polite">সেভ হয়েছে ✓</p>
      </div>
      <div className="mt-3 h-2 bg-tint"><div className="h-full rounded-r-full bg-coral transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>

      <div className="grid gap-5 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <Bhabu face={step === 4 ? 'happy' : step === 1 ? 'think' : 'wow'} body="teal" dot="coral" sparks={step === 4} className="w-9 shrink-0" />
          <p className="rounded-2xl rounded-tl-sm bg-tint px-4 py-2.5 text-lg font-semibold">{STEPS[step].ask}</p>
        </div>

        {step === 0 && (
          <>
            <F label="ডাকনাম" err={errors.nickname} id="pf-nick"><input id="pf-nick" className="field" value={d.nickname} onChange={(e) => set('nickname', e.target.value)} aria-invalid={!!errors.nickname} maxLength={40} /></F>
            <p className="-mt-2 text-sm text-ink-soft">বয়স (আইডি থেকে): <b>{u.ageBand === '13-17' ? '১৩–১৭' : '১৮+'}</b></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="জেলা (ঐচ্ছিক)" id="pf-dist">
                <select id="pf-dist" className="field" value={d.district} onChange={(e) => set('district', e.target.value)}><option value="">বলতে চাই না</option>{districts.map((x) => <option key={x}>{x}</option>)}</select>
              </F>
              <F label="স্কুল / বিশ্ববিদ্যালয় / কাজ (ঐচ্ছিক)" id="pf-aff"><input id="pf-aff" className="field" value={d.affiliation} onChange={(e) => set('affiliation', e.target.value)} maxLength={80} /></F>
            </div>
            <fieldset><legend className="label">আমাদের কীভাবে খুঁজে পেলে?</legend>
              <div className="flex flex-wrap gap-2">{FOUND.map((f) => <button key={f} type="button" className={chip(d.foundUs === f)} aria-pressed={d.foundUs === f} onClick={() => set('foundUs', f)}>{f}</button>)}</div>
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <F label="যে প্রশ্ন দিয়ে শুরু" err={errors.spark} id="pf-spark" hint="যেমন: মশা কেন কিছু মানুষকে বেশি কামড়ায়? আমি এটা নিয়ে কার্ড আর ভিডিও বানাতে চাই।">
              <textarea id="pf-spark" className="field !border-teal" rows={4} value={d.spark} onChange={(e) => set('spark', e.target.value)} aria-invalid={!!errors.spark} maxLength={600} />
            </F>
            <F label="সিরিজের কাজ-চালানো নাম" err={errors.workingTitle} id="pf-title"><input id="pf-title" className="field" value={d.workingTitle} onChange={(e) => set('workingTitle', e.target.value)} aria-invalid={!!errors.workingTitle} maxLength={60} placeholder="যেমন: মশার জীবন" /></F>
            <fieldset><legend className="label">বিষয়</legend>
              <div className="flex flex-wrap gap-2" aria-invalid={!!errors.subject}>{SUBJECTS.map((s) => <button key={s} type="button" className={chip(d.subject === s)} aria-pressed={d.subject === s} onClick={() => set('subject', s)}>{s}</button>)}</div>
              {errors.subject && <p className="error-text mt-1">{errors.subject}</p>}
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <fieldset><legend className="label">কোন ফরম্যাটে? <span className="font-normal text-ink-soft">(একাধিক)</span></legend>
              <div className="flex flex-wrap gap-2">{FORMATS.map((f) => {
                const on = d.formats.includes(f);
                return <button key={f} type="button" className={chip(on)} aria-pressed={on} onClick={() => set('formats', on ? d.formats.filter((x) => x !== f) : [...d.formats, f])}>{f}{on && ' ✓'}</button>;
              })}</div>
              {errors.formats && <p className="error-text mt-1">{errors.formats}</p>}
            </fieldset>
            <fieldset><legend className="label">কত ঘন ঘন?</legend>
              <div className="flex flex-wrap gap-2">{FREQ.map((f) => <button key={f} type="button" className={`chip ${d.frequency === f ? 'is-active' : ''}`} aria-pressed={d.frequency === f} onClick={() => set('frequency', f)}>{f}</button>)}</div>
              {errors.frequency && <p className="error-text mt-1">{errors.frequency}</p>}
            </fieldset>
            <div className="grid gap-3">
              <p className="label !mb-0">প্রথম ৩টা পর্বের আইডিয়া</p>
              {d.episodes.map((x, i) => (
                <F key={i} label={`পর্ব ${bn(i + 1)}`} err={errors[`ep${i}`]} id={`pf-ep${i}`}>
                  <input id={`pf-ep${i}`} className="field" value={x} onChange={(e) => set('episodes', d.episodes.map((y, k) => (k === i ? e.target.value : y)))} aria-invalid={!!errors[`ep${i}`]} maxLength={100} />
                </F>
              ))}
            </div>
            <F label="কাদের জন্য?" err={errors.audience} id="pf-aud" hint="যেমন: ক্লাস ৬–১০, অভিভাবক, কৃষক…"><input id="pf-aud" className="field" value={d.audience} onChange={(e) => set('audience', e.target.value)} aria-invalid={!!errors.audience} maxLength={80} /></F>
            <F label="কোন টেকসই উন্নয়ন লক্ষ্য (SDG) ছুঁয়ে যায়? (ঐচ্ছিক)" id="pf-sdg">
              <select id="pf-sdg" className="field" value={d.sdg} onChange={(e) => set('sdg', e.target.value)}><option value="">জানি না / নেই</option>{SDGS.map((s, i) => <option key={s} value={`SDG ${i + 1}: ${s}`}>{bn(i + 1)}. {s}</option>)}</select>
            </F>
          </>
        )}

        {step === 3 && (
          <>
            <F label="একটা নমুনা (ছবি, ডক বা লিংক) — ঐচ্ছিক" err={errors.sampleLink} id="pf-sample" hint="গুগল ড্রাইভ/ফেসবুক পোস্টের লিংক দিতে পারো। ফাইল আপলোড আসছে v2-তে।">
              <input id="pf-sample" className="field font-en" inputMode="url" value={d.sampleLink} onChange={(e) => set('sampleLink', e.target.value)} aria-invalid={!!errors.sampleLink} placeholder="https://" />
            </F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="যা পারো" err={errors.skillsHave} id="pf-have"><textarea id="pf-have" className="field !min-h-24" value={d.skillsHave} onChange={(e) => set('skillsHave', e.target.value)} aria-invalid={!!errors.skillsHave} placeholder="লেখা, আঁকা, ভিডিও এডিট…" maxLength={300} /></F>
              <F label="যা শিখতে চাও (ঐচ্ছিক)" id="pf-want"><textarea id="pf-want" className="field !min-h-24" value={d.skillsWant} onChange={(e) => set('skillsWant', e.target.value)} maxLength={300} /></F>
            </div>
            <F label="যে বন্ধুরা যোগ দিতে পারে (ঐচ্ছিক)" id="pf-friends" hint="শুধু ডাকনাম — ফোন নম্বর দিও না"><input id="pf-friends" className="field" value={d.friends} onChange={(e) => set('friends', e.target.value)} maxLength={120} /></F>
            <F label="কোন বিষয়ে মেন্টর লাগবে?" id="pf-mentor"><input id="pf-mentor" className="field" value={d.mentorIn} onChange={(e) => set('mentorIn', e.target.value)} maxLength={120} placeholder="যেমন: তথ্য যাচাই, ভিডিও বানানো…" /></F>
          </>
        )}

        {step === 4 && (
          <>
            <F label="যোগাযোগের ইমেইল" err={errors.contactEmail} id="pf-email"><input id="pf-email" type="email" className="field" value={d.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} aria-invalid={!!errors.contactEmail} /></F>
            <div className="grid gap-3">
              <Pledge on={d.pledges.factCheck} err={errors.factCheck} onChange={(v) => set('pledges', { ...d.pledges, factCheck: v })}>প্রতিটা তথ্যের সূত্র দেব আর মেন্টরের যাচাই ছাড়া প্রকাশ করব না।</Pledge>
              <Pledge on={d.pledges.conduct} err={errors.conduct} onChange={(v) => set('pledges', { ...d.pledges, conduct: v })}><a href="/code-of-conduct" target="_blank" className="font-bold text-link underline">আচরণবিধি</a> মানব।</Pledge>
              {teen && <Pledge on={d.pledges.parent} err={errors.parent} onChange={(v) => set('pledges', { ...d.pledges, parent: v })}>আমার অভিভাবক ({u.parentEmail}) জানেন এবং সম্মতি দিয়েছেন। তাঁকেও একটা কপি পাঠানো হবে।</Pledge>}
              <Pledge on={d.pledges.credit} err={errors.credit} onChange={(v) => set('pledges', { ...d.pledges, credit: v })}>আমার কাজ ভাবা যায়!-এর সাইট আর ফেসবুকে আমার নামে ক্রেডিটসহ প্রকাশ হতে পারে।</Pledge>
            </div>
            <div className="rounded-2xl bg-tint p-4 text-sm">
              <p className="font-bold">সারসংক্ষেপ</p>
              <p className="mt-1">“{d.workingTitle}” · {d.subject} · {d.formats.join(', ')} · {d.frequency}</p>
              <p className="text-ink-soft">শুরুর প্রশ্ন: {d.spark}</p>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-1">
          {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}><Icon name="arrow-left" className="h-4 w-4" />আগের ধাপ</button>}
          {step < 4 ? (
            <button type="button" className="btn btn-primary ml-auto flex-1 sm:flex-none" onClick={() => go(step + 1)}>পরের ধাপ <Icon name="arrow-right" className="h-4 w-4" /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg ml-auto flex-1 sm:flex-none" onClick={submit} disabled={busy}>{busy ? 'পাঠাচ্ছি…' : 'পিচ পাঠাও ✈️'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function F({ label, err, id, hint, children }: { label: string; err?: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && !err && <p className="hint mt-1">{hint}</p>}
      {err && <p className="error-text mt-1" role="alert">{err}</p>}
    </div>
  );
}

function Pledge({ on, onChange, err, children }: { on: boolean; onChange: (v: boolean) => void; err?: string; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 ${on ? 'border-teal bg-tint' : err ? 'border-coral' : 'border-line'}`}>
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-teal" checked={on} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!err} />
      <span>{children}{err && <span className="error-text block">{err}</span>}</span>
    </label>
  );
}
