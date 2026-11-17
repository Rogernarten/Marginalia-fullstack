"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { showInNotebook } from "@/components/notebook/arrival";
import { ExplanationSummary } from "@/components/notebook/explanation-summary";
import { Button, LinkButton } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/skeleton";
import type { Explanation, Passage } from "@/lib/explain/core";
import { SELECTION_MAX } from "@/lib/explain/shared";
import { KIND_LABEL } from "@/lib/notes/types";
import { addWord, findWord, useSaved } from "@/lib/storage";

// The server allows the model 20 seconds, plus a Wikipedia lookup or two.
const TIMEOUT_MS = 30_000;

type Result =
  | { status: "explained"; passage: Passage; explanation: Explanation }
  | { status: "not_explained" }
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "signed_out" };

/**
 * Explains what the reader selected, in the margin: what the words mean in this sentence, as
 * Austen used them, with where that came from. Asks once, as soon as it opens. The answer
 * can be saved to the notebook with the sentence.
 */
export function ExplainCard({
  chapter,
  start,
  headingRef,
  onClose,
}: {
  chapter: number;
  /** The selection the card was opened with; empty text if nothing was selected. */
  start: { text: string; paragraph: number | null };
  headingRef: React.Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const path = usePathname();
  // Loading from the start: the card asks as soon as it opens.
  const [result, setResult] = useState<Result | "loading">("loading");
  const request = useRef<AbortController | null>(null);
  const hasSelection = start.text !== "" && start.paragraph !== null;

  async function ask() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    let next: Result;
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter, paragraph: start.paragraph, selection: start.text }),
        signal: controller.signal,
      });
      next =
        res.status === 401
          ? { status: "signed_out" }
          : res.status === 400
            ? { status: "invalid" }
            : res.ok
              ? await res.json()
              : { status: "unavailable" };
    } catch {
      // Replaced by a newer request, or the card closed: nothing to show.
      if (request.current !== controller) return;
      next = { status: "unavailable" };
    } finally {
      window.clearTimeout(timer);
    }
    if (request.current === controller) setResult(next);
  }

  // Ask as soon as the card opens, and stop asking if it closes. In development React mounts
  // twice: the first request is cancelled and the second one shows.
  useEffect(() => {
    if (!isSignedIn || !hasSelection) return;
    void ask();
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per card: a new selection is a new card
  }, [isSignedIn, hasSelection]);

  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(path)}`;
  const signedOut = !isSignedIn || (result !== "loading" && result.status === "signed_out");
  const shownText = result !== "loading" && result.status === "explained" ? result.passage.selection : start.text;
  const ownNote = `/notebook/new?chapter=${chapter}&word=${encodeURIComponent(start.text)}`;

  return (
    <section aria-labelledby="explain-heading" className="font-sans">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Explain</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explanation"
          className={cx("-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-md text-2xl leading-none text-muted hover:text-ink", FOCUS)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <h2
        id="explain-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 rounded-sm font-serif text-2xl leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        {hasSelection ? `“${shownText}”` : "Explain"}
      </h2>

      {!isLoaded ? (
        <Skeleton lines={3} className="mt-4" />
      ) : signedOut ? (
        <div className="mt-3">
          <p className="font-serif text-lg leading-relaxed">
            Sign in to have words explained in the margin and keep them in your notebook.
          </p>
          <LinkButton href={signInHref} className="mt-4">
            Sign in
          </LinkButton>
        </div>
      ) : !hasSelection ? (
        <p className="mt-3 font-serif text-lg leading-relaxed">
          Select a word or a line in the text (up to {SELECTION_MAX} characters), then choose Explain. You&apos;ll
          see what it means in that sentence, as Austen used it.
        </p>
      ) : (
        <div aria-live="polite" className="mt-3">
          <Answer
            result={result}
            text={start.text}
            chapter={chapter}
            ownNote={ownNote}
            onRetry={() => {
              setResult("loading");
              void ask();
            }}
          />
        </div>
      )}
    </section>
  );
}

function Answer({
  result,
  text,
  chapter,
  ownNote,
  onRetry,
}: {
  result: Result | "loading";
  text: string;
  chapter: number;
  ownNote: string;
  onRetry: () => void;
}) {
  if (result === "loading") {
    return (
      <div>
        <p className="sr-only">Explaining “{text}”…</p>
        <Skeleton lines={3} />
        <p className="mt-3 text-sm text-muted">Reading the sentence and checking sources. This takes a few seconds.</p>
      </div>
    );
  }
  switch (result.status) {
    case "explained":
      return <Explained passage={result.passage} explanation={result.explanation} chapter={chapter} />;
    case "not_explained":
      return (
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="font-serif text-lg leading-relaxed">We couldn&apos;t explain “{text}”.</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
            Try selecting fewer words, or save it with your own note.
          </p>
          <LinkButton variant="secondary" href={ownNote} className="mt-3">
            + Add it with my note
          </LinkButton>
        </div>
      );
    case "invalid":
      return (
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="font-serif text-lg leading-relaxed">Select words from one paragraph.</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
            Explain works on a word or a line inside a single paragraph of the text. Select again, then choose Explain.
          </p>
        </div>
      );
    case "unavailable":
      return (
        <div role="alert" className="rounded-md border border-danger bg-surface px-4 py-3">
          <p className="font-medium">Explanations aren&apos;t available right now.</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
            Try again in a minute. Your notebook still works: you can save the word with your own note.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
            <LinkButton variant="quiet" href={ownNote}>
              + Add it with my note
            </LinkButton>
          </div>
        </div>
      );
    case "signed_out":
      return null;
  }
}

function Explained({ passage, explanation, chapter }: { passage: Passage; explanation: Explanation; chapter: number }) {
  const saved = useSaved();
  const [status, setStatus] = useState("");
  const existing = saved ? findWord(saved, passage.selection) : undefined;

  function save() {
    const result = addWord({
      phrase: passage.selection,
      chapter,
      paragraph: passage.paragraph,
      sentence: passage.sentence,
      myNote: "",
      explanation,
    });
    setStatus(result.ok ? `Saved “${passage.selection}” to your notebook.` : `“${passage.selection}” is already in your notebook.`);
  }

  return (
    <article aria-label={`What “${passage.selection}” means here`}>
      <p className="eyebrow">{KIND_LABEL[explanation.kind]}</p>
      <div className="mt-1">
        <ExplanationSummary explanation={explanation} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
        {existing ? (
          <>
            <p className="mr-2 flex items-center gap-2 text-[0.9375rem] font-medium">
              <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                ✓
              </span>
              In your notebook
            </p>
            <LinkButton variant="quiet" href={`/notebook#word-${existing.id}`} onClick={() => showInNotebook(existing.id)}>
              Open in notebook
            </LinkButton>
          </>
        ) : (
          <Button onClick={save}>Save to notebook</Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </article>
  );
}
