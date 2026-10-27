import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { normalize } from "./text";
import type { WikiPage } from "./wikipedia";

// Everything a reader saves lives in Supabase (three tables, see AGENTS.md) and is read and
// written only through this module. Components read an in-memory copy with useSaved() and
// change it only through the actions below, which update the copy at once, then Supabase.
//
// The browser talks to Supabase directly with the Clerk session token, and row-level security
// decides whose rows come back. Reads of the notebook and reading days never filter by user
// here, on purpose: if a policy stops doing its job, the Playwright test sees someone else's
// words and fails.
//
// <SavedSync> (components/account) calls connect() whenever who's signed in changes.

export type Word = {
  id: string;
  phrase: string;
  chapter: number;
  paragraph: number;
  /** The sentence the word was found in, saved automatically. */
  sentence: string;
  /** Set when saved from a hint, so the notebook can show it. */
  noteId?: string;
  /** Set when saved from a Wikipedia lookup: a copy, so the notebook never has to ask again. */
  wiki?: WikiPage;
  myNote: string;
  savedAt: string;
};

export type Saved = {
  words: Word[];
  position: { chapter: number; paragraph: number; at: string } | null;
  /** Seconds read per local day, keyed YYYY-MM-DD. */
  days: Record<string, number>;
  weeklyGoal: number;
  /** The half-typed add-word form. Kept on this device only, per account. */
  draft: { phrase: string; chapter: number; note: string } | null;
};

/** "ok", or why the notebook on screen may not match what's saved. */
export type SyncStatus = "ok" | "load_failed" | "save_failed";

const EMPTY: Saved = { words: [], position: null, days: {}, weeklyGoal: 3, draft: null };
const POSITION_EVERY = 10_000;
const SECONDS_EVERY = 60_000;

let session: { userId: string; db: SupabaseClient } | null = null;
let getToken: () => Promise<string | null> = async () => null;
/** null while it can't be known yet: Clerk is loading, or the notebook is being fetched. */
let cache: Saved | null = null;
let status: SyncStatus = "ok";
// Bumped on every connect, so a slow fetch for someone who has since signed out is dropped.
let generation = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------- Connecting ---------- */

/**
 * Point the store at whoever is signed in (or no one). `token` returns the current Clerk
 * session token; Supabase checks it on every request.
 */
export async function connect(userId: string | null, token: () => Promise<string | null>) {
  getToken = token;
  if ((session?.userId ?? null) === userId && cache) return;

  flushNow();
  const previous = session?.userId;
  const run = ++generation;
  if (previous) localStorage.removeItem(draftKey(previous));
  status = "ok";

  if (!userId) {
    session = null;
    cache = EMPTY;
    emit();
    return;
  }

  cache = null;
  emit();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[storage] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");
    status = "load_failed";
    emit();
    return;
  }
  session = {
    userId,
    db: createClient(url, key, {
      accessToken: () => getToken(),
      // keepalive lets the last writes finish when the tab is closing.
      global: { fetch: (input, init) => fetch(input, { ...init, keepalive: true }) },
    }),
  };
  await load(run);
}

/** Fetch everything again (after a failed save, or from "Try again"). */
export async function reload() {
  if (!session) return;
  await load(generation);
}

async function load(run: number) {
  const s = session;
  if (!s) return;
  let words, state, days;
  try {
    [words, state, days] = await Promise.all([
      s.db.from("saved_words").select("*").order("saved_at", { ascending: false }),
      // One row per person, looked up by its key.
      s.db.from("reader_state").select("*").eq("user_id", s.userId).maybeSingle(),
      s.db.from("reading_days").select("day, seconds"),
    ]);
  } catch (e) {
    words = { error: { message: (e as Error).message }, data: null };
  }
  if (run !== generation) return;
  const error = words.error ?? state?.error ?? days?.error;
  if (error || !state || !days) {
    console.error("[storage] couldn't load the notebook:", error?.message);
    status = "load_failed";
    emit();
    return;
  }
  const row = state.data as StateRow | null;
  cache = {
    words: (words.data as WordRow[]).map(toWord),
    position:
      row?.chapter != null && row.paragraph != null
        ? { chapter: row.chapter, paragraph: row.paragraph, at: row.position_at ?? new Date(0).toISOString() }
        : null,
    days: Object.fromEntries((days.data as { day: string; seconds: number }[]).map((d) => [d.day, d.seconds])),
    weeklyGoal: row?.weekly_goal ?? EMPTY.weeklyGoal,
    draft: readDraft(s.userId),
  };
  status = "ok";
  emit();
}

