/** Status tracker like a parcel tracker: পাঠানো → দেখা হচ্ছে → মেন্টর ঠিক → লাইভ. Nobody waits in silence. */
import { useEffect, useState, type FormEvent } from 'react';
import { getBackend, PITCH_STEPS, type PublicPitchStatus } from '../../lib/backend';
import { bn, bnDate, bnAgo } from '../../lib/bn';
import { Bhabu, Icon, Loader } from './ui';

export default function PitchTracker() {
  const [code, setCode] = useState('');
  const [res, setRes] = useState<PublicPitchStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function lookup(c: string) {
    const clean = c.trim().toUpperCase();
    if (!/^BJ-P-\d{4}$/.test(clean)) {
      setRes(null);
      return;
    }
    setBusy(true);
    const r = await (await getBackend()).pitchStatus(clean);
    setRes(r);
    setBusy(false);
    history.replaceState(null, '', `?code=${clean}`);
  }

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('code');
    if (q) {
      setCode(q);
      void lookup(q);
    }
  }, []);

  const submit = (e: FormEvent) => { e.preventDefault(); void lookup(code); };
  const idx = res ? PITCH_STEPS.findIndex((s) => s.id === res.status) : -1;
  const notYet = res?.status === 'not_yet';
  const daysWaiting = res ? Math.floor((Date.now() - Date.parse(res.createdAt)) / 86400_000) : 0;

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="trk" className="sr-only">ট্র্যাকার নম্বর</label>
        <input id="trk" className="field flex-1 font-en uppercase tracking-wider" placeholder="BJ-P-0142" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
        <button type="submit" className="btn btn-secondary" disabled={busy}><Icon name="search" className="h-5 w-5" />খোঁজো</button>
      </form>

      {busy && <Loader label="তোমার পিচ খুঁজছি…" />}

      {!busy && res === null && (
        <div className="card flex items-center gap-4 p-5">
          <Bhabu face="think" body="teal" dot="coral" className="w-12" />
          <p>এই নম্বরে কোনো পিচ পাইনি। নম্বরটা এমন দেখতে: <b className="font-en">BJ-P-0142</b>। পিচ পাঠানোর পর ইমেইলেও নম্বরটা আছে।</p>
        </div>
      )}

      {!busy && res && (
        <div className="card overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-5">
            <div className="min-w-0">
              <p className="font-en text-sm font-bold text-ink-soft">{res.code}</p>
              <p className="text-xl font-bold">“{res.title}”</p>
              <p className="text-sm text-ink-soft">পাঠানো হয়েছে {bnDate(res.createdAt)} · শেষ আপডেট {bnAgo(res.updatedAt)}</p>
            </div>
            <Bhabu face={notYet ? 'think' : PITCH_STEPS[Math.max(0, idx)].mood} body="teal" dot="coral" sparks={res.status === 'live'} animateSparks className="ml-auto w-12" />
          </div>

          <ol className="grid gap-0 p-5 sm:grid-cols-4" aria-label="অগ্রগতি">
            {PITCH_STEPS.map((s, i) => {
              const done = !notYet && i <= idx;
              const current = !notYet && i === idx;
              const at = res.history.find((h) => h.status === s.id)?.at;
              return (
                <li key={s.id} className="relative flex gap-3 pb-5 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                  {i < PITCH_STEPS.length - 1 && <span className={`absolute left-[1.2rem] top-10 h-[calc(100%-2.5rem)] w-1 rounded sm:left-[calc(50%+1.5rem)] sm:top-[1.2rem] sm:h-1 sm:w-[calc(100%-3rem)] ${done && i < idx ? 'bg-teal' : 'bg-line'}`} />}
                  <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${current ? 'bg-coral text-white ring-4 ring-coral-soft' : done ? 'bg-teal text-white' : 'bg-line text-ink-soft'}`}>
                    {done && !current ? <Icon name="check" className="h-5 w-5" /> : bn(i + 1)}
                  </span>
                  <span className="sm:mt-2">
                    <span className={`block font-bold ${current ? 'text-coral-dark dark:text-coral' : ''}`}>{s.bn}</span>
                    {at && <span className="text-xs text-ink-soft">{bnDate(at, { year: false })}</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          {notYet && (
            <div className="mx-5 mb-5 rounded-2xl bg-sun-soft p-4">
              <p className="font-bold">এখনো না — কিন্তু এটা শেষ না!</p>
              {res.feedback && <p className="mt-1">{res.feedback}</p>}
              <a href="/initiator/pitch" className="btn btn-primary btn-sm mt-3">ছোট করে আবার পিচ করো</a>
            </div>
          )}
          {!notYet && res.status === 'reviewing' && (
            <p className="mx-5 mb-5 rounded-2xl bg-tint p-4 text-sm">কোর টিম দেখছে: বিষয়ের মিল, তথ্য আর নিরাপত্তা। আমাদের লক্ষ্য ৭ দিনের মধ্যে উত্তর — আজ {bn(daysWaiting)} দিন হলো।</p>
          )}
          {res.status === 'mentor' && (
            <p className="mx-5 mb-5 rounded-2xl bg-tint p-4 text-sm">মেন্টর ঠিক হয়েছে{res.mentorName ? `: ${res.mentorName}` : ''}। ব্র্যান্ড কিট আর তথ্য-যাচাইয়ের ছোট পাঠ ইমেইলে গেছে। প্রথম ৪টি পোস্ট মেন্টরের রিভিউ শেষে প্রকাশ হবে।</p>
          )}
          {res.status === 'live' && (
            <p className="mx-5 mb-5 rounded-2xl bg-sun-soft p-4 text-sm font-semibold">সিরিজ লাইভ! ৪টি প্রকাশিত পোস্টের পর খেতাব, ওয়াল অফ ফেম কার্ড আর সার্টিফিকেট। 🏅</p>
          )}
        </div>
      )}
    </div>
  );
}
