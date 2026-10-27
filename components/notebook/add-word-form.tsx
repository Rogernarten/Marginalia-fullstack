"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Button, TextLink } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { loadChapter } from "@/lib/chapter-client";
import { CHAPTER_COUNT, isChapter } from "@/lib/chapters";
import { getNotes } from "@/lib/notes";
import { addWord, findWord, getSaved, noteError, positionHref, setDraft, useSaved, type Saved } from "@/lib/storage";
import { findPhrase, normalize } from "@/lib/text";
import { showInNotebook } from "./arrival";
import { NoteCount } from "./note-editor";

type Values = { phrase: string; chapter: number; note: string };
type Field = keyof Values;
type Errors = Partial<Record<Field, React.ReactNode>>;
const ORDER: Field[] = ["phrase", "chapter", "note"];

/** Check everything at once. The chapter text is fetched to make sure the word is really there. */
async function validate(v: Values) {
  const errors: Errors = {};
  let found: ReturnType<typeof findPhrase> = null;
  const phrase = v.phrase.trim();

  if (!normalize(phrase)) {
    errors.phrase = "Enter the word or phrase you want to save.";
  } else {
    const existing = findWord(getSaved(), phrase);
    if (existing) {
      errors.phrase = (
        <>
          “{existing.phrase}” is already in your notebook.{" "}
          <TextLink
            href={`/notebook#word-${existing.id}`}
            onClick={() => showInNotebook(existing.id)}
            className="text-danger decoration-danger"
          >
            {existing.myNote ? "Open it to see your note" : "Open it to add a note"}
          </TextLink>
          .
        </>
      );
    } else {
      try {
        found = findPhrase(await loadChapter(v.chapter), phrase);
        if (!found) {
          errors.phrase = `We couldn't find “${phrase}” in Chapter ${v.chapter}. Check the spelling, or pick another chapter.`;
        }
      } catch {
        errors.phrase = `We couldn't open Chapter ${v.chapter} to check. Check your connection and try again.`;
      }
    }
  }
  const tooLong = noteError(v.note);
  if (tooLong) errors.note = tooLong;
  return { errors, found };
}

/** Starting values: a word passed from the reader, else an unsaved draft, else empty. */
function initial(saved: Saved, word: string, chapter: number | null): { values: Values; restored: boolean } {
  if (!word && saved.draft && (saved.draft.phrase || saved.draft.note)) {
    return { values: saved.draft, restored: true };
  }
  return { values: { phrase: word, chapter: chapter ?? saved.position?.chapter ?? 1, note: "" }, restored: false };
}

