/**
 * What the reader has selected inside this chapter's text (`max` characters at most: 60 by
 * default, for a word or a Wikipedia title; Explain allows a line), and the paragraph it
 * starts in. Read it on pointer down, before a click clears the selection.
 */
export function selectionIn(chapter: number, max = 60): { text: string; paragraph: number | null } {
  const selection = window.getSelection();
  const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
  const start = selection?.anchorNode?.parentElement;
  if (!start?.closest(`[data-chapter="${chapter}"]`) || !text || text.length > max) {
    return { text: "", paragraph: null };
  }
  const paragraph = start.closest("[data-paragraph]")?.getAttribute("data-paragraph");
  return { text, paragraph: paragraph == null ? null : Number(paragraph) };
}
