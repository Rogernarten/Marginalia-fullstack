/**
 * What the reader has selected inside this chapter's text (60 characters at most), and the
 * paragraph it starts in. Read it on pointer down, before a click clears the selection.
 */
export function selectionIn(chapter: number): { text: string; paragraph: number | null } {
  const selection = window.getSelection();
  const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
  const start = selection?.anchorNode?.parentElement;
  if (!start?.closest(`[data-chapter="${chapter}"]`) || !text || text.length > 60) {
    return { text: "", paragraph: null };
  }
  const paragraph = start.closest("[data-paragraph]")?.getAttribute("data-paragraph");
  return { text, paragraph: paragraph == null ? null : Number(paragraph) };
}
