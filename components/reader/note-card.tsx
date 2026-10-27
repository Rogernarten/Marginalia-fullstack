"use client";

import { useEffect, useRef, useState } from "react";
import { NoteEditor } from "@/components/notebook/note-editor";
import { Button } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import { KIND_LABEL, MORE_LABEL, type Note } from "@/lib/notes/types";
import { addWord, findWord, removeWord, restoreWord, useSaved, type Word } from "@/lib/storage";
import { sentenceAt } from "@/lib/text";

/** The note shown in the margin (wide screens) or the bottom sheet (small screens). */
export function NoteCard({
  note,
  chapter,
  paragraph,
  headingRef,
  onClose,
}: {
  note: Note;
  chapter: number;
  /** Raw text of the paragraph the note belongs to, for saving its sentence. */
  paragraph: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const saved = useSaved();
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  // Kept after Remove so Undo can put the word back with its note.
  const [removed, setRemoved] = useState<Word | null>(null);
  const [status, setStatus] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  // Buttons swap as you save, remove and undo; keep focus on the one that replaced yours.
  const refocus = useRef<"edit" | "undo" | null>(null);
  const inNotebook = saved ? findWord(saved, note.phrase) : undefined;
  const headingId = `${note.id}-heading`;

  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target === "edit") editButton.current?.focus();
    if (target === "undo") undoButton.current?.focus();
  }, [inNotebook]);

  function save() {
    const result = addWord({
      phrase: note.phrase,
      chapter,
      paragraph: note.paragraph,
      sentence: sentenceAt(paragraph, paragraph.indexOf(note.phrase)),
      noteId: note.id,
      myNote: "",
    });
    refocus.current = "edit";
    setStatus(
      result.ok
        ? `Saved “${note.phrase}” to your notebook.`
        : `“${note.phrase}” is already in your notebook.`,
    );
  }

  function remove() {
    if (!inNotebook) return;
    setRemoved(inNotebook);
    removeWord(inNotebook.id);
    refocus.current = "undo";
    setStatus(`Removed “${note.phrase}” from your notebook.`);
  }

  function undo() {
    if (!removed) return;
    restoreWord(removed);
    setRemoved(null);
    refocus.current = "edit";
    setStatus(`Put “${note.phrase}” back in your notebook.`);
  }

  return (
    <section aria-labelledby={headingId} className="font-sans">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden="true" className="swatch font-serif text-sm tracking-normal normal-case" data-kind={note.kind}>
            Aa
          </span>
          {KIND_LABEL[note.kind]}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close note"
          className={cx("-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-md text-2xl leading-none text-muted hover:text-ink", FOCUS)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 rounded-sm font-serif text-2xl leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        {note.phrase}
      </h2>
      <p className="mt-3 font-serif text-lg leading-relaxed">{note.short}</p>

      <button
        type="button"
        aria-expanded={more}
        aria-controls={`${note.id}-more`}
        onClick={() => setMore(!more)}
        className={cx("mt-3 -ml-1 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 text-[0.9375rem] font-medium underline decoration-edge underline-offset-4 hover:decoration-ink", FOCUS)}
      >
        {more ? "Less" : "More"}
        <svg aria-hidden="true" viewBox="0 0 12 12" className={cx("size-3 transition-transform", more && "rotate-180")}>
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={`${note.id}-more`} hidden={!more} className="mt-1 border-l-2 border-rule pl-4">
        <h3 className="eyebrow">{MORE_LABEL[note.kind]}</h3>
        <p className="mt-1.5 font-serif text-base leading-relaxed">{note.more}</p>
      </div>

      {inNotebook?.myNote && !editing && (
        <div className="mt-4 rounded-md bg-paper px-3 py-2.5">
          <h3 className="eyebrow">Your note</h3>
          <p className="mt-1 font-serif text-base leading-relaxed">{inNotebook.myNote}</p>
        </div>
      )}
      {inNotebook && editing && (
        <div className="mt-4">
          <NoteEditor
            word={inNotebook}
            onDone={() => {
              setEditing(false);
              requestAnimationFrame(() => editButton.current?.focus());
            }}
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
        {inNotebook ? (
          !editing && (
            <>
              <p className="mr-2 flex items-center gap-2 text-[0.9375rem] font-medium">
                <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                  ✓
                </span>
                In your notebook
              </p>
              <Button ref={editButton} variant="secondary" onClick={() => setEditing(true)}>
                {inNotebook.myNote ? "Edit note" : "Add a note"}
              </Button>
              <Button variant="quiet" onClick={remove}>
                Remove
              </Button>
            </>
          )
        ) : removed ? (
          <>
            <p className="mr-2 text-[0.9375rem]">Removed from your notebook.</p>
            <Button ref={undoButton} variant="secondary" onClick={undo}>
              Undo
            </Button>
          </>
        ) : (
          <Button onClick={save}>Save to notebook</Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}
