import { useSyncExternalStore } from "react";
import { normalize } from "./text";

// Everything a reader saves lives under one localStorage key. Components read it with
// useSaved() and change it only through the actions below.

const KEY = "marginalia:v1";

export type Word = {
  id: string;
  phrase: string;
  chapter: number;
  paragraph: number;
  /** The sentence the word was found in, saved automatically. */
  sentence: string;
  /** Set when saved from a hint, so the notebook can show it. */
  noteId?: string;
  myNote: string;
  savedAt: string;
};

export type Saved = {
  version: 1;
  words: Word[];
  position: { chapter: number; paragraph: number; at: string } | null;
  /** Seconds read per local day, keyed YYYY-MM-DD. */
  days: Record<string, number>;
  weeklyGoal: number;
  draft: { phrase: string; chapter: number; note: string } | null;
};

const EMPTY: Saved = { version: 1, words: [], position: null, days: {}, weeklyGoal: 3, draft: null };

let cache: Saved | null = null;
let canSave = true;
const listeners = new Set<() => void>();

function isSaved(value: unknown): value is Saved {
  const v = value as Saved | null;
  return !!v && v.version === 1 && Array.isArray(v.words) && typeof v.days === "object";
}

function load(): Saved {
  if (cache) return cache;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    // Unreadable or corrupted data: start fresh rather than crash.
  }
  cache = isSaved(parsed) ? { ...EMPTY, ...parsed } : EMPTY;
  try {
    localStorage.setItem(`${KEY}:probe`, "1");
    localStorage.removeItem(`${KEY}:probe`);
  } catch {
    canSave = false;
  }
  return cache;
}

function write(update: (saved: Saved) => Saved) {
  cache = update(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    canSave = true;
  } catch {
    canSave = false;
  }
  listeners.forEach((l) => l());
}

function onOtherTab(e: StorageEvent) {
  if (e.key !== KEY) return;
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onOtherTab);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onOtherTab);
  };
}

/** Saved data right now, for event handlers and effects. Browser only. */
export function getSaved(): Saved {
  return load();
}

/** Saved data, or null while it can't be known yet (server render and hydration). */
export function useSaved(): Saved | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

function getCanSave() {
  load();
  return canSave;
}

/** False when the browser refuses to store anything (private mode, storage full). */
export function useCanSave(): boolean {
  return useSyncExternalStore(subscribe, getCanSave, () => true);
}

/** True if this device has used the app before. */
export function hasHistory(saved: Saved) {
  return saved.words.length > 0 || saved.position !== null || Object.keys(saved.days).length > 0;
}

/* ---------- Reading position ---------- */

export function setPosition(chapter: number, paragraph: number) {
  const current = load().position;
  if (current?.chapter === chapter && current.paragraph === paragraph) return;
  write((s) => ({ ...s, position: { chapter, paragraph, at: new Date().toISOString() } }));
}

/** Link that reopens a chapter at a paragraph. */
export function positionHref(position: { chapter: number; paragraph: number }) {
  return `/read/${position.chapter}#p-${position.paragraph}`;
}

/* ---------- Reading time and weekly goal ---------- */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addReadingSeconds(seconds: number) {
  const key = todayKey();
  write((s) => ({ ...s, days: { ...s.days, [key]: (s.days[key] ?? 0) + seconds } }));
}

export function setWeeklyGoal(days: number) {
  write((s) => ({ ...s, weeklyGoal: Math.min(7, Math.max(1, Math.round(days))) }));
}

/* ---------- Form draft ---------- */

/** What's typed in the save-a-word form, kept until it's saved or cleared. */
export function setDraft(draft: Saved["draft"]) {
  write((s) => ({ ...s, draft }));
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
  const existing = findWord(load(), input.phrase);
  if (existing) return { ok: false, existing };
  const word: Word = {
    ...input,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    savedAt: new Date().toISOString(),
  };
  write((s) => ({ ...s, words: [word, ...s.words] }));
  return { ok: true, word };
}

export function removeWord(id: string) {
  write((s) => ({ ...s, words: s.words.filter((w) => w.id !== id) }));
}

/** Put a removed word back (undo), keeping newest first. */
export function restoreWord(word: Word) {
  write((s) => ({
    ...s,
    words: [...s.words.filter((w) => w.id !== word.id), word].sort((a, b) =>
      b.savedAt.localeCompare(a.savedAt),
    ),
  }));
}

export function updateNote(id: string, myNote: string) {
  write((s) => ({ ...s, words: s.words.map((w) => (w.id === id ? { ...w, myNote } : w)) }));
}
