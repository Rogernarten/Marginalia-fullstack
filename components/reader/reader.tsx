"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Note } from "@/lib/notes/types";
import { findWord, removeWord, useSaved, type Word } from "@/lib/storage";
import { toRuns } from "@/lib/text";
import { AddWordButton } from "./add-word-button";
import { ChapterNav } from "./chapter-nav";
import { Legend } from "./legend";
import { NoteCard } from "./note-card";
import { arrivalTarget, jumpTo, useReadingPosition, useReadingTimer } from "./reading-position";
import { useMediaQuery } from "./use-media-query";
import { WordCard } from "./word-card";

const SAVED = "saved-";

/**
 * A chapter with its underlined words (guide notes) and shaded words (ones the reader saved
 * themselves). Opening either shows it in the margin on wide screens, or in a bottom sheet on
 * small ones. Esc or × closes it and returns focus to the word.
 *
 * With `resumable`, reopening the chapter you stopped in offers to jump back to your paragraph,
 * unless you arrived with #p-N (Continue links), which jumps straight there.
 *
 * It renders its own heading and chapter links rather than taking them as elements from the
 * server page: server-made elements placed among other children here tripped React's key check
 * on some client navigations.
 */
export function Reader({
  chapter,
  paragraphs,
  notes,
  headingLevel = 1,
  resumable = false,
}: {
  chapter: number;
  paragraphs: string[];
  notes: Note[];
  /** 1 on a chapter's own page; 2 on the home page, under its own title. */
  headingLevel?: 1 | 2;
  resumable?: boolean;
}) {
  const saved = useSaved();
  const wide = useMediaQuery("(min-width: 64rem)");
  const [activeId, setActiveId] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  // The Esc listener calls the latest close(), which depends on render state.
  const closeRef = useRef(() => {});
  useReadingPosition(chapter);
  useReadingTimer();

  // Decided once, when saved data first arrives, so the offer doesn't chase the reader's scroll.
  // No offer when this visit already opens at a paragraph (a Continue link).
  const [resumeAt, setResumeAt] = useState<number | null | undefined>(undefined);
  if (saved && resumeAt === undefined) {
    const p = saved.position;
    const offer = resumable && p?.chapter === chapter && p.paragraph > 1 && arrivalTarget(chapter) === null;
    setResumeAt(offer ? p.paragraph : null);
  }

  const byParagraph = useMemo(() => {
    const map = new Map<number, Note[]>();
    for (const n of notes) map.set(n.paragraph, [...(map.get(n.paragraph) ?? []), n]);
    return map;
  }, [notes]);
  const activeNote = notes.find((n) => n.id === activeId) ?? null;
  // A removed word is kept here so its card can offer Undo after it leaves the page.
  const [removed, setRemoved] = useState<Word | null>(null);
  const activeWord = activeId?.startsWith(SAVED)
    ? (saved?.words.find((w) => SAVED + w.id === activeId) ?? (removed && SAVED + removed.id === activeId ? removed : null))
    : null;
  // A boolean, so saving or removing (which changes the word object) doesn't re-run effects.
  const isOpen = (activeNote ?? activeWord) !== null;
  // Words saved with the form (no note of their own) are shaded where they were found.
  const marks = useMemo(() => {
    const map = new Map<number, { id: string; phrase: string }[]>();
    for (const w of saved?.words ?? []) {
      if (w.chapter !== chapter || w.noteId) continue;
      map.set(w.paragraph, [...(map.get(w.paragraph) ?? []), { id: SAVED + w.id, phrase: w.phrase }]);
    }
    return map;
  }, [saved, chapter]);

  function open(id: string, el: HTMLElement) {
    trigger.current = el;
    setActiveId(id);
    setRemoved(null);
  }

  // Back to the word that was opened (re-found if Undo re-created it), or to its paragraph if
  // it was removed.
  function restoreFocus() {
    const again = [...document.querySelectorAll<HTMLElement>(`[data-chapter="${chapter}"] [data-id="${activeId}"]`)];
    const el = trigger.current?.isConnected ? trigger.current : again.find((e) => e.checkVisibility());
    if (el) el.focus();
    else if (removed) jumpTo(chapter, removed.paragraph);
  }

  function close() {
    setActiveId(null);
    setRemoved(null);
    restoreFocus();
  }

  useEffect(() => {
    closeRef.current = close;
  });

  // Show or hide the bottom sheet, and move focus to the note's heading.
  useEffect(() => {
    const dialog = sheet.current;
    if (!wide && dialog) {
      if (isOpen && !dialog.open) dialog.showModal();
      if (!isOpen && dialog.open) dialog.close();
    }
    if (isOpen) headingRef.current?.focus();
  }, [activeId, isOpen, wide]);

  // Esc closes the margin note wherever focus is (the dialog handles Esc itself).
  useEffect(() => {
    if (!isOpen || !wide) return;
    const onKey = (e: KeyboardEvent) => {
      // Something inside (the note editor) already handled this Esc.
      if (e.key === "Escape" && !e.defaultPrevented) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, wide]);

  const card = activeNote ? (
    <NoteCard
      key={activeNote.id}
      note={activeNote}
      chapter={chapter}
      paragraph={paragraphs[activeNote.paragraph]}
      headingRef={headingRef}
      onClose={close}
    />
  ) : activeWord ? (
    <WordCard
      key={activeWord.id}
      word={activeWord}
      removed={!saved?.words.some((w) => w.id === activeWord.id)}
      headingRef={headingRef}
      onRemove={() => {
        setRemoved(activeWord);
        removeWord(activeWord.id);
      }}
      onClose={close}
    />
  ) : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,38rem)_20rem] lg:gap-16">
      <article className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {headingLevel === 1 ? (
            <h1 className="font-serif text-3xl">Chapter {chapter}</h1>
          ) : (
            <h2 className="font-serif text-2xl">Chapter {chapter}</h2>
          )}
          <AddWordButton chapter={chapter} />
        </div>
        {resumeAt != null && (
          <Notice className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <span>You stopped at paragraph {resumeAt + 1} of this chapter.</span>
            <Button
              variant="secondary"
              onClick={() => {
                setResumeAt(null);
                requestAnimationFrame(() => jumpTo(chapter, resumeAt));
              }}
            >
              Jump there
            </Button>
          </Notice>
        )}
        {notes.length > 0 && <Legend className="mb-8 rounded-lg border border-rule bg-surface p-4 lg:hidden" />}
        <div data-chapter={chapter} className="font-serif text-[1.1875rem] leading-[1.75]">
          {paragraphs.map((text, i) => (
            <Paragraph
              key={i}
              index={i}
              text={text}
              notes={byParagraph.get(i) ?? []}
              marks={marks.get(i) ?? []}
              activeId={activeId}
              isSaved={(phrase) => !!saved && !!findWord(saved, phrase)}
              onOpen={open}
            />
          ))}
        </div>
        <ChapterNav chapter={chapter} />
      </article>

      <aside aria-label="Notes" className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain rounded-lg border border-rule bg-surface p-5">
          {wide && card ? (
            card
          ) : (
            <>
              <p className="eyebrow">In the margin</p>
              <p className="mt-2 font-serif text-lg leading-snug">
                {notes.length > 0
                  ? "Tap an underlined word to see what it meant in 1813."
                  : "Guide notes cover Chapters 1 to 3. Words you save here are shaded; tap one to see your note."}
              </p>
              {notes.length > 0 && <Legend className="mt-4" />}
              <p className="mt-4 font-sans text-sm leading-relaxed text-muted">
                {notes.length > 0 ? "Not underlined? " : "Found a word you don’t know? "}
                Select it in the text, then choose <strong className="font-semibold text-ink">+ Add a word</strong>.
              </p>
              {notes.length > 0 && (
                <p className="mt-2 font-sans text-sm text-muted">Using a keyboard? Tab to a word and press Enter.</p>
              )}
            </>
          )}
        </div>
      </aside>

      {!wide && (
        <dialog
          ref={sheet}
          className="sheet"
          aria-labelledby={activeNote ? `${activeNote.id}-heading` : activeWord ? `${SAVED}${activeWord.id}-heading` : undefined}
          onClose={() => activeId && close()}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          {card}
        </dialog>
      )}
    </div>
  );
}

