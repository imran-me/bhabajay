/** Tiny Bangla number/date formatting for islands (no Node-only imports). */
const BN = '০১২৩৪৫৬৭৮৯';
export const bn = (n: number | string) => String(n).replace(/\d/g, (d) => BN[+d]);
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const bnDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${bn(d)} ${MONTHS[m - 1]} ${bn(y)}`;
};

/** Date label only for dates that have passed (scheduled posts show no date). */
export const shownDate = (iso: string) => {
  const today = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  return iso <= today ? bnDate(iso) : '';
};

/** Feed thumbnails: 480 px variant next to each card image (`name-480.webp`), full size as fallback. */
export const thumbProps = (src: string) => ({
  srcSet: `${src.replace(/\.webp$/, '-480.webp')} 480w, ${src} 960w`,
  sizes: '(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw',
  onError: (e: { currentTarget: HTMLImageElement }) => {
    const im = e.currentTarget;
    if (im.srcset) { im.removeAttribute('srcset'); im.src = src; }
  },
});
