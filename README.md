# ভাবা যায়! (Bhaba Jay) — the home of curious Bangladesh

**প্রশ্ন যার, সিরিজ তার। ভাবা যায়!**

A Bangla-first learning and creator platform built from *Bhaba Jay Website Plan v1 (Nov 2026)*:
**Watch & learn** (series, cartoon, myth library), **Play & collect** (quizzes, Bhaba Jay ID, streaks, badges, avatar studio), **Pitch & lead** (Initiator journey, Wall of Fame, verifiable titles).

```bash
npm install
npm run dev          # http://localhost:4321  (demo mode — no setup needed)
npm run build        # static site → dist/  (127 pages incl. OG images)
npm run check        # TypeScript / Astro diagnostics
npm run validate:data
```

Node 22+. Everything works out of the box in **demo mode**; add Supabase keys to go live.

---

## What is real and what is demo

| Area | Status |
|---|---|
| All pages, navigation, search, filters, share sheet, share-card download, OG images, SEO, dark mode, EN toggle, delight moments | **Real**, fully functional |
| Quiz engine (timer, scoring, weekly Sat 20:00 drop + next-morning answers, দ্রুত ১০, episode/initiator/secret quizzes) | **Real** |
| Streaks (Dhaka days, weekly freeze), points, badges, saves, follows, avatar studio | **Real** — stored in the browser; mirrored to Postgres when Supabase is on |
| Bhaba Jay ID, comments, pitches, inboxes, leaderboards, core-team desk | **Real code paths for Supabase** (`src/lib/backend/supabase.ts`). Without keys a **demo backend** simulates the server in `localStorage` (`src/lib/backend/demo.ts`) |
| Google sign-in, magic-link email, parent-consent email | **Demo:** simulated in-page (clearly labelled). **Live:** Supabase Auth + `supabase/functions/notify` (Resend) |
| Leaderboard rows and the "২,৩১৪ জন খেলেছে" counter | **Demo:** seeded sample rows + an estimate. **Live:** `leaderboard()` / `quiz_play_count()` RPCs |
| Cartoon episodes | No video IDs yet → a playable **demo animatic** built from each script. Add `youtubeId` in `src/data/episodes.json` and the lite YouTube player takes over (with end-of-video detection) |
| Series / myths / quizzes / people / mentors / schools | **Sample content**, written for the demo. People, mentors and schools are fictional. Facts carry sources but need a human fact-check (list below) |
| Partner + social URLs (Delta Initiatives, Facebook, YouTube) | **Placeholders** — set `PUBLIC_DELTA_URL`, `PUBLIC_FACEBOOK_URL`, `PUBLIC_YOUTUBE_URL`. Until then links fall back to `/about#delta` and social icons are hidden |

A "ডেমো" banner sits on every page while demo mode is active; `/about#demo` explains it.

---

## Plan → implementation map

