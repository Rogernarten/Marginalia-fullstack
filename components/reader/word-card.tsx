"use client";

import { useEffect, useRef, useState } from "react";
import { NoteEditor } from "@/components/notebook/note-editor";
import { Button, LinkButton } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import { showInNotebook } from "@/components/notebook/arrival";
import { WikiSummary } from "@/components/notebook/wiki-summary";
import { restoreWord, type Word } from "@/lib/storage";

/**
 * A word the reader saved themselves, opened from the text: their note, editable in place.
 * After Remove the card stays open with Undo, since the shaded word has left the page.
 */
export function WordCard({
  word,
  removed,
  headingRef,
  onRemove,
  onClose,
}: {
  word: Word;
  removed: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const headingId = `saved-${word.id}-heading`;

  // Keep focus on the button that replaces the one just pressed: Remove → Undo → Edit.
  const wasRemoved = useRef(removed);
  useEffect(() => {
    if (removed) undoButton.current?.focus();
    else if (wasRemoved.current) editButton.current?.focus();
    wasRemoved.current = removed;
  }, [removed]);

  function doneEditing() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  return (
    <section aria-labelledby={headingId} className="font-sans">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden="true" className="swatch font-serif text-sm tracking-normal normal-case" data-saved="true">
            Aa
          </span>
          Your word
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
        {word.phrase}
      </h2>

      {removed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-[0.9375rem]">Removed from your notebook.</p>
          <Button
            ref={undoButton}
            variant="secondary"
            onClick={() => {
              restoreWord(word);
              setStatus(`Put “${word.phrase}” back in your notebook.`);
            }}
          >
            Undo
          </Button>
        </div>
      ) : editing ? (
        <div className="mt-4">
          <NoteEditor word={word} onDone={doneEditing} />
        </div>
      ) : (
        <>
          {word.wiki && (
            <div className="mt-3">
              <WikiSummary page={word.wiki} id={`saved-${word.id}-wiki`} />
            </div>
          )}
          {word.myNote ? (
            word.wiki ? (
              <div className="mt-4 rounded-md bg-paper px-3 py-2.5">
                <h3 className="eyebrow">Your note</h3>
                <p className="mt-1 font-serif text-base leading-relaxed">{word.myNote}</p>
              </div>
            ) : (
              <p className="mt-3 font-serif text-lg leading-relaxed">{word.myNote}</p>
            )
          ) : (
            !word.wiki && <p className="mt-3 text-[0.9375rem] text-muted">No note yet.</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
            <Button ref={editButton} variant="secondary" onClick={() => setEditing(true)}>
              {word.myNote ? "Edit note" : "Add a note"}
            </Button>
            <LinkButton variant="quiet" href={`/notebook#word-${word.id}`} onClick={() => showInNotebook(word.id)}>
              Open in notebook
            </LinkButton>
            <Button
              variant="quiet"
              onClick={() => {
                onRemove();
                setStatus(`Removed “${word.phrase}” from your notebook.`);
              }}
            >
              Remove
            </Button>
          </div>
        </>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}
