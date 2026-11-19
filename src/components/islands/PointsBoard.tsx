/**
 * /leaderboard — accounts ranked by ভাবনা পয়েন্ট (quiz + unlocks + bonuses).
 * Weekly / all-time tabs, district filter (only people who allowed it), top-3 podium.
 * Never shows ages. Falls back to the browser leaderboard when /api is not there.
 */
import { useEffect, useState } from 'react';
import type { AvatarConfig } from '../../data/types';
import { DEFAULT_AVATAR } from '../../lib/bhabu';
import { bn } from '../../lib/bn';
import { prefersReducedMotion } from '../../lib/fx';
import { Avatar, Bhabu, Loader } from './ui';

interface Row { rank: number; name: string; username: string | null; avatar: AvatarConfig | null; district: string | null; score: number; me: boolean }

export default function PointsBoard() {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [district, setDistrict] = useState('');
  const [data, setData] = useState<{ rows: Row[]; districts: string[] } | null | 'off'>(null);

  useEffect(() => {
    setData(null);
    const q = new URLSearchParams({ period });
    if (district) q.set('district', district);
    fetch(`/api/leaderboard.php?${q}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(async (r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? setData(await r.json()) : setData('off')))
      .catch(() => setData('off'));
  }, [period, district]);

  const motion = !prefersReducedMotion();
  const top = data && data !== 'off' ? data.rows.slice(0, 3) : [];
  const rest = data && data !== 'off' ? data.rows.slice(3) : [];
  // podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]];
  const heights = ['h-24', 'h-32', 'h-20'];
  const medals = ['🥈', '🥇', '🥉'];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-tint p-1" role="tablist" aria-label="সময়">
          {([['week', 'এই সপ্তাহ'], ['all', 'সব সময়']] as const).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={period === id} onClick={() => setPeriod(id)}
              className={`min-h-11 rounded-xl px-4 font-bold ${period === id ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}>{l}</button>
          ))}
        </div>
        {data && data !== 'off' && (data.districts.length > 0 || district) && (
          <label className="ml-auto flex items-center gap-2">
            <span className="sr-only">জেলা</span>
            <select className="field min-h-11 !w-auto" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">সব জেলা</option>
              {[...new Set([...(district ? [district] : []), ...data.districts])].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
      </div>

      {data === null && <Loader label="তালিকা সাজাচ্ছি…" />}
      {data === 'off' && (
        <div className="card p-6 text-center">
          <p className="font-bold">লিডারবোর্ড এই মুহূর্তে আনা যাচ্ছে না।</p>
          <a href="/quiz/leaderboard" className="btn btn-ghost mt-3">কুইজের লিডারবোর্ড দেখো</a>
        </div>
      )}
      {data && data !== 'off' && data.rows.length === 0 && (
        <div className="card flex flex-col items-center p-8 text-center">
          <Bhabu face="wink" body="teal" dot="coral" className="w-16" />
          <p className="mt-3 text-xl font-bold">{period === 'week' ? 'এই সপ্তাহে এখনো কেউ পয়েন্ট পায়নি' : 'এখনো তালিকা ফাঁকা'}</p>
          <p className="mt-1 text-ink-soft">প্রথম হও! কুইজ খেলো বা আজকের চাবি দিয়ে কার্ড খোলো।</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2"><a href="/quiz" className="btn btn-primary">কুইজ খেলো</a><a href="/myth" className="btn btn-ghost">মিথ খোলো</a></div>
        </div>
      )}

      {top.length > 0 && (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="সেরা তিন">
          {podium.map((r, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              {r && (
                <>
                  <div className={motion ? 'reveal-up' : ''} style={motion ? { animationDelay: `${[250, 500, 0][i]}ms` } : undefined}>
                    <Avatar avatar={r.avatar ?? DEFAULT_AVATAR} className={i === 1 ? 'h-20 w-20' : 'h-16 w-16'} />
                  </div>
                  <p className="mt-1 line-clamp-1 w-full text-sm font-bold">{r.username ? <a href={`/u/?h=${r.username}`} className="text-link">{r.name}</a> : r.name}{r.me && ' (তুমি)'}</p>
                  <p className="text-xs text-ink-soft">{bn(r.score)} পয়েন্ট</p>
                  <div className={`mt-1 grid w-full place-items-start justify-center rounded-t-2xl pt-2 text-2xl ${heights[i]} ${i === 1 ? 'bg-sun' : 'bg-tint'} ${motion ? 'origin-bottom animate-[podium_.6s_ease-out_both]' : ''}`}
                    style={motion ? { animationDelay: `${[200, 450, 0][i]}ms` } : undefined}>{medals[i]}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="card divide-y divide-line">
          {rest.map((r) => (
            <li key={r.rank} className={`flex min-h-14 items-center gap-3 px-3 py-2 ${r.me ? 'bg-sun-soft' : ''}`}>
              <span className="w-8 shrink-0 text-center font-bold text-ink-soft">{bn(r.rank)}</span>
              <Avatar avatar={r.avatar ?? DEFAULT_AVATAR} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{r.username ? <a href={`/u/?h=${r.username}`} className="text-link">{r.name}</a> : r.name}{r.me && ' (তুমি)'}</span>
                {r.district && <span className="text-xs text-ink-soft">{r.district}</span>}
              </span>
              <span className="shrink-0 font-bold text-link">{bn(r.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
