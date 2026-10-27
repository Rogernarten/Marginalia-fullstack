import { chapter01 } from "./chapter-01";
import { chapter02 } from "./chapter-02";
import { chapter03 } from "./chapter-03";
import type { Note } from "./types";

const NOTES: Record<number, Note[]> = {
  1: chapter01,
  2: chapter02,
  3: chapter03,
};

export function getNotes(chapter: number): Note[] {
  return NOTES[chapter] ?? [];
}

export function hasNotes(chapter: number) {
  return getNotes(chapter).length > 0;
}
