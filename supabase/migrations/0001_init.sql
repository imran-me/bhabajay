-- ═══════════════════════════════════════════════════════════════════
-- ভাবা যায়! — initial schema (Supabase / Postgres 15+)
--
-- Principles
--  • Content (series, myths, quizzes, posts) lives in Git as JSON; the
--    database only holds people, activity and workflow.
--  • Every table has row-level security. The anon key in the browser can
--    only do what these policies allow.
--  • Teen privacy is enforced HERE, not only in the UI:
--      13–17 → private, nickname + avatar only, parent must confirm
--      under 13 → no account at all (guest play stays on the device)
--  • Users cannot write their own role, tier, points or pitch status
--    (column-level grants + policies).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists citext;

create type public.age_band as enum ('13-17', '18+');
create type public.member_role as enum ('member', 'editor', 'mentor', 'core');
create type public.tier as enum ('curious', 'explorer', 'initiator', 'legend');
create type public.pitch_status as enum ('sent', 'reviewing', 'mentor', 'live', 'not_yet');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.inbox_kind as enum ('myth_tip', 'question', 'mentor', 'contact');
create type public.inbox_status as enum ('new', 'used', 'answered', 'archived');

-- ───────────────────────── schools ─────────────────────────
create table public.schools (
  id text primary key,
  name text not null,
  district text not null
);
alter table public.schools enable row level security;
create policy "schools are public" on public.schools for select using (true);

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  nickname text not null check (char_length(nickname) between 2 and 30),
  age_band public.age_band not null,
  parent_email text,
  parent_token uuid not null default gen_random_uuid(),
  parent_confirmed_at timestamptz,
  is_public boolean not null default false,
  show_real_name boolean not null default false,
  real_name text check (char_length(real_name) <= 60),
  district text,
  school_id text references public.schools (id),
  bio text check (char_length(bio) <= 60),
  avatar jsonb not null default '{"face":"wow","hat":"none","prop":"none","ground":"sun","body":"teal"}',
  role public.member_role not null default 'member',
  tier public.tier,
  points integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_active date,
  freeze_week text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teen_needs_parent check (age_band = '18+' or parent_email is not null)
);
alter table public.profiles enable row level security;

create or replace function public.is_core() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'core');
$$;

-- Teen privacy + immutable fields, enforced on every write
create or replace function public.enforce_profile_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- server-side functions (points, streaks, parent confirmation) set
  -- bj.trusted for the duration of their own statement
  if tg_op = 'UPDATE' and not public.is_core() and coalesce(current_setting('bj.trusted', true), '') <> 'on' then
    if new.age_band is distinct from old.age_band then
      raise exception 'age_band can only be changed by the core team';
    end if;
    new.role := old.role;
    new.tier := old.tier;
    new.points := old.points;
    new.streak := old.streak;
    new.best_streak := old.best_streak;
    new.parent_confirmed_at := old.parent_confirmed_at;
    new.parent_token := old.parent_token;
  end if;
  if new.age_band = '13-17' then
    new.is_public := false;
    new.show_real_name := false;
    new.real_name := null;
  end if;
  new.username := lower(new.username);
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_rules before insert or update on public.profiles
  for each row execute function public.enforce_profile_rules();

create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_core());
create policy "create own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid() or public.is_core());

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, username, nickname, age_band, parent_email, is_public, show_real_name, real_name, district, school_id, bio, avatar)
  on public.profiles to authenticated;
grant update (username, nickname, parent_email, is_public, show_real_name, real_name, district, school_id, bio, avatar)
  on public.profiles to authenticated;

-- Public-safe projection (Wall of Fame, comments, leaderboards).
-- Teens: nickname + avatar only. Place (district/school) only for adults
-- or parent-confirmed teens.
create or replace view public.public_profiles as
select
  p.username,
  p.nickname,
  p.avatar,
  p.tier,
  case when p.age_band = '18+' then p.bio end as bio,
  case when p.age_band = '18+' and p.show_real_name then p.real_name end as real_name,
  case when p.age_band = '18+' and p.is_public then p.district end as district,
  p.created_at
