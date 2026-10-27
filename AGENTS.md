<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Marginalia

A reading companion for Pride and Prejudice (Design, Build, Ship · Assignment 4: Full Stack App,
built on Assignment 3). Readers tap underlined words and period details to see layered hints,
look up anything else on Wikipedia, save words to a notebook, and come back on any device to
pick up where they stopped and keep a weekly reading goal. Flows live in `flows.md`.

## Stack

- Next.js and Tailwind CSS. Clerk for sign-in. Supabase (Postgres) for saved data. One external
  API: the Wikipedia REST summary, `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`.
- Allowed new packages: `@clerk/nextjs`, `@supabase/supabase-js`, `@playwright/test`,
  `@clerk/testing`. Push back on anything else.
- Clerk stays on development keys. Deployed on Vercel's Hobby plan.

## Constraints

- Keys live in `.env.local` (and Vercel's environment variables), never in code or commits.
  Never read, print or write any `.env*` file; ask the human to add a key.
- The browser only ever gets the Supabase publishable key. Never use the secret (service role)
  key in the app: it skips row-level security.
- The book and the hand-written hints are public and work signed out. Anything personal (the
  notebook, reading position, reading time, weekly goal) and Wikipedia lookups need sign-in.
- The hints are static data written ahead of time (`lib/notes/`), not generated at runtime.
  Hints explain; they never give a straight translation.
- Book text is Project Gutenberg #1342 in `public/book/NN.json` (one array of paragraphs per
  chapter), built by `scripts/build-book.mjs`. Italics are marked `_like this_`.

## Data model

Three tables, all in Supabase. Each row belongs to one person: `user_id` is the Clerk user id
(text like `user_2x…`, not a uuid), filled in by the database from the signed-in session with
`default (auth.jwt() ->> 'sub')`. The app never sends `user_id` itself.

**`saved_words`**: the notebook, one row per saved word.

| column | type | notes |
|---|---|---|
| `id` | uuid, pk | `default gen_random_uuid()` |
| `user_id` | text, not null | owner |
| `phrase` | text, not null | as the reader saved it |
| `phrase_key` | text, not null | `normalize(phrase)` from `lib/text.ts`; `unique (user_id, phrase_key)` so "already in your notebook" works on every device |
| `chapter` | smallint, not null | 1–61 |
| `paragraph` | int, not null | ≥ 0, index into the chapter |
| `sentence` | text, not null | the sentence it was found in |
| `note_id` | text, null | set when saved from a hand-written hint |
| `my_note` | text, not null | `default ''`, at most 280 characters |
| `wiki_page_id` | int, null | set when saved from a Wikipedia lookup |
| `wiki_title` | text, null | the article actually shown (Entail → "Fee tail") |
| `wiki_description` | text, null | one line, shown first |
| `wiki_extract` | text, null | plain-text summary, shown under "More" |
| `wiki_url` | text, null | link back to the article (attribution) |
| `saved_at` | timestamptz, not null | `default now()` |

The Wikipedia fields are a copy taken when the word is saved, so the notebook never calls
Wikipedia and still works when it's down.

**`reader_state`**: one row per person.

| column | type | notes |
|---|---|---|
| `user_id` | text, pk | owner |
| `chapter` | smallint, null | last reading position; null until they start |
| `paragraph` | int, null | |
| `position_at` | timestamptz, null | when the position was saved |
| `weekly_goal` | smallint, not null | `default 3`, 1–7 days |

**`reading_days`**: seconds read per local day, for the weekly goal and streaks.

| column | type | notes |
|---|---|---|
| `user_id` | text, not null | owner |
| `day` | date, not null | the reader's local date |
| `seconds` | int, not null | ≥ 0, ≤ 86400 |
| | | pk `(user_id, day)` |

Time is added with a `security invoker` function, `add_reading_seconds(day, seconds)`, that
does `insert … on conflict do update set seconds = seconds + excluded.seconds`, so two devices
reading on the same day add up instead of overwriting each other.

Stays out of Supabase: the half-typed add-word form (`draft`, localStorage, cleared on sign-out),
the book and the hints (static files), and Wikipedia results that weren't saved.

Code: `supabase/migrations/20261027185911_create_marginalia_tables.sql` creates all of this;
`lib/storage.ts` is the only code that reads or writes it, straight from the browser with the
Clerk session token (`accessToken` option). Its notebook and reading-day queries never filter by
user: row-level security alone decides, so the Playwright test catches a broken policy.

Writes: reading time is counted locally and sent at most once a minute and when the tab is
hidden. Reading position is sent at most every 10 seconds and when the tab is hidden.

## Row-level security

- RLS is on for every table. Each table has four policies (select, insert, update, delete) for
  the `authenticated` role, all `(select auth.jwt() ->> 'sub') = user_id`. Signed-out (`anon`)
  requests match no policy and see nothing.
- Table privileges: `anon` has none; `authenticated` has only select, insert, update and delete.
  Supabase's defaults grant more (`truncate` skips RLS), so a new table revokes the rest.
- Clerk is connected through Supabase's third-party auth; the Supabase client sends the Clerk
  session token.
- Schema changes are migrations in `supabase/migrations/`, applied through the Supabase MCP.
  Name the file with the version the MCP records (`list_migrations`). Never turn off RLS or widen a policy unless the human asks for it.

## Wikipedia

- Called only from our server: the reader's "Look it up" → `GET /api/lookup?q=` →
  `lib/wikipedia.ts` → Wikipedia. Why there: it's for signed-in readers only (so it isn't an
  open proxy), it sends a `User-Agent` (browsers can't set one), and each title is cached for
  a day for every reader (`"use cache"`, `cacheLife("days")`), so Wikipedia's rate limits are
  never a worry. Failures are never cached. The browser gives up after 8 seconds, the server
  after 5.
- Use it for things, customs and places (curricle, entail, Pemberley). It's wrong for words that
  changed meaning (want → a philosophy article, tolerable → "Toleration"); those stay with the
  hand-written hints and the reader's own note.
- Send a `User-Agent` header that names the app. Show `extract` as plain text; never render
  `extract_html` or use `dangerouslySetInnerHTML`. Always link to `content_urls.desktop.page`.
- Design every state: loading; found (`200`, `type: "standard"`); several meanings (`200`,
  `type: "disambiguation"`, not a result); nothing found (`404`); and down (timeout, 5xx,
  network error). When it's down, the reader can still save the word with their own note.

## Conventions

- Work on a branch, never on `main`. Don't push, merge or deploy without asking.
- Build every screen from the shared components in `components/ui/`. Don't hand-style a
  button, input or field inside a page.
- Every field has a visible `<label>`. Errors sit under their field, are linked with
  `aria-describedby`, and say what to do next ("Enter the word or phrase you want to save."),
  never "Invalid input". Keep what the person typed when there's an error.
- Everything works with a keyboard, with the shared `focus-visible` ring. Check new colors with
  `lib/contrast.ts` (4.5:1 for text, 3:1 for UI boundaries).
- Never interrupt reading with pop-ups. Streaks and goals stay on the home page.
