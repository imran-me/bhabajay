/**
 * Ritual clocks, all in Asia/Dhaka (UTC+6, no DST):
 *  - আজকের ভাবনা changes daily at 08:00
 *  - শুক্রবারের মিথ is the latest myth whose Friday has arrived
 *  - শনিবারের কুইজ drops Saturday 20:00; answers + explanations next morning 08:00
 */
const DHAKA_OFFSET = 6 * 3600_000;
const DAY = 86400_000;

/** "YYYY-MM-DD" of the Dhaka calendar day for `d` */
export function dhakaDay(d = new Date()): string {
  return new Date(d.getTime() + DHAKA_OFFSET).toISOString().slice(0, 10);
}

/** Integer that increments every day at 08:00 Dhaka */
export function thoughtIndex(count: number, d = new Date()): number {
  const shifted = d.getTime() + DHAKA_OFFSET - 8 * 3600_000;
  const dayNo = Math.floor(shifted / DAY);
  return ((dayNo % count) + count) % count;
}

/** ISO week key (Dhaka) like "2026-W46" — used for weekly rotation + streak freezes */
export function weekKey(d = new Date()): string {
  const t = new Date(d.getTime() + DHAKA_OFFSET);
  const date = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

export interface WeeklyLike { slug: string; opensAt?: string }

/** The weekly quiz that is currently open (latest whose drop has passed), plus the next one. */
export function weeklyWindow<T extends WeeklyLike>(weeklies: T[], now = new Date()) {
  const sorted = [...weeklies].filter((w) => w.opensAt).sort((a, b) => Date.parse(a.opensAt!) - Date.parse(b.opensAt!));
  let current: T | undefined;
  let next: T | undefined;
  for (const w of sorted) {
    if (Date.parse(w.opensAt!) <= now.getTime()) current = w;
    else if (!next) next = w;
  }
  current ??= sorted[0];
  const revealAt = current?.opensAt ? Date.parse(current.opensAt) + 12 * 3600_000 : 0; // next morning 08:00
  return { current, next, revealAt, answersOut: now.getTime() >= revealAt };
}

/** The next Saturday 20:00 Dhaka after `now` (for countdowns when no quiz is scheduled yet) */
export function nextSaturdayDrop(now = new Date()): Date {
  const t = new Date(now.getTime() + DHAKA_OFFSET);
  const day = t.getUTCDay();
  let add = (6 - day + 7) % 7;
  const drop = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + add, 20, 0, 0);
  let ms = drop - DHAKA_OFFSET;
  if (ms <= now.getTime()) ms += 7 * DAY;
  return new Date(ms);
}

export function isFridayDhaka(now = new Date()): boolean {
  return new Date(now.getTime() + DHAKA_OFFSET).getUTCDay() === 5;
}
