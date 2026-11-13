/**
 * Quiz that feels like a game show (Plan p.11).
 *  Right answer → ভাবু cheers, confetti, "ভাবা যায়!" pops, +১০
 *  Wrong answer → no red-X shame; ভাবু thinks, shows the fact, still +২
 *  Result card → "আমি ৫/৫ পেয়েছি, তুমি পারবে?" one tap to WhatsApp
 * Weekly quizzes keep the ritual: full answers + explanations next morning.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Quiz, QuizQuestion } from '../../data/types';
import { bn, OPTION_LETTERS, bnCountdown } from '../../lib/bn';
import { getState, recordQuiz, touchActivity, addPoints, awardBadge, toast, countShare } from '../../lib/store';
import { sound, confetti, vibrate } from '../../lib/fx';
import { getBackend } from '../../lib/backend';
import { shareTargets, renderCard, downloadBlob } from '../../lib/share';
import { Bhabu, Icon } from './ui';

type Phase = 'intro' | 'question' | 'feedback' | 'result';

interface Props {
  quiz: Quiz;
  /** number of questions to draw (pool mode shuffles) */
  count?: number;
  shuffle?: boolean;
  /** start locked until window event `bj:episode-ended` */
  lockedUntilEpisodeEnds?: boolean;
  badgeOnPerfect?: string;
  revealAt?: number;
  compact?: boolean;
  shareUrl?: string;
}

const RIGHT = 10;
const TRY = 2;

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isNight = () => {
  const h = new Date(Date.now() + 6 * 3600_000).getUTCHours();
  return h >= 21 || h < 5;
};

