import type { AvatarConfig } from '../../data/types';
import type { LocalUser } from '../store';

export type PitchStatus = 'sent' | 'reviewing' | 'mentor' | 'live' | 'not_yet';

export const PITCH_STEPS: { id: PitchStatus; bn: string; mood: 'wow' | 'happy' | 'think' | 'wink' | 'grin' }[] = [
  { id: 'sent', bn: 'পাঠানো', mood: 'wink' },
  { id: 'reviewing', bn: 'দেখা হচ্ছে', mood: 'think' },
  { id: 'mentor', bn: 'মেন্টর ঠিক', mood: 'happy' },
  { id: 'live', bn: 'লাইভ', mood: 'wow' },
];

export interface PitchPayload {
  nickname: string;
  ageBand: '13-17' | '18+';
  district?: string;
  affiliation?: string;
  foundUs?: string;
  spark: string;
  workingTitle: string;
  subject: string;
  formats: string[];
  frequency: string;
  episodes: [string, string, string];
  audience: string;
  sdg?: string;
  sampleLink?: string;
  skillsHave: string;
  skillsWant?: string;
  friends?: string;
  mentorIn?: string;
  contactEmail: string;
  parentEmail?: string;
  pledges: { factCheck: boolean; conduct: boolean; parent: boolean; credit: boolean };
}

export interface Pitch {
  code: string;
  status: PitchStatus;
  title: string;
  subject: string;
  nickname: string;
  createdAt: string;
  updatedAt: string;
  feedback?: string;
  mentorName?: string;
  history: { status: PitchStatus; at: string; note?: string }[];
  payload?: PitchPayload;
  mine?: boolean;
  /** php: hidden from the public tracker by the core team */
  hidden?: boolean;
}

export interface PublicPitchStatus {
  code: string;
  status: PitchStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  feedback?: string;
  mentorName?: string;
  history: { status: PitchStatus; at: string; note?: string }[];
}

export type CommentTarget = { type: 'myth' | 'thought' | 'post' | 'episode'; id: string };

export interface Comment {
  id: string;
  target: CommentTarget;
  nickname: string;
  avatar?: AvatarConfig;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  mine?: boolean;
}

export interface InboxItem {
  id: string;
  kind: 'myth_tip' | 'question' | 'mentor' | 'contact';
  createdAt: string;
  status: 'new' | 'used' | 'answered' | 'archived';
  fields: Record<string, string>;
}

export interface LeaderRow {
  rank: number;
  name: string;
  sub?: string;
  score: number;
  plays?: number;
  me?: boolean;
  avatar?: AvatarConfig;
}

export interface SessionInfo {
  user: LocalUser;
}

export interface ProfileInput {
  nickname: string;
  username: string;
  ageBand: '13-17' | '18+';
  parentEmail?: string;
  isPublic: boolean;
  showRealName: boolean;
  realName?: string;
  district?: string;
  schoolId?: string;
  bio?: string;
  /** series slugs the person is curious about */
  interests?: string[];
  avatar: AvatarConfig;
}

export interface Backend {
  mode: 'demo' | 'supabase' | 'php';

  /* Bhaba Jay ID */
  startGoogle(): Promise<{ demo?: true }>;
  sendMagicLink(email: string): Promise<{ demoLink?: string }>;
  /** demo: complete the simulated OAuth / magic link with an email */
  completeDemoSignIn?(email: string, method: 'google' | 'magic'): Promise<void>;
  /** php: email + password account on the server */
  passwordSignIn?(email: string, password: string, mode: 'login' | 'register'): Promise<{ hasProfile: boolean }>;
  getSession(): Promise<SessionInfo | null>;
  saveProfile(input: ProfileInput): Promise<LocalUser>;
  signOut(): Promise<void>;
  deleteMyData(): Promise<void>;
  usernameAvailable(username: string): Promise<boolean>;
  /** parent clicks the emailed link → returns the teen's nickname, or null */
  confirmParent(token: string): Promise<string | null>;

  /* Quiz */
  recordAttempt(a: { quizSlug: string; score: number; total: number; points: number; durationMs: number }): Promise<void>;
  playCount(quizSlug: string): Promise<number>;
  leaderboard(scope: 'people' | 'schools' | 'districts', quizSlug?: string): Promise<LeaderRow[]>;

  /* Initiators */
  submitPitch(p: PitchPayload): Promise<{ code: string }>;
  pitchStatus(code: string): Promise<PublicPitchStatus | null>;
  myPitches(): Promise<Pitch[]>;

  /* Community */
  listComments(t: CommentTarget): Promise<Comment[]>;
  postComment(t: CommentTarget, body: string): Promise<Comment>;
  submitInbox(kind: InboxItem['kind'], fields: Record<string, string>): Promise<void>;
  setFollow(seriesSlug: string, on: boolean): Promise<void>;

  /* Core team (RLS: role = core) */
  admin: {
    pitches(): Promise<Pitch[]>;
    updatePitch(code: string, status: PitchStatus, opts?: { feedback?: string; mentorName?: string }): Promise<void>;
    pendingComments(): Promise<Comment[]>;
    moderate(id: string, status: 'approved' | 'rejected'): Promise<void>;
    /** php: hide/unhide a pitch from the public tracker */
    hidePitch?(code: string, hidden: boolean): Promise<void>;
    inbox(kind?: InboxItem['kind']): Promise<InboxItem[]>;
    markInbox(id: string, status: InboxItem['status']): Promise<void>;
  };
}