from public.profiles p
where p.is_public or p.tier in ('explorer', 'initiator', 'legend');
grant select on public.public_profiles to anon, authenticated;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(p_username))
     and lower(p_username) not in ('admin', 'bhabajay', 'bhabu', 'core', 'support');
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Parent confirms a teen account from the emailed link (/parent?token=…)
create or replace function public.confirm_parent(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_nick text;
begin
  perform set_config('bj.trusted', 'on', true);
  update public.profiles set parent_confirmed_at = now()
   where parent_token = p_token and parent_confirmed_at is null
   returning nickname into v_nick;
  perform set_config('bj.trusted', '', true);
  return v_nick;
end $$;
grant execute on function public.confirm_parent(uuid) to anon, authenticated;

-- One-tap "delete my data" (cascades to everything below)
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────────────────── streaks (Asia/Dhaka days) ─────────────────────────
create or replace function public.touch_activity(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  wk text := to_char(now() at time zone 'Asia/Dhaka', 'IYYY-"W"IW');
  r public.profiles%rowtype;
begin
  select * into r from public.profiles where id = p_user for update;
  if not found or r.last_active = today then return; end if;
  if r.last_active = today - 1 then
    r.streak := r.streak + 1;
  elsif r.last_active = today - 2 and coalesce(r.freeze_week, '') <> wk then
    r.streak := r.streak + 1;          -- one free "freeze" per week
    r.freeze_week := wk;
  else
    r.streak := 1;
  end if;
  update public.profiles
     set streak = r.streak, best_streak = greatest(best_streak, r.streak), last_active = today, freeze_week = r.freeze_week
   where id = p_user;
end $$;

-- ───────────────────────── quizzes ─────────────────────────
create table public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  quiz_slug text not null check (quiz_slug ~ '^[a-z0-9-]{3,60}$'),
  score integer not null check (score >= 0),
  total integer not null check (total between 1 and 50),
  points integer not null check (points >= 0),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  -- anti-cheat: +10 per right answer, +2 per attempt
  constraint score_le_total check (score <= total),
  constraint points_possible check (points <= score * 10 + (total - score) * 2)
);
create index quiz_attempts_slug on public.quiz_attempts (quiz_slug);
create unique index one_weekly_attempt on public.quiz_attempts (user_id, quiz_slug) where quiz_slug like 'weekly-%';
alter table public.quiz_attempts enable row level security;
create policy "insert own attempts" on public.quiz_attempts for insert with check (user_id = auth.uid());
create policy "read own attempts" on public.quiz_attempts for select using (user_id = auth.uid() or public.is_core());

create or replace function public.after_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('bj.trusted', 'on', true);
  update public.profiles set points = points + new.points where id = new.user_id;
  perform public.touch_activity(new.user_id);
  perform set_config('bj.trusted', '', true);
  return new;
end $$;
create trigger quiz_attempt_points after insert on public.quiz_attempts
  for each row execute function public.after_attempt();

create or replace function public.quiz_play_count(p_slug text) returns bigint
language sql stable security definer set search_path = public as $$
  select count(distinct user_id) from public.quiz_attempts where quiz_slug = p_slug;
$$;
grant execute on function public.quiz_play_count(text) to anon, authenticated;

-- Leaderboards: nicknames only; places only when allowed
create or replace function public.leaderboard(p_scope text, p_quiz text default null)
returns table (name text, sub text, score bigint, plays bigint)
language sql stable security definer set search_path = public as $$
  with a as (
    select q.*, p.nickname, p.age_band, p.parent_confirmed_at, p.district, p.school_id, p.is_public
      from public.quiz_attempts q join public.profiles p on p.id = q.user_id
     where p_quiz is null or q.quiz_slug = p_quiz or (p_quiz = 'weekly' and q.quiz_slug like 'weekly-%')
  ), placed as (
    select * from a where age_band = '18+' or parent_confirmed_at is not null
  )
  select * from (
    select nickname, case when age_band = '18+' and is_public then district end, sum(points), count(*)
      from a where p_scope = 'people' group by user_id, nickname, age_band, is_public, district
    union all
    select s.name, s.district, sum(points), count(*)
      from placed join public.schools s on s.id = placed.school_id where p_scope = 'schools' group by s.id, s.name, s.district
    union all
    select district, null, sum(points), count(*)
      from placed where p_scope = 'districts' and district is not null group by district
  ) t (name, sub, score, plays)
  order by score desc
  limit 100;
$$;
grant execute on function public.leaderboard(text, text) to anon, authenticated;

-- ───────────────────────── badges, saves, follows ─────────────────────────
create table public.user_badges (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;
create policy "read own badges" on public.user_badges for select using (user_id = auth.uid() or public.is_core());
-- self-awarded activity badges are fine; tier badges only by the core team
create policy "award badges" on public.user_badges for insert with check (
  (user_id = auth.uid() and badge_id not in ('explorer', 'initiator', 'legend', 'translator')) or public.is_core()
);

create table public.saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('post', 'myth', 'episode')),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
alter table public.saves enable row level security;
create policy "own saves" on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.follows (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  series_slug text not null,
  channel text not null default 'email' check (channel in ('email', 'push', 'none')),
  created_at timestamptz not null default now(),
  primary key (user_id, series_slug)
);
alter table public.follows enable row level security;
create policy "own follows" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── notifications (on-site; email via edge function) ─────────────────────────
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mood text not null default 'happy' check (mood in ('wow', 'happy', 'think', 'wink', 'grin')),
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ───────────────────────── pitches: পাঠানো → দেখা হচ্ছে → মেন্টর ঠিক → লাইভ ─────────────────────────
create sequence public.pitch_code_seq start 143;
create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('BJ-P-' || lpad(nextval('public.pitch_code_seq')::text, 4, '0')),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  subject text not null check (char_length(subject) <= 40),
  nickname text not null check (char_length(nickname) <= 40),
  payload jsonb not null check (pg_column_size(payload) < 16000),
  status public.pitch_status not null default 'sent',
  feedback text,
  mentor_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pitch_events (
  id bigint generated always as identity primary key,
  pitch_id uuid not null references public.pitches (id) on delete cascade,
  status public.pitch_status not null,
  note text,
  at timestamptz not null default now()
);
alter table public.pitches enable row level security;
alter table public.pitch_events enable row level security;

-- teens can pitch only after a parent confirmed the account
create policy "pitch as yourself" on public.pitches for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and (p.age_band = '18+' or p.parent_confirmed_at is not null)
  )
);
create policy "read own pitches" on public.pitches for select using (user_id = auth.uid() or public.is_core());
create policy "core reviews pitches" on public.pitches for update using (public.is_core());
revoke insert, update on public.pitches from anon, authenticated;
grant insert (title, subject, nickname, payload) on public.pitches to authenticated;
grant update (status, feedback, mentor_name) on public.pitches to authenticated; -- policy limits to core
create policy "read own pitch events" on public.pitch_events for select using (
  exists (select 1 from public.pitches x where x.id = pitch_id and (x.user_id = auth.uid() or public.is_core()))
);

