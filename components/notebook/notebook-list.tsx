"use client";

import { useEffect, useRef, useState } from "react";
import { arriveAt } from "@/components/reader/reading-position";
import { Button, LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotes } from "@/lib/notes";
import { KIND_LABEL } from "@/lib/notes/types";
import { positionHref, removeWord, restoreWord, useSaved, type Word } from "@/lib/storage";
import { arrivalWord, clearArrival } from "./arrival";
import { NoteEditor } from "./note-editor";

/** Words grouped by chapter, in reading order. Removing leaves an Undo in the word's place. */
export function NotebookList() {
  const saved = useSaved();
  const list = useRef<HTMLDivElement>(null);
  const [removed, setRemoved] = useState<Record<string, Word>>({});
  const ready = saved !== null;

  // After saving, or from "already in your notebook": show that word. Next.js re-shows this
  // page from a hidden copy and may paint the old list first, so keep trying until the word
  // is on the page, then show it once per visit.
  const count = saved?.words.length ?? 0;
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const id = arrivalWord();
    if (!id || shown.current === id) return;
    const el = list.current?.querySelector<HTMLElement>(`#${CSS.escape(`word-${id}`)}`);
    if (!el) return;
    shown.current = id;
    clearArrival();
    el.scrollIntoView({ block: "center" });
    el.classList.remove("resume-flash");
    void el.offsetWidth;
    el.classList.add("resume-flash");
  }, [ready, count]);
  // Runs when the page is hidden (and on unmount), so the next visit can show a word again.
  useEffect(
    () => () => {
      shown.current = null;
    },
    [],
  );

  if (!saved) return <Skeleton lines={10} className="max-w-[38rem]" />;

  const words = [...saved.words, ...Object.values(removed)].sort(
    (a, b) => a.chapter - b.chapter || a.paragraph - b.paragraph || a.savedAt.localeCompare(b.savedAt),
  );
  const chapters = [...new Set(words.map((w) => w.chapter))];
  const startHref = saved.position ? positionHref(saved.position) : "/read/1";

  return (
    <div ref={list} className="max-w-[38rem]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Notebook</h1>
          {count > 0 && (
            <p className="mt-2 text-muted">{`${count} ${count === 1 ? "word" : "words"}, saved on this device.`}</p>
          )}
        </div>
        {words.length > 0 && <LinkButton href="/notebook/new">+ Add a word</LinkButton>}
      </header>

      {words.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-edge bg-surface p-6">
          <h2 className="font-serif text-xl">No words yet.</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Tap an underlined word in Chapter 1 to save it, or add any word you don&apos;t know yourself.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href={startHref}>Start reading</LinkButton>
            <LinkButton variant="secondary" href="/notebook/new">
              + Add a word
            </LinkButton>
          </div>
        </div>
      ) : (
        chapters.map((chapter) => (
          <section key={chapter} aria-labelledby={`nb-ch-${chapter}`} className="mt-10">
            <h2 id={`nb-ch-${chapter}`} className="eyebrow border-b border-rule pb-2">
              Chapter {chapter}
            </h2>
            <ul className="mt-4 space-y-4">
              {words
                .filter((w) => w.chapter === chapter)
                .map((w) =>
                  removed[w.id] ? (
                    <Removed
                      key={w.id}
                      word={w}
                      onUndo={() => {
                        restoreWord(w);
                        setRemoved((r) => {
                          const next = { ...r };
                          delete next[w.id];
                          return next;
                        });
                        // Put focus back on the restored word's first action.
                        requestAnimationFrame(() =>
                          document.getElementById(`word-${w.id}`)?.querySelector<HTMLElement>("a")?.focus(),
                        );
                      }}
                    />
                  ) : (
                    <Entry
                      key={w.id}
                      word={w}
                      onRemove={() => {
                        removeWord(w.id);
                        setRemoved((r) => ({ ...r, [w.id]: w }));
                      }}
                    />
                  ),
                )}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Highlighted({ sentence, phrase }: { sentence: string; phrase: string }) {
  const at = sentence.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <mark className="rounded-sm bg-saved px-0.5 text-ink">{sentence.slice(at, at + phrase.length)}</mark>
      {sentence.slice(at + phrase.length)}
    </>
  );
}

function Entry({ word, onRemove }: { word: Word; onRemove: () => void }) {
  const note = word.noteId ? getNotes(word.chapter).find((n) => n.id === word.noteId) : undefined;
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const position = { chapter: word.chapter, paragraph: word.paragraph };

  function doneEditing() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  return (
    <li id={`word-${word.id}`} className="scroll-mt-24 rounded-lg border border-rule bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-xl">{word.phrase}</h3>
        {note && <span className="eyebrow shrink-0">{KIND_LABEL[note.kind]}</span>}
      </div>
      {note && <p className="mt-1.5 font-serif text-[1.0625rem] leading-relaxed">{note.short}</p>}
      <blockquote className="mt-3 border-l-2 border-rule pl-3 font-serif text-[1.0625rem] leading-relaxed text-muted">
        <Highlighted sentence={word.sentence} phrase={word.phrase} />
      </blockquote>

      {editing ? (
        <div className="mt-4">
          <NoteEditor word={word} onDone={doneEditing} />
        </div>
      ) : (
        word.myNote && (
          <p className="mt-3 font-sans text-[0.9375rem] leading-relaxed">
            <span className="font-semibold">Your note:</span> {word.myNote}
          </p>
        )
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LinkButton variant="secondary" href={positionHref(position)} onClick={() => arriveAt(position)}>
            Open in Chapter {word.chapter}
          </LinkButton>
          <Button
            ref={editButton}
            variant="quiet"
            onClick={() => setEditing(true)}
          >
            {word.myNote ? "Edit note" : "Add a note"}
            <span className="sr-only"> for “{word.phrase}”</span>
          </Button>
          <Button variant="quiet" onClick={onRemove}>
            Remove<span className="sr-only"> “{word.phrase}”</span>
          </Button>
        </div>
      )}
    </li>
  );
}

function Removed({ word, onUndo }: { word: Word; onUndo: () => void }) {
  const undo = useRef<HTMLButtonElement>(null);
  useEffect(() => undo.current?.focus(), []);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-edge px-5 py-3 font-sans text-[0.9375rem]">
      <span role="status">Removed “{word.phrase}”.</span>
      <Button ref={undo} variant="secondary" onClick={onUndo}>
        Undo
      </Button>
    </li>
  );
}
