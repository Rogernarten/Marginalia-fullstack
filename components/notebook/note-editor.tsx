"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { NOTE_MAX, noteError, updateNote, type Word } from "@/lib/storage";

/** "12 / 280", turning red past the limit. */
export function NoteCount({ note }: { note: string }) {
  return (
    <span className={note.length > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}>
      {note.length} / {NOTE_MAX}
    </span>
  );
}

/** Edit a saved word's note in place. Used in the notebook and in the reader's margin. */
export function NoteEditor({ word, onDone }: { word: Word; onDone: () => void }) {
  const [draft, setDraft] = useState(word.myNote);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const tooLong = noteError(draft);
    if (tooLong) {
      setError(tooLong);
      return;
    }
    updateNote(word.id, draft.trim());
    onDone();
  }

  return (
    <div className="space-y-3">
      <TextAreaField
        id={`note-${word.id}`}
        label="Your note"
        value={draft}
        error={error}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          // Cancel just the edit, not the margin note or sheet around it. The reader's Esc
          // listener skips handled events; preventDefault also stops the sheet's own cancel.
          e.preventDefault();
          onDone();
        }}
        aside={<NoteCount note={draft} />}
      />
      <div className="flex gap-3">
        <Button onClick={save}>Save note</Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
