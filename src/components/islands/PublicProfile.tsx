/**
 * Public profile of a server account (/u/?h=handle, and /u/<handle> via the 404 page).
 * Shows nickname, avatar, bio, interests, badges, quiz scores, pitches and approved
 * comments. Age band, district and school are never shown.
 */
import { useEffect, useState } from 'react';
import type { AvatarConfig } from '../../data/types';
import { BADGE_MAP } from '../../lib/badges';
import { PITCH_STEPS } from '../../lib/backend/types';
import { DEFAULT_AVATAR } from '../../lib/bhabu';
import { bn, bnMonthYear } from '../../lib/bn';
import { Avatar, Bhabu, Loader } from './ui';
import { ProgressRing } from './unlock';

interface Profile {
  username: string;
  nickname?: string;
  realName?: string | null;
  bio?: string | null;
  avatar?: AvatarConfig | null;
  interests?: string[];
  badges?: string[];
  points?: number;
  core?: boolean;
  joined?: string;
  own?: boolean;
  private?: boolean;
  quizzes?: { slug: string; best: number; total: number; plays: number; points: number }[];
  pitches?: { code: string; title: string; status: string }[];
  comments?: { target: { type: string; id: string }; body: string; createdAt: string }[];
  progress?: Record<string, { opened: number; total: number }>;
  seriesBadges?: { slug: string; title: string; cover?: string | null }[];
}

interface Props {
  seriesTitles: Record<string, string>;
  quizTitles: Record<string, string>;
}

const TARGET_HREF: Record<string, (id: string) => string> = {
  myth: (id) => `/myth/${id}`,
  episode: (id) => `/bhabur-duniya/${id}`,
  post: () => '/series',
  thought: () => '/',
};