export function AddWordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const saved = useSaved();
  const word = (params.get("word") ?? "").slice(0, 80);
  const fromChapter = isChapter(Number(params.get("chapter"))) ? Number(params.get("chapter")) : null;

  // Next.js keeps this page alive (hidden) after you leave, so start again when the link changes.
  const linkKey = params.toString();
  const [startedFor, setStartedFor] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({ phrase: "", chapter: 1, note: "" });
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  // After the first submit, errors re-check while you type. Not on blur: clearing an error on
  // blur moved the Save button out from under the click that caused the blur.
  const recheckTimer = useRef<number | undefined>(undefined);
  const checkRun = useRef(0);
  const pointerDown = useRef(false);
  const phraseRef = useRef<HTMLInputElement>(null);
  const chapterRef = useRef<HTMLSelectElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  function focusField(field: Field) {
    ({ phrase: phraseRef, chapter: chapterRef, note: noteRef })[field].current?.focus();
  }

  if (saved && startedFor !== linkKey) {
    const start = initial(saved, word, fromChapter);
    setStartedFor(linkKey);
    setValues(start.values);
    setRestored(start.restored);
    setErrors({});
    setSubmitted(false);
  }

  if (!saved || startedFor !== linkKey) return <Skeleton lines={8} />;

  const back =
    fromChapter !== null
      ? {
          href:
            saved.position?.chapter === fromChapter ? positionHref(saved.position) : `/read/${fromChapter}`,
          label: `Back to Chapter ${fromChapter}`,
        }
      : { href: "/notebook", label: "Back to your notebook" };

  function update<K extends Field>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    setDraft(next);
    if (submitted) recheck(next);
  }

  function recheck(next: Values) {
    window.clearTimeout(recheckTimer.current);
    recheckTimer.current = window.setTimeout(async () => {
      // Mid-click: wait, so the layout can't shift between press and release.
      if (pointerDown.current) return recheck(next);
      const run = ++checkRun.current;
      const { errors: fresh } = await validate(next);
      if (run === checkRun.current) setErrors(fresh);
    }, 350);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checking) return;
    window.clearTimeout(recheckTimer.current);
    const run = ++checkRun.current; // newer than any re-check still in flight
    setSubmitted(true);
    setChecking(true);
    const { errors: next, found } = await validate(values);
    if (run !== checkRun.current) return;
    setChecking(false);
    setErrors(next);
    const firstError = ORDER.find((f) => next[f]);
    if (firstError) {
      focusField(firstError);
      return;
    }
    if (!found) return;

    const note = getNotes(values.chapter).find((n) => normalize(n.phrase) === normalize(found.match));
    const result = addWord({
      phrase: found.match,
      chapter: values.chapter,
      paragraph: found.paragraph,
      sentence: found.sentence,
      noteId: note?.id,
      myNote: values.note.trim(),
    });
    if (!result.ok) {
      setErrors({ phrase: `“${result.existing.phrase}” is already in your notebook.` });
      focusField("phrase");
      return;
    }

    setDraft(null);
    setValues({ phrase: "", chapter: values.chapter, note: "" });
    setSubmitted(false);
    setRestored(false);
    showToast({
      message: `Saved “${found.match}” to your notebook.`,
      action: { label: `Back to Chapter ${values.chapter}`, href: `/read/${values.chapter}` },
    });
    showInNotebook(result.word.id);
    router.push(`/notebook#word-${result.word.id}`);
  }

  function startOver() {
    const next = { phrase: word, chapter: fromChapter ?? saved?.position?.chapter ?? 1, note: "" };
    setValues(next);
    setDraft(null);
    setRestored(false);
    setErrors({});
    setSubmitted(false);
    focusField("phrase");
  }

  return (
    <>
      <BackLink href={back.href}>{back.label}</BackLink>
      <h1 className="mt-4 font-serif text-3xl">Save a word</h1>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
        Found a word with no note? Save it with your own. We&apos;ll find the sentence it&apos;s in.
      </p>

      {restored && (
        <Notice className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span>We kept what you typed last time.</span>
          <Button variant="quiet" onClick={startOver}>
            Start over
          </Button>
        </Notice>
      )}

      <form
        noValidate
        onSubmit={submit}
        onPointerDown={() => (pointerDown.current = true)}
        onPointerUp={() => (pointerDown.current = false)}
        onPointerCancel={() => (pointerDown.current = false)}
        className="mt-8 space-y-6"
      >
        <TextField
          ref={phraseRef}
          id="phrase"
          label="Word or phrase"
          hint="As it appears in the chapter, e.g. “Michaelmas” or “in want of”."
          required
          autoComplete="off"
          spellCheck={false}
          value={values.phrase}
          error={errors.phrase}
          onChange={(e) => update("phrase", e.target.value)}
        />
        <SelectField
          ref={chapterRef}
          id="chapter"
          label="Chapter"
          value={values.chapter}
          error={errors.chapter}
          onChange={(e) => update("chapter", Number(e.target.value))}
        >
          {Array.from({ length: CHAPTER_COUNT }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Chapter {i + 1}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          ref={noteRef}
          id="note"
          label="Your note"
          optional
          hint="What it means, or why you saved it."
          value={values.note}
          error={errors.note}
          onChange={(e) => update("note", e.target.value)}
          aside={<NoteCount note={values.note} />}
        />
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button type="submit">{checking ? `Checking Chapter ${values.chapter}…` : "Save to notebook"}</Button>
          <span className="font-sans text-sm text-muted">Saved on this device only.</span>
        </div>
      </form>
    </>
  );
}