create or replace function public.pitch_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mood text; v_title text; v_body text;
begin
  if tg_op = 'INSERT' then
    insert into public.pitch_events (pitch_id, status) values (new.id, 'sent');
    insert into public.notifications (user_id, mood, title, body, href)
      values (new.user_id, 'wow', 'পিচ পৌঁছেছে!', 'ট্র্যাকার নম্বর ' || new.code || '। ৭ দিনের মধ্যে জানাব।', '/initiator/track?code=' || new.code);
    return new;
  end if;
  if new.status is distinct from old.status then
    new.updated_at := now();
    insert into public.pitch_events (pitch_id, status, note) values (new.id, new.status, new.feedback);
    v_mood := case new.status when 'reviewing' then 'think' when 'mentor' then 'happy' when 'live' then 'wow' when 'not_yet' then 'think' else 'wink' end;
    v_title := case new.status when 'reviewing' then 'দেখা হচ্ছে' when 'mentor' then 'মেন্টর ঠিক!' when 'live' then 'সিরিজ লাইভ!' when 'not_yet' then 'এখনো না' else 'পাঠানো' end;
    v_body := case new.status
      when 'reviewing' then 'কোর টিম "' || new.title || '" দেখছে: বিষয়ের মিল, তথ্য, নিরাপত্তা।'
      when 'mentor' then 'অভিনন্দন! মেন্টর: ' || coalesce(new.mentor_name, '—') || '। ব্র্যান্ড কিট ইমেইলে গেছে।'
      when 'live' then '"' || new.title || '" এখন লাইভ!'
      when 'not_yet' then coalesce(new.feedback, 'একটা ছোট প্রথম ধাপ সাজেস্ট করেছি — যেকোনো সময় আবার পিচ করো।')
      else '' end;
    insert into public.notifications (user_id, mood, title, body, href)
      values (new.user_id, v_mood, v_title, v_body, '/initiator/track?code=' || new.code);
    if new.status = 'mentor' then
      perform set_config('bj.trusted', 'on', true);
      insert into public.user_badges (user_id, badge_id) values (new.user_id, 'explorer') on conflict do nothing;
      update public.profiles set tier = 'explorer' where id = new.user_id and (tier is null or tier = 'curious');
      perform set_config('bj.trusted', '', true);
    end if;
  end if;
  return new;
