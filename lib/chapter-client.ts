import { chapterFile } from "./chapters";

// Browser side: chapters are static files on this site (public/book), fetched once and cached.
const cache = new Map<number, Promise<string[]>>();

export function loadChapter(n: number): Promise<string[]> {
  let chapter = cache.get(n);
  if (!chapter) {
    chapter = fetch(`/book/${chapterFile(n)}`).then((r) => {
      if (!r.ok) throw new Error(`Chapter ${n}: ${r.status}`);
      return r.json();
    });
    chapter.catch(() => cache.delete(n));
    cache.set(n, chapter);
  }
  return chapter;
}
