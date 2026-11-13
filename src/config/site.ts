/**
 * Site-wide configuration. URLs marked OWNER-CONFIRM are placeholders the
 * owner must confirm before launch (Website Plan p.26, decisions ১ and ৫).
 */
const env = import.meta.env;

export const SITE = {
  name: 'ভাবা যায়!',
  nameEn: 'Bhaba Jay',
  url: (env.PUBLIC_SITE_URL as string | undefined) || 'https://bhabajay.com',
  tagline: 'প্রশ্ন যার, সিরিজ তার। ভাবা যায়!',
  description:
    'ভাবা যায়! — কৌতূহলী বাংলাদেশের ঘর। মজার বিজ্ঞান কার্ড, মিথ না সত্য যাচাই, ভাবুর দুনিয়া কার্টুন, শনিবারের কুইজ, আর তোমার প্রশ্ন থেকে তোমার সিরিজ।',
  locale: 'bn_BD',
  twitter: '@bhabajay',
  // OWNER-CONFIRM: real partner + social URLs. Empty → internal fallbacks.
  deltaUrl: (env.PUBLIC_DELTA_URL as string | undefined) || '',
  facebookUrl: (env.PUBLIC_FACEBOOK_URL as string | undefined) || '',
  youtubeUrl: (env.PUBLIC_YOUTUBE_URL as string | undefined) || '',
  contactEmail: 'hello@bhabajay.com',
};

export const DEMO_MODE = !(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);

/** Primary navigation (desktop top bar) */
export const NAV = [
  { href: '/series', bn: 'সিরিজ', en: 'Series' },
  { href: '/bhabur-duniya', bn: 'ভাবুর দুনিয়া', en: 'Cartoon' },
  { href: '/myth', bn: 'মিথ না সত্য?', en: 'Myth or fact?' },
  { href: '/quiz', bn: 'কুইজ', en: 'Quiz' },
  { href: '/wall-of-fame', bn: 'ওয়াল অফ ফেম', en: 'Wall of Fame' },
] as const;

/** Mobile bottom tabs: হোম · সিরিজ · কুইজ · ফেম · আমি (thumb zone) */
export const TABS = [
  { href: '/', bn: 'হোম', en: 'Home', icon: 'home' },
  { href: '/series', bn: 'সিরিজ', en: 'Series', icon: 'series' },
  { href: '/quiz', bn: 'কুইজ', en: 'Quiz', icon: 'quiz' },
  { href: '/wall-of-fame', bn: 'ফেম', en: 'Fame', icon: 'fame' },
  { href: '/me', bn: 'আমি', en: 'Me', icon: 'me' },
] as const;

export const FOOTER_LINKS = {
  explore: [
    { href: '/series', bn: 'সব সিরিজ', en: 'All series' },
    { href: '/bhabur-duniya', bn: 'ভাবুর দুনিয়া', en: 'Cartoon' },
    { href: '/myth', bn: 'মিথ না সত্য?', en: 'Myth library' },
    { href: '/quiz', bn: 'কুইজ জোন', en: 'Quiz zone' },
    { href: '/search', bn: 'খোঁজো', en: 'Search' },
  ],
  community: [
    { href: '/initiator', bn: 'ইনিশিয়েটর হও', en: 'Become an Initiator' },
    { href: '/wall-of-fame', bn: 'ওয়াল অফ ফেম', en: 'Wall of Fame' },
    { href: '/ask', bn: 'ভাবুকে জিজ্ঞেস করো', en: 'Ask ভাবু' },
    { href: '/mentors', bn: 'মেন্টর হও', en: 'Become a mentor' },
    { href: '/teachers', bn: 'শিক্ষকদের কিট', en: 'Teacher kits' },
    { href: '/journal', bn: 'জার্নাল', en: 'Journal' },
  ],
  about: [
    { href: '/about', bn: 'আমাদের কথা', en: 'About us' },
    { href: '/privacy', bn: 'গোপনীয়তা ও অভিভাবক', en: 'Privacy & parents' },
    { href: '/code-of-conduct', bn: 'আচরণবিধি', en: 'Code of conduct' },
    { href: '/contact', bn: 'যোগাযোগ', en: 'Contact' },
  ],
};
