/**
 * Moderated comments on questions. Rules (Plan p.12):
 *  - under-13 guests: no comments; signed-out: invited to get an ID
 *  - every comment is held for moderation; you see your own pending ones
 *  - no direct messages between users
 */
import { useEffect, useState, type FormEvent } from 'react';
import { getBackend, type Comment, type CommentTarget } from '../../lib/backend';
import { toast } from '../../lib/store';
import { bnAgo } from '../../lib/bn';
import { Avatar, Bhabu, Loader, useStore } from './ui';

const MAX = 400;
const BLOCK = /(https?:\/\/|www\.|\b\d{10,}\b|@[a-z0-9_]{3,})/i; // links / phone numbers / handles

export default function Comments({ target }: { target: CommentTarget }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const st = useStore();

  useEffect(() => {
    void getBackend().then((b) => b.listComments(target)).then(setList);
  }, [target.type, target.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (text.length < 3) return setErr('একটু বেশি লেখো');
    if (text.length > MAX) return setErr(`${MAX} অক্ষরের মধ্যে লেখো`);
    if (BLOCK.test(text)) return setErr('নিরাপত্তার জন্য লিংক, ফোন নম্বর বা আইডি দেওয়া যাবে না');
    setErr(null);
    setBusy(true);
    try {
      const c = await (await getBackend()).postComment(target, text);
      setList((l) => [...(l ?? []), c]);
      setBody('');
      toast('পাঠানো হয়েছে! মডারেটর দেখার পর সবাই দেখবে।', { mood: 'happy' });
    } catch {
      setErr('উফ! পাঠানো গেল না, আবার চেষ্টা করো।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {list === null ? (
        <Loader label="মন্তব্য আনছি…" />
      ) : list.length === 0 ? (
        <p className="text-ink-soft">এখনো কেউ কিছু বলেনি — প্রথম প্রশ্নটা তোমার হোক!</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.avatar ? <Avatar avatar={c.avatar} className="h-10 w-10" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint font-bold text-link">{c.nickname.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface p-3 ring-1 ring-line">
                <p className="text-sm"><b>{c.nickname}</b> <span className="text-ink-soft">· {bnAgo(c.createdAt)}</span>{c.status === 'pending' && <span className="tag tag-sun ml-2 !py-0 text-xs">মডারেশনের অপেক্ষায়</span>}</p>
                <p className="mt-1 whitespace-pre-line leading-relaxed">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {st.user ? (
        <form onSubmit={submit} className="grid gap-2">
          <label htmlFor={`cm-${target.id}`} className="sr-only">তোমার মন্তব্য</label>
          <textarea id={`cm-${target.id}`} className="field" rows={3} maxLength={MAX + 50} value={body} onChange={(e) => setBody(e.target.value)} placeholder="প্রশ্ন বা মতামত লেখো… (ভদ্র থাকো, তথ্য দাও)" aria-invalid={!!err} />
          {err && <p className="error-text" role="alert">{err}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>{busy ? 'পাঠাচ্ছি…' : 'পাঠাও'}</button>
            <span className="text-xs text-ink-soft">সব মন্তব্য মডারেট হয় · <a href="/code-of-conduct" className="underline">আচরণবিধি</a></span>
          </div>
        </form>
      ) : st.guest ? (
        <p className="rounded-2xl bg-tint p-3 text-sm">১৩ বছরের নিচে বলে এখানে মন্তব্য করা যাবে না — তবে কুইজ খেলতে আর পড়তে কোনো মানা নেই! প্রশ্ন থাকলে বড় কাউকে দিয়ে <a href="/ask" className="font-bold text-link">ভাবুকে জিজ্ঞেস করো</a>।</p>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-tint p-3">
          <Bhabu face="wink" body="teal" dot="coral" sparks={false} className="w-8" />
          <p className="text-sm">মন্তব্য করতে <a href="/id" className="font-bold text-link">ভাবা যায় আইডি</a> লাগবে — ৩০ সেকেন্ডের কাজ।</p>
        </div>
      )}
    </div>
  );
}