| Plan (page) | Where |
|---|---|
| Sitemap (p.5) | every route in `src/pages` — home, `/series`, `/bhabur-duniya`, `/myth`, `/initiator`, `/wall-of-fame`, `/quiz`, plus `/me`, `/id`, `/about`, `/ask`, `/teachers`, `/journal`, `/mentors`, `/search`, `/privacy`, `/code-of-conduct`, `/contact` |
| Home, mobile daily ritual + desktop hero (p.6–7) | `src/pages/index.astro`, `components/home/*` (আজকের ভাবনা flips at 08:00 Dhaka; Friday myth; quiz progress; Initiator band; bottom tabs) |
| Series page (p.8) | `/series/[slug]` — cover band, owner strip, follow/share, tabs, 4:5 grid, join-the-team, credits, sources |
| Episode page (p.9) | `/bhabur-duniya/[ep]` — player, fact box, locked 3-question quiz, 5 s next-episode countdown (cancelable), cast, parents & teachers fold, behind the scenes |
| Myth library (p.10) | `/myth`, `/myth/[slug]`, short links `/m/[id]` — Bangla fuzzy search, verdict stamps, one source line, 1:1 share card, "Dadu said" inbox |
| Quiz zone (p.11) | `/quiz`, `/quiz/weekly`, `/quiz/[slug]`, `/quiz/leaderboard` |
| Bhaba Jay ID (p.12) | `/id` — under-13 guest, 13–17 parent consent, 18+ public/private; `/parent` confirmation link |
| Profile + avatar studio (p.13) | `/me`, public `/u/[username]` |
| Tiers + Wall of Fame (p.14–15) | `/wall-of-fame` (flip cards, filters, monthly highlights), `/verify/[code]` |
| Initiator journey + pitch form (p.16–17) | `/initiator`, `/initiator/pitch` (5 steps, autosave, paper-plane submit), `/initiator/track`, core desk `/admin` |
| Design system (p.18–20) | `src/styles/global.css` (tokens, buttons with the 4 px "shadow step", tags, stamps, patterns, dark mode), `src/lib/bhabu.ts` (ভাবু + avatars), `src/lib/doodles.ts` |
| Delight (p.21) | `src/scripts/app.ts` + islands — wave hello, peek, confetti, loading ভাবু, streak flames + freeze, daily fact, sound toggle (off by default), 7-tap logo spin, "ভাবু" search → secret quiz, 404 lost in space, "ভাবা যায়!" reveal plates; `prefers-reduced-motion` respected |
| Content engine (p.22) | `scripts/import-facebook.mjs` + `.github/workflows/nightly-import.yml` |
| Bangla SEO + share cards (p.23) | `components/layout/Seo.astro` (lang="bn", canonical, hreflang, OG/Twitter), JSON-LD (FAQPage, ClaimReview, VideoObject, Quiz, Person-with-consent, LearningResource), `@astrojs/sitemap`, build-time OG PNGs (`src/lib/og.ts`) |
| Tech (p.24) | Astro 5 static + React 19 islands, Tailwind 4, Supabase, Cloudflare Pages |

---

## Architecture

```
src/
  data/           content as JSON (+ types.ts contract, validated by scripts/validate-data.mjs)
  lib/
    store.ts      local-first state: points, streaks, badges, saves, follows, prefs
    backend/      one interface, two implementations: demo.ts (browser) · supabase.ts (live)
    bhabu.ts      ভাবু + avatar SVG generator (shared by Astro, React, canvas, OG)
    search.ts     Bangla-aware fuzzy search (spelling variants + Banglish)
    share.ts      share sheet + canvas share cards (browser text shaping → correct Bangla)
    og.ts         build-time OG images: HarfBuzz shaping → glyph paths → resvg
    time.ts       Asia/Dhaka ritual clocks (08:00 thought, Sat 20:00 quiz, weekly freeze)
  components/     Astro UI + React islands (QuizPlayer, PitchForm, IdPanel, MeDashboard, …)
  scripts/app.ts  global vanilla JS (no React on content pages)
  pages/          routes
supabase/         migrations (RLS), seed, edge function (email)
scripts/          data validator, Facebook import, pattern generator, OG fonts
```

**Why our own search and not Pagefind:** Bengali has no stemmer in static-search tools, and people type variant spellings (শ্বেতি/শ্বেতী, য/জ, শ/ষ/স) or Banglish ("dudh mach"). `src/lib/search.ts` normalises both sides. The index is a static JSON file loaded lazily.

**Why HarfBuzz for OG images:** satori and resvg's own text layout break Bangla shaping (pre-base vowel signs, conjuncts). We shape with HarfBuzz (WASM), emit glyph outlines as SVG paths, and rasterise with resvg.

---

## Going live with Supabase

1. Create a project → **SQL editor**: run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
   (Or `supabase db push`.) The migration has been executed against Postgres in development; its triggers, constraints and RPCs were exercised (teen privacy, anti-cheat, pitch workflow, cascade delete).