end $$;
create trigger pitch_after_insert after insert on public.pitches for each row execute function public.pitch_log();
create trigger pitch_before_update before update on public.pitches for each row execute function public.pitch_log();

-- Public tracker: status only, no personal data
create or replace function public.pitch_status(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'code', p.code, 'status', p.status, 'title', p.title, 'createdAt', p.created_at, 'updatedAt', p.updated_at,
    'feedback', p.feedback, 'mentorName', p.mentor_name,
    'history', coalesce((select json_agg(json_build_object('status', e.status, 'at', e.at) order by e.at) from public.pitch_events e where e.pitch_id = p.id), '[]'::json)
  ) from public.pitches p where p.code = upper(p_code);
$$;
grant execute on function public.pitch_status(text) to anon, authenticated;

-- ───────────────────────── comments (moderated) ─────────────────────────
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('myth', 'thought', 'post', 'episode')),
  target_id text not null check (char_length(target_id) <= 80),
  body text not null check (char_length(body) between 3 and 400 and body !~* '(https?://|www\.)'),
  status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index comments_target on public.comments (target_type, target_id, status);
alter table public.comments enable row level security;
create policy "comment as yourself" on public.comments for insert with check (user_id = auth.uid());
create policy "read own or core" on public.comments for select using (user_id = auth.uid() or public.is_core());
create policy "core moderates" on public.comments for update using (public.is_core());
revoke insert, update on public.comments from anon, authenticated;
grant insert (target_type, target_id, body) on public.comments to authenticated;
grant update (status) on public.comments to authenticated; -- policy limits to core

create or replace function public.list_comments(p_type text, p_id text)
returns table (id uuid, nickname text, avatar jsonb, body text, status public.moderation_status, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, p.nickname, p.avatar, c.body, c.status, c.created_at, c.user_id = auth.uid()
    from public.comments c join public.profiles p on p.id = c.user_id
   where c.target_type = p_type and c.target_id = p_id and (c.status = 'approved' or c.user_id = auth.uid())
   order by c.created_at;
$$;
grant execute on function public.list_comments(text, text) to anon, authenticated;

-- ───────────────────────── inbox: "Dadu said", Ask ভাবু, mentors, contact ─────────────────────────
create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  kind public.inbox_kind not null,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  fields jsonb not null check (pg_column_size(fields) < 4000),
  status public.inbox_status not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.inbox enable row level security;
create policy "anyone can write to the inbox" on public.inbox for insert to anon, authenticated with check (status = 'new');
create policy "core reads inbox" on public.inbox for select using (public.is_core());
create policy "core triages inbox" on public.inbox for update using (public.is_core());
revoke insert, update on public.inbox from anon, authenticated;
grant insert (kind, fields) on public.inbox to anon, authenticated;
grant update (status) on public.inbox to authenticated; -- policy limits to core

-- ───────────────────────── Wall of Fame credentials (/verify/BJ-2026-014) ─────────────────────────
create table public.credentials (
  verify_code text primary key check (verify_code ~ '^BJ-\d{4}-\d{3}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier public.tier not null,
  series_slug text,
  issued_at date not null default current_date
);
alter table public.credentials enable row level security;
create policy "credentials are public" on public.credentials for select using (true);
create policy "core issues credentials" on public.credentials for all using (public.is_core()) with check (public.is_core());
