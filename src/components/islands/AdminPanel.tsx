/**
 * Core-team desk: review pitches (fit · facts · safety, ≤ 7 days), match
 * mentors, moderate comments, and read the inboxes ("Dadu said" myth tips,
 * Ask ভাবু, mentor applications, contact).
 * Supabase: every query is protected by RLS (role = core). Demo: open to all.
 */
import { useEffect, useState } from 'react';
import { getBackend, PITCH_STEPS, type Backend, type Comment, type InboxItem, type Pitch, type PitchStatus } from '../../lib/backend';
import { getState } from '../../lib/store';
import { bn, bnAgo, bnDate } from '../../lib/bn';
import { toast } from '../../lib/store';
import { Bhabu, Icon, Loader } from './ui';

type Tab = 'pitches' | 'comments' | 'inbox';
const KIND: Record<InboxItem['kind'], string> = { myth_tip: 'দাদুর মিথ', question: 'ভাবুকে প্রশ্ন', mentor: 'মেন্টর আবেদন', contact: 'যোগাযোগ' };

export default function AdminPanel({ mentors }: { mentors: string[] }) {
  const [b, setB] = useState<Backend | null>(null);
  const [tab, setTab] = useState<Tab>('pitches');
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function refresh(be = b) {
    if (!be) return;
    const [p, c, i] = await Promise.all([be.admin.pitches(), be.admin.pendingComments(), be.admin.inbox()]);
    setPitches(p);
    setComments(c);
    setInbox(i);
  }
  useEffect(() => {
    void getBackend().then(async (be) => {
      setB(be);
      if (be.mode === 'supabase') await be.getSession();
      await refresh(be);
    });
  }, []);

  if (!b) return <Loader />;
  if (b.mode === 'supabase' && getState().user?.role !== 'core') {
    return (
      <div className="card flex items-center gap-4 p-6">
        <Bhabu face="think" body="teal" dot="coral" className="w-12" />
        <p>এই পাতা শুধু কোর টিমের জন্য। কোর টিমের অ্যাকাউন্ট দিয়ে <a href="/id" className="link">লগ ইন</a> করুন।</p>
      </div>
    );
  }

  const waiting = pitches?.filter((p) => p.status === 'sent' || p.status === 'reviewing') ?? [];
  const overdue = waiting.filter((p) => Date.now() - Date.parse(p.createdAt) > 7 * 86400_000);

  async function move(p: Pitch, status: PitchStatus, opts: { feedback?: string; mentorName?: string } = {}) {
    await b!.admin.updatePitch(p.code, status, opts);
    toast(`${p.code} → ${status === 'not_yet' ? 'এখনো না' : PITCH_STEPS.find((s) => s.id === status)?.bn}। ইনিশিয়েটরকে নোটিফিকেশন গেছে।`, { mood: 'happy' });
    await refresh();
  }

  return (
    <div className="grid gap-5">
      {b.mode === 'demo' && (
        <p className="rounded-2xl bg-sun-soft p-3 text-sm"><b>ডেমো:</b> আসল সাইটে এই প্যানেল শুধু কোর টিম দেখতে পায় (ডেটাবেসের row-level security)। এখান থেকে নিজের পাঠানো পিচ এগিয়ে নিলে তোমার “আমি” পেজে নোটিফিকেশন আর ব্যাজ আসবে।</p>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-3"><p className="font-display text-3xl text-coral">{bn(waiting.length)}</p><p className="text-xs font-semibold text-ink-soft">রিভিউয়ের অপেক্ষায়</p></div>
        <div className="card p-3"><p className={`font-display text-3xl ${overdue.length ? 'text-coral' : 'text-link'}`}>{bn(overdue.length)}</p><p className="text-xs font-semibold text-ink-soft">৭ দিন পেরিয়েছে</p></div>
        <div className="card p-3"><p className="font-display text-3xl text-link">{bn(comments?.length ?? 0)}</p><p className="text-xs font-semibold text-ink-soft">মডারেশনের মন্তব্য</p></div>
      </div>

      <div role="tablist" className="flex gap-1 rounded-2xl bg-tint p-1">
        {([['pitches', 'পিচ'], ['comments', 'মন্তব্য'], ['inbox', 'ইনবক্স']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 flex-1 rounded-xl py-2 font-bold ${tab === id ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}>{l}</button>
        ))}
      </div>

      {tab === 'pitches' && (pitches === null ? <Loader /> : (
        <ul className="grid gap-3">
          {pitches.map((p) => {
            const isOpen = open === p.code;
            const days = Math.floor((Date.now() - Date.parse(p.createdAt)) / 86400_000);
            return (
              <li key={p.code} className="card overflow-hidden">
                <button type="button" className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : p.code)} aria-expanded={isOpen}>
                  <span className="font-en text-sm font-bold text-ink-soft">{p.code}</span>
                  <span className="font-bold">“{p.title}”</span>
                  <span className="text-sm text-ink-soft">{p.nickname} · {p.subject}</span>
                  <span className={`tag ml-auto ${p.status === 'not_yet' ? 'tag-coral' : p.status === 'live' ? '' : 'tag-sun'}`}>{p.status === 'not_yet' ? 'এখনো না' : PITCH_STEPS.find((s) => s.id === p.status)?.bn}</span>
                  {(p.status === 'sent' || p.status === 'reviewing') && <span className={`text-xs font-bold ${days > 7 ? 'text-coral-dark' : 'text-ink-soft'}`}>{bn(days)} দিন</span>}
                </button>
                {isOpen && <PitchReview p={p} mentors={mentors} onMove={move} />}
              </li>
            );
          })}
        </ul>
      ))}

      {tab === 'comments' && (comments === null ? <Loader /> : comments.length === 0 ? <p className="card p-5 text-ink-soft">মডারেশনের অপেক্ষায় কিছু নেই ✓</p> : (
        <ul className="grid gap-3">
          {comments.map((c) => (
            <li key={c.id} className="card p-4">
              <p className="text-sm text-ink-soft"><b className="text-ink">{c.nickname}</b> · {c.target.type}: {c.target.id} · {bnAgo(c.createdAt)}</p>
              <p className="mt-1">{c.body}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await b.admin.moderate(c.id, 'approved'); await refresh(); }}><Icon name="check" className="h-4 w-4" />প্রকাশ</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await b.admin.moderate(c.id, 'rejected'); await refresh(); }}><Icon name="x" className="h-4 w-4" />বাদ</button>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === 'inbox' && (inbox === null ? <Loader /> : (
        <ul className="grid gap-3">
          {inbox.map((i) => (
            <li key={i.id} className={`card p-4 ${i.status !== 'new' ? 'opacity-60' : ''}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm"><span className="tag !py-0">{KIND[i.kind]}</span><span className="text-ink-soft">{bnDate(i.createdAt)}</span>{i.status !== 'new' && <span className="tag tag-sun !py-0">{i.status === 'used' ? 'ব্যবহৃত' : i.status === 'answered' ? 'উত্তর দেওয়া' : 'আর্কাইভ'}</span>}</p>
              <dl className="mt-2 grid gap-1 text-[.95rem]">
                {Object.entries(i.fields).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="min-w-20 text-ink-soft">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
              </dl>
              {i.status === 'new' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.kind === 'myth_tip' && <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await b.admin.markInbox(i.id, 'used'); await refresh(); }}>শুক্রবারের তালিকায়</button>}
                  {i.kind === 'question' && <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await b.admin.markInbox(i.id, 'answered'); await refresh(); }}>উত্তর দেওয়া হয়েছে</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await b.admin.markInbox(i.id, 'archived'); await refresh(); }}>আর্কাইভ</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function PitchReview({ p, mentors, onMove }: { p: Pitch; mentors: string[]; onMove: (p: Pitch, s: PitchStatus, o?: { feedback?: string; mentorName?: string }) => Promise<void> }) {
  const [checks, setChecks] = useState({ fit: false, facts: false, safety: false });
  const [mentor, setMentor] = useState(p.mentorName ?? '');
  const [feedback, setFeedback] = useState(p.feedback ?? '');
  const pl = p.payload;
  const allOk = checks.fit && checks.facts && checks.safety;
  return (
    <div className="grid gap-4 border-t border-line bg-tint/50 p-4">
      {pl ? (
        <div className="grid gap-1 text-[.95rem]">
          <p><b>শুরুর প্রশ্ন:</b> {pl.spark}</p>
          <p><b>ফরম্যাট:</b> {pl.formats.join(', ')} · {pl.frequency} · <b>কাদের জন্য:</b> {pl.audience}</p>
          <p><b>প্রথম ৩ পর্ব:</b> {pl.episodes.join(' / ')}</p>
          {pl.sdg && <p><b>SDG:</b> {pl.sdg}</p>}
          <p><b>দক্ষতা:</b> {pl.skillsHave}{pl.mentorIn ? ` · মেন্টর চাই: ${pl.mentorIn}` : ''}</p>
          <p><b>বয়স:</b> {pl.ageBand}{pl.parentEmail ? ` · অভিভাবক: ${pl.parentEmail}` : ''}</p>
        </div>
      ) : <p className="text-sm text-ink-soft">(নমুনা পিচ — বিস্তারিত নেই)</p>}

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-bold">রিভিউ চেকলিস্ট</legend>
        {([['fit', 'বিষয়ের মিল'], ['facts', 'তথ্য যাচাইযোগ্য'], ['safety', 'নিরাপত্তা (বয়স, ব্যক্তিগত তথ্য)']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-teal" checked={checks[k]} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />{l}</label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`m-${p.code}`}>মেন্টর</label>
          <select id={`m-${p.code}`} className="field" value={mentor} onChange={(e) => setMentor(e.target.value)}><option value="">বেছে নিন</option>{mentors.map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor={`f-${p.code}`}>“এখনো না” হলে মতামত + ছোট প্রথম ধাপ</label>
          <textarea id={`f-${p.code}`} className="field !min-h-20" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {p.status === 'sent' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onMove(p, 'reviewing')}>রিভিউ শুরু</button>}
        <button type="button" className="btn btn-primary btn-sm" disabled={!allOk || !mentor} onClick={() => onMove(p, 'mentor', { mentorName: mentor })} title={!allOk ? 'আগে তিনটা চেক' : !mentor ? 'মেন্টর বেছে নিন' : ''}>অনুমোদন + মেন্টর ঠিক</button>
        {p.status === 'mentor' && <button type="button" className="btn btn-pill btn-sm" onClick={() => onMove(p, 'live')}>সিরিজ লাইভ</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={feedback.trim().length < 10} onClick={() => onMove(p, 'not_yet', { feedback })}>এখনো না</button>
      </div>
    </div>
  );
}