/* ---------- Reading ---------- */

/** Saved data right now, for event handlers and effects. Empty until it's known. */
export function getSaved(): Saved {
  return cache ?? EMPTY;
}

/** Saved data, or null while it can't be known yet (server render, sign-in, fetching). */
export function useSaved(): Saved | null {
  return useSyncExternalStore(subscribe, () => cache, () => null);
}

/** Whether what's on screen matches what's saved. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status, () => "ok");
}

/** True if this account has used the app before. */
export function hasHistory(saved: Saved) {
  return saved.words.length > 0 || saved.position !== null || Object.keys(saved.days).length > 0;
}

/* ---------- Writing ---------- */

/** Change the copy on screen. While it's still loading there's nothing to change: the fetch
 * that's under way will bring the change back once it's been sent. */
function update(change: (saved: Saved) => Saved) {
  if (!cache) return;
  cache = change(cache);
  emit();
}

/**
 * Send one change to Supabase. If it fails, say so and fetch the notebook again, so the screen
 * goes back to what's really saved.
 */
function send(label: string, request: (db: SupabaseClient) => PromiseLike<{ error: { message: string } | null }>) {
  const s = session;
  if (!s) return;
  Promise.resolve(request(s.db))
    .then(({ error }) => {
      if (error) throw new Error(error.message);
      if (session === s && status === "save_failed") {
        status = "ok";
        emit();
      }
    })
    .catch((e: Error) => {
      if (session !== s) return;
      console.error(`[storage] ${label}:`, e.message);
      status = "save_failed";
      emit();
      void reload();
    });
}

function requireSession() {
  if (!session) throw new Error("Sign in to save words.");
}

/* ---------- Reading position ---------- */

let pendingPosition: { chapter: number; paragraph: number; at: string } | null = null;
let positionTimer: number | undefined;

export function setPosition(chapter: number, paragraph: number) {
  if (!session) return;
  const current = cache?.position;
  if (current?.chapter === chapter && current.paragraph === paragraph) return;
  const position = { chapter, paragraph, at: new Date().toISOString() };
  update((s) => ({ ...s, position }));
  pendingPosition = position;
  positionTimer ??= window.setTimeout(flushPosition, POSITION_EVERY);
}

function flushPosition() {
  window.clearTimeout(positionTimer);
  positionTimer = undefined;
  const p = pendingPosition;
  pendingPosition = null;
  if (!p) return;
  send("save reading position", (db) =>
    db
      .from("reader_state")
      .upsert({ chapter: p.chapter, paragraph: p.paragraph, position_at: p.at }, { onConflict: "user_id" }),
  );
}

/** Link that reopens a chapter at a paragraph. */
export function positionHref(position: { chapter: number; paragraph: number }) {
  return `/read/${position.chapter}#p-${position.paragraph}`;
}

/* ---------- Reading time and weekly goal ---------- */

const pendingSeconds = new Map<string, number>();
let secondsTimer: number | undefined;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addReadingSeconds(seconds: number) {
  if (!session) return;
  const key = todayKey();
  update((s) => ({ ...s, days: { ...s.days, [key]: (s.days[key] ?? 0) + seconds } }));
  pendingSeconds.set(key, (pendingSeconds.get(key) ?? 0) + seconds);
  secondsTimer ??= window.setTimeout(flushSeconds, SECONDS_EVERY);
}

function flushSeconds() {
  window.clearTimeout(secondsTimer);
  secondsTimer = undefined;
  for (const [day, seconds] of pendingSeconds) {
    send("save reading time", (db) => db.rpc("add_reading_seconds", { p_day: day, p_seconds: Math.round(seconds) }));
  }
  pendingSeconds.clear();
}

/** Send what's waiting now: when the tab is hidden, and before switching accounts. */
function flushNow() {
  flushPosition();
  flushSeconds();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushNow());
  window.addEventListener("pagehide", flushNow);
}

export function setWeeklyGoal(days: number) {
  requireSession();
  const weeklyGoal = Math.min(7, Math.max(1, Math.round(days)));
  update((s) => ({ ...s, weeklyGoal }));
  send("save weekly goal", (db) => db.from("reader_state").upsert({ weekly_goal: weeklyGoal }, { onConflict: "user_id" }));
}

