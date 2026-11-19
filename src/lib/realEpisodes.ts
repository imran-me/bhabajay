/** Released ভাবুর দুনিয়া episodes (videos in /media/video/, listed in videos.json). */
import realJson from '../data/real-episodes.json';
import videosJson from '../data/videos.json';
import type { Video } from '../components/islands/VideoGallery';

export interface RealEpisode {
  slug: string;
  number: number;
  title: string;
  videos: string[];
  summary: string;
  facts: string[];
  quizSlug?: string;
}

const videos = videosJson as Video[];
export const realEpisodes = (realJson as RealEpisode[]).slice().sort((a, b) => a.number - b.number);
export const episodeVideos = (ep: RealEpisode) => ep.videos.map((s) => videos.find((v) => v.slug === s)!).filter(Boolean);
export const episodeSeconds = (ep: RealEpisode) => episodeVideos(ep).reduce((a, v) => a + v.seconds, 0);
const BN = '০১২৩৪৫৬৭৮৯';
export const bnDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`.replace(/\d/g, (d) => BN[+d]);
