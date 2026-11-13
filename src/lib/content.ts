/**
 * Typed access to the JSON content in src/data. Server-side (build) only for
 * pages; islands receive slices as props.
 */
import type { Series, Post, Myth, Quiz, Thought, Fact, Episode, Person, Mentor, TeacherKit, AskAnswer, School } from '../data/types';
import seriesJson from '../data/series.json';
import postsJson from '../data/posts.json';
import mythsJson from '../data/myths.json';
import quizzesJson from '../data/quizzes.json';
import thoughtsJson from '../data/thoughts.json';
import factsJson from '../data/facts.json';
import episodesJson from '../data/episodes.json';
import peopleJson from '../data/people.json';
import mentorsJson from '../data/mentors.json';
import kitsJson from '../data/kits.json';
import askJson from '../data/ask.json';
import schoolsJson from '../data/schools.json';
import { dhakaDay } from './time';

export const series = seriesJson as Series[];
export const posts = (postsJson as Post[]).slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
export const myths = (mythsJson as Myth[]).slice().sort((a, b) => a.id - b.id);
export const quizzes = quizzesJson as Quiz[];
export const thoughts = thoughtsJson as Thought[];
export const facts = factsJson as Fact[];
export const episodes = (episodesJson as Episode[]).slice().sort((a, b) => a.number - b.number);
export const people = peopleJson as Person[];
export const mentors = mentorsJson as Mentor[];
export const kits = kitsJson as TeacherKit[];
export const asks = (askJson as AskAnswer[]).slice().sort((a, b) => b.date.localeCompare(a.date));
export const schools = schoolsJson as School[];

export const cardSeries = series.filter((s) => s.kind === 'cards');
export const getSeries = (slug: string) => series.find((s) => s.slug === slug);
export const getPerson = (id?: string) => people.find((p) => p.id === id);
export const getPersonByUsername = (u: string) => people.find((p) => p.username === u);
export const getMentor = (id?: string) => mentors.find((m) => m.id === id);
export const getQuiz = (slug?: string) => quizzes.find((q) => q.slug === slug);
export const getEpisode = (slug: string) => episodes.find((e) => e.slug === slug);
export const getMyth = (slug: string) => myths.find((m) => m.slug === slug);
export const postsOf = (slug: string) => posts.filter((p) => p.seriesSlug === slug);
export const liveEpisodes = episodes.filter((e) => !e.comingSoon);

export function seriesStats(slug: string) {
  const ps = postsOf(slug);
  return {
    posts: ps.length,
    cards: ps.filter((p) => p.format === 'card').length,
    videos: ps.filter((p) => p.format === 'video').length,
    blogs: ps.filter((p) => p.format === 'blog').length,
    latest: ps[0]?.publishedAt,
  };
}

/** Series ordered newest-activity first (চলছে সিরিজ: newest episode first) */
export function seriesByActivity(): Series[] {
  const latest = (s: Series) => (s.kind === 'cartoon' ? liveEpisodes.at(-1)?.publishedAt : postsOf(s.slug)[0]?.publishedAt) ?? s.launchedAt;
  return series.slice().sort((a, b) => latest(b).localeCompare(latest(a)));
}

export function isNew(dateIso: string | undefined, days = 10, now = new Date()): boolean {
  if (!dateIso) return false;
  return now.getTime() - Date.parse(dateIso + 'T00:00:00+06:00') < days * 86400_000;
}

/** শুক্রবারের মিথ: latest myth whose Friday has arrived */
export function fridayMyth(now = new Date()): Myth {
  const today = dhakaDay(now);
  const featured = myths.filter((m) => m.fridayDate && m.fridayDate <= today).sort((a, b) => b.fridayDate!.localeCompare(a.fridayDate!));
  return featured[0] ?? myths[0];
}

export const weeklies = quizzes.filter((q) => q.kind === 'weekly');

/** Wall of Fame: Explorer and above, Legend first */
const TIER_ORDER = { legend: 0, initiator: 1, explorer: 2, curious: 3 } as const;
export const wallPeople = people
  .filter((p) => p.id !== 'core' && p.tier !== 'curious')
  .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.stats.points - a.stats.points);

/** Proof numbers computed from real content (posts) + recorded stats */
export function personProof(p: Person) {
  const owned = p.seriesSlug && getSeries(p.seriesSlug)?.ownerId === p.id ? seriesStats(p.seriesSlug) : null;
  return {
    posts: owned ? owned.posts : p.stats.posts,
    videos: owned ? owned.videos : p.stats.videos ?? 0,
    research: p.stats.research ?? 0,
    forums: p.stats.forums ?? 0,
    team: p.seriesSlug ? getSeries(p.seriesSlug)?.team.length ?? 1 : p.stats.team ?? 0,
  };
}

/** Public display name: real name only for adults (18+) who consented */
export const displayName = (p: Person) => (p.ageBand === 'adult' && p.realName ? p.realName : p.nickname);

export const MONTH_STAR = 'rafi';