export default function PublicProfile({ seriesTitles, quizTitles }: Props) {
  const [p, setP] = useState<Profile | null | 'missing' | 'error'>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('h');
    const fromPath = location.pathname.match(/^\/u\/([a-z0-9_]{3,20})\/?$/i)?.[1];
    const h = (q || fromPath || '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return setP('missing');
    fetch(`/api/profile.php?u=${encodeURIComponent(h)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(async (r) => {
        if (r.status === 404 || r.status === 400) return setP('missing');
        if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return setP('error');
        const data = (await r.json()) as Profile;
        setP(data);
        if (data.nickname) document.title = `${data.nickname} — ভাবা যায়!`;
      })
      .catch(() => setP('error'));
  }, []);

  if (p === null) return <Loader label="প্রোফাইল আনছি…" />;
  if (p === 'missing' || p === 'error') {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <Bhabu face="think" body="teal" dot="coral" className="w-16" />
        <p className="mt-3 text-xl font-bold">{p === 'missing' ? 'এই নামে কাউকে খুঁজে পেলাম না' : 'উফ! প্রোফাইল আনা গেল না'}</p>
        <p className="mt-1 text-ink-soft">{p === 'missing' ? 'ইউজারনেমটা আরেকবার দেখো।' : 'একটু পরে আবার চেষ্টা করো।'}</p>
        <a href="/wall-of-fame" className="btn btn-ghost mt-4">ওয়াল অফ ফেম দেখো</a>
      </div>
    );
  }
  if (p.private && !p.own) {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <Bhabu face="wink" body="teal" dot="coral" className="w-16" />
        <p className="mt-3 text-xl font-bold">@{p.username}-এর প্রোফাইল ব্যক্তিগত</p>
        <p className="mt-1 text-ink-soft">শুধু তিনি নিজে দেখতে পান।</p>
      </div>
    );
  }

  const badges = (p.badges ?? []).map((id) => BADGE_MAP[id]).filter(Boolean);
  return (
    <div className="grid gap-5">
      {p.own && p.private && <p className="rounded-2xl bg-sun-soft p-3 text-sm">শুধু তুমি দেখছ — প্রোফাইল ব্যক্তিগত। <a href="/me" className="font-bold text-link">সেটিংসে</a> পাবলিক করা যায় (১৮+)।</p>}
      <div className="card flex flex-col items-center p-6 text-center sm:flex-row sm:text-left">
        <Avatar avatar={p.avatar ?? DEFAULT_AVATAR} className="h-24 w-24" />
        <div className="mt-3 min-w-0 sm:ml-5 sm:mt-0">
          <h1 className="text-2xl font-bold">{p.nickname}{p.core && <span className="tag ml-2 align-middle text-xs">কোর টিম</span>}</h1>
          {p.realName && <p className="text-ink-soft">{p.realName}</p>}
          <p className="font-en text-sm text-ink-soft">@{p.username}{p.joined && <span className="font-bn"> · যোগ দিয়েছে {bnMonthYear(p.joined)}</span>}</p>
          {p.bio && <p className="mt-2">“{p.bio}”</p>}
          <p className="mt-2 font-bold text-link">🧠 {bn(p.points ?? 0)} পয়েন্ট · 🏅 {bn(badges.length)} ব্যাজ</p>
        </div>
      </div>

      {(p.interests?.length ?? 0) > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">কৌতূহল</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.interests!.map((s) => <a key={s} href={`/series/${s}`} className="chip min-h-11">{seriesTitles[s] ?? s}</a>)}
          </div>
        </section>
      )}

      {(p.seriesBadges?.length ?? 0) > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">সিরিজ-ব্যাজ কার্ড</h2>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.seriesBadges!.map((b) => (
              <li key={b.slug}><a href={b.slug === 'myth-na-sotti' ? '/myth' : `/series/${b.slug}`} className="block overflow-hidden rounded-2xl bg-deep text-white ring-2 ring-sun">
                {b.cover ? <img src={b.cover} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" /> : <span className="grid aspect-[4/5] place-items-center text-5xl">🏅</span>}
                <span className="block p-2 text-sm font-bold leading-snug">🏅 {b.title}</span>
              </a></li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(p.progress ?? {}).length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">কোন সিরিজে কতদূর</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(p.progress!).map(([slug, x]) => (
              <li key={slug} className="flex min-h-11 items-center gap-3 rounded-2xl bg-tint p-2 px-3">
                <a href={slug === 'myth-na-sotti' ? '/myth' : `/series/${slug}`} className="min-w-0 flex-1 truncate font-semibold">{slug === 'myth-na-sotti' ? 'মিথ না সত্য?' : seriesTitles[slug] ?? slug}</a>
                <ProgressRing done={x.opened} total={x.total} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-bold">ব্যাজ</h2>
        {badges.length === 0 ? <p className="mt-1 text-ink-soft">এখনো কোনো ব্যাজ নেই।</p> : (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {badges.map((b) => <li key={b.id} className="rounded-2xl bg-tint p-3"><p className="font-bold">{b.bn}</p><p className="text-xs text-ink-soft">{b.how}</p></li>)}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">কুইজ স্কোর</h2>
        {(p.quizzes?.length ?? 0) === 0 ? <p className="mt-1 text-ink-soft">এখনো কোনো কুইজ খেলা হয়নি।</p> : (
          <ul className="mt-2 grid gap-2">
            {p.quizzes!.map((q) => (
              <li key={q.slug} className="flex items-center gap-3 rounded-2xl bg-tint p-3">
                <a href={q.slug === 'weekly' ? '/quiz/weekly' : `/quiz/${q.slug}`} className="min-w-0 flex-1 font-semibold">{q.slug === 'weekly' ? 'শনিবারের কুইজ' : quizTitles[q.slug] ?? q.slug}</a>
                <span className="shrink-0 font-bold text-link">{bn(q.best)}/{bn(q.total)}</span>
                <span className="shrink-0 text-xs text-ink-soft">{bn(q.plays)} বার</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(p.pitches?.length ?? 0) > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">পিচ</h2>
          <ul className="mt-2 grid gap-2">
            {p.pitches!.map((x) => (
              <li key={x.code}><a href={`/initiator/track?code=${x.code}`} className="flex min-h-11 items-center gap-3 rounded-2xl bg-tint p-3">
                <span className="min-w-0 flex-1 font-semibold">“{x.title}”</span>
                <span className="tag shrink-0">{x.status === 'not_yet' ? 'এখনো না' : PITCH_STEPS.find((s) => s.id === x.status)?.bn ?? x.status}</span>
              </a></li>
            ))}
          </ul>
        </section>
      )}

      {(p.comments?.length ?? 0) > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">মন্তব্য</h2>
          <ul className="mt-2 grid gap-2">
            {p.comments!.map((c, i) => (
              <li key={i}><a href={(TARGET_HREF[c.target.type] ?? (() => '/'))(c.target.id)} className="block rounded-2xl bg-tint p-3">
                <p className="line-clamp-3">{c.body}</p>
              </a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
