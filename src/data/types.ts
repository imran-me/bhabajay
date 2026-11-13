/**
 * Content model for ভাবা যায়!
 *
 * Content lives as JSON in Git (src/data/*.json) so the Facebook import script
 * (scripts/import-facebook.mjs) and editors can write it without touching code.
 * These types are the contract; `npm run validate:data` checks the JSON.
 */

export type TopicId =
  | 'food' | 'health' | 'nature' | 'space' | 'chemistry'
  | 'biology' | 'physics' | 'body' | 'history' | 'tech';

export type DoodleName =
  | 'atom' | 'bulb' | 'butterfly' | 'dna' | 'drop' | 'eye' | 'fish' | 'leaf'
  | 'moon' | 'paw' | 'planet' | 'sparkle' | 'mosquito' | 'flask' | 'heart'
  | 'bolt' | 'frog' | 'pot' | 'telescope' | 'book';

export type BrandBg = 'teal' | 'coral' | 'sun' | 'mint' | 'deep';

export interface Source {
  /** Short org name shown on cards, e.g. "WHO", "CDC", "NASA" */
  label: string;
  url: string;
}

/* ───────────── Myth library ───────────── */
export type Verdict = 'true' | 'myth' | 'partial'; // সত্য / মিথ / আংশিক

export interface Myth {
  /** numeric id → short link /m/:id */
  id: number;
  /** readable latin slug, e.g. "dudh-mach" */
  slug: string;
  /** The sentence as an uncle would say it: "দুধ আর মাছ একসাথে খেলে শ্বেতী হয়" */
  claim: string;
  /** The question people type into Google (page <title>/H1): "দুধ আর মাছ একসাথে খেলে কি শ্বেতী হয়?" */
  question: string;
  verdict: Verdict;
  /** One-line proof for the card (≤ 90 chars) */
  short: string;
  /** Surprising number behind the tap-to-reveal plate */
  reveal?: { value: string; label: string };
  /** Explanation, 2–4 short paragraphs, surprise first, term second */
  body: string[];
  /** 2–3 follow-up questions for FAQPage schema */
  faq: { q: string; a: string }[];
  /** Filter chip: খাবার / স্বাস্থ্য / প্রকৃতি / মহাকাশ */
  topic: 'food' | 'health' | 'nature' | 'space';
  sources: Source[];
  /** Banglish + alternative spellings people type: ["dudh mach", "দুধ-মাছ"] */
  aliases: string[];
  /** ISO date (YYYY-MM-DD, a Friday) when featured as শুক্রবারের মিথ */
  fridayDate?: string;
  shares: number;
}

/* ───────────── Quizzes ───────────── */
export interface QuizQuestion {
  id: string;
  q: string;
  /** exactly four options, rendered as ক খ গ ঘ */
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  /** Shown after answering — what ভাবু explains. One or two sentences. */
  fact: string;
  topic?: TopicId;
}

export type QuizKind = 'weekly' | 'episode' | 'initiator' | 'pool' | 'secret';

export interface Quiz {
  slug: string;
  kind: QuizKind;
  title: string;
  blurb: string;
  /** weekly only: ISO datetime of the Saturday 20:00 drop, "+06:00" offset */
  opensAt?: string;
  seriesSlug?: string;
  episodeSlug?: string;
  secondsPerQuestion: number;
  questions: QuizQuestion[];
}

/* ───────────── Daily content ───────────── */
export interface Thought {
  id: number;
  q: string;
  a: string;
  topic: TopicId;
  source?: Source;
}

export interface Fact {
  id: number;
  text: string;
  topic: TopicId;
}

/* ───────────── Series & posts ───────────── */
export interface Series {
  slug: string;
  title: string;
  tagline: string;
  /** e.g. "রসায়ন + খাবার" */
  subject: string;
  topic: TopicId;
  kind: 'cards' | 'cartoon';
  ownerId: string;
  team: string[];
  mentorId?: string;
  /** cover band gradient */
  color: { from: string; to: string; ink: 'light' | 'dark' };
  doodle: DoodleName;
  launchedAt: string;
  followers: number;
  description: string;
  credits: string[];
}

