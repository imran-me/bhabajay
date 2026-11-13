/** Leaderboards: people · school vs school · district. Public names only (nicknames). */
import { useEffect, useState } from 'react';
import { getBackend, type LeaderRow } from '../../lib/backend';
import { getState } from '../../lib/store';
import { bn, bnNum } from '../../lib/bn';
import { Loader, Icon } from './ui';

type Scope = 'people' | 'schools' | 'districts';
const TABS: { id: Scope; bn: string }[] = [
  { id: 'people', bn: 'খেলোয়াড়' },
  { id: 'schools', bn: 'স্কুল বনাম স্কুল' },
  { id: 'districts', bn: 'জেলা' },
];
const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ initial = 'people', limit = 20 }: { initial?: Scope; limit?: number }) {
  const [scope, setScope] = useState<Scope>(initial);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [hasSchool, setHasSchool] = useState(true);

  useEffect(() => {
    const s = new URLSearchParams(location.search).get('scope');
    if (s === 'schools' || s === 'districts') setScope(s);
  }, []);

  useEffect(() => {
    setRows(null);
    setHasSchool(!!getState().user?.schoolId);
    void getBackend().then((b) => b.leaderboard(scope)).then(setRows);
  }, [scope]);

  const mine = rows?.find((r) => r.me);
  return (
    <div className="card overflow-hidden">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3" aria-label="লিডারবোর্ড">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={scope === t.id} onClick={() => setScope(t.id)}
            className={`relative shrink-0 px-3 pb-3 pt-1 font-bold ${scope === t.id ? 'text-coral-dark after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-coral dark:text-coral' : 'text-ink-soft'}`}>
            {t.bn}
          </button>
        ))}
      </div>
      {rows === null ? (
        <Loader label="স্কোর গুনছি…" />
      ) : (
        <ol className="divide-y divide-line">
          {rows.slice(0, limit).map((r) => (
            <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 px-4 py-3 ${r.me ? 'bg-sun-soft' : ''}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${r.rank <= 3 ? 'text-xl' : 'bg-tint text-sm text-link'}`}>{r.rank <= 3 ? MEDAL[r.rank - 1] : bn(r.rank)}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-bold">{r.name}{r.me && ' (তুমি)'}</span>
                {r.sub && <span className="text-sm text-ink-soft">{r.sub}</span>}
              </span>
              <span className="text-right leading-tight">
                <span className="block font-display text-xl text-link">{bnNum(r.score)}</span>
                <span className="text-xs text-ink-soft">{r.plays ? `${bn(r.plays)} বার খেলা` : 'পয়েন্ট'}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {rows && scope === 'people' && !mine && (
        <p className="border-t border-line p-4 text-sm text-ink-soft">তুমি এখনো তালিকায় নেই — <a href="/quiz/weekly" className="font-bold text-link">শনিবারের কুইজ খেলো</a>।</p>
      )}
      {rows && scope === 'schools' && !hasSchool && (
        <div className="flex items-center gap-3 border-t border-line p-4 text-sm">
          <Icon name="school" className="h-5 w-5 text-link" />
          <p>তোমার স্কুলের হয়ে খেলতে <a href="/me#settings" className="font-bold text-link">প্রোফাইলে স্কুল যোগ করো</a> (১৩–১৭ হলে অভিভাবকের সম্মতি লাগবে)। ক্লাব বা ক্লাস হিসেবে খেলতে চাইলে শিক্ষক <a href="/teachers" className="font-bold text-link">ক্লাব অ্যাকাউন্ট</a> খুলতে পারেন।</p>
        </div>
      )}
    </div>
  );
}
