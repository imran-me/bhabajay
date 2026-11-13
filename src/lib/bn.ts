/** Bangla formatting helpers: digits, dates, counts, relative time. */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** 1234 → "১২৩৪"; also accepts strings ("4:12" → "৪:১২"). */
export function bn(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Bangla digits → ASCII digits (for parsing user input). */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** 2314 → "২,৩১৪" (South-Asian grouping: 12,34,567) */
export function bnNum(n: number): string {
  const s = Math.round(n).toString();
  if (s.length <= 3) return bn(s);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return bn(`${rest},${last3}`);
}

/** 12400 → "১২ হাজার", 1_250_000 → "১২.৫ লাখ" */
export function bnCompact(n: number): string {
  if (n >= 10_000_000) return `${bn(trim(n / 10_000_000))} কোটি`;
  if (n >= 100_000) return `${bn(trim(n / 100_000))} লাখ`;
  if (n >= 1000) return `${bn(trim(n / 1000))} হাজার`;
  return bn(n);
}
function trim(x: number) {
  return x >= 10 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString();
}

export const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
export const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

/** "2026-11-14" → "১৪ নভেম্বর ২০২৬" (date-only strings are treated as Dhaka dates) */
export function bnDate(iso: string | Date, opts: { year?: boolean } = {}): string {
  const d = typeof iso === 'string' ? parseLocalDate(iso) : iso;
  const dh = toDhaka(d);
  const base = `${bn(dh.getUTCDate())} ${BN_MONTHS[dh.getUTCMonth()]}`;
  return opts.year === false ? base : `${base} ${bn(dh.getUTCFullYear())}`;
}

/** "অক্টোবর ২০২৬" */
export function bnMonthYear(iso: string): string {
  const dh = toDhaka(parseLocalDate(iso));
  return `${BN_MONTHS[dh.getUTCMonth()]} ${bn(dh.getUTCFullYear())}`;
}

function parseLocalDate(iso: string): Date {
  // A bare YYYY-MM-DD means "that day in Dhaka" → noon Dhaka avoids TZ edge flips
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T12:00:00+06:00`);
  return new Date(iso);
}

/** Shift a Date so its UTC fields read as Asia/Dhaka wall-clock (UTC+6, no DST). */
export function toDhaka(d: Date): Date {
  return new Date(d.getTime() + 6 * 3600_000);
}

/** "৩ দিন আগে", "এইমাত্র" */
export function bnAgo(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return `${bn(Math.floor(diff / 60))} মিনিট আগে`;
  if (diff < 86400) return `${bn(Math.floor(diff / 3600))} ঘণ্টা আগে`;
  if (diff < 86400 * 30) return `${bn(Math.floor(diff / 86400))} দিন আগে`;
  return bnDate(iso);
}

/** mm:ss countdown in Bangla digits; adds hours/days when needed */
export function bnCountdown(ms: number): string {
  if (ms <= 0) return bn('০০:০০');
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${bn(d)} দিন ${bn(h)} ঘণ্টা`;
  if (h > 0) return `${bn(h)} ঘণ্টা ${bn(m)} মিনিট`;
  return bn(`${pad(m)}:${pad(sec)}`);
}

export const OPTION_LETTERS = ['ক', 'খ', 'গ', 'ঘ'] as const;

export const TOPIC_LABEL: Record<string, string> = {
  food: 'খাবার',
  health: 'স্বাস্থ্য',
  nature: 'প্রকৃতি',
  space: 'মহাকাশ',
  chemistry: 'রসায়ন',
  biology: 'জীববিজ্ঞান',
  physics: 'পদার্থবিজ্ঞান',
  body: 'শরীর',
  history: 'ইতিহাস',
  tech: 'প্রযুক্তি',
};

export const VERDICT_LABEL = { true: 'সত্য', myth: 'মিথ', partial: 'আংশিক' } as const;

export const TIER_LABEL = {
  curious: { bn: 'কৌতূহলী', en: 'Curious' },
  explorer: { bn: 'অভিযাত্রী', en: 'Explorer' },
  initiator: { bn: 'ইনিশিয়েটর', en: 'Initiator' },
  legend: { bn: 'কিংবদন্তি', en: 'Legend' },
} as const;

export const FORMAT_LABEL = { card: 'কার্ড', video: 'ভিডিও', blog: 'ব্লগ' } as const;
