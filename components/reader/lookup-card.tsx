"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { showInNotebook } from "@/components/notebook/arrival";
import { WikiSummary } from "@/components/notebook/wiki-summary";
import { Button, ExternalLink, LinkButton } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import { TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { addWord, findWord, useSaved } from "@/lib/storage";
import { findPhrase } from "@/lib/text";
import type { Lookup, WikiPage } from "@/lib/wikipedia";

const QUERY_MAX = 80;
// Our server gives Wikipedia 5 seconds; this covers the trip to our server too.
const TIMEOUT_MS = 8000;

type Result = Lookup | { status: "signed_out" };

/**
 * Looks up what the reader selected on Wikipedia, in the margin. For things, customs and
 * places; the hand-written hints stay the guide for words that changed meaning. A found
 * article can be saved to the notebook with the sentence the word is in.
 */
export function LookupCard({
  chapter,
  paragraphs,
  start,
  headingRef,
  onClose,
}: {
  chapter: number;
  paragraphs: string[];
  /** The selection the card was opened with; empty text if nothing was selected. */
  start: { text: string; paragraph: number | null };
  headingRef: React.Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const path = usePathname();
  const [query, setQuery] = useState(start.text);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ query: string; result: Result | "loading" } | null>(null);
  const request = useRef<AbortController | null>(null);

  async function run(q: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    setShown({ query: q, result: "loading" });
    let result: Result;
    try {
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      result = res.status === 401 ? { status: "signed_out" } : res.ok ? await res.json() : { status: "unavailable" };
    } catch {
      // Replaced by a newer lookup, or the card closed: nothing to show.
      if (request.current !== controller) return;
      result = { status: "unavailable" };
    } finally {
      window.clearTimeout(timer);
    }
    if (request.current === controller) setShown({ query: q, result });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.replace(/\s+/g, " ").trim();
    if (!q) return setError("Enter the word or phrase you want to look up.");
    if (q.length > QUERY_MAX) return setError(`Shorten it to ${QUERY_MAX} characters or fewer (now ${q.length}).`);
    setError(null);
    void run(q);
  }

  // Look up the selection straight away; with nothing selected, wait for the form.
  const started = useRef(false);
  useEffect(() => {
    if (!isSignedIn || started.current || !start.text) return;
    started.current = true;
    void run(start.text);
  }, [isSignedIn, start.text]);
  useEffect(() => () => request.current?.abort(), []);

  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(path)}`;
  // Signed out here, or the session ended since (the server answered 401).
  const signedOut = !isSignedIn || (shown !== null && shown.result !== "loading" && shown.result.status === "signed_out");

  return (
    <section aria-labelledby="lookup-heading" className="font-sans">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Wikipedia</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close lookup"
          className={cx("-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-md text-2xl leading-none text-muted hover:text-ink", FOCUS)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <h2
        id="lookup-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 rounded-sm font-serif text-2xl leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        Look it up
      </h2>

      {!isLoaded ? (
        <Skeleton lines={3} className="mt-4" />
      ) : signedOut ? (
        <SignInPrompt href={signInHref} />
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            For things, customs and places of 1813, like a curricle or an entail.
          </p>
          <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
            <TextField
              id="lookup-query"
              label="Word or phrase"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              error={error}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" variant="secondary" className="self-start">
              Look up
            </Button>
          </form>
          <div aria-live="polite" className="mt-5">
            {shown && (
              <Answer
                key={shown.query}
                query={shown.query}
                result={shown.result}
                chapter={chapter}
                paragraphs={paragraphs}
                start={start}
                onRetry={() => void run(shown.query)}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SignInPrompt({ href }: { href: string }) {
  return (
    <div className="mt-3">
      <p className="font-serif text-lg leading-relaxed">
        Sign in to look things up on Wikipedia and keep them in your notebook.
      </p>
      <LinkButton href={href} className="mt-4">
        Sign in
      </LinkButton>
    </div>
  );
}

function Answer({
  query,
  result,
  chapter,
  paragraphs,
  start,
  onRetry,
}: {
  query: string;
  result: Result | "loading";
  chapter: number;
  paragraphs: string[];
  start: { text: string; paragraph: number | null };
  onRetry: () => void;
}) {
  const ownNote = `/notebook/new?chapter=${chapter}&word=${encodeURIComponent(start.text || query)}`;

  if (result === "loading") {
    return (
      <div>
        <p className="sr-only">Looking up “{query}” on Wikipedia…</p>
        <Skeleton lines={4} />
      </div>
    );
  }
  switch (result.status) {
    case "found":
      return <Found query={query} page={result.page} chapter={chapter} paragraphs={paragraphs} start={start} />;
    case "ambiguous":
      return (
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="font-serif text-lg leading-relaxed">“{query}” means several things on Wikipedia.</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
            Try a more specific phrase, such as a full name or a place, or{" "}
            <ExternalLink href={result.url}>see the list on Wikipedia</ExternalLink>.
          </p>
        </div>
      );
    case "not_found":
      return (
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="font-serif text-lg leading-relaxed">Wikipedia has no article on “{query}”.</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
            Check the spelling, or try the word without its ending. You can still save it with your own note.
          </p>
          <LinkButton variant="secondary" href={ownNote} className="mt-3">
            + Add it with my note
          </LinkButton>
        </div>
      );
    case "unavailable":
      return (
        <div role="alert" className="rounded-md border border-danger bg-surface px-4 py-3">
          <p className="font-medium">Wikipedia isn&apos;t answering right now.</p>
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

function Found({
  query,
  page,
  chapter,
  paragraphs,
  start,
}: {
  query: string;
  page: WikiPage;
  chapter: number;
  paragraphs: string[];
  start: { text: string; paragraph: number | null };
}) {
  const saved = useSaved();
  const [status, setStatus] = useState("");
  const asked = query.toLowerCase().replace(/_/g, " ");

  // Save the word where it was selected; if it was typed, where it first appears in the chapter.
  const where =
    start.text && start.paragraph != null
      ? atParagraph(paragraphs, start.paragraph, start.text)
      : findPhrase(paragraphs, query);
  const existing = saved && where ? findWord(saved, where.match) : undefined;

  function save() {
    if (!where) return;
    const result = addWord({
      phrase: where.match,
      chapter,
      paragraph: where.paragraph,
      sentence: where.sentence,
      myNote: "",
      wiki: page,
    });
    setStatus(result.ok ? `Saved “${where.match}” to your notebook.` : `“${where.match}” is already in your notebook.`);
  }

  return (
    <article aria-labelledby="lookup-title">
      {page.title.toLowerCase() !== asked && (
        <p className="text-sm text-muted">
          Showing “{page.title}” for “{query}”.
        </p>
      )}
      <h3 id="lookup-title" className="font-serif text-xl leading-snug">
        {page.title}
      </h3>
      <div className="mt-1">
        <WikiSummary page={page} id="lookup" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
        {!where ? (
          <p className="text-[0.9375rem] leading-relaxed">
            “{query}” isn&apos;t in Chapter {chapter}. To save it, select it in the text first.
          </p>
        ) : existing ? (
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
          <Button onClick={save}>Save “{where.match}” to notebook</Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </article>
  );
}

/** The selected text as the book has it in that paragraph, with its sentence. */
function atParagraph(paragraphs: string[], paragraph: number, text: string) {
  const found = findPhrase([paragraphs[paragraph] ?? ""], text);
  return found ? { ...found, paragraph } : findPhrase(paragraphs, text);
}
