-- Marginalia: the notebook, reading position and reading time. Every row belongs to one person.
--
-- user_id is the Clerk user id, the `sub` claim of the Clerk session token that Supabase
-- accepts through third-party auth. It's text ("user_2x…"), not a uuid, and the database
-- fills it in from the session: the app never sends it.

-- The notebook: one row per saved word.
create table public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  phrase text not null check (char_length(phrase) between 1 and 200),
  -- normalize(phrase) from lib/text.ts, so "already in your notebook" works on every device.
  phrase_key text not null check (char_length(phrase_key) between 1 and 200),
  chapter smallint not null check (chapter between 1 and 61),
  paragraph integer not null check (paragraph >= 0),
  sentence text not null check (char_length(sentence) <= 2000),
  -- Set when saved from a hand-written hint (lib/notes).
  note_id text check (char_length(note_id) <= 80),
  my_note text not null default '' check (char_length(my_note) <= 280),
  -- A copy of the Wikipedia summary, taken when the word was saved from a lookup.
  wiki_page_id integer,
  wiki_title text check (char_length(wiki_title) <= 300),
  wiki_description text check (char_length(wiki_description) <= 500),
  wiki_extract text check (char_length(wiki_extract) <= 5000),
  -- Shown as a link, so only ever an English Wikipedia address.
  wiki_url text check (wiki_url like 'https://en.wikipedia.org/%'),
  saved_at timestamptz not null default now(),
  unique (user_id, phrase_key)
);

-- One row per person: where they stopped, and their weekly goal.
create table public.reader_state (
  user_id text primary key default (auth.jwt() ->> 'sub'),
  chapter smallint check (chapter between 1 and 61),
  paragraph integer check (paragraph >= 0),
  position_at timestamptz,
  weekly_goal smallint not null default 3 check (weekly_goal between 1 and 7)
);

-- Seconds read per local day, for the weekly goal and streaks.
create table public.reading_days (
  user_id text not null default (auth.jwt() ->> 'sub'),
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  primary key (user_id, day)
);

-- Row-level security: each person sees and changes only their own rows. Signed-out requests
-- (the anon role) match no policy, and anon has no access to these tables at all.

alter table public.saved_words enable row level security;
alter table public.reader_state enable row level security;
alter table public.reading_days enable row level security;

create policy "Readers see their own words" on public.saved_words
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers save words as themselves" on public.saved_words
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers edit their own words" on public.saved_words
  for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers remove their own words" on public.saved_words
  for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Readers see their own state" on public.reader_state
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers create their own state" on public.reader_state
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers update their own state" on public.reader_state
  for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers delete their own state" on public.reader_state
  for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Readers see their own days" on public.reading_days
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers add their own days" on public.reading_days
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers update their own days" on public.reading_days
  for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Readers delete their own days" on public.reading_days
  for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

revoke all on public.saved_words, public.reader_state, public.reading_days from anon;
grant select, insert, update, delete on public.saved_words, public.reader_state, public.reading_days
  to authenticated;

-- Adds reading time to a day, so two devices reading on the same day add up instead of
-- overwriting each other. security invoker: it runs as the reader, so the policies above apply.
create function public.add_reading_seconds(p_day date, p_seconds integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.reading_days (day, seconds)
  values (p_day, least(greatest(p_seconds, 0), 86400))
  on conflict (user_id, day)
  do update set seconds = least(public.reading_days.seconds + excluded.seconds, 86400);
$$;

revoke execute on function public.add_reading_seconds(date, integer) from public, anon;
grant execute on function public.add_reading_seconds(date, integer) to authenticated;