export default function QuizPlayer({ quiz, count, shuffle = false, lockedUntilEpisodeEnds = false, badgeOnPerfect, revealAt, compact = false, shareUrl }: Props) {
  const [locked, setLocked] = useState(lockedUntilEpisodeEnds);
  const [phase, setPhase] = useState<Phase>('intro');
  const [seed, setSeed] = useState(0);
  const questions: QuizQuestion[] = useMemo(() => {
    const base = shuffle ? shuffled(quiz.questions) : quiz.questions;
    return count ? base.slice(0, count) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.slug, seed]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [points, setPoints] = useState(0);
  const [left, setLeft] = useState(quiz.secondsPerQuestion);
  const [pop, setPop] = useState<string | null>(null);
  const startedAt = useRef(0);
  // browser-only facts are read after mount (keeps SSR + hydration identical)
  const [night, setNight] = useState(false);
  const [prev, setPrev] = useState<ReturnType<typeof getState>['quizzes'][string] | undefined>(undefined);
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    setNight(isNight());
    setPrev(getState().quizzes[quiz.slug]);
    setGuest(!getState().user);
  }, [quiz.slug, phase === 'intro']);
  const weekly = quiz.kind === 'weekly';
  const answersOut = !weekly || (revealAt ? Date.now() >= revealAt : true);
  const q = questions[i];

  useEffect(() => {
    if (!lockedUntilEpisodeEnds) return;
    // the island may hydrate after the episode already ended (client:visible)
    if (quiz.episodeSlug && getState().episodesWatched.includes(quiz.episodeSlug)) setLocked(false);
    const on = () => setLocked(false);
    window.addEventListener('bj:episode-ended', on);
    return () => window.removeEventListener('bj:episode-ended', on);
  }, [lockedUntilEpisodeEnds]);

  // per-question timer
  useEffect(() => {
    if (phase !== 'question') return;
    if (left <= 0) {
      choose(null);
      return;
    }
    const t = setTimeout(() => {
      setLeft((x) => x - 1);
      if (left <= 4) sound.tick();
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left]);

  const start = () => {
    setPhase('question');
    setI(0);
    setAnswers([]);
    setPoints(0);
    setPicked(null);
    setLeft(quiz.secondsPerQuestion);
    startedAt.current = Date.now();
    sound.pop();
  };

  const choose = useCallback(
    (opt: number | null) => {
      if (phase !== 'question' || !q) return;
      setPicked(opt);
      setAnswers((a) => [...a, opt]);
      const right = opt === q.answer;
      if (right) {
        setPoints((p) => p + RIGHT);
        setPop(`ভাবা যায়! +${bn(RIGHT)}`);
        sound.cheer();
        confetti({ count: 70 });
        vibrate(25);
      } else {
        if (opt !== null) setPoints((p) => p + TRY);
        setPop(opt === null ? 'সময় শেষ!' : `চেষ্টার জন্য +${bn(TRY)}`);
        sound.think();
      }
      setPhase('feedback');
    },
    [phase, q],
  );

  // plain function on purpose: it must see the latest answers/points
  function next() {
    setPop(null);
    if (i + 1 >= questions.length) {
      finish();
      return;
    }
    setI((x) => x + 1);
    setPicked(null);
    setLeft(quiz.secondsPerQuestion);
    setPhase('question');
  }

  function finish() {
    setPhase('result');
    const score = answers.filter((a, k) => a === questions[k]?.answer).length;
    const total = questions.length;
    const firstTime = !getState().quizzes[quiz.slug];
    addPoints(points);
    recordQuiz(quiz.slug, score, total, points);
    touchActivity();
    if (badgeOnPerfect && score === total) awardBadge(badgeOnPerfect);
    if (quiz.slug === 'druto-10' && score >= 8) awardBadge('fast-10');
    if (quiz.slug === 'series-rannaghar' && score >= 4) awardBadge('kitchen-chemist');
    if (quiz.kind === 'secret') awardBadge('secret');
    if (night) awardBadge('night-owl');
    if (firstTime || quiz.kind !== 'weekly') {
      void getBackend().then((b) => b.recordAttempt({ quizSlug: quiz.slug, score, total, points, durationMs: Date.now() - startedAt.current }));
    }
    if (score === total) setTimeout(() => confetti({ count: 160 }), 250);
  }

  // keyboard: 1-4 / ক খ গ ঘ to answer, Enter for next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'question') {
        const k = ['1', '2', '3', '4'].indexOf(e.key);
        const b = OPTION_LETTERS.indexOf(e.key as (typeof OPTION_LETTERS)[number]);
        const idx = k >= 0 ? k : b;
        if (idx >= 0) choose(idx);
      } else if (phase === 'feedback' && e.key === 'Enter') {
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const score = answers.filter((a, k) => a === questions[k]?.answer).length;

  /* ───────── locked (episode not finished) ───────── */
  if (locked) {
    return (
      <div className="flex items-center gap-4 rounded-[22px] bg-sun p-5 text-deep">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/60"><Icon name="lock" className="h-6 w-6" /></span>
        <div>
          <p className="text-lg font-bold">এখন তোমার পালা! {bn(questions.length)} প্রশ্ন</p>
          <p className="text-deep/80">দেখা শেষ হলেই কুইজ খুলবে — ব্যাজ জেতো 🏅</p>
          <button type="button" className="mt-1 text-sm font-bold underline underline-offset-4" onClick={() => setLocked(false)}>আগেই দেখেছি, খুলে দাও</button>
        </div>
      </div>
    );
  }

  /* ───────── intro ───────── */
  if (phase === 'intro') {
    return (
      <div className={`relative overflow-hidden rounded-[26px] ${night ? 'bg-deep text-white' : 'bg-sun-soft'} ${compact ? 'p-5' : 'p-6 sm:p-8'}`}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {night && <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-bold text-sun">🌙 রাতের ভাবনা</p>}
            <h2 className={`font-bold ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{quiz.title}</h2>
            <p className={`mt-1 ${night ? 'text-white/80' : 'text-ink-soft'}`}>{quiz.blurb}</p>
            <ul className={`mt-4 flex flex-wrap gap-2 text-sm font-semibold ${night ? 'text-white' : ''}`}>
              <li className={`rounded-full px-3 py-1 ${night ? 'bg-white/10' : 'bg-white dark:bg-surface'}`}>{bn(questions.length)} প্রশ্ন</li>
              <li className={`rounded-full px-3 py-1 ${night ? 'bg-white/10' : 'bg-white dark:bg-surface'}`}>⏱ {bn(quiz.secondsPerQuestion)} সেকেন্ড করে</li>
              <li className={`rounded-full px-3 py-1 ${night ? 'bg-white/10' : 'bg-white dark:bg-surface'}`}>ঠিক +{bn(RIGHT)} · চেষ্টা +{bn(TRY)}</li>
            </ul>
            {prev && <p className={`mt-3 text-sm ${night ? 'text-white/75' : 'text-ink-soft'}`}>আগের সেরা: {bn(prev.best)}/{bn(prev.total)}{weekly ? ' — লিডারবোর্ডে প্রথম চেষ্টাটাই গোনা হয়' : ''}</p>}
            <button type="button" className="btn btn-primary btn-lg mt-5" onClick={start}>{prev ? 'আবার খেলি!' : 'শুরু করি!'}</button>
            {guest && <p className={`mt-3 text-xs ${night ? 'text-white/70' : 'text-ink-soft'}`}>আইডি ছাড়া খেলছ — স্কোর শুধু এই ফোনে থাকবে। <a href="/id" className="font-bold underline">আইডি বানাও</a></p>}
          </div>
          {!compact && <Bhabu face="wink" body={night ? 'coral' : 'teal'} dot={night ? 'sun' : 'coral'} brows={night ? 'light' : 'dark'} animateSparks className="hidden w-24 sm:block" />}
        </div>
      </div>
    );
  }

  /* ───────── result ───────── */
  if (phase === 'result') {
    const total = questions.length;
    const perfect = score === total;
    const face = perfect ? 'wow' : score / total >= 0.6 ? 'happy' : 'think';
    const line = perfect ? 'পুরোটাই ঠিক! ভাবা যায়!' : score / total >= 0.6 ? 'দারুণ খেলেছ!' : 'শেখাটাই আসল জয় — আবার চেষ্টা করো!';
    const brag = `আমি ভাবা যায়! কুইজে ${bn(score)}/${bn(total)} পেয়েছি, তুমি পারবে? 🤔`;
    const url = shareUrl ?? location.pathname;
    const wa = shareTargets({ url, title: quiz.title, text: brag }).whatsapp;
    return (
      <div className="overflow-hidden rounded-[26px] bg-surface ring-1 ring-line">
        <div className="pattern-teal p-6 text-white sm:p-8">
          <div className="flex items-center gap-5 rounded-3xl bg-deep/85 p-5">
            <Bhabu face={face} body="coral" dot="sun" brows="light" animateSparks={perfect} className="w-20 shrink-0" />
            <div>
              <p className="font-display text-5xl leading-none text-sun sm:text-6xl">{bn(score)}/{bn(total)}</p>
              <p className="mt-1 text-lg font-bold">{line}</p>
              <p className="text-white/80">+{bn(points)} পয়েন্ট জমা হলো</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6">
          <a href={wa} target="_blank" rel="noopener" className="btn btn-primary w-full !whitespace-normal text-center" onClick={() => countShare()}>
            <Icon name="whatsapp" className="h-5 w-5" />“{bn(score)}/{bn(total)} পেয়েছি, তুমি পারবে?” — WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost" onClick={async () => {
              const blob = await renderCard({ kind: 'quiz', eyebrow: quiz.title, big: `${bn(score)}/${bn(total)}`, title: 'আমি পেয়েছি, তুমি পারবে?', url: location.host + url });
              downloadBlob(blob, `bhabajay-quiz-${bn(score)}.png`);
              toast('কার্ড নেমেছে — স্ট্যাটাসে দাও!', { mood: 'happy' });
            }}><Icon name="download" className="h-4 w-4" />কার্ড</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setSeed((x) => x + 1); setPhase('intro'); }}><Icon name="refresh" className="h-4 w-4" />আবার খেলো</button>
          </div>
          {!answersOut && revealAt && (
            <p className="rounded-2xl bg-tint p-3 text-sm font-semibold">সব প্রশ্নের সঠিক উত্তর আর ব্যাখ্যা আসবে কাল সকাল ৮টায় — আর {bnCountdown(revealAt - Date.now())}।</p>
          )}
          {answersOut && (
            <details className="rounded-2xl bg-tint p-3">
              <summary className="cursor-pointer font-bold">উত্তর আর ব্যাখ্যা দেখো</summary>
              <ol className="mt-3 grid gap-3">
                {questions.map((qq, k) => (
                  <li key={qq.id} className="text-[.95rem]">
                    <p className="font-semibold">{bn(k + 1)}. {qq.q}</p>
                    <p className="mt-0.5 text-link">✓ {qq.options[qq.answer]} {answers[k] === qq.answer ? '— তুমিও ঠিক!' : ''}</p>
                    <p className="text-ink-soft">{qq.fact}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm font-bold">
            <a href="/quiz/leaderboard" className="link">লিডারবোর্ড →</a>
            <a href="/quiz" className="link">আরেকটা কুইজ →</a>
            {!getState().user && <a href="/id" className="link">স্কোর ধরে রাখতে আইডি বানাও →</a>}
          </div>
        </div>
      </div>
    );
  }

  /* ───────── question + feedback ───────── */
  const isFeedback = phase === 'feedback';
  const right = isFeedback && picked === q.answer;
  const pct = ((i + (isFeedback ? 1 : 0)) / questions.length) * 100;
  const hideAnswer = isFeedback && !right && !answersOut;
  return (
    <div className={`relative overflow-hidden rounded-[26px] bg-surface ring-1 ring-line ${night ? 'dark:ring-white/10' : ''}`}>
      <div className="flex items-center gap-3 px-5 pt-4">
        <p className="font-bold">প্রশ্ন {bn(i + 1)} / {bn(questions.length)}</p>
        {night && <span className="text-sm font-bold text-mustard dark:text-sun">🌙 রাতের ভাবনা</span>}
        <p className={`ml-auto inline-flex items-center gap-1 font-bold tabular-nums ${left <= 5 && !isFeedback ? 'text-coral-dark dark:text-coral animate-pulse' : 'text-coral-dark dark:text-coral'}`} aria-live="off">
          <Icon name="clock" className="h-4 w-4" />{bn(Math.max(0, left))}s
        </p>
      </div>
      <div className="mt-3 h-2 bg-tint" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={i + (isFeedback ? 1 : 0)} aria-label="অগ্রগতি">
        <div className="h-full rounded-r-full bg-sun transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="p-5 sm:p-6">
        <h2 className="text-[1.35rem] font-bold leading-snug sm:text-2xl" id={`q-${q.id}`}>{q.q}</h2>
        <div className="mt-5 grid gap-2.5" role="group" aria-labelledby={`q-${q.id}`}>
          {q.options.map((o, k) => {
            let state = '';
            if (isFeedback) {
              if (k === q.answer && !hideAnswer) state = '!border-teal !bg-teal !text-white';
              else if (k === picked && k !== q.answer) state = '!border-line !bg-tint opacity-80';
              else if (k === picked) state = '!border-teal !bg-teal !text-white';
              else state = 'opacity-55';
            }
            return (
              <button key={k} type="button" className={`option ${state}`} disabled={isFeedback} onClick={() => choose(k)} aria-pressed={picked === k}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${state.includes('bg-teal') ? 'bg-white/20' : 'bg-tint text-link'}`}>{OPTION_LETTERS[k]}</span>
                <span className="flex-1">{o}</span>
                {isFeedback && k === q.answer && !hideAnswer && <Icon name="check" className="h-5 w-5" />}
              </button>
            );
          })}
        </div>

        {isFeedback && (
          <div className={`mt-5 flex items-start gap-3 rounded-[20px] p-4 ${right ? 'bg-sun-soft' : 'bg-tint'}`} role="status" aria-live="polite">
            <Bhabu face={right ? 'happy' : 'think'} body="teal" dot="coral" animateSparks={right} className="w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{right ? 'একদম ঠিক!' : picked === null ? 'সময় ফুরিয়ে গেল — সমস্যা নেই!' : 'কাছাকাছি! চলো জেনে নিই —'}</p>
              {hideAnswer ? (
                <p className="mt-0.5 text-ink-soft">সঠিক উত্তর আর ব্যাখ্যা কাল সকাল ৮টায়। ততক্ষণ ভাবতে থাকো!</p>
              ) : (
                <p className="mt-0.5 leading-relaxed">{q.fact}</p>
              )}
              <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={next} autoFocus>
                {i + 1 >= questions.length ? 'ফলাফল দেখো' : 'পরের প্রশ্ন'} <Icon name="arrow-right" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {pop && (
        <div className="pointer-events-none absolute bottom-5 left-5 z-10 animate-pop rounded-2xl bg-sun px-4 py-2 font-display text-xl text-deep shadow-[0_4px_0_#D9A21C]" aria-hidden="true">{pop}</div>
      )}
    </div>
  );
}
