/** ভাবুর দুনিয়া cast portraits — flat, brand palette, 80×80. */
import type { CastId } from '../data/types';
import { bhabuSvg } from './bhabu';

export const CAST: Record<CastId, { bn: string; line: string }> = {
  bhabu: { bn: 'ভাবু', line: 'প্রশ্নচিহ্নের ভাই "!" — সব কিছুতে অবাক হয়, তারপর উত্তর খোঁজে।' },
  rafi: { bn: 'রাফি', line: 'ক্লাস সেভেন, ফুটবল-পাগল। প্রশ্ন করে আগে, ভাবে পরে।' },
  titli: { bn: 'তিতলি', line: 'রাফির ছোট বোন। আঁকতে ভালোবাসে, সব কিছু খাতায় টুকে রাখে।' },
  ammu: { bn: 'আম্মু', line: 'বাড়ির আসল বিজ্ঞানী — রান্নাঘরই তাঁর ল্যাব।' },
  dadu: { bn: 'দাদু', line: 'পুরোনো বিশ্বাসের ঝুড়ি, কিন্তু নতুন কিছু শিখতে সবার আগে।' },
};

const SKIN = '#D9A27A';
const SKIN2 = '#C68B62';
const D = '#063C43';

function face(extra = '') {
  return `<circle cx="40" cy="44" r="19" fill="${SKIN}"/><circle cx="33" cy="44" r="2.2" fill="${D}"/><circle cx="47" cy="44" r="2.2" fill="${D}"/><path d="M34 52 Q40 57 46 52" stroke="${D}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="29" cy="50" r="3" fill="#FF8B7E" opacity=".45"/><circle cx="51" cy="50" r="3" fill="#FF8B7E" opacity=".45"/>${extra}`;
}

export function castSvg(id: CastId, cls = 'w-full h-full'): string {
  const wrap = (bg: string, inner: string) =>
    `<svg viewBox="0 0 80 80" class="${cls}" aria-hidden="true"><circle cx="40" cy="40" r="40" fill="${bg}"/><clipPath id="cc-${id}"><circle cx="40" cy="40" r="40"/></clipPath><g clip-path="url(#cc-${id})">${inner}</g></svg>`;
  switch (id) {
    case 'rafi':
      return wrap('#FFC93C', `<path d="M14 80 Q16 64 40 63 Q64 64 66 80 Z" fill="#0B6E79"/><path d="M33 64 L40 72 L47 64" fill="#fff"/>${face()}<path d="M21 40 Q22 22 40 22 Q58 22 59 40 Q52 30 40 31 Q28 30 21 40 Z" fill="#2B1B12"/>`);
    case 'titli':
      return wrap('#E6F5F3', `<path d="M14 80 Q16 64 40 63 Q64 64 66 80 Z" fill="#FF6B5B"/>${face()}<path d="M20 44 Q19 21 40 21 Q61 21 60 44 Q56 30 40 30 Q24 30 20 44 Z" fill="#2B1B12"/><circle cx="18" cy="48" r="6" fill="#2B1B12"/><circle cx="62" cy="48" r="6" fill="#2B1B12"/><circle cx="19" cy="41" r="3.5" fill="#FF6B5B"/><circle cx="61" cy="41" r="3.5" fill="#FF6B5B"/>`);
    case 'ammu':
      return wrap('#FFE4E0', `<path d="M12 80 Q14 62 40 61 Q66 62 68 80 Z" fill="#0B6E79"/><path d="M12 80 Q30 64 52 80 Z" fill="#FFC93C" opacity=".9"/><circle cx="40" cy="44" r="19" fill="${SKIN2}"/><circle cx="33" cy="44" r="2.2" fill="${D}"/><circle cx="47" cy="44" r="2.2" fill="${D}"/><path d="M34 52 Q40 56 46 52" stroke="${D}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="40" cy="35" r="1.8" fill="#FF6B5B"/><path d="M21 42 Q21 22 40 22 Q59 22 59 42 Q55 29 40 29 Q25 29 21 42 Z" fill="#1E140E"/><circle cx="40" cy="20" r="7" fill="#1E140E"/>`);
    case 'dadu':
      return wrap('#063C43', `<path d="M14 80 Q16 64 40 63 Q64 64 66 80 Z" fill="#FFFBF4"/>${face()}<path d="M24 50 Q26 68 40 70 Q54 68 56 50 Q50 58 40 58 Q30 58 24 50 Z" fill="#F2F2F2"/><path d="M34 54 Q40 52 46 54" stroke="#DADADA" stroke-width="3" fill="none"/><circle cx="33" cy="44" r="5.5" fill="none" stroke="${D}" stroke-width="1.8"/><circle cx="47" cy="44" r="5.5" fill="none" stroke="${D}" stroke-width="1.8"/><path d="M38.5 44 L41.5 44" stroke="${D}" stroke-width="1.8"/><path d="M22 34 Q24 22 40 21 Q56 22 58 34 Q48 28 40 28 Q32 28 22 34 Z" fill="#fff"/>`);
    case 'bhabu':
    default:
      return `<span class="${cls} grid place-items-center rounded-full bg-sun">${bhabuSvg({ face: 'wow', body: 'teal', dot: 'coral', sparks: false, className: 'h-[85%] w-auto' })}</span>`;
  }
}
