// Supabase Edge Function (Deno): sends Bangla emails via Resend.
//
// Wire it with Database Webhooks (Dashboard → Database → Webhooks):
//   • INSERT on public.notifications  → every pitch step gets an email
//   • INSERT on public.profiles       → parent-consent email for 13–17
// Secrets: RESEND_API_KEY, SITE_URL, MAIL_FROM (e.g. "ভাবা যায়! <hello@bhabajay.com>"),
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET
// Deploy:  supabase functions deploy notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const SITE = Deno.env.get('SITE_URL') ?? 'https://bhabajay.com';
const FROM = Deno.env.get('MAIL_FROM') ?? 'ভাবা যায়! <hello@bhabajay.com>';
const MOOD_EMOJI: Record<string, string> = { wow: '🤩', happy: '😊', think: '🤔', wink: '😉', grin: '😄' };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function layout(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html lang="bn"><body style="margin:0;background:#FFFBF4;font-family:'Hind Siliguri',system-ui,sans-serif;color:#063C43">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <p style="font-size:26px;font-weight:800;margin:0 0 16px"><span style="color:#0B6E79">ভাবা</span> <span style="color:#FF6B5B">যায়!</span></p>
    <div style="background:#fff;border-radius:20px;padding:24px;border:1px solid #E2ECEA">
      <h1 style="font-size:22px;margin:0 0 10px">${title}</h1>
      <p style="font-size:16px;line-height:1.7;margin:0">${body}</p>
      ${cta ? `<p style="margin:22px 0 0"><a href="${cta.href}" style="background:#FF6B5B;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:14px;display:inline-block">${cta.label}</a></p>` : ''}
    </div>
    <p style="font-size:12px;color:#436E73;margin-top:16px">এই ইমেইল পাচ্ছ কারণ তোমার ভাবা যায় আইডি আছে। সেটিংস: ${SITE}/me#settings</p>
  </div></body></html>`;
}

async function send(to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 });
  const { table, type, record } = await req.json();

  try {
    if (table === 'notifications' && type === 'INSERT') {
      const { data: user } = await admin.auth.admin.getUserById(record.user_id);
      const email = user?.user?.email;
      if (email) {
        await send(email, `${MOOD_EMOJI[record.mood] ?? ''} ${record.title}`, layout(record.title, record.body, record.href ? { href: SITE + record.href, label: 'দেখো →' } : undefined));
      }
      // teens: parents get a copy of pitch updates
      const { data: p } = await admin.from('profiles').select('age_band,parent_email,nickname').eq('id', record.user_id).single();
      if (p?.age_band === '13-17' && p.parent_email && record.href?.startsWith('/initiator/track')) {
        await send(p.parent_email, `${p.nickname}-এর পিচ: ${record.title}`, layout(`${p.nickname}-এর পিচের খবর`, record.body, { href: SITE + record.href, label: 'অগ্রগতি দেখুন' }));
      }
    }

    if (table === 'profiles' && type === 'INSERT' && record.age_band === '13-17' && record.parent_email) {
      const link = `${SITE}/parent?token=${record.parent_token}`;
      await send(
        record.parent_email,
        `${record.nickname} ভাবা যায়!-এ যোগ দিতে চায় — আপনার সম্মতি দরকার`,
        layout(
          'আপনার সন্তানের ভাবা যায় আইডি',
          `“${record.nickname}” ভাবা যায়!-এ (বাংলা বিজ্ঞান ও কৌতূহলের প্ল্যাটফর্ম) আইডি খুলেছে। প্রোফাইল ব্যক্তিগত থাকবে, পাবলিক নাম শুধু ডাকনাম আর অবতার, কোনো সরাসরি মেসেজ নেই। সম্মতি দিলে সে সিরিজ পিচ করতে আর স্কুল যোগ করতে পারবে।`,
          { href: link, label: 'সম্মতি দিন' },
        ),
      );
    }
    return new Response('ok');
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