export type PostFormat = 'card' | 'video' | 'blog';

export interface Post {
  slug: string;
  seriesSlug: string;
  format: PostFormat;
  /** the question on the card */
  title: string;
  /** the surprise, first line people read */
  hook: string;
  body: string[];
  facts?: string[];
  sources: Source[];
  publishedAt: string;
  topic: TopicId;
  readMinutes: number;
  art: { doodle: DoodleName; bg: BrandBg };
  shares: number;
  likes: number;
  fbUrl?: string;
}

/* ───────────── Cartoon: ভাবুর দুনিয়া ───────────── */
export type CastId = 'bhabu' | 'rafi' | 'titli' | 'ammu' | 'dadu';

export interface Episode {
  slug: string;
  number: number;
  title: string;
  /** display duration of the real episode, Bangla digits, e.g. "৪:১২" */
  duration: string;
  views: number;
  publishedAt: string;
  /** null until the real video is uploaded — the page then plays the demo animatic */
  youtubeId: string | null;
  facebookUrl: string | null;
  summary: string;
  facts: [string, string, string];
  quizSlug: string;
  doodle: DoodleName;
  /** demo animatic: subtitle beats, ~4 s each */
  beats: { who: CastId | 'narrator'; line: string }[];
  ageTag: string;
  discussion: string[];
  behindScenes: string[];
  comingSoon?: boolean;
}

/* ───────────── People ───────────── */
export type Tier = 'curious' | 'explorer' | 'initiator' | 'legend';

export type FaceId = 'wow' | 'happy' | 'think' | 'wink' | 'grin';
export type HatId = 'none' | 'tupi' | 'grad' | 'astro' | 'gamchha';
export type PropId = 'none' | 'tube' | 'telescope' | 'book' | 'magnifier';
export type GroundId = 'teal' | 'coral' | 'sun' | 'mint' | 'dots' | 'stars' | 'stripes';
export type BodyId = 'teal' | 'coral' | 'deep';

export interface AvatarConfig {
  face: FaceId;
  hat: HatId;
  prop: PropId;
  ground: GroundId;
  body: BodyId;
}

export interface Person {
  id: string;
  username: string;
  nickname: string;
  /** only shown for 18+ with consent */
  realName?: string;
  ageBand: 'teen' | 'adult';
  tier: Tier;
  seriesSlug?: string;
  bio: string;
  joinedAt: string;
  avatar: AvatarConfig;
  stats: {
    posts: number;
    videos?: number;
    research?: number;
    forums?: number;
    team?: number;
    points: number;
    streak: number;
    quizAvg?: number;
  };
  badges: string[];
  mentorId?: string;
  verifyCode?: string;
  originalQuestion?: string;
  pitchDate?: string;
  journey: { date: string; label: string }[];
  /** adult only (teens never show district/school without parent OK) */
  district?: string;
  following?: string[];
}

export interface Mentor {
  id: string;
  name: string;
  title: string;
  field: string;
  bio: string;
  topics: TopicId[];
  color: BrandBg;
}

/* ───────────── Teachers ───────────── */
export interface TeacherKit {
  slug: string;
  title: string;
  grades: string;
  minutes: number;
  subject: string;
  topic: TopicId;
  summary: string;
  objectives: string[];
  materials: string[];
  steps: { time: string; title: string; detail: string }[];
  discussion: string[];
  worksheet: { q: string; lines: number }[];
  quizSlug?: string;
  seriesSlug?: string;
  episodeSlug?: string;
}

/* ───────────── Ask ভাবু ───────────── */
export interface AskAnswer {
  id: number;
  q: string;
  a: string;
  askedBy: string;
  topic: TopicId;
  date: string;
  sources?: Source[];
}

export interface School {
  id: string;
  name: string;
  district: string;
}
