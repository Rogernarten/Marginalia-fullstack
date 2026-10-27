// Safe to import anywhere, including client components.
export const CHAPTER_COUNT = 61;

export function isChapter(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= CHAPTER_COUNT;
}

export function chapterFile(n: number) {
  return `${String(n).padStart(2, "0")}.json`;
}
