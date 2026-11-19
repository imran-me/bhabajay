/**
 * Plays a quiz stored in MySQL (made in the core-team desk): /quiz/play/?q=<slug>.
 * Also lists the server quizzes that are not prebuilt pages (mode="list").
 */
import { useEffect, useState } from 'react';
import type { Quiz } from '../../data/types';
import { bn } from '../../lib/bn';
import QuizPlayer from './QuizPlayer';
import { Bhabu, Loader } from './ui';

const json = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(String(r.status));
  return r.json() as Promise<T>;
};

export default function RemoteQuiz({ mode = 'play', known = [] }: { mode?: 'play' | 'list'; known?: string[] }) {
  const [quiz, setQuiz] = useState<Quiz | null | 'missing'>(null);
  const [list, setList] = useState<{ slug: string; title: string; blurb: string }[]>([]);

  useEffect(() => {
    if (mode === 'list') {
      json<{ quizzes: { slug: string; title: string; blurb: string }[] }>('/api/quiz.php')
        .then((r) => setList(r.quizzes.filter((q) => !known.includes(q.slug))))
        .catch(() => {});
      return;
    }
    const slug = new URLSearchParams(location.search).get('q') ?? '';
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return setQuiz('missing');
    json<Quiz>(`/api/quiz.php?slug=${slug}`)
      .then((q) => { setQuiz(q); document.title = `${q.title} — ভাবা যায়!`; })
      .catch(() => setQuiz('missing'));
  }, []);

  if (mode === 'list') {
    if (!list.length) return null;
    return (
      <section className="wrap mt-12" aria-labelledby="new-q-h">
        <h2 id="new-q-h" className="section-title mb-4">নতুন কুইজ</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((q) => (
            <a key={q.slug} href={`/quiz/play/?q=${q.slug}`} className="card card-hover press p-4">
              <p className="font-bold">{q.title}</p>
              {q.blurb && <p className="mt-1 text-sm text-ink-soft">{q.blurb}</p>}
            </a>
          ))}
        </div>
      </section>
    );
  }

  if (quiz === null) return <Loader label="কুইজ আনছি…" />;
  if (quiz === 'missing') {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <Bhabu face="think" body="teal" dot="coral" className="w-16" />
        <p className="mt-3 text-xl font-bold">এই কুইজটা খুঁজে পেলাম না</p>
        <a href="/quiz" className="btn btn-primary mt-4">কুইজ জোনে ফেরো</a>
      </div>
    );
  }
  return (
    <>
      <h1 className="mt-2 text-[2rem] font-bold leading-tight sm:text-4xl">{quiz.title}</h1>
      {quiz.blurb && <p className="mt-1 text-ink-soft">{quiz.blurb} · {bn(quiz.questions.length)} প্রশ্ন</p>}
      <div className="mt-5"><QuizPlayer quiz={quiz} shareUrl={`/quiz/play/?q=${quiz.slug}`} /></div>
    </>
  );
}