function Paragraph({
  index,
  text,
  notes,
  marks,
  activeId,
  isSaved,
  onOpen,
}: {
  index: number;
  text: string;
  notes: Note[];
  marks: { id: string; phrase: string }[];
  activeId: string | null;
  isSaved: (phrase: string) => boolean;
  onOpen: (id: string, el: HTMLElement) => void;
}) {
  const runs = toRuns(text, [...notes, ...marks]);
  const parts: React.ReactNode[] = [];

  // Group consecutive runs that belong to the same note into one underlined word.
  for (let i = 0; i < runs.length; ) {
    const noteId = runs[i].noteId;
    let j = i;
    while (j < runs.length && runs[j].noteId === noteId) j++;
    const inner = runs.slice(i, j).map((r, k) => (r.italic ? <em key={k}>{r.text}</em> : r.text));
    const note = noteId ? notes.find((n) => n.id === noteId) : undefined;
    if (noteId?.startsWith(SAVED)) {
      parts.push(
        <OpenableWord key={i} id={noteId} kind="mine" saved active={activeId === noteId} onOpen={onOpen}>
          {inner}
        </OpenableWord>,
      );
    } else if (note) {
      parts.push(
        <OpenableWord
          key={i}
          id={note.id}
          kind={note.kind}
          saved={isSaved(note.phrase)}
          active={activeId === note.id}
          onOpen={onOpen}
        >
          {inner}
        </OpenableWord>,
      );
    } else {
      parts.push(<Fragment key={i}>{inner}</Fragment>);
    }
    i = j;
  }

  return (
    <p id={`p-${index}`} data-paragraph={index} className="mb-5 scroll-mt-24">
      {parts}
    </p>
  );
}

// A span with role="button" rather than <button>, so long phrases wrap across lines like text.
function OpenableWord({
  id,
  kind,
  active,
  saved,
  onOpen,
  children,
}: {
  id: string;
  /** "mine" is a word the reader saved themselves, shown shaded without an underline. */
  kind: Note["kind"] | "mine";
  active: boolean;
  saved: boolean;
  onOpen: (id: string, el: HTMLElement) => void;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="note-word"
      data-id={id}
      data-kind={kind}
      data-saved={saved}
      aria-expanded={active}
      onClick={(e) => onOpen(id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(id, e.currentTarget);
        }
      }}
    >
      {children}
    </span>
  );
}