/* ---------- Form draft ---------- */

function draftKey(userId: string) {
  return `marginalia:draft:${userId}`;
}

function readDraft(userId: string): Saved["draft"] {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(userId)) ?? "null");
    return d && typeof d.phrase === "string" && typeof d.chapter === "number" && typeof d.note === "string" ? d : null;
  } catch {
    return null;
  }
}

/** What's typed in the save-a-word form, kept on this device until it's saved or cleared. */
export function setDraft(draft: Saved["draft"]) {
  if (!session) return;
  update((s) => ({ ...s, draft }));
  try {
    if (draft) localStorage.setItem(draftKey(session.userId), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(session.userId));
  } catch {
    // Private mode or a full disk: the draft just isn't kept.
  }
}

/* ---------- Words ---------- */

export const NOTE_MAX = 280;

/** The error for a note that's too long, or null. */
export function noteError(note: string) {
  return note.length > NOTE_MAX
    ? `Shorten your note to ${NOTE_MAX} characters or fewer (now ${note.length}).`
    : null;
}

export function findWord(saved: Saved, phrase: string) {
  const key = normalize(phrase);
  return saved.words.find((w) => normalize(w.phrase) === key);
}

export function addWord(
  input: Omit<Word, "id" | "savedAt">,
): { ok: true; word: Word } | { ok: false; existing: Word } {
  requireSession();
  const existing = findWord(getSaved(), input.phrase);
  if (existing) return { ok: false, existing };
  const word: Word = { ...input, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
  update((s) => ({ ...s, words: [word, ...s.words] }));
  send("save word", (db) => db.from("saved_words").insert(toRow(word)));
  return { ok: true, word };
}

export function removeWord(id: string) {
  requireSession();
  update((s) => ({ ...s, words: s.words.filter((w) => w.id !== id) }));
  send("remove word", (db) => db.from("saved_words").delete().eq("id", id));
}

/** Put a removed word back (undo), keeping newest first. */
export function restoreWord(word: Word) {
  requireSession();
  update((s) => ({
    ...s,
    words: [...s.words.filter((w) => w.id !== word.id), word].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  }));
  send("put word back", (db) => db.from("saved_words").insert(toRow(word)));
}

export function updateNote(id: string, myNote: string) {
  requireSession();
  update((s) => ({ ...s, words: s.words.map((w) => (w.id === id ? { ...w, myNote } : w)) }));
  send("save note", (db) => db.from("saved_words").update({ my_note: myNote }).eq("id", id));
}

/* ---------- Rows ---------- */

type WordRow = {
  id: string;
  phrase: string;
  chapter: number;
  paragraph: number;
  sentence: string;
  note_id: string | null;
  my_note: string;
  wiki_page_id: number | null;
  wiki_title: string | null;
  wiki_description: string | null;
  wiki_extract: string | null;
  wiki_url: string | null;
  saved_at: string;
};

type StateRow = {
  chapter: number | null;
  paragraph: number | null;
  position_at: string | null;
  weekly_goal: number;
};

function toWord(r: WordRow): Word {
  return {
    id: r.id,
    phrase: r.phrase,
    chapter: r.chapter,
    paragraph: r.paragraph,
    sentence: r.sentence,
    noteId: r.note_id ?? undefined,
    wiki:
      r.wiki_page_id != null && r.wiki_title && r.wiki_extract && r.wiki_url
        ? { pageId: r.wiki_page_id, title: r.wiki_title, description: r.wiki_description, extract: r.wiki_extract, url: r.wiki_url }
        : undefined,
    myNote: r.my_note,
    savedAt: r.saved_at,
  };
}

/** No user_id: the database fills it in from the session. */
function toRow(w: Word) {
  return {
    id: w.id,
    phrase: w.phrase,
    phrase_key: normalize(w.phrase),
    chapter: w.chapter,
    paragraph: w.paragraph,
    sentence: w.sentence,
    note_id: w.noteId ?? null,
    my_note: w.myNote,
    wiki_page_id: w.wiki?.pageId ?? null,
    wiki_title: w.wiki?.title ?? null,
    wiki_description: w.wiki?.description ?? null,
    wiki_extract: w.wiki?.extract ?? null,
    wiki_url: w.wiki?.url ?? null,
    saved_at: w.savedAt,
  };
}