2. **Auth → Providers:** enable Google (OAuth client) and Email (magic link). Add `https://<your-domain>/id` to redirect URLs.
3. `.env` (or Cloudflare env vars): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`.
4. Email: `supabase functions deploy notify --no-verify-jwt`; secrets `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL`, `WEBHOOK_SECRET`. Add **Database Webhooks** for `INSERT` on `notifications` and `profiles` → the function, header `x-webhook-secret`.
5. Make the core team: sign in once, then `update profiles set role='core' where id=(select id from auth.users where email='…');` → `/admin` works.
6. Recommended before launch: add Cloudflare Turnstile to the anonymous inbox forms (rate-limiting), and review the privacy and code-of-conduct drafts.

Security model: every table has row-level security; users cannot write their own role, tier, points or pitch status (column grants + triggers); teens are forced private in the database; the public tracker and comments go through `security definer` RPCs that expose no personal data.

## Deploy (Cloudflare Pages)

Build command `npm run build`, output `dist`, Node 22. `public/_headers` sets security headers (CSP allows only self, Supabase, YouTube-nocookie and Facebook embeds). Netlify works the same way.

## Editing content

Edit `src/data/*.json` (or let the nightly import open a PR), then `npm run validate:data` — it checks every field, slug, reference, Friday date, quiz shape and source URL. Myths need ≥1 source; teens in `people.json` may not expose real names or districts.

---

## Performance, accessibility, SEO

- **Home critical path ≈ 74 KB gzipped** (HTML 28 + CSS 16 + JS 30); no React on content pages — islands load only where needed (`client:visible`/`client:idle`). Web fonts (≈184 KB: Hind Siliguri 400/700 + Baloo Da 2 800, Bengali subsets) load with `font-display: swap`, so text paints immediately in the phone's Bangla font. The plan's "< 150 KB first screen" is met for the critical path but **not** if fonts are counted.
- The condensed stamp face is a 47 KB static instance cut from the 448 KB variable font.
- Mobile crawl of all 126 HTML pages: 0 JS errors, 0 broken links/assets, 0 horizontal overflow at 390 px.
- 44 px+ tap targets, 3 px yellow focus ring, skip link, landmarks, `aria-live` feedback, reduced motion, line-height 1.7 for Bangla, no letter-spacing on Bangla.
- **Contrast note for the owner:** white text on coral `#FF6B5B` (the brand's primary button, p.19) measures ≈ 2.8:1. The brand rule (≥ 16 px, bold) is followed, but WCAG AA needs a deeper coral for button faces: `#E5503F` ≈ 3.8:1 (AA for large/bold text), `#D0432F` ≈ 4.7:1 (AA for all text) — one token in `global.css`.

## Fact-check before launch

Content was written with sources but needs a human pass. Claims flagged as less certain:
vitiligo prevalence 0.5–2% (myth 1); acne in ~85% of 12–24-year-olds (myth 4); Empire State Building lightning strikes per year (myth 5); honey ≈17% water and tomb-honey anecdote (myth 7); the Lancet 1978 ORS quote, 1971 refugee-camp use and 1960s Dhaka/Kolkata research (myth 13, `ors-icddrb`); the 2002 onion-enzyme discovery (myth 15); Saturn's rings ≈300 million years (myth 17, `shonir-bolay-harabe`); blink rate (myth 6); mosquito wingbeat 300–800/s; lightning ≈28,000 °C (thought 12); Jagadish Chandra Bose details (Kolkata demo, Bikrampur, 1904 patent, crater, Bose Institute 1917); S. N. Bose details (journal rejection, Dirac coining "boson", Bangiya Bigyan Parishad); Azizul Haque details (Khulna, 1,024 pigeonholes, 1897, Khan Bahadur, Hem Chandra Bose); P. C. Ray details (Raruli, Bengal Chemical, students); African magur ban; current-jaal ban and declining haor species; Fazlur Rahman Khan's birthplace (quiz `w1114-4`); hedged claims on ilish spawning and the moon, yawning contagion age, curiosity and memory. Two posts describe Rafi's and Tanvir's field work — placeholder story copy.

## Owner decisions still open (Plan p.26)

Domain + Cloudflare account · tier names/thresholds · review team + first mentors · 3–5 "first circle" Initiators (replace the sample people) · Delta Initiatives link, logo use and referral path · final privacy and code-of-conduct text (drafts are at `/privacy` and `/code-of-conduct`).

Fonts: Hind Siliguri, Baloo Da 2, Anek Bangla, Inter — SIL Open Font License.
