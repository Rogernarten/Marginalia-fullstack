// "context" notes explain history and customs ("Then & now"); "word" notes explain language.
export type NoteKind = "context" | "word";

export type Note = {
  id: string;
  /** Index into the chapter's paragraph array. */
  paragraph: number;
  /** Exact text as it appears in that paragraph; the first match is underlined. */
  phrase: string;
  kind: NoteKind;
  /** One line, shown first. */
  short: string;
  /** Background (context) or word notes (word), shown under "More". */
  more: string;
};

export const KIND_LABEL: Record<NoteKind, string> = {
  context: "Then & now",
  word: "Word",
};

export const MORE_LABEL: Record<NoteKind, string> = {
  context: "Background",
  word: "Word notes",
};
