/** শনিবারের কুইজ: picks the open quiz by the visitor's clock (Sat 20:00 Dhaka drop). */
import { useEffect, useState } from 'react';
import type { Quiz } from '../../data/types';
import { weeklyWindow, nextSaturdayDrop } from '../../lib/time';
import { bnCountdown, bnDate, bn } from '../../lib/bn';
import QuizPlayer from './QuizPlayer';

export default function WeeklyQuiz({ weeklies }: { weeklies: Quiz[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { current, next, revealAt, answersOut } = weeklyWindow(weeklies, new Date(now));
  const nextDrop = next?.opensAt ? Date.parse(next.opensAt) : nextSaturdayDrop(new Date(now)).getTime();
  if (!current) return null;
  const opened = Date.parse(current.opensAt!);
  return (
    <div className="grid gap-4">
      <QuizPlayer key={current.slug} quiz={current} revealAt={revealAt} shareUrl="/quiz/weekly" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-sm font-bold text-ink-soft">এই কুইজ খুলেছে</p>
          <p className="text-lg font-bold">{bnDate(new Date(opened))}, রাত ৮টা</p>
          <p className="mt-1 text-sm text-ink-soft">{answersOut ? 'উত্তর আর ব্যাখ্যা প্রকাশিত হয়েছে ✓' : `উত্তর + ব্যাখ্যা আসবে ${bnCountdown(revealAt - now)} পর (কাল সকাল ৮টা)`}</p>
        </div>
        <div className="card bg-sun-soft p-4">
          <p className="text-sm font-bold text-ink-soft">পরের কুইজ</p>
          <p className="font-display text-2xl tabular-nums">{bnCountdown(nextDrop - now)}</p>
          <p className="text-sm text-ink-soft">শনিবার রাত ৮টায় · {bn(5)} প্রশ্ন</p>
        </div>
      </div>
    </div>
  );
}
