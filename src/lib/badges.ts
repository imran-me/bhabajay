import type { DoodleName, Tier } from '../data/types';

export interface BadgeDef {
  id: string;
  bn: string;
  how: string;
  doodle?: DoodleName;
  text?: string;
  bg: 'teal' | 'coral' | 'sun' | 'deep' | 'mint';
}

/** Round, flat, one doodle inside; locked = grey silhouette + "?" (Plan p.19) */
export const BADGES: BadgeDef[] = [
  { id: 'first-quiz', bn: 'প্রথম কুইজ', how: 'যেকোনো একটা কুইজ খেলো', doodle: 'bulb', bg: 'sun' },
  { id: 'perfect-5', bn: '৫/৫', how: '৫ প্রশ্নের কুইজে সবগুলো ঠিক', text: '৫/৫', bg: 'teal' },
  { id: 'streak-3', bn: '৩ দিনের আগুন', how: 'টানা ৩ দিন ভাবা যায়!-এ এসো', text: '৩', bg: 'coral' },
  { id: 'streak-7', bn: '৭ দিনের স্ট্রিক', how: 'টানা ৭ দিন', text: '৭', bg: 'coral' },
  { id: 'streak-30', bn: '৩০ দিনের স্ট্রিক', how: 'টানা ৩০ দিন — সত্যিকারের কৌতূহলী', text: '৩০', bg: 'deep' },
  { id: 'myth-buster', bn: 'মিথ-ভাঙা', how: '৫টা মিথ পুরো পড়ো', doodle: 'eye', bg: 'mint' },
  { id: 'fast-10', bn: 'বিদ্যুৎ-মগজ', how: 'দ্রুত ১০-এ ৮ বা বেশি', doodle: 'bolt', bg: 'deep' },
  { id: 'night-owl', bn: 'রাতের ভাবুক', how: 'রাত ৯টার পর রাতের ভাবনা কুইজ খেলো', doodle: 'moon', bg: 'deep' },
  { id: 'episode-mosha', bn: 'মশা-বিশারদ', how: 'পর্ব ১ দেখে কুইজে ৩/৩', doodle: 'mosquito', bg: 'mint' },
  { id: 'episode-bang', bn: 'ব্যাঙ-বন্ধু', how: 'পর্ব ২ দেখে কুইজে ৩/৩', doodle: 'frog', bg: 'mint' },
  { id: 'episode-mati', bn: 'মাটির ঘ্রাণ', how: 'পর্ব ৩ দেখে কুইজে ৩/৩', doodle: 'drop', bg: 'mint' },
  { id: 'episode-jonaki', bn: 'জোনাকি', how: 'পর্ব ৪ দেখে কুইজে ৩/৩', doodle: 'sparkle', bg: 'deep' },
  { id: 'kitchen-chemist', bn: 'রান্নাঘরের রসায়নবিদ', how: 'নাদিয়ার কুইজে ৪ বা বেশি', doodle: 'flask', bg: 'coral' },
  { id: 'saver', bn: 'সংগ্রাহক', how: '৫টা পোস্ট সেভ করো', doodle: 'book', bg: 'sun' },
  { id: 'sharer', bn: 'খবর-বাহক', how: '৩ বার শেয়ার করো', doodle: 'butterfly', bg: 'sun' },
  { id: 'dadu', bn: 'দাদুর প্রশ্ন', how: 'পরিবারের একটা মিথ ভাবুকে পাঠাও', doodle: 'heart', bg: 'coral' },
  { id: 'pitch-sent', bn: 'প্রথম পিচ', how: 'একটা সিরিজ-আইডিয়া পাঠাও', doodle: 'bulb', bg: 'coral' },
  { id: 'secret', bn: 'গোপন দরজা', how: '???', doodle: 'paw', bg: 'deep' },
  { id: 'explorer', bn: 'অভিযাত্রী', how: 'প্রথম অবদান গৃহীত বা সিরিজ দলে যোগ', doodle: 'telescope', bg: 'teal' },
  { id: 'initiator', bn: 'ইনিশিয়েটর', how: 'তোমার সিরিজ লাইভ, ৪টি প্রকাশিত পোস্ট', doodle: 'sparkle', bg: 'coral' },
  { id: 'legend', bn: 'কিংবদন্তি', how: '৬ মাসের সিরিজ + গবেষণা/ফোরাম/প্রভাব', doodle: 'planet', bg: 'sun' },
  { id: 'translator', bn: 'অনুবাদক', how: 'একটা অনুবাদ গৃহীত', doodle: 'book', bg: 'teal' },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export const TIERS: { id: Tier; bn: string; en: string; need: string; unlocks: string }[] = [
  { id: 'curious', bn: 'কৌতূহলী', en: 'Curious', need: 'আইডি বানাও, তারপর ৩টা কুইজ খেলো, ৫টা পোস্ট সেভ করো, বা টানা ৭ দিনের স্ট্রিক রাখো।', unlocks: 'অবতার স্টুডিও, ব্যাজ' },
  { id: 'explorer', bn: 'অভিযাত্রী', en: 'Explorer', need: 'অবদান রাখো: প্রথম গৃহীত কাজ (একটা কার্ড, ব্যবহৃত মিথ-টিপ, ব্লগ, অনুবাদ) অথবা কোনো সিরিজের দলে যোগ দাও।', unlocks: 'ক্রেডিট লাইন, ব্র্যান্ড কিট, মেন্টরের অফিস আওয়ার' },
  { id: 'initiator', bn: 'ইনিশিয়েটর', en: 'Initiator', need: 'পিচ অনুমোদিত আর সিরিজ লাইভ: ২ মাসে অন্তত ৪টি প্রকাশিত পোস্ট।', unlocks: 'খেতাব, ওয়াল অফ ফেম কার্ড, নিজের দল, সিরিজ পেজ, সার্টিফিকেট' },
  { id: 'legend', bn: 'কিংবদন্তি', en: 'Legend', need: '৬+ মাস দলসহ চলমান সিরিজ, সাথে যেকোনো একটি: প্রকাশিত গবেষণা নোট, ফোরামে বক্তৃতা, বা মাপা যায় এমন প্রভাব (SDG অ্যাকশন)।', unlocks: 'জার্নালে জায়গা, সুপারিশপত্র, ডেল্টা ইনিশিয়েটিভস রেফারেল, সোনালি অ্যানিমেটেড ফ্রেম' },
];
