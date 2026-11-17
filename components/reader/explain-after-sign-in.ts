// What the reader asked Explain about before they were sent off to sign in or sign up, so
// they come back to the same paragraph with the card open, instead of the top of the page.
// This tab only (sessionStorage), and only for a while.

const KEY = "marginalia:explain-after-sign-in";
const MAX_AGE_MS = 15 * 60 * 1000;

export type PendingExplain = { chapter: number; paragraph: number; text: string };

export function rememberExplain(pending: PendingExplain) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...pending, at: Date.now() }));
  } catch {
    // Storage off (private mode): they'll come back to the paragraph, without the card.
  }
}

/** The selection waiting in this chapter, once: reading it clears it. */
export function takeExplain(chapter: number): Omit<PendingExplain, "chapter"> | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.chapter !== chapter) return null;
    sessionStorage.removeItem(KEY);
    if (typeof p.text !== "string" || !Number.isInteger(p.paragraph) || Date.now() - p.at > MAX_AGE_MS) return null;
    return { text: p.text, paragraph: p.paragraph };
  } catch {
    return null;
  }
}

/** Where to come back to after signing in: this page, at the paragraph. */
export function returnTo(path: string, paragraph: number | null) {
  return paragraph === null ? path : `${path}#p-${paragraph}`;
}
