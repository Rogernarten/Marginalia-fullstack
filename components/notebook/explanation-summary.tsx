"use client";

import { Fragment } from "react";
import { arriveAt } from "@/components/reader/reading-position";
import { ExternalLink, TextLink } from "@/components/ui/button";
import type { Explanation, Source } from "@/lib/explain/core";
import { positionHref } from "@/lib/storage";

/**
 * An explanation from Explain: the meaning first, then the background, then what it was based
 * on and that a model wrote it. Used in the margin, on a saved word and in the notebook.
 */
export function ExplanationSummary({ explanation }: { explanation: Explanation }) {
  const sources = explanation.sources.filter(shown);
  return (
    <div>
      <p className="font-serif text-lg leading-relaxed">{explanation.meaning}</p>
      {explanation.background && (
        <p className="mt-2 font-serif text-base leading-relaxed">{explanation.background}</p>
      )}
      <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
        Written by AI for this sentence, so it can be wrong. From{" "}
        {sources.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && (i === sources.length - 1 ? " and " : ", ")}
            <SourceLink source={s} />
          </Fragment>
        ))}
        .
      </p>
    </div>
  );
}

function SourceLink({ source }: { source: Source }) {
  switch (source.kind) {
    case "sentence":
      return <>the sentence itself</>;
    case "wikipedia":
      return <ExternalLink href={source.url}>Wikipedia: {source.title}</ExternalLink>;
    case "book": {
      const position = { chapter: source.chapter, paragraph: source.paragraph };
      return (
        <TextLink href={positionHref(position)} onClick={() => arriveAt(position)}>
          Chapter {source.chapter}, paragraph {source.paragraph + 1}
        </TextLink>
      );
    }
  }
}

// Saved explanations come back from the reader's own notebook row: link only to Wikipedia
// articles and to real places in the book, never to anything else a row might hold.
function shown(s: Source) {
  if (s.kind === "wikipedia") return typeof s.url === "string" && s.url.startsWith("https://en.wikipedia.org/");
  if (s.kind === "book") return Number.isInteger(s.chapter) && Number.isInteger(s.paragraph);
  return s.kind === "sentence";
}
